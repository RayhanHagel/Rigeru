"use client";
import { Header } from "@/components/ui/Header";

import React, { useState } from "react";
import { FileVideo, Upload, Image as ImageIcon, Settings2, Download, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";

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

      <div className="flex flex-col gap-6 animate-slide-up">
        <div className="w-full space-y-6">
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 shadow-xl backdrop-blur-sm h-full flex flex-col">
            
            {errorMsg && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                <p className="text-red-400 text-sm">{errorMsg}</p>
              </div>
            )}
            
            {!resultGifUrl ? (
              <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <DirectUploadBox 
                  accept="video/*"
                  label="Upload Video"
                  className="w-full max-w-lg"
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
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                <div className="relative w-full max-w-2xl bg-zinc-950 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                  <div className="bg-zinc-900 border-b border-white/5 p-3 flex items-center gap-2">
                    <ImageIcon className="text-pink-400" size={16} />
                    <span className="text-xs font-medium text-zinc-300">{resultFilename}</span>
                  </div>
                  <div className="p-4 flex items-center justify-center bg-[#000000] min-h-[300px]">
                    <img src={resultGifUrl} alt="Generated GIF" className="max-w-full max-h-[500px] object-contain" />
                  </div>
                  <div className="bg-zinc-900 border-t border-white/5 p-4 flex justify-between items-center">
                    <button 
                      onClick={() => {
                        setResultGifUrl(null);
                        setFileHash(null);
                      }}
                      className="text-sm font-medium text-zinc-400 hover:text-zinc-200"
                    >
                      Convert Another
                    </button>
                    <a 
                      href={resultGifUrl} 
                      download={resultFilename}
                      className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Download size={16} /> Download GIF
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full space-y-6">
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 shadow-xl backdrop-blur-sm">
            <h3 className="font-medium text-zinc-100 mb-4 flex items-center gap-2">Output Settings</h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-zinc-300">Frames Per Second</label>
                  <span className="text-xs text-zinc-500 font-mono">{fps} FPS</span>
                </div>
                <input 
                  type="range" 
                  min="5" max="30" step="1"
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  className="w-full accent-pink-500"
                />
                <p className="text-xs text-zinc-500">Higher FPS = smoother but larger file.</p>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-zinc-300">Width (Scale)</label>
                  <span className="text-xs text-zinc-500 font-mono">{scale}px</span>
                </div>
                <input 
                  type="range" 
                  min="160" max="1080" step="10"
                  value={scale}
                  onChange={(e) => setScale(parseInt(e.target.value))}
                  className="w-full accent-pink-500"
                />
                <p className="text-xs text-zinc-500">Higher width = sharper but larger file.</p>
              </div>
              
              <div className="pt-4">
                <Button 
                  variant="primary" 
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white border-transparent" 
                  onClick={handleConvert}
                  disabled={!fileHash || isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 size={18} className="animate-spin mr-2" /> Processing</>
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
