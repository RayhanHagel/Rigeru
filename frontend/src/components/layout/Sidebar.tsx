"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from 'react';
import { 
  Home, Tv, Download, Palette, FileText, Folder, Settings, Table,
  ChevronDown, ChevronRight, BookOpen, MonitorPlay, AudioLines, Library, Menu, X, Search, ListFilter, Globe, Activity, Receipt, Sigma, FileSpreadsheet, Film, Crosshair, CheckSquare
} from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";

type NavItem = {
  title: string;
  href: string;
  icon?: React.ReactNode;
};

type NavGroup = {
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
  href?: string;
};

const navigation: NavGroup[] = [
  {
    title: "Dashboard",
    icon: <Home size={20} />,
    items: [
      { title: "Quick Navigation", href: "/", icon: <Home size={18} /> }
    ]
  },
  {
    title: "Media & Entertainment",
    href: "/media-entertainment",
    icon: <Tv size={20} />,
    items: [
      { title: "Manga Library", href: "/media-entertainment/manga-library", icon: <BookOpen size={18} /> },
      // { title: "Manga Sort", href: "/media-entertainment/manga-sort", icon: <ListFilter size={18} /> },
      { title: "Twitch Watch", href: "/media-entertainment/twitch-watch", icon: <MonitorPlay size={18} /> },
      { title: "Spotify Scrobbler", href: "/media-entertainment/spotify-scrobbler", icon: <AudioLines size={18} /> },
      { title: "MAL Local Tracker", href: "/media-entertainment/malsync", icon: <Library size={18} /> },
    ]
  },
  // Add other categories later as they are migrated
  {
    title: "Web & Downloads",
    href: "/web-downloads",
    icon: <Download size={20} />,
    items: [
      { title: "YouTube Downloader", href: "/web-downloads/youtube", icon: <Tv size={18} /> },
      { title: "Spotify Downloader", href: "/web-downloads/spotify", icon: <AudioLines size={18} /> },
      { title: "Visual Web Scraper", href: "/web-downloads/scraper", icon: <Globe size={18} /> },
      { title: "Price Drop Monitor", href: "/web-downloads/price-monitor", icon: <Activity size={18} /> },
      { title: "Currency Converter", href: "/web-downloads/currency-view", icon: <Activity size={18} /> },
      { title: "YouTube RSS Feed", href: "/web-downloads/youtube-rss", icon: <Tv size={18} /> },
      { title: "RSS Feed Manager", href: "/web-downloads/rss", icon: <FileText size={18} /> },
    ]
  },
  {
    title: "Media & Vision Processing",
    href: "/media-vision-processing",
    icon: <Palette size={20} />,
    items: [
      { title: "Local Translation", href: "/media-vision-processing/translation", icon: <Palette size={18} /> },
      { title: "Background Remover", href: "/media-vision/background-remover", icon: <Palette size={18} /> },
      { title: "Image Upscaler", href: "/media-vision-processing/image-upscaler", icon: <Palette size={18} /> },
      { title: "Media Compressor", href: "/media-vision-processing/media-compressor", icon: <Film size={18} /> },
      { title: "Color Picker", href: "/media-vision-processing/color-picker", icon: <Palette size={18} /> },
      { title: "Code to Image", href: "/media-vision-processing/code-to-image", icon: <Palette size={18} /> },
      { title: "Object Detection", href: "/media-vision-processing/object-detect", icon: <Crosshair size={18} /> },
      { title: "Face Blur", href: "/media-vision-processing/face-blur", icon: <CheckSquare size={18} /> },
      { title: "Depth Estimation", href: "/media-vision-processing/depth-estimation", icon: <Palette size={18} /> },
      { title: "AI De-Nudifier", href: "/media-vision-processing/vision-censor", icon: <CheckSquare size={18} /> }
    ]
  },
    {
      title: "Subtitles & Metadata",
      href: "/subtitles-metadata",
      icon: <FileText size={20} />,
      items: [
        { title: "Transcriber", href: "/subtitles-metadata/transcriber", icon: <Film size={18} /> },
        { title: "Subtitle Fetcher", href: "/subtitles-metadata/subtitle-fetcher", icon: <FileText size={18} /> },
        { title: "Subtitle Merger", href: "/subtitles-metadata/subtitle-merger", icon: <FileText size={18} /> },
        { title: "Media Tags Editor", href: "/subtitles-metadata/media-tags", icon: <FileText size={18} /> },
        { title: "File Timestamps", href: "/subtitles-metadata/file-timestamps", icon: <FileText size={18} /> },
        { title: "EXIF Stripper", href: "/subtitles-metadata/exif-remover", icon: <FileText size={18} /> }
      ]
    },
  {
    title: "System & Network",
    icon: <Settings size={20} />,
    href: "/system-network",
    items: [
      { title: "Package Manager", href: "/system-network/package-manager", icon: <Settings size={18} /> },
      { title: "Environment Variables", href: "/system-network/environment-variables", icon: <Settings size={18} /> },
      { title: "Services", href: "/system-network/services", icon: <Settings size={18} /> },
      { title: "Docker Manager", href: "/system-network/docker-manager", icon: <Settings size={18} /> },
      { title: "System Monitor", href: "/system-network/system-monitor", icon: <Settings size={18} /> },
      { title: "Ping Test", href: "/system-network/ping-test", icon: <Settings size={18} /> }
    ]
  },
  {
    title: "Files & Documents",
    href: "/files-documents",
    icon: <Folder size={20} />,
    items: [
      { title: "CV Builder", href: "/files-documents/cv-builder", icon: <FileText size={18} /> },
      { title: "PDF Studio", href: "/files-documents/pdf-studio", icon: <FileText size={18} /> },
      { title: "Excel Cleaner", href: "/files-documents/excel-cleaner", icon: <Table size={18} /> },
      { title: "Expense Tracker", href: "/files-documents/expense-tracker", icon: <Receipt size={18} /> },
      { title: "Math to LaTeX", href: "/files-documents/math-latex", icon: <Sigma size={18} /> },
      { title: "Hash Integrity", href: "/files-documents/hash-integrity", icon: <FileText size={18} /> },
      { title: "Link Cleaner", href: "/files-documents/link-cleaner", icon: <FileSpreadsheet size={18} /> },
      { title: "Rapid File Organizer", href: "/files-documents/file-organizer", icon: <Folder size={18} /> },
    ]
  },
  {
    title: "Settings",
    icon: <Settings size={20} />,
    items: [
      { title: "Model Settings", href: "/settings/model-settings", icon: <Settings size={18} /> }
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
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, var(--theme-heading), color-mix(in srgb, var(--theme-heading) 60%, #6366f1))`, boxShadow: `0 0 15px color-mix(in srgb, var(--theme-heading) 50%, transparent)` }}>
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-wide">Rigeru</h1>
          </div>
          <button 
            onClick={() => setSidebarCollapsed(true)} 
            className="p-1 rounded-md text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      
      <div className="px-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
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
                <button 
                  onClick={() => toggleGroup(group.title)}
                  className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-500 hover:text-zinc-300"
                >
                  {openGroups[group.title] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
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
                        {item.icon}
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

    </aside>

    {isSidebarCollapsed && (
      <button
        onClick={() => setSidebarCollapsed(false)}
        className="fixed left-4 top-4 z-40 p-2 backdrop-blur-xl border rounded-md text-zinc-400 hover:text-white shadow-lg transition-colors"
        style={{ backgroundColor: "color-mix(in srgb, var(--theme-bg) 90%, transparent)", borderColor: "var(--theme-ui-border)" }}
      >
        <Menu size={24} />
      </button>
    )}
    </>
  );
}
