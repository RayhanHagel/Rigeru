"use client";

import { useState } from "react";
import { MonitorPlay, Search, Download, Clock, Eye, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";

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
      const res = await fetch(`http://127.0.0.1:8000/api/web-downloads/youtube/search?q=${encodeURIComponent(query)}&max_results=12`);
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
    setDownloadTasks(prev => ({ ...prev, [tempId]: { status: "pending", message: "Starting..." } }));
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/web-downloads/youtube/download", {
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
        const res = await fetch(`http://127.0.0.1:8000/api/web-downloads/youtube/download/${taskId}`);
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
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-10 border-b border-red-500/30 pb-6">
        <div className="p-3 rounded-2xl bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <MonitorPlay size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">YouTube Downloader</h1>
          <p className="text-zinc-400 text-sm font-medium mt-1">Download videos and audio tracks in high quality.</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-4 mb-10 items-end">
        <div className="flex-1">
          <TextInput 
            label="Search or URL"
            placeholder="Enter YouTube URL or search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search size={18} />}
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
      return `http://127.0.0.1:8000${url.replace('/app/static', '/static')}`;
    }
    return url;
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 bg-zinc-900/60 border border-white/10 rounded-2xl backdrop-blur-md transition-all hover:bg-zinc-900/80 hover:border-red-500/30">
      <div className="w-full md:w-64 h-36 rounded-xl overflow-hidden bg-black shrink-0 relative">
        <img 
          src={resolveImageUrl(vid.thumbnail)} 
          alt={vid.title} 
          className="w-full h-full object-cover" 
        />
        <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-mono font-medium border border-white/10">
          {vid.duration_string}
        </div>
      </div>

      <div className="flex flex-col flex-1 justify-between py-1 min-w-0 overflow-hidden">
        <div>
          <a href={vid.webpage_url || vid.url} target="_blank" rel="noreferrer" className="text-lg font-bold text-zinc-100 hover:text-red-400 transition-colors line-clamp-2">
            {vid.title}
          </a>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-zinc-400">
            <span className="flex items-center gap-1"><User size={14} /> {vid.uploader || "Unknown"}</span>
            <span className="flex items-center gap-1"><Eye size={14} /> {vid.views?.toLocaleString() || 0} views</span>
          </div>
        </div>

        {downloadState ? (
          <div className="mt-4 p-3 rounded-lg bg-zinc-950/50 border border-white/5 flex items-center justify-between">
            <span className={`text-sm font-medium ${
              downloadState.status === 'completed' ? 'text-green-400' :
              downloadState.status === 'failed' ? 'text-red-400' : 'text-purple-400'
            }`}>
              {downloadState.message}
            </span>
            {downloadState.status === 'downloading' && (
              <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
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
            <Button variant="primary" icon={<Download size={16} />} onClick={() => onDownload(vid, format, quality)} className="px-6">
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
