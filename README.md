# Rigeru — Developer & Media Toolbox

A comprehensive, self-hosted developer dashboard and media workstation. It unifies 60+ tools — from AI computer vision and media processing to system administration and web scraping — within a single, dark-themed web interface.

---

## ⚡ Quick Start

### Prerequisites
- **Python 3.11+** (managed with `uv` or `pip`)
- **Node.js 18+**
- **FFmpeg** (installed and added to system `PATH`)

### Run (Windows)
Double-click or run from terminal:
```bat
.\start.bat
```
*Handles venv setup, dependencies (`pip`/`npm`), port cleanup, and launches both services.*

### Manual Start
```bash
# Backend (FastAPI on :8000)
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (Next.js on :3000)
cd frontend && npm run dev
```

### Access
| Service | URL | Credentials |
| :--- | :--- | :--- |
| **Web Interface** | `http://localhost:3000` | Username: `admin`<br>Password: `admin` |
| **API Docs (Swagger)** | `http://127.0.0.1:8000/docs` | Requires JWT Token |

---

## 🧰 Feature Suite

| Category | Tools & Capabilities |
| :--- | :--- |
| **Media & Vision** | AI Background Remover, Image Upscaler (Real-ESRGAN), Face Blur (InsightFace), Vision Censor, Depth Estimation, Object Detection (YOLO), Code-to-Image, Pinhole Photography, Fisheye, RGB Shutter, Color Picker |
| **Audio & Video** | Audio Editor (WaveSurfer), Video-to-GIF, Media Compressor (FFmpeg), AI Transcriber (Whisper), Voice Clone & Text-to-Speech, Dictation, Subtitle Fetcher & Merger |
| **Documents & Text** | PDF Studio (Merge, Split, Compress, Sign, Watermark, Convert, Diff, Redact), CV Builder, Excel Cleaner, Chart Maker, Math LaTeX Renderer, Ebook Reader |
| **Web & Downloads** | YouTube Downloader (`yt-dlp`), Spotify Downloader (`spotdl`), Visual Web Scraper (Playwright), Image Scraper, Sitemap Crawler, RSS Reader & YouTube Feed Monitor |
| **System & Network** | Docker Container Manager, Package Manager GUI (`winget`, `scoop`, `choco`), Bluetooth Tracker, WiFi Mapper, LAN Radar, Services Monitor, Ping/Port Tester, Env Variable Editor, Windows Tweaks |
| **Productivity & Life** | Whiteboard Canvas, Kanban Board, Korean SRS Flashcards, Expense Tracker, Price Monitor, Currency Converter, QR Code Studio, Randomizer Suite (Wheel, Coin, Dice, Amidakuji) |
| **File Utilities** | Everything Search GUI, File Organizer & Batch Mover, Hash Integrity Checker, File Timestamps Editor, EXIF Metadata Remover, Media Tag Editor, Link Cleaner |
| **Entertainment** | Manga Reader & Library Manager, MyAnimeList (MAL) Sync, Spotify Scrobbler, Twitch Player |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│       Next.js 15 (React App Router)     │  :3000
│  Unified glassmorphism UI & custom CSS  │
└───────────────────┬─────────────────────┘
                    │ REST / SSE / WebSockets
┌───────────────────▼─────────────────────┐
│          FastAPI Application            │  :8000
│  JWT auth, background tasks, worker     │
└─────────┬─────────────────────┬─────────┘
          │                     │
┌─────────▼─────────┐ ┌─────────▼─────────┐
│ SQLite Databases  │ │ Standalone Logic  │
│ Auth, Kanban, SRS │ │ ~90 Py utilities  │
└───────────────────┘ └───────────────────┘
```

---

## 📁 Repository Map

```
Rigeru/
├── backend/            # FastAPI routers, auth, worker, and database models
├── frontend/           # Next.js 15 application (App Router, components, themes)
│   ├── src/app/        # Feature pages organized by category
│   └── src/components/ # Shared UI library (glassmorphism primitives, layout)
├── utilities/          # Modular Python packages (core, vision, audio_video, documents, system, web, etc.)
├── docs/               # Project backlog and architectural documentation
├── data/               # Local SQLite databases
├── cache/              # AI model weights and cached runtime assets
├── uploads/            # Temporary user-uploaded processing files
└── start.bat           # Automated environment setup and runner
```
