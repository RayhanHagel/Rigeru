# Rigeru — Project Context

## Purpose

Rigeru is a comprehensive, locally-hosted developer & media toolbox. It provides 60+ utilities — from AI-powered media processing and computer vision to system administration and web scraping — all accessible through a unified, premium dark-mode web interface.

It is designed as a **personal workstation dashboard** with JWT-based single-user authentication.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 + React)    :3000                 │
│  ├── App Router (src/app/*)                             │
│  ├── Reusable UI Components (src/components/ui/*)       │
│  └── Layout Shell (src/components/layout/*)             │
├─────────────────────────────────────────────────────────┤
│  Backend (FastAPI + Uvicorn)       :8000                │
│  ├── Routers (backend/routers/*)  — API endpoints       │
│  ├── Database (SQLite via backend/database.py)          │
│  └── Utilities (utilities/*)      — core logic          │
├─────────────────────────────────────────────────────────┤
│  External Dependencies                                  │
│  ├── ffmpeg (system)    — media encoding                │
│  ├── spotdl (pip)       — Spotify downloads             │
│  ├── yt-dlp (pip)       — YouTube downloads             │
│  ├── Docker (optional)  — container management          │
│  ├── Ollama (optional)  — local LLM chat                │
│  ├── SearxNG (Docker)   — image search                  │
│  └── Playwright (Node)  — headless browser scraping     │
└─────────────────────────────────────────────────────────┘
```

### Communication Pattern
- Frontend calls backend via **REST API** (prefixed `/api/`).
- Long-running tasks use a **background task + polling** pattern: POST starts the task and returns a `task_id`, GET polls status until `completed` or `failed`.
- Real-time features (sitemap crawl, image scraper) use **Server-Sent Events (SSE)** via `StreamingResponse`.
- WebSocket is used for the virtual camera feature.

### Authentication
- JWT-based via `backend/routers/auth.py`.
- Default credentials: `admin` / `admin`.
- All routers except `auth` are protected with `Depends(get_current_user)`.

---

## Key File & Directory Map

### Root
| Path | Description |
|---|---|
| `start.bat` | Startup script: kills stale processes, launches backend + frontend in separate terminal windows |
| `backend/` | FastAPI application |
| `frontend/` | Next.js application |
| `utilities/` | ~90 Python utility modules (core business logic) |
| `data/` | SQLite databases (bluetooth, configs, korean SRS, wifi mapper) |
| `cache/` | AI model caches (HuggingFace, Torch, Ultralytics, InsightFace) |
| `static/` | Cached static files (e.g., proxied images) |
| `uploads/` | User-uploaded files (served at `/uploads/`) |
| `temp/` | Temporary processing artifacts (served at `/temp/`) |

### Backend (`backend/`)
| File | Description |
|---|---|
| `main.py` | FastAPI app, CORS config, router registration, static file mounts |
| `database.py` | SQLite connection, user auth tables, kanban tables, password hashing |
| `worker.py` | Background task worker (arq + Redis) |
| `requirements.txt` | Python dependency manifest |
| `routers/auth.py` | JWT authentication (login, register, token validation) |
| `routers/media_vision.py` | Image/video processing endpoints (face blur, upscale, object detect, etc.) |
| `routers/media_entertainment.py` | MAL sync, manga, Spotify scrobbler, Twitch |
| `routers/web_downloads.py` | YouTube/Spotify download, RSS, image scraper, web scraper |
| `routers/files_documents.py` | PDF ops, CV builder, file organizer, excel, hash, etc. |
| `routers/system_network.py` | Docker, env vars, package manager, services, ping, monitors |
| `routers/subtitles_metadata.py` | Subtitle fetch/merge, EXIF, media tags, transcription |
| `routers/lifestyle.py` | Expense tracker, Korean SRS, QR code |
| `routers/settings.py` | App settings management |

### Frontend (`frontend/src/`)
| Path | Description |
|---|---|
| `app/layout.tsx` | Root layout (Geist font, Material Symbols, MainLayout shell, Toaster) |
| `app/page.tsx` | Landing / dashboard page |
| `app/login/` | Login page |
| `app/settings/` | Settings page |
| `components/layout/MainLayout.tsx` | App shell with sidebar |
| `components/layout/Sidebar.tsx` | Navigation sidebar |
| `components/layout/SettingsSidebar.tsx` | Settings panel |
| `components/ui/` | Reusable UI primitives (Button, Card, Header, FileExplorerModal, DirectUploadBox, etc.) |

### Frontend Feature Categories
| Route Group | Pages |
|---|---|
| `audio-video/` | Audio editor, Dictation, Media compressor, Subtitle fetcher/merger, Transcriber, Video-to-GIF, Voice clone |
| `image-vision/` | Background remover, Code-to-image, Color picker, Depth estimation, Face blur, Fisheye, Image upscaler, Object detect, Pinhole photography, RGB shutter, Vision censor |
| `documents-text/` | Chart maker, Ebook reader, Excel cleaner, Math LaTeX, PDF studio |
| `entertainment-reading/` | MAL sync, Manga library/reader/search/sort, Spotify scrobbler, Twitch watch |
| `web-downloaders/` | Image scraper, RSS, Scraper, Sitemap, Spotify, YouTube, YouTube RSS |
| `file-utils/` | Everything search, EXIF remover, File organizer, File timestamps, Hash integrity, Link cleaner, Media tags |
| `system-network/` | Bluetooth tracker, Client details, Docker manager, Env vars, LAN radar, Package manager, Ping test, Port test, Services, System monitor, WiFi mapper, Windows tweaks |
| `productivity-life/` | Currency view, CV builder, Expense tracker, Kanban, Korean study, Price monitor, QR code, Randomizer, Whiteboard |

### Utilities (`utilities/`)
All backend logic lives here as `util_*.py` modules. Each utility is a standalone module imported by routers. Key ones:
- `util_ai_tools.py` — SearxNG integration, AI tool orchestration
- `util_object_detect.py` — YOLO object detection
- `util_face_blur.py` — InsightFace face detection + blur
- `util_audio.py` — Audio editing / processing
- `util_ffmpeg.py` — FFmpeg wrapper
- `util_spotify_download.py` — spotDL CLI wrapper
- `util_yt.py` — YouTube search/download via yt-dlp
- `util_manga.py` — Manga library management
- `util_llm_chat.py` — Ollama LLM integration
- `util_huggingface.py` — HuggingFace model management
- `util_network.py` — HTTP client with proxy support (Tor, better_get)

---

## Setup & Run Instructions

### Prerequisites
- Python 3.11+ (managed via `uv`)
- Node.js 18+
- ffmpeg (system PATH)
- Optional: Docker (for SearxNG, container management)

### Quick Start
```bash
# Windows
.\start.bat
```
This handles: venv creation, pip install, npm install, Playwright setup, port cleanup, and launches both servers.

### Manual Start
```bash
# Backend (port 8000)
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend --reload-dir utilities

# Frontend (port 3000)
cd frontend && npm run dev -- -H 0.0.0.0
```

### Access
- Frontend: `http://localhost:3000`
- Backend API: `http://127.0.0.1:8000`
- Default login: `admin` / `admin`

---

## Convention Deviations & Notes

- **No ORM**: Raw SQLite via `sqlite3` module (not SQLAlchemy). Intentional for simplicity.
- **Icon library**: Google Material Symbols Outlined (loaded via CDN in layout.tsx). All icons use the `Icon` component from `src/lib/utils.tsx`.
- **Styling**: Vanilla CSS with CSS variables for theming. No Tailwind — uses utility classes defined in `globals.css`.
- **Model caching**: All AI models (HuggingFace, Torch, Ultralytics, InsightFace) cached under `cache/models/` via environment variables set in `main.py`.
- **Background tasks**: FastAPI `BackgroundTasks` for short-lived operations. `arq` + Redis for heavyweight work (`worker.py`).
- **COM threading**: `sys.coinit_flags = 0` at top of `main.py` forces MTA mode to fix `bleak` (Bluetooth) issues on Windows.
- **Package management**: `uv` is used for Python package management instead of raw `pip`.
