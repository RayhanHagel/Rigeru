# Rigeru — Project Context

## Purpose

Rigeru is a comprehensive, locally-hosted developer & media toolbox providing 60+ utilities — from AI-powered media processing and computer vision to system administration and web scraping — accessible through a unified, premium dark-mode web interface.

It functions as a **personal workstation dashboard** secured with JWT single-user authentication.

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
│  └── Utilities (utilities/*)      — core business logic │
├─────────────────────────────────────────────────────────┤
│  External Dependencies                                  │
│  ├── ffmpeg (system PATH) — media transcoding & streams │
│  ├── spotdl (pip)         — Spotify track downloaders   │
│  ├── yt-dlp (pip)         — YouTube media downloaders   │
│  ├── Docker (optional)    — container management        │
│  ├── Ollama (optional)    — local LLM chat              │
│  ├── SearxNG (Docker)     — privacy-focused web search  │
│  └── Playwright (Node)    — headless browser automation │
└─────────────────────────────────────────────────────────┘
```

### Communication Protocols
- **REST API**: Frontend communicates via Next.js proxy rewrites (`/api/*` -> `http://127.0.0.1:8000/api/*`).
- **Async Operations**: Long tasks use background task queues + polling (`POST` returns `task_id`, `GET` polls status).
- **Server-Sent Events (SSE)**: Real-time streams (sitemap crawler, image scraper) use `StreamingResponse`.
- **WebSocket**: Full-duplex video streaming for virtual camera capabilities.

### Authentication
- JWT bearer tokens issued via `backend/routers/auth.py`.
- Storage key in frontend: `localStorage.getItem("auth_token")`.
- Default credentials: `admin` / `admin`.
- All routes except `/api/auth/*` and WebSocket endpoints require `Depends(get_current_user)`.

---

## Key File & Directory Map

### Root Directories
| Path | Purpose |
| :--- | :--- |
| `backend/` | FastAPI application, routers, database schema, and task worker |
| `frontend/` | Next.js 15 App Router web client and components |
| `utilities/` | Modular Python business logic grouped into `core/`, `audio_video/`, `vision/`, `documents/`, `file_tools/`, `system_network/`, `web/`, `entertainment/`, and `productivity_lifestyle/` |
| `docs/` | Project backlog (`docs/backlog.md`) and technical specs |
| `data/` | SQLite databases (bluetooth, configs, korean SRS, reading library, wifi mapper) |
| `cache/` | AI model weights (HuggingFace, Torch, Ultralytics, InsightFace) |
| `static/` | Cached static files and proxied media assets |
| `uploads/` | User-uploaded files (served at `/uploads/`) |
| `temp/` | Temporary processing files (served at `/temp/`) |
| `start.bat` | Automated environment setup, dependency installer, and process launcher |

### Backend Routers (`backend/routers/`)
| Router | Responsibilities |
| :--- | :--- |
| `auth.py` | JWT authentication (login, password change, token validation) |
| `media_vision.py` | AI vision (face blur, upscale, object detect, depth, censor, code-to-image) |
| `files_documents.py` | PDF Studio, CV builder, file organizer, hash check, excel cleaner |
| `web_downloads.py` | YouTube & Spotify downloaders, RSS reader, image & web scrapers |
| `system_network.py` | Docker manager, package manager, Bluetooth/WiFi/LAN scanners, tweaks |
| `media_entertainment.py`| MAL sync, Manga reader/library, Spotify scrobbler, Twitch viewer |
| `subtitles_metadata.py` | Subtitle fetch/merge, EXIF metadata remover, audio transcriber |
| `lifestyle.py` | Expense tracker, Korean SRS flashcards, QR code generator |
| `settings.py` | Application configuration & AI model settings |

### Frontend Category Pages (`frontend/src/app/`)
| Route Group | Major Features |
| :--- | :--- |
| `audio-video/` | Audio editor, transcriber, video-to-gif, compressor, voice clone |
| `image-vision/` | Face blur, background remover, upscale, censor, object detect |
| `documents-text/` | PDF Studio (20+ tools), CV builder, chart maker, LaTeX renderer |
| `entertainment-reading/`| Manga library & reader, MAL sync, Twitch watch, Spotify scrobbler |
| `web-downloaders/` | YouTube/Spotify downloaders, image scraper, RSS reader, sitemap |
| `file-utils/` | Everything search, file organizer, EXIF remover, hash integrity |
| `system-network/` | Docker manager, package manager, Bluetooth tracker, WiFi mapper |
| `productivity-life/` | Whiteboard, Kanban, Korean study, expense tracker, randomizer |

---

## Setup & Run Instructions

### Prerequisites
- Python 3.11+ (managed via `uv` or standard virtual environment)
- Node.js 18+
- FFmpeg on system `PATH`

### Automated Run (Windows)
```bat
.\start.bat
```
Handles venv creation, pip install, npm install, Playwright browser binaries, and boots both servers.

### Manual Commands
```bash
# Backend (Port 8000)
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend --reload-dir utilities

# Frontend (Port 3000)
cd frontend && npm run dev -- -H 0.0.0.0
```

### Access Points
- **Web App**: `http://localhost:3000`
- **Backend API**: `http://127.0.0.1:8000`
- **Default Auth**: `admin` / `admin`

---

## Convention Deviations & Architecture Notes

- **No ORM**: Raw SQLite via standard library `sqlite3` for minimal overhead and simple migration.
- **Dynamic Theming**: Dark/Light mode strictly uses CSS variables (`--theme-bg`, `--theme-ui-bg`, `--theme-ui-border`, `--theme-heading`, `--theme-text`). Hardcoded color classes are forbidden.
- **Icon Library**: Exclusively Google Material Symbols Outlined loaded via Google CDN, invoked through `<Icon name="..." size={...} />`.
- **Model Caching**: AI model paths (`HF_HOME`, `TORCH_HOME`, `YOLO_CONFIG_DIR`, `INSIGHTFACE_HOME`) are explicitly routed to `cache/models/` in `backend/main.py`.
- **Windows COM Policy**: MTA mode enforced at backend startup (`sys.coinit_flags = 0`) to prevent Bluetooth (`bleak`) threading locks on Windows.
- **API Requests**: Frontend calls backend using relative `/api/*` routes proxied by Next.js `rewrites` to guarantee LAN compatibility.
