import sys
sys.coinit_flags = 0  # Force MTA (Multi-Threaded Apartment) for COM to fix bleak issues

import json
import os

CACHE_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache", "models")
os.makedirs(CACHE_MODELS_DIR, exist_ok=True)
os.environ["HF_HOME"] = os.path.join(CACHE_MODELS_DIR, "huggingface")
os.environ["TORCH_HOME"] = os.path.join(CACHE_MODELS_DIR, "torch")
os.environ["YOLO_CONFIG_DIR"] = os.path.join(CACHE_MODELS_DIR, "ultralytics")
os.environ["INSIGHTFACE_HOME"] = os.path.join(CACHE_MODELS_DIR, "insightface")

import sys
import asyncio
import warnings

# Suppress Pyannote/Torchcodec & PyTorch Lightning warnings globally
warnings.filterwarnings("ignore", module="pyannote.audio.core.io")
warnings.filterwarnings("ignore", category=UserWarning, module="lightning")

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .routers import auth, media_entertainment, web_downloads, files_documents, home, price_monitor, currency_view, settings, media_vision, subtitles_metadata, system_network, lifestyle, system_upload, virtual_camera, pinhole_camera, quickmachine
from fastapi import Depends
from .routers.auth import get_current_user

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        pass
    except Exception as e:
        print(f"Failed during startup: {e}")
    yield
    # Shutdown
    try:
        from utilities.bluetooth_tracker import stop_tracking
        stop_tracking()
    except:
        pass

app = FastAPI(title="Streamlit Migration API", lifespan=lifespan)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Redaction-Count"],
)

app.include_router(auth.router)

# Protect all other routers with JWT authentication
auth_deps = [Depends(get_current_user)]
app.include_router(media_entertainment.router, dependencies=auth_deps)
app.include_router(web_downloads.router, dependencies=auth_deps)
app.include_router(files_documents.router, dependencies=auth_deps)
app.include_router(home.router, dependencies=auth_deps)
app.include_router(price_monitor.router, dependencies=auth_deps)
app.include_router(currency_view.router, dependencies=auth_deps)
app.include_router(settings.router, dependencies=auth_deps)
app.include_router(media_vision.router, dependencies=auth_deps)
app.include_router(subtitles_metadata.router, dependencies=auth_deps)
app.include_router(system_network.router, dependencies=auth_deps)
app.include_router(lifestyle.router, dependencies=auth_deps)
app.include_router(system_upload.router, dependencies=auth_deps)
app.include_router(virtual_camera.router) # auth is handled per route due to WebSocket
app.include_router(pinhole_camera.router, dependencies=auth_deps)
app.include_router(quickmachine.router, dependencies=auth_deps)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache")
STATIC_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "static"))
UPLOADS_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads"))
os.makedirs(UPLOADS_DIR, exist_ok=True)
TEMP_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp"))
os.makedirs(TEMP_DIR, exist_ok=True)

# Mount the static directory to serve images cached by utilities.util_network
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Mount the temp directory to serve temp files
app.mount("/temp", StaticFiles(directory=TEMP_DIR), name="temp")

# Mount the uploads directory to serve uploaded media files
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

QUICK_NAV_FILE = os.path.join(CACHE_DIR, "quick_navigation.json")

@app.get("/")
def read_root():
    return {"message": "Welcome to V2"}

@app.get("/debug/uploads")
def debug_uploads():
    import os
    return {
        "__file__": __file__,
        "UPLOADS_DIR": UPLOADS_DIR,
        "exists": os.path.exists(UPLOADS_DIR),
        "files": os.listdir(UPLOADS_DIR) if os.path.exists(UPLOADS_DIR) else []
    }

@app.get("/api/dashboard", dependencies=auth_deps)
def get_dashboard_data():
    """Returns the quick navigation cache data for the dashboard."""
    try:
        from utilities.util_home import get_quick_cache_data
        return get_quick_cache_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

