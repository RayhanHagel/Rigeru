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

from .routers import media_entertainment, web_downloads, files_documents, home, price_monitor, currency_view, settings, media_vision, subtitles_metadata, system_network
app = FastAPI(title="Streamlit Migration API")

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Redaction-Count"],
)

app.include_router(media_entertainment.router)
app.include_router(web_downloads.router)
app.include_router(files_documents.router)
app.include_router(home.router)
app.include_router(price_monitor.router)
app.include_router(currency_view.router)
app.include_router(settings.router)
app.include_router(media_vision.router)
app.include_router(subtitles_metadata.router)
app.include_router(system_network.router)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache")
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")

# Mount the static directory to serve images cached by utilities.util_network
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

QUICK_NAV_FILE = os.path.join(CACHE_DIR, "quick_navigation.json")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Streamlit Migration API"}

@app.get("/api/dashboard")
def get_dashboard_data():
    """Returns the quick navigation cache data for the dashboard."""
    if not os.path.exists(QUICK_NAV_FILE):
        return []
    try:
        with open(QUICK_NAV_FILE, "r") as f:
            data = json.load(f)
            return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


