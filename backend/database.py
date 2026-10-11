import sqlite3
import os
import secrets
import hashlib

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "users.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            token TEXT
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS kanban_tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL, -- 'todo', 'in_progress', 'done'
            due_date TEXT, -- ISO format string
            google_event_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS github_accounts (
            id TEXT PRIMARY KEY,
            account_type TEXT NOT NULL, -- 'pat' or 'ssh'
            label TEXT NOT NULL,
            token TEXT,
            ssh_key TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS github_tracked_repos (
            id TEXT PRIMARY KEY,
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            account_id TEXT, -- foreign key to github_accounts if private
            default_branch TEXT DEFAULT 'main',
            is_private INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner, repo)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS github_commits (
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            branch TEXT NOT NULL,
            sha TEXT NOT NULL,
            short_sha TEXT NOT NULL,
            message TEXT NOT NULL,
            author_name TEXT,
            author_email TEXT,
            author_avatar TEXT,
            date TEXT NOT NULL,
            html_url TEXT,
            parents TEXT, -- JSON string
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (owner, repo, sha)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS github_commit_details (
            sha TEXT PRIMARY KEY,
            data_json TEXT NOT NULL, -- full file diffs and stats
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    
    # Check if we need to create the default admin
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    
    if count == 0:
        # Create default admin:admin
        # In a real app we'd use bcrypt, but SHA256 with a salt is fine for local
        salt = secrets.token_hex(16)
        pwd_hash = hashlib.sha256(("admin" + salt).encode()).hexdigest()
        stored_password = f"{salt}${pwd_hash}"
        
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", ("admin", stored_password))
        conn.commit()
        print("[Auth] Created default 'admin' user with password 'admin'")
        
    conn.close()

def verify_password(stored_password, provided_password):
    try:
        salt, pwd_hash = stored_password.split("$")
        return pwd_hash == hashlib.sha256((provided_password + salt).encode()).hexdigest()
    except ValueError:
        return False

def hash_password(password):
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${pwd_hash}"

init_db()
