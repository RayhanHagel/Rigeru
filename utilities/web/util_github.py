"""
GitHub repository commit tracker utility for Rigeru.
Supports incremental immutable commit caching, fast branch head validation,
diff caching, PAT, and SSH keys.
"""
import os
import json
import uuid
import shutil
import tempfile
import subprocess
import httpx
from typing import Optional, Dict, Any, List
from backend.database import get_db

GITHUB_API_BASE = "https://api.github.com"

def get_accounts() -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, account_type, label, created_at FROM github_accounts ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_account(account_type: str, label: str, token: Optional[str] = None, ssh_key: Optional[str] = None) -> Dict[str, Any]:
    acc_id = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO github_accounts (id, account_type, label, token, ssh_key) VALUES (?, ?, ?, ?, ?)",
        (acc_id, account_type, label, token, ssh_key)
    )
    conn.commit()
    conn.close()
    return {"id": acc_id, "account_type": account_type, "label": label}

def delete_account(account_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM github_accounts WHERE id = ?", (account_id,))
    cursor.execute("UPDATE github_tracked_repos SET account_id = NULL WHERE account_id = ?", (account_id,))
    conn.commit()
    conn.close()

def get_account_credentials(account_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, account_type, label, token, ssh_key FROM github_accounts WHERE id = ?", (account_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_tracked_repos() -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.id, r.owner, r.repo, r.account_id, r.default_branch, r.is_private, r.created_at, a.label as account_label, a.account_type
        FROM github_tracked_repos r
        LEFT JOIN github_accounts a ON r.account_id = a.id
        ORDER BY r.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def track_repo(owner: str, repo: str, account_id: Optional[str] = None, default_branch: str = "main", is_private: bool = False) -> Dict[str, Any]:
    repo_id = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO github_tracked_repos (id, owner, repo, account_id, default_branch, is_private)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner, repo) DO UPDATE SET
            account_id = excluded.account_id,
            default_branch = excluded.default_branch,
            is_private = excluded.is_private
    """, (repo_id, owner, repo, account_id, default_branch, 1 if is_private else 0))
    conn.commit()
    conn.close()
    return {"id": repo_id, "owner": owner, "repo": repo, "account_id": account_id}

def untrack_repo(repo_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM github_tracked_repos WHERE id = ?", (repo_id,))
    conn.commit()
    conn.close()

def _get_api_headers(token: Optional[str] = None) -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Rigeru-GitTracker/1.0"
    }
    if token:
        clean_token = token.strip()
        if not clean_token.startswith("Bearer ") and not clean_token.startswith("token "):
            headers["Authorization"] = f"token {clean_token}"
        else:
            headers["Authorization"] = clean_token
    return headers

def fetch_branches(owner: str, repo: str, account_id: Optional[str] = None) -> List[Dict[str, Any]]:
    account = get_account_credentials(account_id) if account_id else None
    
    if not account or account.get("account_type") == "pat":
        token = account.get("token") if account else None
        headers = _get_api_headers(token)
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/branches?per_page=100"
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code != 200:
                raise Exception(f"GitHub API Error ({resp.status_code}): {resp.text}")
            return resp.json()
    
    # SSH account fallback using git ls-remote
    ssh_key = account.get("ssh_key", "")
    with tempfile.TemporaryDirectory() as temp_dir:
        key_file = os.path.join(temp_dir, "id_rsa")
        with open(key_file, "w", encoding="utf-8") as f:
            f.write(ssh_key.strip() + "\n")
        try:
            os.chmod(key_file, 0o600)
        except Exception:
            pass

        ssh_cmd = f"ssh -i \"{key_file}\" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
        env = os.environ.copy()
        env["GIT_SSH_COMMAND"] = ssh_cmd

        remote_url = f"git@github.com:{owner}/{repo}.git"
        res = subprocess.run(["git", "ls-remote", "--heads", remote_url], env=env, capture_output=True, text=True, timeout=20)
        if res.returncode != 0:
            raise Exception(f"Git SSH error: {res.stderr}")
        
        branches = []
        for line in res.stdout.strip().splitlines():
            parts = line.split()
            if len(parts) >= 2:
                ref = parts[1]
                name = ref.replace("refs/heads/", "")
                branches.append({"name": name, "commit": {"sha": parts[0]}})
        return branches

# --- CACHE HELPERS ---

def get_cached_commits(owner: str, repo: str, branch: str, limit: int = 25, offset: int = 0) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sha, short_sha, message, author_name, author_email, author_avatar, date, html_url, parents
        FROM github_commits
        WHERE owner = ? AND repo = ? AND branch = ?
        ORDER BY date DESC
        LIMIT ? OFFSET ?
    """, (owner, repo, branch, limit, offset))
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        row_dict = dict(r)
        if row_dict.get("parents"):
            try:
                row_dict["parents"] = json.loads(row_dict["parents"])
            except Exception:
                row_dict["parents"] = []
        else:
            row_dict["parents"] = []
        result.append(row_dict)
    return result

def save_commits_to_cache(owner: str, repo: str, branch: str, commits: List[Dict[str, Any]]):
    if not commits:
        return
    conn = get_db()
    cursor = conn.cursor()
    for c in commits:
        cursor.execute("""
            INSERT OR REPLACE INTO github_commits (
                owner, repo, branch, sha, short_sha, message, author_name, author_email, author_avatar, date, html_url, parents
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            owner,
            repo,
            branch,
            c.get("sha"),
            c.get("short_sha") or c.get("sha", "")[:7],
            c.get("message", ""),
            c.get("author_name", "Unknown"),
            c.get("author_email", ""),
            c.get("author_avatar"),
            c.get("date", ""),
            c.get("html_url", ""),
            json.dumps(c.get("parents", []))
        ))
    conn.commit()
    conn.close()

def get_cached_head_sha(owner: str, repo: str, branch: str) -> Optional[str]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sha FROM github_commits
        WHERE owner = ? AND repo = ? AND branch = ?
        ORDER BY date DESC
        LIMIT 1
    """, (owner, repo, branch))
    row = cursor.fetchone()
    conn.close()
    return row["sha"] if row else None

def get_cached_commit_detail(sha: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT data_json FROM github_commit_details WHERE sha = ?", (sha,))
    row = cursor.fetchone()
    conn.close()
    if row and row["data_json"]:
        try:
            return json.loads(row["data_json"])
        except Exception:
            return None
    return None

def save_commit_detail_to_cache(sha: str, data: Dict[str, Any]):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO github_commit_details (sha, data_json) VALUES (?, ?)", (sha, json.dumps(data)))
    conn.commit()
    conn.close()

# --- MAIN COMMIT FETCHER ---

def fetch_commits(owner: str, repo: str, branch: Optional[str] = None, page: int = 1, per_page: int = 25, account_id: Optional[str] = None, force_refresh: bool = False) -> Dict[str, Any]:
    account = get_account_credentials(account_id) if account_id else None
    target_branch = branch if branch else "main"
    offset = (page - 1) * per_page

    # Check cached head SHA
    cached_head = get_cached_head_sha(owner, repo, target_branch)

    # If public or PAT account, use GitHub REST API
    if not account or account.get("account_type") == "pat":
        token = account.get("token") if account else None
        headers = _get_api_headers(token)

        # 1. Quick HEAD check: if not forcing refresh and page 1, check latest remote commit
        # If the newest commit matches our cached HEAD, we can instantly return from cache
        if cached_head and not force_refresh and page == 1:
            try:
                with httpx.Client(timeout=10.0) as client:
                    head_check_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits"
                    check_resp = client.get(head_check_url, headers=headers, params={"per_page": 1, "sha": target_branch})
                    if check_resp.status_code == 200:
                        remote_latest = check_resp.json()
                        if remote_latest and remote_latest[0].get("sha") == cached_head:
                            cached_list = get_cached_commits(owner, repo, target_branch, limit=per_page, offset=offset)
                            if cached_list:
                                return {
                                    "owner": owner,
                                    "repo": repo,
                                    "branch": target_branch,
                                    "page": page,
                                    "per_page": per_page,
                                    "commits": cached_list,
                                    "cached": True
                                }
            except Exception:
                # If network fails or timeout, fall back to whatever is cached
                cached_list = get_cached_commits(owner, repo, target_branch, limit=per_page, offset=offset)
                if cached_list:
                    return {
                        "owner": owner,
                        "repo": repo,
                        "branch": target_branch,
                        "page": page,
                        "per_page": per_page,
                        "commits": cached_list,
                        "cached": True
                    }

        # 2. Fetch from GitHub API (either new commits exist, or page > 1, or forced refresh)
        params: Dict[str, Any] = {"page": page, "per_page": per_page}
        if target_branch:
            params["sha"] = target_branch

        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits"
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                # If API call fails (rate limit/offline), try returning local cache
                cached_list = get_cached_commits(owner, repo, target_branch, limit=per_page, offset=offset)
                if cached_list:
                    return {
                        "owner": owner,
                        "repo": repo,
                        "branch": target_branch,
                        "page": page,
                        "per_page": per_page,
                        "commits": cached_list,
                        "cached": True
                    }
                raise Exception(f"GitHub API Error ({resp.status_code}): {resp.text}")

            commits_data = resp.json()

            normalized = []
            for c in commits_data:
                normalized.append({
                    "sha": c.get("sha", ""),
                    "short_sha": c.get("sha", "")[:7],
                    "message": c.get("commit", {}).get("message", ""),
                    "author_name": c.get("commit", {}).get("author", {}).get("name", "Unknown"),
                    "author_email": c.get("commit", {}).get("author", {}).get("email", ""),
                    "author_avatar": (c.get("author") or {}).get("avatar_url") or None,
                    "date": c.get("commit", {}).get("author", {}).get("date", ""),
                    "html_url": c.get("html_url", f"https://github.com/{owner}/{repo}/commit/{c.get('sha')}"),
                    "parents": [p.get("sha") for p in c.get("parents", [])]
                })

            # Save immutable commits into SQLite cache
            save_commits_to_cache(owner, repo, target_branch, normalized)

            return {
                "owner": owner,
                "repo": repo,
                "branch": target_branch,
                "page": page,
                "per_page": per_page,
                "commits": normalized,
                "cached": False
            }

    # SSH key handling via local git clone/fetch mirror
    ssh_key = account.get("ssh_key", "")
    cache_root = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "cache", "git_repos")
    os.makedirs(cache_root, exist_ok=True)
    repo_cache_dir = os.path.join(cache_root, f"{owner}_{repo}")

    with tempfile.TemporaryDirectory() as temp_dir:
        key_file = os.path.join(temp_dir, "id_rsa")
        with open(key_file, "w", encoding="utf-8") as f:
            f.write(ssh_key.strip() + "\n")
        try:
            os.chmod(key_file, 0o600)
        except Exception:
            pass

        ssh_cmd = f"ssh -i \"{key_file}\" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
        env = os.environ.copy()
        env["GIT_SSH_COMMAND"] = ssh_cmd
        remote_url = f"git@github.com:{owner}/{repo}.git"

        if not os.path.exists(repo_cache_dir):
            clone_res = subprocess.run(["git", "clone", "--bare", remote_url, repo_cache_dir], env=env, capture_output=True, text=True, timeout=60)
            if clone_res.returncode != 0:
                raise Exception(f"Git clone error: {clone_res.stderr}")
        elif force_refresh or page == 1:
            subprocess.run(["git", "fetch", "--all"], cwd=repo_cache_dir, env=env, capture_output=True, text=True, timeout=30)

        target_ref = target_branch if target_branch else "HEAD"
        fmt = "%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P"
        log_cmd = ["git", "log", f"--format={fmt}", f"-n{per_page}", f"--skip={offset}", target_ref]
        log_res = subprocess.run(log_cmd, cwd=repo_cache_dir, capture_output=True, text=True, timeout=15)
        if log_res.returncode != 0:
            raise Exception(f"Git log error: {log_res.stderr}")

        normalized = []
        for line in log_res.stdout.strip().splitlines():
            if not line:
                continue
            parts = line.split("\x1f")
            if len(parts) >= 5:
                sha = parts[0]
                an = parts[1]
                ae = parts[2]
                date = parts[3]
                msg = parts[4]
                parents = parts[5].split() if len(parts) > 5 and parts[5] else []
                normalized.append({
                    "sha": sha,
                    "short_sha": sha[:7],
                    "message": msg,
                    "author_name": an,
                    "author_email": ae,
                    "author_avatar": None,
                    "date": date,
                    "html_url": f"https://github.com/{owner}/{repo}/commit/{sha}",
                    "parents": parents
                })

        save_commits_to_cache(owner, repo, target_branch, normalized)

        return {
            "owner": owner,
            "repo": repo,
            "branch": target_branch,
            "page": page,
            "per_page": per_page,
            "commits": normalized,
            "cached": False
        }

def fetch_commit_detail(owner: str, repo: str, sha: str, account_id: Optional[str] = None) -> Dict[str, Any]:
    # Check cache first — commits are immutable by SHA
    cached_detail = get_cached_commit_detail(sha)
    if cached_detail:
        return cached_detail

    account = get_account_credentials(account_id) if account_id else None

    if not account or account.get("account_type") == "pat":
        token = account.get("token") if account else None
        headers = _get_api_headers(token)
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits/{sha}"
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code != 200:
                raise Exception(f"GitHub API Error ({resp.status_code}): {resp.text}")
            data = resp.json()
            
            files = []
            for f in data.get("files", []):
                files.append({
                    "filename": f.get("filename"),
                    "status": f.get("status"),
                    "additions": f.get("additions", 0),
                    "deletions": f.get("deletions", 0),
                    "changes": f.get("changes", 0),
                    "patch": f.get("patch", "")
                })

            detail = {
                "sha": data.get("sha", sha),
                "short_sha": data.get("sha", sha)[:7],
                "message": data.get("commit", {}).get("message", ""),
                "author_name": data.get("commit", {}).get("author", {}).get("name", "Unknown"),
                "author_email": data.get("commit", {}).get("author", {}).get("email", ""),
                "author_avatar": (data.get("author") or {}).get("avatar_url") or None,
                "date": data.get("commit", {}).get("author", {}).get("date", ""),
                "html_url": data.get("html_url", ""),
                "stats": data.get("stats", {"total": 0, "additions": 0, "deletions": 0}),
                "files": files
            }
            # Cache permanently in SQLite
            save_commit_detail_to_cache(sha, detail)
            return detail

    # SSH key detail via git show
    cache_root = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "cache", "git_repos")
    repo_cache_dir = os.path.join(cache_root, f"{owner}_{repo}")
    if not os.path.exists(repo_cache_dir):
        fetch_commits(owner, repo, account_id=account_id)

    show_cmd = ["git", "show", "--patch", "--stat", sha]
    show_res = subprocess.run(show_cmd, cwd=repo_cache_dir, capture_output=True, text=True, timeout=20)
    if show_res.returncode != 0:
        raise Exception(f"Git show error: {show_res.stderr}")

    raw_diff = show_res.stdout
    detail = {
        "sha": sha,
        "short_sha": sha[:7],
        "message": f"Commit {sha[:7]}",
        "author_name": "Author",
        "author_email": "",
        "author_avatar": None,
        "date": "",
        "html_url": f"https://github.com/{owner}/{repo}/commit/{sha}",
        "stats": {"total": 0, "additions": 0, "deletions": 0},
        "raw_diff": raw_diff,
        "files": []
    }
    save_commit_detail_to_cache(sha, detail)
    return detail
