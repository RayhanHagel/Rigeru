import base64
import json
import hmac
import hashlib
import time
import os
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from backend.database import get_db, verify_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

SECRET_KEY = os.environ.get("JWT_SECRET", "local_network_secret_key_12345")

def create_jwt(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip('=')
    payload["exp"] = time.time() + (365 * 24 * 3600) # 1 year expiry
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
    
    msg = f"{header_b64}.{payload_b64}"
    sig = hmac.new(SECRET_KEY.encode(), msg.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip('=')
    
    return f"{msg}.{sig_b64}"

def verify_jwt(token: str) -> dict | None:
    try:
        parts = token.split('.')
        if len(parts) != 3: return None
        header_b64, payload_b64, sig_b64 = parts
        msg = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(SECRET_KEY.encode(), msg.encode(), hashlib.sha256).digest()
        expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode().rstrip('=')
        
        if hmac.compare_digest(sig_b64, expected_sig_b64):
            # Add padding back if needed
            pad = len(payload_b64) % 4
            if pad: payload_b64 += '=' * (4 - pad)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode())
            if payload.get("exp", 0) > time.time():
                return payload
    except Exception as e:
        print(f"JWT verify error: {e}")
        pass
    return None

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
def login(req: LoginRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (req.username,))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not verify_password(user["password_hash"], req.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    token = create_jwt({"sub": user["username"], "id": user["id"]})
    return {"token": token, "username": user["username"]}

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    new_username: str = None

from fastapi import Request

security = HTTPBearer(auto_error=False)

def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials if credentials else request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

@router.post("/change-password")
def change_password(req: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    from backend.database import hash_password
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash FROM users WHERE id = ?", (current_user["id"],))
    user = cursor.fetchone()
    
    if not user or not verify_password(user["password_hash"], req.current_password):
        conn.close()
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    new_hash = hash_password(req.new_password)
    
    if req.new_username and req.new_username != user["username"]:
        try:
            cursor.execute("UPDATE users SET password_hash = ?, username = ? WHERE id = ?", (new_hash, req.new_username, current_user["id"]))
        except Exception:
            conn.close()
            raise HTTPException(status_code=400, detail="Username already exists")
    else:
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, current_user["id"]))
        
    conn.commit()
    conn.close()
    
    return {"detail": "Credentials updated successfully"}


