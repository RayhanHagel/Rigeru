"use client";
import { Header } from "@/components/ui/Header";

import React, { useState } from "react";

import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { Icon } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function VideoToGifPage() {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fps, setFps] = useState(15);
  const [scale, setScale] = useState(480);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultGifUrl, setResultGifUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState("");

  const handleConvert = async () => {
    if (!fileHash) return;
    
    setIsProcessing(true);
    setErrorMsg("");
    setResultGifUrl(null);
    
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    formData.append("fps", fps.toString());
    formData.append("scale", scale.toString());
    
    try {
      const res = await fetch("/api/media-vision/video-to-gif", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Conversion failed");
      }
      
      // Get the GIF blob
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultGifUrl(url);
      
      const originalName = fileName.split('.')[0];
      setResultFilename(`${originalName}_${fps}fps_${scale}w.gif`);
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to convert video");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Video to GIF" subtitle="Convert video clips to high-quality optimized GIFs." />

      <div className="flex flex-col gap-6 mt-4">
        
        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
            <Icon name="error" className="text-red-400 shrink-0 mt-0.5" size={18} />
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}
        
        {!resultGifUrl ? (
          <div className="flex flex-col gap-2">
            <SectionHeader title="Upload Video" />
            <DirectUploadBox 
              accept="video/*"
              label="Upload Video"
              className="w-full"
              onUploadComplete={(info) => {
                setFileHash(info.hash_name);
                setFileName(info.original_name);
                setResultGifUrl(null);
                setErrorMsg("");
              }}
              onClear={() => {
                setFileHash(null);
                setFileName("");
              }}
            />
            {fileHash && (
              <div className="mt-4 p-10 border border-dashed border-[var(--theme-ui-border)] rounded-xl bg-[var(--theme-ui-bg)] flex flex-col items-center justify-center text-[var(--theme-text)] opacity-60">
                <Icon name="movie" size={48} className="mb-4 opacity-50" />
                <p>Video loaded. Adjust output settings below and convert to GIF.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <SectionHeader title="Generated GIF" />
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
              <div className="relative w-full max-w-2xl bg-[var(--theme-bg)] rounded-xl border border-[var(--theme-ui-border)] overflow-hidden shadow-2xl">
                <div className="bg-[var(--theme-ui-bg)] border-b border-[var(--theme-ui-border)] p-3 flex items-center gap-2">
                  <Icon name="image" className="text-[var(--theme-heading)]" size={16} />
                  <span className="text-xs font-medium text-[var(--theme-text)]">{resultFilename}</span>
                </div>
                <div className="p-4 flex items-center justify-center bg-[#000000] min-h-[300px]">
                  <img src={resultGifUrl} alt="Generated GIF" className="max-w-full max-h-[500px] object-contain" />
                </div>
                <div className="bg-[var(--theme-ui-bg)] border-t border-[var(--theme-ui-border)] p-4 flex justify-between items-center">
                  <button 
                    onClick={() => {
                      setResultGifUrl(null);
                      setFileHash(null);
                    }}
                    className="text-sm font-medium text-[var(--theme-text)] hover:text-[var(--theme-text)]"
                  >
                    Convert Another
                  </button>
                  <a 
                    href={resultGifUrl} 
                    download={resultFilename}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-heading)] text-[var(--theme-bg)] hover:opacity-90 rounded-lg text-sm font-bold transition-colors"
                  >
                    <Icon name="download" size={16} /> Download GIF
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <SectionHeader title={!resultGifUrl ? "2. Output Settings" : "Output Settings"} />
          <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-6 shadow-sm">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-[var(--theme-heading)]">Frames Per Second</label>
                  <span className="text-xs text-[var(--theme-text)] font-mono">{fps} FPS</span>
                </div>
                <input 
                  type="range" 
                  min="5" max="30" step="1"
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  className="w-full accent-[var(--theme-heading)]"
                />
                <p className="text-xs text-[var(--theme-text)]">Higher FPS = smoother but larger file.</p>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-[var(--theme-heading)]">Width (Scale)</label>
                  <span className="text-xs text-[var(--theme-text)] font-mono">{scale}px</span>
                </div>
                <input 
                  type="range" 
                  min="160" max="1080" step="10"
                  value={scale}
                  onChange={(e) => setScale(parseInt(e.target.value))}
                  className="w-full accent-[var(--theme-heading)]"
                />
                <p className="text-xs text-[var(--theme-text)]">Higher width = sharper but larger file.</p>
              </div>
              
              <div className="pt-4">
                <Button 
                  variant="primary" 
                  className="w-full py-3 text-base font-medium transition-shadow"
                  onClick={handleConvert}
                  disabled={!fileHash || isProcessing}
                >
                  {isProcessing ? (
                    <><Icon name="progress_activity" size={18} className="animate-spin mr-2" /> Processing</>
                  ) : (
                    "Convert to GIF"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
