<h1 align="center">RIGERU PROJECT</h1>
<p align="center">A streamlit application that I made for fun.</p>

## Features
The application is divided into several powerful modules:
1. Files & Documents
    - Data Diff
    - Document Search
    - Excel Cleaner
    - Expense Tracker
    - File Organizer
    - Hash Integrity
    - Math LaTeX
    - PDF Redact

2. Media & Entertainment
    - MAL Sync
    - Manga Library
    - Manga Search
    - Spotify Listen
    - Twitch Watch

3. Media & Vision Processing
    - Background Remove
    - Color Picker
    - Depth Estimation
    - Face Blur
    - Image Upscaler
    - Media Compressor
    - Object Detect
    - Vision Censor

4. Subtitles & Metadata
    - EXIF Remover
    - File Timestamps
    - Media Tags
    - Subtitle Fetcher
    - Subtitle Merger
    - Subtitle Studio

5. System & Network
    - Package Managers
    - Environment Variables
    - Network Monitor
    - Ping Test
    - System Monitor:
    - Services

6. Web Downloads
    - Currency View
    - Price Monitor
    - RSS Manager
    - Spotify Download
    - Web Scraper
    - YouTube Download
    - YouTube RSS

## Prerequisite
If you're ISP blocks some of the websites needed, then TOR might be needed. To install TOR via Scoop, run this command below.
```bash
    scoop bucket add extras
    scoop install extras/tor-browser
```

## How to Install

### 1.) Clone repository
```bash
    git clone https://github.com/RayhanHagel/Rigeru.git
```

### 2.) Create Virtual Environment (Python 3.11)
```bash
    uv venv .venv --python 3.11
```

### 3.) Activate Virtual Enviroment
- For MacOS
```bash
    source .venv/bin/activate
```

- For Windows (Powershell)
```bash
    .venv\Scripts\Activate.ps1
```

- For Windows (Command Prompt)
```bash
    .venv\Scripts\activate.bat
```

### 4.) Install Required Packages
```bash
    uv pip install -r requirements.txt
```

### 5.) Apply Hot Fixes
```bash
    <FolderPath>.venv\Scripts\python.exe <FolderPath>/patches/config_toml.py
    <FolderPath>.venv\Scripts\python.exe <FolderPath>/patches/streamlit-elements.py
```

## Running the Script
Simply run this command below in the terminal.
```bash
    streamlit run main.py
```

## To-do List
- [ ] Fully remove tkinter.
- [ ] Fix issue regarding the st.DataFrame theme style.
- [ ] Save the chosen theme and fonts to the settings cache.
- [ ] Fix utilities: Math to Latex, Receipt Scanner, MalSync, Spotify Listen, Spotify Download.
- [ ] Apply lazy loading for instant streamlit load.
- [ ] Move twitch_cache read and manga_cache read to the concerning page rather in the main page.
- [ ] Make Document Studio UI better (especially on the drag and drop ui).
- [ ] Maybe refactor codes? Not sure tho.


## QnA
1. What if I want to modify the project myself?
> Sure, go ahead since the license of this project is under MIT license.

2. What other questions are there here?
> I dont know, I'll just leave this here as a placeholder.


## License
The entire code in this repository is licensed under the [MIT](https://mit-license.org/) license.

