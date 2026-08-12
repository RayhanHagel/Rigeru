"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from 'react';

import { useSettingsStore } from "@/store/useSettingsStore";
import { Icon } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  icon?: React.ReactNode;
  description?: string;
};

type NavGroup = {
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
  href?: string;
  description?: string;
};

export const navigation: NavGroup[] = [
  {
    title: "Dashboard",
    icon: <Icon name="home" size={20} />,
    href: "/",
    items: [],
    description: "Overview and recent activity across all your tools."
  },
  {
    title: "Entertainment & Reading",
    href: "/entertainment-reading",
    icon: <Icon name="tv" size={20} />,
    description: "Tools for managing and enjoying your media, streams, and reading materials.",
    items: [
      { title: "Manga Library", href: "/entertainment-reading/manga-library", icon: <Icon name="menu_book" size={18} />, description: "Read and organize your manga collection." },
      { title: "Twitch Watch", href: "/entertainment-reading/twitch-watch", icon: <Icon name="smart_display" size={18} />, description: "Watch Twitch streams seamlessly." },
      { title: "Spotify Scrobbler", href: "/entertainment-reading/spotify-scrobbler", icon: <Icon name="graphic_eq" size={18} />, description: "Track your Spotify listening history." },
      { title: "MAL Local Tracker", href: "/entertainment-reading/malsync", icon: <Icon name="local_library" size={18} />, description: "Sync and track MyAnimeList entries locally." },
    ]
  },
  {
    title: "Productivity & Life",
    href: "/productivity-life",
    icon: <Icon name="check_box" size={20} />,
    description: "Applications to help organize tasks, manage finances, and boost daily productivity.",
    items: [
      { title: "Kanban Board", href: "/productivity-life/kanban", icon: <Icon name="check_box" size={18} />, description: "Manage tasks with a visual Kanban board." },
      { title: "Expense Tracker", href: "/productivity-life/expense-tracker", icon: <Icon name="receipt" size={18} />, description: "Track your personal expenses and budget." },
      { title: "CV Builder", href: "/productivity-life/cv-builder", icon: <Icon name="description" size={18} />, description: "Create and export a professional curriculum vitae." },
      { title: "Price Drop Monitor", href: "/productivity-life/price-monitor", icon: <Icon name="monitoring" size={18} />, description: "Monitor item prices and get alerts on drops." },
      { title: "Currency Converter", href: "/productivity-life/currency-view", icon: <Icon name="monitoring" size={18} />, description: "Convert between global currencies." },
      { title: "Randomizer", href: "/productivity-life/randomizer", icon: <Icon name="casino" size={18} />, description: "Generate random numbers, choices, or teams." },
      { title: "Korean Study SRS", href: "/productivity-life/korean-study", icon: <Icon name="menu_book" size={18} />, description: "Spaced repetition system for learning Korean." },
      { title: "Digital Whiteboard", href: "/productivity-life/whiteboard", icon: <Icon name="palette" size={18} />, description: "Draw, sketch, and brainstorm on a digital canvas." },
      { title: "QR Code Tools", href: "/productivity-life/qr-code", icon: <Icon name="check_box" size={18} />, description: "Generate custom QR codes or scan them instantly." },
    ]
  },
  {
    title: "Web & Downloaders",
    href: "/web-downloaders",
    icon: <Icon name="download" size={20} />,
    description: "Utilities for downloading media, monitoring feeds, and scraping data from the web.",
    items: [
      { title: "YouTube Downloader", href: "/web-downloaders/youtube", icon: <Icon name="tv" size={18} />, description: "Download videos and audio from YouTube." },
      { title: "Spotify Downloader", href: "/web-downloaders/spotify", icon: <Icon name="graphic_eq" size={18} />, description: "Download tracks and playlists from Spotify." },
      { title: "YouTube RSS Feed", href: "/web-downloaders/youtube-rss", icon: <Icon name="tv" size={18} />, description: "View YouTube channel updates via RSS." },
      { title: "RSS Feed Manager", href: "/web-downloaders/rss", icon: <Icon name="description" size={18} />, description: "Subscribe and read your favorite RSS feeds." },
      { title: "Visual Web Scraper", href: "/web-downloaders/scraper", icon: <Icon name="language" size={18} />, description: "Scrape data from websites visually." },
      { title: "Image Scraper", href: "/web-downloaders/image-scraper", icon: <Icon name="download" size={18} />, description: "Extract and download images from any webpage." },
      { title: "Sitemap Generator", href: "/web-downloaders/sitemap", icon: <Icon name="hub" size={18} />, description: "Generate XML sitemaps for websites." },
    ]
  },
  {
    title: "Image & Vision",
    href: "/image-vision",
    icon: <Icon name="palette" size={20} />,
    description: "Advanced tools for image processing, manipulation, and AI-powered enhancements.",
    items: [
      { title: "Image Upscaler", href: "/image-vision/image-upscaler", icon: <Icon name="palette" size={18} />, description: "Upscale images using AI models." },
      { title: "Background Remover", href: "/image-vision/background-remover", icon: <Icon name="palette" size={18} />, description: "Remove backgrounds from photos automatically." },
      { title: "Object Detection", href: "/image-vision/object-detect", icon: <Icon name="my_location" size={18} />, description: "Detect and bound objects within images." },
      { title: "Face Blur", href: "/image-vision/face-blur", icon: <Icon name="check_box" size={18} />, description: "Automatically detect and blur faces in photos." },
      { title: "Depth Estimation", href: "/image-vision/depth-estimation", icon: <Icon name="palette" size={18} />, description: "Generate depth maps from 2D images." },
      { title: "AI De-Nudifier", href: "/image-vision/vision-censor", icon: <Icon name="check_box" size={18} />, description: "Censor explicit content in images." },
      { title: "Color Picker", href: "/image-vision/color-picker", icon: <Icon name="palette" size={18} />, description: "Extract color palettes from images." },
      { title: "Code to Image", href: "/image-vision/code-to-image", icon: <Icon name="palette" size={18} />, description: "Convert code snippets into beautiful images." },
      { title: "Pinhole Photography", href: "/image-vision/pinhole-photography", icon: <Icon name="camera" size={18} />, description: "Apply a pinhole camera effect to photos." },
      { title: "Fisheye Effect", href: "/image-vision/fisheye", icon: <Icon name="camera" size={18} />, description: "Apply a fisheye lens distortion to images." },
      { title: "RGB Shutter Lag", href: "/image-vision/rgb-shutter", icon: <Icon name="movie" size={18} />, description: "Simulate RGB shutter lag effect on videos." },
    ]
  },
  {
    title: "Audio, Video & Subtitles",
    href: "/audio-video",
    icon: <Icon name="movie" size={20} />,
    description: "Comprehensive suite for editing, converting, and managing multimedia files.",
    items: [
      { title: "Video to GIF", href: "/audio-video/video-to-gif", icon: <Icon name="movie" size={18} />, description: "Convert video clips into animated GIFs." },
      { title: "Audio Waveform Editor", href: "/audio-video/audio-editor", icon: <Icon name="graphic_eq" size={18} />, description: "Edit audio files with a visual waveform." },
      { title: "Transcriber", href: "/audio-video/transcriber", icon: <Icon name="movie" size={18} />, description: "Transcribe audio and video to text." },
      { title: "Audio Dictation", href: "/audio-video/dictation", icon: <Icon name="graphic_eq" size={18} />, description: "Dictate text using your voice." },
      { title: "Voice Cloning TTS", href: "/audio-video/voice-clone", icon: <Icon name="graphic_eq" size={18} />, description: "Clone voices for text-to-speech generation." },
      { title: "Subtitle Fetcher", href: "/audio-video/subtitle-fetcher", icon: <Icon name="description" size={18} />, description: "Download subtitles for movies and shows." },
      { title: "Subtitle Merger", href: "/audio-video/subtitle-merger", icon: <Icon name="description" size={18} />, description: "Merge subtitles into video files." },
      { title: "Media Compressor", href: "/audio-video/media-compressor", icon: <Icon name="movie" size={18} />, description: "Compress audio and video files." },
    ]
  },
  {
    title: "Documents & Text",
    href: "/documents-text",
    icon: <Icon name="description" size={20} />,
    description: "Tools for reading, converting, and analyzing documents and spreadsheets.",
    items: [
      { title: "Ebook Reader", href: "/documents-text/ebook-reader", icon: <Icon name="menu_book" size={18} />, description: "Read EPUB and other ebook formats." },
      { title: "PDF Studio", href: "/documents-text/pdf-studio", icon: <Icon name="description" size={18} />, description: "A comprehensive suite of PDF tools." },
      { title: "Math to LaTeX", href: "/documents-text/math-latex", icon: <Icon name="functions" size={18} />, description: "Convert handwritten math to LaTeX equations." },
      { title: "Excel Cleaner", href: "/documents-text/excel-cleaner", icon: <Icon name="table_chart" size={18} />, description: "Clean and format messy Excel spreadsheets." },
      { title: "Chart Maker", href: "/documents-text/chart-maker", icon: <Icon name="description" size={18} />, description: "Upload data to instantly generate interactive charts." },
    ]
  },
  {
    title: "Artificial Intelligence",
    href: "/data-science",
    icon: <Icon name="smart_toy" size={20} />,
    description: "Harness the power of machine learning and large language models.",
    items: [
      { title: "Visual ML Builder", href: "/data-science/quickmachine", icon: <Icon name="hub" size={18} />, description: "Build machine learning models visually." },
      { title: "Obsidian AI Builder", href: "/data-science/obsidian-builder", icon: <Icon name="hub" size={18} />, description: "Enhance Obsidian notes with AI." },
      { title: "LLM Chat Bot", href: "/data-science/llm-chat", icon: <Icon name="smart_toy" size={18} />, description: "Chat with local or remote large language models." },
      { title: "Local Translation", href: "/data-science/translation", icon: <Icon name="palette" size={18} />, description: "Translate text using local models." },
    ]
  },
  {
    title: "File Utilities",
    href: "/file-utils",
    icon: <Icon name="folder" size={20} />,
    description: "Utilities for organizing, verifying, and modifying files and metadata.",
    items: [
      { title: "Rapid File Organizer", href: "/file-utils/file-organizer", icon: <Icon name="folder" size={18} />, description: "Organize files into folders rapidly." },
      { title: "Hash Integrity", href: "/file-utils/hash-integrity", icon: <Icon name="description" size={18} />, description: "Verify file integrity using hashes." },
      { title: "Link Cleaner", href: "/file-utils/link-cleaner", icon: <Icon name="table_view" size={18} />, description: "Clean tracking parameters from URLs." },
      { title: "Media Tags Editor", href: "/file-utils/media-tags", icon: <Icon name="description" size={18} />, description: "Edit metadata tags for media files." },
      { title: "File Timestamps", href: "/file-utils/file-timestamps", icon: <Icon name="description" size={18} />, description: "Modify creation and modification timestamps." },
      { title: "EXIF Stripper", href: "/file-utils/exif-remover", icon: <Icon name="description" size={18} />, description: "Remove EXIF data from images." },
      { title: "Everything Search", href: "/file-utils/everything-search", icon: <Icon name="search" size={18} />, description: "Search for files instantly." },
    ]
  },
  {
    title: "System & Network",
    icon: <Icon name="settings" size={20} />,
    href: "/system-network",
    description: "Advanced tools for system monitoring, network analysis, and configuration.",
    items: [
      { title: "Package Manager", href: "/system-network/package-manager", icon: <Icon name="settings" size={18} />, description: "Manage system packages and software." },
      { title: "Environment Variables", href: "/system-network/environment-variables", icon: <Icon name="settings" size={18} />, description: "Edit system environment variables." },
      { title: "Services", href: "/system-network/services", icon: <Icon name="settings" size={18} />, description: "Manage background system services." },
      { title: "Docker Manager", href: "/system-network/docker-manager", icon: <Icon name="settings" size={18} />, description: "Manage Docker containers and images." },
      { title: "System Monitor", href: "/system-network/system-monitor", icon: <Icon name="settings" size={18} />, description: "Monitor system resources and performance." },
      { title: "Ping Test", href: "/system-network/ping-test", icon: <Icon name="settings" size={18} />, description: "Test network latency and packet loss." },
      { title: "Port Test", href: "/system-network/port-test", icon: <Icon name="monitoring" size={18} />, description: "Scan and test open network ports." },
      { title: "Bluetooth Tracker", href: "/system-network/bluetooth-tracker", icon: <Icon name="hub" size={18} />, description: "Track and manage Bluetooth devices." },
      { title: "Wi-Fi Mapper", href: "/system-network/wifi-mapper", icon: <Icon name="wifi" size={18} />, description: "Map and analyze Wi-Fi networks." },
      { title: "Local Network Radar", href: "/system-network/lan-radar", icon: <Icon name="radio" size={18} />, description: "Scan devices on your local network." },
      { title: "Windows Tweaks", href: "/system-network/windows-tweaks", icon: <Icon name="settings" size={18} />, description: "Apply advanced tweaks to Windows OS." },
      { title: "Web Client Details", href: "/system-network/client-details", icon: <Icon name="settings" size={18} />, description: "View browser fingerprint and environment details." }
    ]
  },
  {
    title: "Settings",
    icon: <Icon name="settings" size={20} />,
    href: "/settings",
    description: "Configure your application preferences, AI models, and API endpoints.",
    items: [
      { title: "Model Settings", href: "/settings/model-settings", icon: <Icon name="settings" size={18} />, description: "Configure AI models and API keys." },
      { title: "Configurations", href: "/settings/configurations", icon: <Icon name="settings" size={18} />, description: "Adjust application settings and preferences." },
      { title: "API Endpoints", href: "/settings/api-endpoints", icon: <Icon name="settings" size={18} />, description: "View backend API endpoint documentation." }
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarCollapsed, setSidebarCollapsed } = useSettingsStore();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <>
      <aside className={`w-72 h-screen fixed left-0 top-0 backdrop-blur-xl border-r z-50 flex flex-col pt-6 pb-6 overflow-y-auto transition-transform duration-300 md:flex ${isSidebarCollapsed ? "-translate-x-full" : "translate-x-0"}`} style={{ backgroundColor: "color-mix(in srgb, var(--theme-bg) 90%, transparent)", borderColor: "var(--theme-ui-border)" }}>
        <div className="px-6 mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `var(--theme-heading)`, boxShadow: `0 0 15px var(--theme-glow1)` }}>
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-wide">Rigeru</h1>
          </div>
          <button 
            onClick={() => setSidebarCollapsed(true)} 
            className="p-1 rounded-md text-zinc-500 hover:text-white transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      
      <div className="px-4 mb-4">
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search pages..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) {
                // Open all groups if searching
                const allOpen = navigation.reduce((acc, group) => ({ ...acc, [group.title]: true }), {});
                setOpenGroups(allOpen);
              }
            }}
            className="w-full bg-zinc-950/50 border rounded-lg py-2 pl-9 pr-4 text-sm text-white outline-none transition-colors"
            style={{ borderColor: "var(--theme-ui-border)" }}
            onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
          />
        </div>
      </div>

      <nav className="flex-1 px-4 flex flex-col gap-2">
        {navigation.map((group) => {
          const filteredItems = group.items.filter(item => 
            item.title.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (searchQuery && filteredItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-2">
              <div className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors">
                {group.href ? (
                  <Link href={group.href} className="flex-1 flex items-center gap-3 font-medium hover:text-zinc-200">
                    {group.icon}
                    <span>{group.title}</span>
                  </Link>
                ) : (
                  <div className="flex-1 flex items-center gap-3 font-medium text-zinc-200">
                    {group.icon}
                    <span>{group.title}</span>
                  </div>
                )}
                {group.items.length > 0 && (
                  <button 
                    onClick={() => toggleGroup(group.title)}
                    className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-500 hover:text-zinc-300"
                  >
                    {openGroups[group.title] ? <Icon name="expand_more" size={16} /> : <Icon name="chevron_right" size={16} />}
                  </button>
                )}
              </div>
              
              {openGroups[group.title] && filteredItems.length > 0 && (
                <div className="mt-1 ml-4 pl-4 border-l border-white/10 flex flex-col gap-1 animate-slide-up">
                  {filteredItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 p-2 rounded-lg text-sm font-medium transition-all ${
                          isActive 
                            ? "border" 
                            : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300 border border-transparent"
                        }`}
                      style={isActive ? {
                        backgroundColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                        color: "var(--theme-heading)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 30%, transparent)",
                      } : undefined}
                      >
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-white/5">
        <button 
          onClick={() => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("username");
            window.location.href = "/login";
          }}
          className="flex items-center gap-3 w-full p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium text-sm"
        >
          <Icon name="logout" size={18} />
          <span>Sign Out</span>
        </button>
      </div>

    </aside>

    {isSidebarCollapsed && (
      <button
        onClick={() => setSidebarCollapsed(false)}
        className="fixed left-4 top-4 z-50 p-2 backdrop-blur-xl border rounded-md text-zinc-400 hover:text-white shadow-lg transition-colors"
        style={{ backgroundColor: "color-mix(in srgb, var(--theme-bg) 90%, transparent)", borderColor: "var(--theme-ui-border)" }}
      >
        <Icon name="menu" size={24} />
      </button>
    )}
    </>
  );
}
