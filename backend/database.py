import sqlite3
import os
import secrets
import hashlib

DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")

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
