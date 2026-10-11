from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from utilities.web import util_github

router = APIRouter(prefix="/api/github", tags=["GitHub Tracker"])

class AccountCreateRequest(BaseModel):
    account_type: str  # 'pat' or 'ssh'
    label: str
    token: Optional[str] = None
    ssh_key: Optional[str] = None

class TrackRepoRequest(BaseModel):
    owner: str
    repo: str
    account_id: Optional[str] = None
    default_branch: Optional[str] = "main"
    is_private: Optional[bool] = False

@router.get("/accounts")
def list_accounts():
    """List configured GitHub accounts/credentials (without exposing private keys/tokens)."""
    try:
        return {"accounts": util_github.get_accounts()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/accounts")
def create_account(req: AccountCreateRequest):
    """Add a new GitHub credential (PAT or SSH key)."""
    try:
        if req.account_type not in ("pat", "ssh"):
            raise HTTPException(status_code=400, detail="account_type must be 'pat' or 'ssh'")
        if req.account_type == "pat" and not req.token:
            raise HTTPException(status_code=400, detail="token is required for 'pat' account type")
        if req.account_type == "ssh" and not req.ssh_key:
            raise HTTPException(status_code=400, detail="ssh_key is required for 'ssh' account type")
        
        acc = util_github.add_account(
            account_type=req.account_type,
            label=req.label,
            token=req.token,
            ssh_key=req.ssh_key
        )
        return {"success": True, "account": acc}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/accounts/{account_id}")
def remove_account(account_id: str):
    """Remove a configured GitHub account credential."""
    try:
        util_github.delete_account(account_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/repos")
def list_tracked_repos():
    """List all tracked repositories."""
    try:
        return {"repos": util_github.get_tracked_repos()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/repos")
def add_tracked_repo(req: TrackRepoRequest):
    """Add or update a repository to track."""
    try:
        clean_owner = req.owner.strip()
        clean_repo = req.repo.strip()
        if not clean_owner or not clean_repo:
            raise HTTPException(status_code=400, detail="Owner and repo must not be empty")

        res = util_github.track_repo(
            owner=clean_owner,
            repo=clean_repo,
            account_id=req.account_id,
            default_branch=req.default_branch or "main",
            is_private=bool(req.is_private)
        )
        return {"success": True, "tracked": res}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/repos/{repo_id}")
def remove_tracked_repo(repo_id: str):
    """Untrack a repository."""
    try:
        util_github.untrack_repo(repo_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/branches")
def get_branches(owner: str, repo: str, account_id: Optional[str] = None):
    """Fetch branches for a repository."""
    try:
        branches = util_github.fetch_branches(owner=owner, repo=repo, account_id=account_id)
        return {"branches": branches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/commits")
def get_commits(
    owner: str,
    repo: str,
    branch: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    account_id: Optional[str] = None,
    force_refresh: bool = False
):
    """Fetch commits for a specific repository and branch with automatic incremental caching."""
    try:
        data = util_github.fetch_commits(
            owner=owner,
            repo=repo,
            branch=branch,
            page=page,
            per_page=per_page,
            account_id=account_id,
            force_refresh=force_refresh
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/commit-detail")
def get_commit_detail(owner: str, repo: str, sha: str, account_id: Optional[str] = None):
    """Fetch commit diff and file changes."""
    try:
        detail = util_github.fetch_commit_detail(
            owner=owner,
            repo=repo,
            sha=sha,
            account_id=account_id
        )
        return detail
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
