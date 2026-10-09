import base64
import json
import hmac
import hashlib
import time
import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from backend.database import get_db, verify_password, hash_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

SECRET_KEY = os.environ.get("JWT_SECRET", "local_network_secret_key_12345")

def create_jwt(payload: Dict[str, Any]) -> str:
    """
    Generate an HMAC-SHA256 signed JSON Web Token with 1-year expiration.

    Args:
        payload (Dict[str, Any]): Dictionary of claims to include in the token body.

    Returns:
        str: Encoded and signed JWT string formatted as `header.payload.signature`.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip('=')
    payload_copy = dict(payload)
    payload_copy["exp"] = time.time() + (365 * 24 * 3600)  # 1 year expiry
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload_copy).encode()).decode().rstrip('=')
    
    msg = f"{header_b64}.{payload_b64}"
    sig = hmac.new(SECRET_KEY.encode(), msg.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip('=')
    
    return f"{msg}.{sig_b64}"

def verify_jwt(token: str) -> Optional[Dict[str, Any]]:
    """
    Validate an HMAC-SHA256 signed JWT string and return its claims if signature and expiry are valid.

    Args:
        token (str): Encoded JWT string.

    Returns:
        Optional[Dict[str, Any]]: Decoded payload dictionary if valid, or None if invalid/expired.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        msg = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(SECRET_KEY.encode(), msg.encode(), hashlib.sha256).digest()
        expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode().rstrip('=')
        
        if hmac.compare_digest(sig_b64, expected_sig_b64):
            pad = len(payload_b64) % 4
            if pad:
                payload_b64 += '=' * (4 - pad)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode())
            if payload.get("exp", 0) > time.time():
                return payload
    except Exception as e:
        print(f"JWT verify error: {e}")
        pass
    return None

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64, description="User login handle.")
    password: str = Field(..., min_length=1, description="Plaintext login password.")

@router.post("/login")
def login(req: LoginRequest) -> Dict[str, str]:
    """
    Authenticate user credentials against the SQLite database and return a JWT access token.

    Args:
        req (LoginRequest): Username and password login payload.

    Returns:
        Dict[str, str]: JWT access token and authenticated username (`{"token": str, "username": str}`).

    Raises:
        HTTPException: 401 Unauthorized if username or password does not match.
    """
    clean_username = req.username.strip()
    if not clean_username or not req.password:
        raise HTTPException(status_code=400, detail="Username and password must not be empty.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (clean_username,))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not verify_password(user["password_hash"], req.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    token = create_jwt({"sub": user["username"], "id": user["id"]})
    return {"token": token, "username": user["username"]}

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Existing account password.")
    new_password: str = Field(..., min_length=4, description="New replacement password (min 4 chars).")
    new_username: Optional[str] = Field(None, max_length=64, description="Optional new username.")

security = HTTPBearer(auto_error=False)

def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    FastAPI dependency extracting and validating the JWT bearer token from the Authorization header or query parameter.

    Args:
        request (Request): Active HTTP request object.
        credentials (Optional[HTTPAuthorizationCredentials]): Bearer token authorization wrapper.

    Returns:
        Dict[str, Any]: Decoded token payload claims for the authenticated user.

    Raises:
        HTTPException: 401 Unauthorized if token is missing, expired, or corrupted.
    """
    token = credentials.credentials if credentials else request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

@router.post("/change-password")
def change_password(req: ChangePasswordRequest, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    """
    Update the authenticated user's account password and optionally change their username.

    Args:
        req (ChangePasswordRequest): Current password, new password, and optional new username.
        current_user (Dict[str, Any]): Authenticated user claims payload from JWT.

    Returns:
        Dict[str, str]: Success confirmation message.

    Raises:
        HTTPException: 400 Bad Request if current password is wrong or new username already exists.
    """
    if not req.new_password or len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters long.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash FROM users WHERE id = ?", (current_user["id"],))
    user = cursor.fetchone()
    
    if not user or not verify_password(user["password_hash"], req.current_password):
        conn.close()
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    new_hash = hash_password(req.new_password)
    
    if req.new_username and req.new_username.strip() and req.new_username.strip() != user["username"]:
        try:
            cursor.execute(
                "UPDATE users SET password_hash = ?, username = ? WHERE id = ?",
                (new_hash, req.new_username.strip(), current_user["id"])
            )
        except Exception:
            conn.close()
            raise HTTPException(status_code=400, detail="Username already exists")
    else:
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, current_user["id"]))
        
    conn.commit()
    conn.close()
    
    return {"detail": "Credentials updated successfully"}
