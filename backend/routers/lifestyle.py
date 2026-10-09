import os
import sys
import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from backend.database import get_db
from backend.routers.auth import get_current_user
from utilities.productivity_lifestyle.util_korean_srs import get_due_cards, get_all_cards, review_card, get_stats, scrape_wikipedia_cloze
from utilities.productivity_lifestyle.util_qr import generate_qr, scan_qr_from_base64

router = APIRouter(prefix="/api/lifestyle", tags=["Lifestyle"])

class KanbanTask(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Task headline.")
    description: Optional[str] = Field("", description="Detailed task notes.")
    status: str = Field(..., min_length=1, max_length=50, description="Column identifier (e.g., 'todo', 'in_progress', 'done').")
    due_date: Optional[str] = Field(None, description="ISO date string for task deadline.")
    
class KanbanUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="Updated headline.")
    description: Optional[str] = Field(None, description="Updated notes.")
    status: Optional[str] = Field(None, min_length=1, max_length=50, description="Updated column status.")
    due_date: Optional[str] = Field(None, description="Updated ISO deadline.")

@router.get("/kanban")
def get_tasks(user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """
    Retrieve all active and archived Kanban board tasks.

    Args:
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        List[Dict[str, Any]]: Array of Kanban task objects ordered by creation timestamp.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM kanban_tasks ORDER BY created_at DESC")
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return tasks

@router.post("/kanban")
def create_task(task: KanbanTask, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Create a new task card on the user's Kanban board.

    Args:
        task (KanbanTask): Task details including title, status, description, and due date.
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        Dict[str, Any]: Newly created task record with assigned UUID.
    """
    conn = get_db()
    cursor = conn.cursor()
    task_id = str(uuid.uuid4())
    
    cursor.execute(
        "INSERT INTO kanban_tasks (id, title, description, status, due_date) VALUES (?, ?, ?, ?, ?)",
        (task_id, task.title.strip(), task.description, task.status.strip(), task.due_date)
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM kanban_tasks WHERE id = ?", (task_id,))
    new_task = dict(cursor.fetchone())
    conn.close()
    return new_task

@router.put("/kanban/{task_id}")
def update_task(task_id: str, update: KanbanUpdate, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Update field values on an existing Kanban task card.

    Args:
        task_id (str): UUID of the target task.
        update (KanbanUpdate): Partial update attributes.
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        Dict[str, Any]: Updated task database record.

    Raises:
        HTTPException: 404 Not Found if task ID does not exist.
    """
    clean_id = task_id.strip()
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM kanban_tasks WHERE id = ?", (clean_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
        
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        conn.close()
        return {"detail": "No fields to update"}
        
    query = "UPDATE kanban_tasks SET " + ", ".join([f"{k} = ?" for k in update_data.keys()]) + " WHERE id = ?"
    params = list(update_data.values()) + [clean_id]
    
    cursor.execute(query, params)
    conn.commit()
    
    cursor.execute("SELECT * FROM kanban_tasks WHERE id = ?", (clean_id,))
    updated_task = dict(cursor.fetchone())
    conn.close()
    
    return updated_task

@router.delete("/kanban/{task_id}")
def delete_task(task_id: str, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    """
    Delete a task card permanently from the Kanban database.

    Args:
        task_id (str): UUID of the task to delete.
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        Dict[str, str]: Confirmation message (`{"detail": "Task deleted"}`).
    """
    clean_id = task_id.strip()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM kanban_tasks WHERE id = ?", (clean_id,))
    conn.commit()
    conn.close()
    return {"detail": "Task deleted"}

@router.post("/kanban/sync-calendar")
def sync_calendar(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    """
    Synchronize Kanban task deadlines with connected Google Calendar account.

    Args:
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        Dict[str, str]: Status message reporting synchronization outcome.

    Raises:
        HTTPException: 400 Bad Request if Google credentials.json is not configured.
    """
    creds_path = os.path.join(os.path.dirname(__file__), "..", "..", "credentials.json")
    if not os.path.exists(creds_path):
        raise HTTPException(
            status_code=400, 
            detail="Missing credentials.json. Please create a Google Cloud Project, enable the Google Calendar API, create an OAuth 2.0 Client ID for a Desktop app, download the JSON file, rename it to credentials.json, and place it in the root folder of this project."
        )
    return {"detail": "Calendar synced successfully (mock implementation for testing)"}

# --- Korean SRS ---
class ReviewRequest(BaseModel):
    card_id: str = Field(..., min_length=1, description="Unique flashcard ID.")
    quality: int = Field(..., ge=0, le=5, description="SM-2 recall rating (0 to 5).")

@router.get("/korean-srs/next")
def get_next_korean_cards(limit: int = 20, user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """
    Fetch the next batch of Korean SRS flashcards due for spaced-repetition review.

    Args:
        limit (int, optional): Maximum count of cards to fetch. Defaults to 20.
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        List[Dict[str, Any]]: List of flashcard records due for study.
    """
    safe_limit = max(1, min(limit, 100))
    return get_due_cards(safe_limit)

@router.get("/korean-srs/all")
def get_all_korean_cards(user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """
    Retrieve all Korean vocabulary flashcards across all review tiers.

    Args:
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        List[Dict[str, Any]]: Complete list of Korean vocabulary cards.
    """
    return get_all_cards()

@router.post("/korean-srs/review")
def review_korean_card(req: ReviewRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Submit a review grade for a flashcard and calculate its next repetition interval using SM-2.

    Args:
        req (ReviewRequest): Flashcard ID and SM-2 quality score (0-5).
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        Dict[str, Any]: Updated card scheduling metrics.

    Raises:
        HTTPException: 404 Not Found if card does not exist.
    """
    res = review_card(req.card_id.strip(), req.quality)
    if not res:
        raise HTTPException(status_code=404, detail="Card not found")
    return res

@router.get("/korean-srs/stats")
def get_korean_stats(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Compute spaced repetition study metrics, retention rates, and interval distributions.

    Args:
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        Dict[str, Any]: Summary dictionary with total, due, learned, and mature counts.
    """
    return get_stats()

@router.post("/korean-srs/generate-cloze")
def generate_cloze(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Scrape Korean Wikipedia to generate a dynamic cloze-deletion sentence flashcard.

    Args:
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        Dict[str, Any]: Generated cloze sentence, missing word, and translation prompt.

    Raises:
        HTTPException: 500 Internal Server Error if scraping fails.
    """
    res = scrape_wikipedia_cloze()
    if not res:
        raise HTTPException(status_code=500, detail="Failed to generate cloze card from Wikipedia")
    return res

# --- QR Code ---
class QRGenerateRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Payload text or URL to encode in the QR code.")
    fill_color: str = Field("black", description="Foreground pixel color.")
    back_color: str = Field("white", description="Background canvas color.")

@router.post("/qr-generate")
def qr_generate_endpoint(req: QRGenerateRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    """
    Generate a QR code image encoded as a Base64 data URL.

    Args:
        req (QRGenerateRequest): Target text and styling colors.
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        Dict[str, str]: Base64 image data URL (`{"data_url": str}`).

    Raises:
        HTTPException: 500 if QR rendering fails.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    try:
        qr_data_url = generate_qr(req.text, req.fill_color, req.back_color)
        return {"data_url": qr_data_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate QR code: {e}")

class QRScanRequest(BaseModel):
    image: str = Field(..., min_length=1, description="Base64 encoded image string to decode.")

@router.post("/qr-scan")
def qr_scan_endpoint(req: QRScanRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    """
    Decode textual payload from an uploaded Base64 QR code image.

    Args:
        req (QRScanRequest): Base64 image payload.
        user (Dict[str, Any]): Authenticated user session claims.

    Returns:
        Dict[str, str]: Decoded text content (`{"text": str}`).

    Raises:
        HTTPException: 500 if scanning or decoding fails.
    """
    if not req.image.strip():
        raise HTTPException(status_code=400, detail="Image data cannot be empty.")
    try:
        decoded_text = scan_qr_from_base64(req.image)
        return {"text": decoded_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan QR code: {e}")
