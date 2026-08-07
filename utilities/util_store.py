import sqlite3
import json
import os
import threading

DB_FILE = os.path.join("data", "configs.db")
_local = threading.local()

def _get_conn():
    # Keep one connection per thread to avoid SQLite cross-thread issues
    if not hasattr(_local, "conn"):
        os.makedirs(os.path.dirname(DB_FILE) or ".", exist_ok=True)
        conn = sqlite3.connect(DB_FILE)
        conn.execute("CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)")
        conn.commit()
        _local.conn = conn
    return _local.conn

def get_data(key: str, default_factory=dict):
    """Retrieves data from the SQLite store, parsed as JSON."""
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM store WHERE key = ?", (key,))
    row = cursor.fetchone()
    if row:
        try:
            return json.loads(row[0])
        except Exception:
            return default_factory() if callable(default_factory) else default_factory
    return default_factory() if callable(default_factory) else default_factory

def set_data(key: str, data):
    """Saves data to the SQLite store as a JSON string."""
    conn = _get_conn()
    with conn:
        conn.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)", (key, json.dumps(data, indent=4)))

def get_all_keys():
    """Returns a list of all configuration keys."""
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT key FROM store ORDER BY key")
    return [row[0] for row in cursor.fetchall()]

def delete_data(key: str):
    """Deletes a key from the store."""
    conn = _get_conn()
    with conn:
        conn.execute("DELETE FROM store WHERE key = ?", (key,))
