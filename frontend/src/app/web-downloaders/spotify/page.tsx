"use client";
import { Header } from "@/components/ui/Header";

import { useState, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { Icon } from "@/lib/utils";

export default function SpotifyDownloader() {
  const [url, setUrl] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [audioFormat, setAudioFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("320k");
  
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);

  const startDownload = async () => {
    if (!url) return;
    setStatus({ status: "starting", message: "Initiating download" });
    
    try {
      const res = await fetch("/api/web-downloads/spotify/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          output_dir: outputDir,
          audio_format: audioFormat,
          bitrate: bitrate
        })
      });
      if (!res.ok) throw new Error("Failed to start download");
      const data = await res.json();
      setTaskId(data.task_id);
    } catch (e: any) {
      setStatus({ status: "failed", message: e.message });
    }
  };

  useEffect(() => {
    if (!taskId) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/web-downloads/spotify/download/${taskId}`);
        const data = await res.json();
        setStatus(data);
        
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          setTaskId(null);
        }
      } catch (e) {
        console.error(e);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [taskId]);

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Spotify Downloader" subtitle="Download Spotify tracks and playlists locally." />
      
      <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6 md:p-8 shadow-sm backdrop-blur-md">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Spotify Link (Track, Album, or Playlist)</label>
            <input 
              type="text" 
              placeholder="https://open.spotify.com/..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl p-4 text-[var(--theme-text)] border focus:outline-none transition-colors"
              style={{ 
                backgroundColor: "var(--theme-bg)",
                borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Audio Format</label>
              <select 
                value={audioFormat}
                onChange={(e) => setAudioFormat(e.target.value)}
                className="w-full rounded-xl p-4 text-[var(--theme-text)] border focus:outline-none appearance-none transition-colors"
                style={{ 
                  backgroundColor: "var(--theme-bg)",
                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              >
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="mp3">MP3</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="flac">FLAC</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="ogg">OGG</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="opus">OPUS</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="m4a">M4A</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="wav">WAV</option>
              </select>
            </div>
            
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Bitrate</label>
              <select 
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value)}
                className="w-full rounded-xl p-4 text-[var(--theme-text)] border focus:outline-none appearance-none transition-colors"
                style={{ 
                  backgroundColor: "var(--theme-bg)",
                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              >
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="320k">320 kbps (High)</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="192k">192 kbps (Medium)</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="128k">128 kbps (Low)</option>
              </select>
            </div>
            
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Output Directory</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Default: ~/Music" 
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  className="w-full rounded-xl p-4 pr-12 text-[var(--theme-text)] border focus:outline-none transition-colors"
                  style={{ 
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                />
                <button
                  type="button"
                  onClick={() => setIsExplorerOpen(true)}
                  className="absolute inset-y-0 right-2 flex items-center p-1.5 my-auto h-fit text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-white/10 rounded-lg transition-colors"
                  title="Browse folder"
                >
                  <Icon name="folder_open" size={18} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="pt-4">
            <Button 
              variant="primary" 
              icon={<Icon name="download" size={20} />} 
              fullWidth 
              onClick={startDownload}
              isLoading={taskId !== null}
              disabled={!url}
              className="py-4 border-none"
            >
              {taskId ? "Downloading" : "Start Download"}
            </Button>
          </div>
        </div>
      </div>
      
      {status && (
        <div className={`mt-6 p-6 rounded-2xl border flex items-start gap-4 ${
          status.status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
          status.status === 'failed' ? 'bg-red-500/10 border-red-500/30' :
          'bg-[var(--theme-heading)]/10 border-[var(--theme-heading)]/30'
        }`}>
          {status.status === 'completed' ? <Icon name="check_circle" className="text-green-500" /> :
           status.status === 'failed' ? <Icon name="error" className="text-red-500" /> :
           <div className="w-6 h-6 border-2 border-[var(--theme-heading)]/30 border-t-[var(--theme-heading)] rounded-full animate-spin" />
          }
          <div>
            <h3 className={`font-semibold ${
              status.status === 'completed' ? 'text-green-400' :
              status.status === 'failed' ? 'text-red-400' : 'text-[var(--theme-heading)]'
            }`}>
              {status.status === 'completed' ? 'Download Complete' :
               status.status === 'failed' ? 'Download Failed' : 'Downloading'}
            </h3>
            <p className="text-[var(--theme-text)] text-sm">{status.message}</p>
            {status.path && <p className="text-[var(--theme-text)] text-xs font-mono break-all">Saved to: {status.path}</p>}
          </div>
        </div>
      )}

      <FileExplorerModal 
        isOpen={isExplorerOpen} 
        onClose={() => setIsExplorerOpen(false)} 
        onSelect={(path) => setOutputDir(path)} 
        title="Select Output Directory"
      />
    </div>
  );
}
