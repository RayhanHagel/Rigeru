"use client";
import { Header } from "@/components/ui/Header";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/lib/utils";

interface SearchResult {
  title: string;
  url: string;
  webpage_url?: string;
  thumbnail?: string;
  uploader?: string;
  duration_string?: string;
  views?: number;
}

export default function YouTubeDownloader() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<Record<string, { status: string; message: string }>>({});

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/web-downloads/youtube/search?q=${encodeURIComponent(query)}&max_results=12`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startDownload = async (vid: SearchResult, format: string, quality: string) => {
    const isAudio = format === "audio";
    
    // Optimistic UI update
    const tempId = vid.url;
    setDownloadTasks(prev => ({ ...prev, [tempId]: { status: "pending", message: "Starting" } }));
    
    try {
      const res = await fetch("/api/web-downloads/youtube/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: vid.url,
          is_audio: isAudio,
          resolution: quality,
        })
      });
      
      if (res.ok) {
        const { task_id } = await res.json();
        // Poll for status
        pollDownloadStatus(task_id, tempId);
      }
    } catch (e) {
      setDownloadTasks(prev => ({ ...prev, [tempId]: { status: "failed", message: "Network error" } }));
    }
  };

  const pollDownloadStatus = async (taskId: string, tempId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/web-downloads/youtube/download/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          setDownloadTasks(prev => ({ ...prev, [tempId]: { status: data.status, message: data.message } }));
          
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 2000);
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="YouTube Downloader" subtitle="Download videos and audio tracks in high quality." />

      <form onSubmit={handleSearch} className="flex gap-4 mb-10 items-end">
        <div className="flex-1">
          <TextInput 
            label="Search or URL"
            placeholder="Enter YouTube URL or search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Icon name="search" size={18} />}
          />
        </div>
        <Button variant="primary" type="submit" isLoading={loading} className="px-8">
          Search
        </Button>
      </form>

      <div className="flex flex-col gap-6">
        {results.map((vid, idx) => (
          <ResultCard 
            key={idx} 
            vid={vid} 
            downloadState={downloadTasks[vid.url]} 
            onDownload={startDownload}
          />
        ))}
      </div>
    </div>
  );
}

function ResultCard({ vid, downloadState, onDownload }: { 
  vid: SearchResult; 
  downloadState?: { status: string; message: string }; 
  onDownload: (vid: SearchResult, format: string, quality: string) => void;
}) {
  const [format, setFormat] = useState("video");
  const [quality, setQuality] = useState("Best");

  const resolveImageUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith('/app/static/')) {
      return `${url.replace('/app/static', '/static')}`;
    }
    return url;
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl shadow-sm backdrop-blur-md transition-all hover:border-[var(--theme-heading)]">
      <div className="w-full md:w-64 h-36 rounded-xl overflow-hidden bg-black shrink-0 relative">
        <img 
          src={resolveImageUrl(vid.thumbnail)} 
          alt={vid.title} 
          className="w-full h-full object-cover" 
        />
        <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-mono font-medium border border-[var(--theme-ui-border)]">
          {vid.duration_string}
        </div>
      </div>

      <div className="flex flex-col flex-1 justify-between py-1 min-w-0 overflow-hidden">
        <div>
          <a href={vid.webpage_url || vid.url} target="_blank" rel="noreferrer" className="text-lg font-bold text-[var(--theme-text)] hover:text-[var(--theme-heading)] transition-colors line-clamp-2">
            {vid.title}
          </a>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[var(--theme-text)]">
            <span className="flex items-center gap-1"><Icon name="person" size={14} /> {vid.uploader || "Unknown"}</span>
            <span className="flex items-center gap-1"><Icon name="visibility" size={14} /> {vid.views?.toLocaleString() || 0} views</span>
          </div>
        </div>

        {downloadState ? (
          <div className="mt-4 p-3 rounded-lg bg-[var(--theme-bg)]/50 border border-[var(--theme-ui-border)] flex items-center justify-between">
            <span className={`text-sm font-medium ${
              downloadState.status === 'completed' ? 'text-green-400' :
              downloadState.status === 'failed' ? 'text-red-400' : 'text-[var(--theme-heading)]'
            }`}>
              {downloadState.message}
            </span>
            {downloadState.status === 'downloading' && (
              <div className="w-4 h-4 border-2 border-[var(--theme-ui-border)] border-t-[var(--theme-heading)] rounded-full animate-spin" />
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="w-32">
              <Select 
                options={[
                  { label: "Video (MP4)", value: "video" },
                  { label: "Audio (MP3)", value: "audio" },
                ]}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              />
            </div>
            <div className="w-32">
              <Select 
                options={format === "audio" 
                  ? [{ label: "Best (192kbps)", value: "Best" }] 
                  : [
                      { label: "Best", value: "Best" },
                      { label: "1080p", value: "1080p" },
                      { label: "720p", value: "720p" },
                    ]
                }
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              />
            </div>
            <Button variant="primary" icon={<Icon name="download" size={16} />} onClick={() => onDownload(vid, format, quality)} className="px-6">
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
