import os
import sqlite3
import json
import threading
from typing import Any, Dict, List, Optional

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "reading_library.db"))
_local = threading.local()

def get_connection() -> sqlite3.Connection:
    """
    Retrieve or initialize the thread-local SQLite connection for the reading library database.

    Returns:
        sqlite3.Connection: Thread-local SQLite connection instance with row factory enabled.
    """
    if not hasattr(_local, "conn") or _local.conn is None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS manga_library (
                title TEXT PRIMARY KEY,
                main_url TEXT,
                chapters_amount INTEGER DEFAULT 0,
                status TEXT,
                type TEXT,
                rating REAL DEFAULT 0.0,
                website TEXT,
                image TEXT,
                local_image TEXT,
                chapter_read INTEGER DEFAULT 0,
                chapter_downloaded TEXT DEFAULT '[]',
                chapters_url TEXT DEFAULT '[]',
                sort_order INTEGER DEFAULT 0,
                extra_metadata TEXT DEFAULT '{}',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS manga_tracking (
                mal_id TEXT PRIMARY KEY,
                title TEXT,
                chapters_total INTEGER DEFAULT 0,
                chapters_read INTEGER DEFAULT 0,
                image_url TEXT,
                url TEXT,
                status TEXT,
                extra_metadata TEXT DEFAULT '{}',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        _local.conn = conn
    return _local.conn

# ─────────────────────────────────────────────
# Manga Library Operations
# ─────────────────────────────────────────────

def get_all_manga() -> Dict[str, Dict[str, Any]]:
    """
    Retrieve all manga items ordered by user sort preference.

    Returns:
        Dict[str, Dict[str, Any]]: Mapping of manga title to its metadata.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM manga_library ORDER BY sort_order ASC, rowid ASC")
    rows = cursor.fetchall()
    library: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        manga_data = {
            "main_url": row["main_url"] or "",
            "chapters_amount": row["chapters_amount"] or 0,
            "status": row["status"] or "",
            "type": row["type"] or "",
            "rating": float(row["rating"] or 0.0),
            "website": row["website"] or "",
            "image": row["image"] or "",
            "local_image": row["local_image"] or "",
            "chapter_read": row["chapter_read"] if row["chapter_read"] is not None else 0,
            "chapter_downloaded": json.loads(row["chapter_downloaded"] or "[]"),
            "chapters_url": json.loads(row["chapters_url"] or "[]"),
        }
        try:
            extra = json.loads(row["extra_metadata"] or "{}")
            if isinstance(extra, dict):
                for k, v in extra.items():
                    if k not in manga_data:
                        manga_data[k] = v
        except Exception:
            pass
        library[row["title"]] = manga_data
    return library

def get_manga(title: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a single manga record by title.

    Args:
        title (str): Manga title.

    Returns:
        Optional[Dict[str, Any]]: Manga metadata dictionary or None if not found.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM manga_library WHERE title = ?", (title.strip(),))
    row = cursor.fetchone()
    if not row:
        return None
    manga_data = {
        "main_url": row["main_url"] or "",
        "chapters_amount": row["chapters_amount"] or 0,
        "status": row["status"] or "",
        "type": row["type"] or "",
        "rating": float(row["rating"] or 0.0),
        "website": row["website"] or "",
        "image": row["image"] or "",
        "local_image": row["local_image"] or "",
        "chapter_read": row["chapter_read"] if row["chapter_read"] is not None else 0,
        "chapter_downloaded": json.loads(row["chapter_downloaded"] or "[]"),
        "chapters_url": json.loads(row["chapters_url"] or "[]"),
    }
    try:
        extra = json.loads(row["extra_metadata"] or "{}")
        if isinstance(extra, dict):
            for k, v in extra.items():
                if k not in manga_data:
                    manga_data[k] = v
    except Exception:
        pass
    return manga_data

def upsert_manga(title: str, data: Dict[str, Any], sort_order: Optional[int] = None) -> None:
    """
    Insert or update a manga record in the database.

    Args:
        title (str): Manga series title.
        data (Dict[str, Any]): Dictionary of manga metadata.
        sort_order (Optional[int]): Sequence index for library sorting.
    """
    conn = get_connection()
    clean_title = title.strip()
    
    main_url = data.get("main_url", "")
    chapters_amount = int(data.get("chapters_amount") or 0)
    status = data.get("status", "")
    manga_type = data.get("type", "")
    rating = float(data.get("rating") or 0.0)
    website = data.get("website", "")
    image = data.get("image", "")
    local_image = data.get("local_image", "")
    chapter_read = int(data.get("chapter_read") or 0)
    chapter_downloaded = json.dumps(data.get("chapter_downloaded") or [])
    chapters_url = json.dumps(data.get("chapters_url") or [])

    known_keys = {
        "main_url", "chapters_amount", "status", "type", "rating",
        "website", "image", "local_image", "chapter_read",
        "chapter_downloaded", "chapters_url", "sort_order"
    }
    extra = {k: v for k, v in data.items() if k not in known_keys}
    extra_metadata = json.dumps(extra)

    with conn:
        if sort_order is None:
            cursor = conn.cursor()
            cursor.execute("SELECT sort_order FROM manga_library WHERE title = ?", (clean_title,))
            existing = cursor.fetchone()
            if existing:
                sort_order = existing[0]
            else:
                cursor.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM manga_library")
                sort_order = cursor.fetchone()[0]

        conn.execute("""
            INSERT INTO manga_library (
                title, main_url, chapters_amount, status, type, rating,
                website, image, local_image, chapter_read, chapter_downloaded,
                chapters_url, sort_order, extra_metadata, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(title) DO UPDATE SET
                main_url = excluded.main_url,
                chapters_amount = excluded.chapters_amount,
                status = excluded.status,
                type = excluded.type,
                rating = excluded.rating,
                website = excluded.website,
                image = excluded.image,
                local_image = excluded.local_image,
                chapter_read = excluded.chapter_read,
                chapter_downloaded = excluded.chapter_downloaded,
                chapters_url = excluded.chapters_url,
                sort_order = excluded.sort_order,
                extra_metadata = excluded.extra_metadata,
                updated_at = CURRENT_TIMESTAMP
        """, (
            clean_title, main_url, chapters_amount, status, manga_type, rating,
            website, image, local_image, chapter_read, chapter_downloaded,
            chapters_url, sort_order, extra_metadata
        ))

def save_entire_library(library_dict: Dict[str, Dict[str, Any]]) -> None:
    """
    Bulk update the manga library preserving key order.

    Args:
        library_dict (Dict[str, Dict[str, Any]]): Ordered dictionary of manga entries.
    """
    for idx, (title, data) in enumerate(library_dict.items()):
        upsert_manga(title, data, sort_order=idx)

def update_manga_progress(title: str, chapter_read: int) -> int:
    """
    Update the chapter_read progress for a manga title.

    Args:
        title (str): Manga title.
        chapter_read (int): Chapter number read.

    Returns:
        int: Sanitized updated chapter progress value.

    Raises:
        ValueError: If title not found in database.
    """
    conn = get_connection()
    clean_title = title.strip()
    new_progress = max(0, chapter_read)
    with conn:
        cursor = conn.cursor()
        cursor.execute("SELECT title FROM manga_library WHERE title = ?", (clean_title,))
        if not cursor.fetchone():
            raise ValueError(f"Title '{clean_title}' not found in library.")
        cursor.execute("""
            UPDATE manga_library
            SET chapter_read = ?, updated_at = CURRENT_TIMESTAMP
            WHERE title = ?
        """, (new_progress, clean_title))
    return new_progress

def delete_manga(title: str) -> None:
    """
    Delete a manga title and history from the library.

    Args:
        title (str): Manga title.

    Raises:
        ValueError: If title not found.
    """
    conn = get_connection()
    clean_title = title.strip()
    with conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM manga_library WHERE title = ?", (clean_title,))
        if cursor.rowcount == 0:
            raise ValueError("Title not found.")

def sort_manga_library(keys: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Reorder the manga library collection based on list sequence.

    Args:
        keys (List[str]): Ordered list of titles.

    Returns:
        Dict[str, Dict[str, Any]]: Reordered manga library.
    """
    conn = get_connection()
    with conn:
        for idx, key in enumerate(keys):
            conn.execute("UPDATE manga_library SET sort_order = ? WHERE title = ?", (idx, key.strip()))
    return get_all_manga()

def add_chapter_download(title: str, chapter_url: str) -> bool:
    """
    Record a downloaded chapter URL for a manga.

    Args:
        title (str): Manga title.
        chapter_url (str): Chapter URL that was compiled into PDF.

    Returns:
        bool: True if recorded successfully, False if manga not found.
    """
    conn = get_connection()
    clean_title = title.strip()
    cursor = conn.cursor()
    cursor.execute("SELECT chapter_downloaded FROM manga_library WHERE title = ?", (clean_title,))
    row = cursor.fetchone()
    if not row:
        return False
    downloaded = json.loads(row[0] or "[]")
    if chapter_url not in downloaded:
        downloaded.append(chapter_url)
        with conn:
            conn.execute("""
                UPDATE manga_library
                SET chapter_downloaded = ?, updated_at = CURRENT_TIMESTAMP
                WHERE title = ?
            """, (json.dumps(downloaded), clean_title))
    return True

# ─────────────────────────────────────────────
# Manga Tracking Operations (MAL Sync)
# ─────────────────────────────────────────────

def load_manga_tracking() -> Dict[str, Dict[str, Any]]:
    """
    Retrieve all MyAnimeList manga tracking entries.

    Returns:
        Dict[str, Dict[str, Any]]: Tracking items mapped by MAL ID.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM manga_tracking ORDER BY title ASC")
    rows = cursor.fetchall()
    tracking: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        tracking[str(row["mal_id"])] = {
            "title": row["title"] or "",
            "chapters_total": row["chapters_total"] or 0,
            "chapters_read": row["chapters_read"] or 0,
            "image_url": row["image_url"] or "",
            "url": row["url"] or "",
            "status": row["status"] or "Reading",
        }
    return tracking

def save_manga_tracking(tracking_data: Dict[str, Dict[str, Any]]) -> None:
    """
    Replace/sync all MAL manga tracking entries in the database.

    Args:
        tracking_data (Dict[str, Dict[str, Any]]): Full tracking dictionary.
    """
    conn = get_connection()
    with conn:
        for mal_id, item in tracking_data.items():
            conn.execute("""
                INSERT INTO manga_tracking (
                    mal_id, title, chapters_total, chapters_read, image_url, url, status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(mal_id) DO UPDATE SET
                    title = excluded.title,
                    chapters_total = excluded.chapters_total,
                    chapters_read = excluded.chapters_read,
                    image_url = excluded.image_url,
                    url = excluded.url,
                    status = excluded.status,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                str(mal_id),
                item.get("title", ""),
                int(item.get("chapters_total") or 0),
                int(item.get("chapters_read") or 0),
                item.get("image_url", ""),
                item.get("url", ""),
                item.get("status", "Reading"),
            ))
        if tracking_data:
            placeholders = ",".join("?" for _ in tracking_data)
            conn.execute(
                f"DELETE FROM manga_tracking WHERE mal_id NOT IN ({placeholders})",
                [str(k) for k in tracking_data.keys()]
            )
        else:
            conn.execute("DELETE FROM manga_tracking")

def update_manga_tracking_progress(mal_id: str, read: int) -> None:
    """
    Update chapter progress and auto-calculate completion status for a tracked manga.

    Args:
        mal_id (str): MyAnimeList ID.
        read (int): Chapter read count.
    """
    conn = get_connection()
    clean_id = str(mal_id)
    with conn:
        cursor = conn.cursor()
        cursor.execute("SELECT chapters_total FROM manga_tracking WHERE mal_id = ?", (clean_id,))
        row = cursor.fetchone()
        if not row:
            return
        total = row[0] or 0
        new_read = max(0, min(read, total)) if total > 0 else max(0, read)
        if total > 0 and new_read == total:
            status = "Completed"
        elif new_read > 0:
            status = "Reading"
        else:
            status = "Plan to Read"
        conn.execute("""
            UPDATE manga_tracking
            SET chapters_read = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE mal_id = ?
        """, (new_read, status, clean_id))

def delete_manga_tracking(mal_id: str) -> None:
    """
    Remove a manga series from MAL tracking.

    Args:
        mal_id (str): MyAnimeList ID.
    """
    conn = get_connection()
    with conn:
        conn.execute("DELETE FROM manga_tracking WHERE mal_id = ?", (str(mal_id),))
