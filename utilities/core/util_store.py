import sqlite3
import json
import os
import threading
from typing import Any, Callable, List

DB_FILE = os.path.join("data", "configs.db")
_local = threading.local()

def _get_conn() -> sqlite3.Connection:
    """
    Retrieve or initialize the thread-local SQLite database connection.

    Returns:
        sqlite3.Connection: Thread-local SQLite connection instance.
    """
    # Keep one connection per thread to avoid SQLite cross-thread issues
    if not hasattr(_local, "conn"):
        os.makedirs(os.path.dirname(DB_FILE) or ".", exist_ok=True)
        conn = sqlite3.connect(DB_FILE)
        conn.execute("CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)")
        conn.commit()
        _local.conn = conn
    return _local.conn

def get_data(key: str, default_factory: Any = dict) -> Any:
    """
    Retrieve and JSON-deserialize configuration or state data from the SQLite key-value store.

    Args:
        key (str): Setting or configuration key name.
        default_factory (Any, optional): Fallback value or constructor if key is not found. Defaults to dict.

    Returns:
        Any: Deserialized JSON data or default value.
    """
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

def set_data(key: str, data: Any) -> None:
    """
    Serialize data to JSON and store it under the specified key in the SQLite store.

    Args:
        key (str): Configuration key name.
        data (Any): JSON-serializable object payload.

    Returns:
        None
    """
    conn = _get_conn()
    with conn:
        conn.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)", (key, json.dumps(data, indent=4)))

def get_all_keys() -> list[str]:
    """
    Return a list of all stored configuration key names sorted alphabetically.

    Returns:
        list[str]: Array of store key strings.
    """
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT key FROM store ORDER BY key")
    return [row[0] for row in cursor.fetchall()]

def delete_data(key: str) -> None:
    """
    Delete a specific key and its data from the SQLite store.

    Args:
        key (str): Configuration key name to remove.

    Returns:
        None
    """
    conn = _get_conn()
    with conn:
        conn.execute("DELETE FROM store WHERE key = ?", (key,))
