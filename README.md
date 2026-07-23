# Rigeru - Comprehensive Developer & Media Toolbox

A powerful, all-in-one locally hosted dashboard that integrates a Next.js frontend with a robust FastAPI backend. It features dozens of utilities ranging from media processing (like machine translation and image upscaling) to system monitoring, file conversions, and web scraping—all easily accessible through a unified web interface.

## 🚀 Features

The toolbox is organized into several distinct categories:

### 📁 Files & Documents
- **CV Builder**: Build and generate professional resumes.
- **Excel Cleaner**: Sanitize and process spreadsheet data.
- **Expense Tracker**: Manage and visualize your spending.
- **File Organizer**: Sort and organize clutter into coherent directories.
- **Hash Integrity**: Verify file integrity using cryptographic hashes.
- **Link Cleaner**: Remove tracking parameters from URLs.
- **Math LaTeX**: Render mathematical equations.
- **PDF Studio**: A comprehensive suite for PDF conversions, editing, and compression.

### 🎮 Media & Entertainment
- **MAL Sync**: Synchronize anime/manga lists with MyAnimeList.
- **Manga Library & Reader**: Browse, search, and read your local manga collection.
- **Spotify Scrobbler**: Track and manage listening habits.
- **Twitch Watch**: Integrated Twitch viewing experience.

### 👁️ Media & Vision Processing
- **AI Machine Translation**: High-speed, local translation using NLLB (CTranslate2).
- **Background Remover**: Automatically strip backgrounds from images.
- **Code to Image**: Generate beautiful snippets of your code.
- **Face Blur & Vision Censor**: Automate privacy masks on images and video.
- **Image Upscaler**: AI-driven resolution enhancement.
- **Depth Estimation & Object Detect**: Computer vision analysis tools.

### 📝 Subtitles & Metadata
- **EXIF Remover**: Strip metadata from images for privacy.
- **Media Tags**: Edit audio/video metadata.
- **Subtitle Fetcher & Merger**: Automatically download and merge subtitles into video files.
- **Transcriber**: Audio-to-text transcriptions.

### ⚙️ System & Network
- **Docker Manager**: Monitor and manage local containers.
- **Environment Variables**: Edit system/app configuration easily.
- **Package Manager**: GUI wrapper for choco, scoop, and winget.
- **System Monitor & Services**: Real-time stats on CPU, RAM, and background services.
- **Ping Test**: Network latency analyzer.

### 🌐 Web & Downloads
- **Currency & Price Monitor**: Track exchange rates and product prices.
- **RSS Reader**: Aggregate feeds (including specialized YouTube RSS).
- **Visual Scraper**: Playwright-powered graphical web scraper.
- **Spotify & YouTube Downloaders**: Download media directly for offline access.

---

## 🛠️ Getting Started (Cross-Platform)

The project requires **Python 3.8+** and **Node.js** installed on your system.

We have included an automated startup script that handles:
1. Creating a Python virtual environment (`.venv`).
2. Installing all backend Python dependencies.
3. Installing all frontend Node.js dependencies (`node_modules`).
4. Concurrently launching the FastAPI backend and Next.js frontend.


### Manual Execution (Any OS)
If you prefer to run the setup script manually through Python:
```bash
python start.py
```
*(Use `python3` on macOS/Linux if `python` is not aliased).*

Once started, the backend API will run on `http://127.0.0.1:8000` and the web interface will automatically be available at `http://localhost:3000`.
