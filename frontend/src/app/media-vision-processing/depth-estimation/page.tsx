"use client";

import React, { useState, useEffect } from "react";
import { Settings, Image as ImageIcon, Film, Download, Play, Layers } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STColumns, STColumn } from "@/components/streamlit/STColumns";
import { Button } from "@/components/ui/Button";
import { ImageCompareSlider } from "@/components/ui/ImageCompareSlider";
import { STTabs } from "@/components/streamlit/STTabs";

export default function DepthEstimationPage() {
  // Config State
  const [colormap, setColormap] = useState("INFERNO");
  const [invert, setInvert] = useState(false);
  
  // Media State
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaOriginalUrl, setMediaOriginalUrl] = useState<string | null>(null);
  const [mediaDepthUrl, setMediaDepthUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaError, setMediaError] = useState("");
  
  const isVideo = mediaFile && mediaFile.name.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/i);
  const isImage = mediaFile && mediaFile.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/i);
  const [encoders, setEncoders] = useState<string[]>([]);
  const [chosenEncoder, setChosenEncoder] = useState("");

  useEffect(() => {
    // Fetch encoders
    fetch("http://127.0.0.1:8000/api/media-vision/ffmpeg-encoders")
      .then(res => res.json())
      .then(data => {
        if (data.encoders && data.encoders.length > 0) {
          setEncoders(data.encoders);
          setChosenEncoder(data.encoders[0]);
        }
      })
      .catch(err => console.error("Failed to load encoders", err));
  }, []);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      setMediaFile(f);
      if (mediaOriginalUrl) URL.revokeObjectURL(mediaOriginalUrl);
      if (mediaDepthUrl) URL.revokeObjectURL(mediaDepthUrl);
      setMediaOriginalUrl(URL.createObjectURL(f));
      setMediaDepthUrl(null);
      setMediaError("");
    }
  };



  const processMedia = async () => {
    if (!mediaFile) return;
    if (isVideo && !chosenEncoder) return;
    
    setIsProcessing(true);
    setMediaError("");
    setMediaDepthUrl(null);

    const formData = new FormData();
    formData.append("file", mediaFile);
    formData.append("colormap", colormap);
    formData.append("invert", invert.toString());
    
    let endpoint = "http://127.0.0.1:8000/api/media-vision/depth-image";
    if (isVideo) {
      const encoderName = chosenEncoder.split(" ")[0];
      formData.append("encoder", encoderName);
      endpoint = "http://127.0.0.1:8000/api/media-vision/depth-video";
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to generate depth map");
      }

      const blob = await res.blob();
      setMediaDepthUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setMediaError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadBlob = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="🌫️ Depth Estimation" />
        <p className="text-zinc-400 mt-2">
          Generate high-quality monocular depth maps from images and videos using ONNX-accelerated Depth Anything V2.
        </p>
      </div>

      <div className="space-y-6">
        <div>
            <STContainer title="Output Settings" icon={<Settings className="text-blue-400" size={20} />}>
              <div className="space-y-6">
                <STColumns>
                  <STColumn width={1}>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-300">Depth Colormap</label>
                        <select 
                          value={colormap} 
                          onChange={(e) => setColormap(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-blue-500 outline-none"
                        >
                          {["INFERNO", "PLASMA", "VIRIDIS", "MAGMA", "JET", "GRAY"].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer pt-2">
                        <input 
                          type="checkbox" 
                          checked={invert} 
                          onChange={(e) => setInvert(e.target.checked)}
                          className="rounded bg-zinc-900 border-white/20 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-950"
                        />
                        <span className="text-sm font-medium text-zinc-300">Invert Depth Map</span>
                      </label>
                    </div>
                  </STColumn>
                </STColumns>
                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-zinc-400 italic">Depth model size and hardware acceleration are configured globally in Model Settings.</p>
                </div>
              </div>
            </STContainer>
        </div>

        <div>
            <STContainer>
              <div className="space-y-6">
                {!mediaOriginalUrl ? (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-700 hover:border-blue-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className="mb-3 text-zinc-500" size={32} />
                      <p className="mb-2 text-sm text-zinc-400">
                        <span className="font-semibold text-zinc-200">Click to upload</span> or drag and drop media
                      </p>
                      <p className="text-xs text-zinc-500">JPG, PNG, WEBP, MP4, MOV, AVI</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-zinc-950 p-4 border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      {isVideo ? <Film size={20} className="text-zinc-400" /> : <ImageIcon size={20} className="text-zinc-400" />}
                      <span className="text-zinc-200 font-medium">{mediaFile?.name}</span>
                    </div>
                    <label className="cursor-pointer text-sm font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg transition-colors">
                      Change Media
                      <input type="file" className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />
                    </label>
                  </div>
                )}
                
                {isVideo && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-300">FFmpeg Video Encoder</label>
                      <select 
                        value={chosenEncoder} 
                        onChange={(e) => setChosenEncoder(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-blue-500 outline-none"
                      >
                        {encoders.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <p className="text-xs text-zinc-500 mt-1">Select a hardware encoder (like nvenc) for drastically faster processing.</p>
                    </div>
                )}

                {mediaError && (
                  <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm">
                    {mediaError}
                  </div>
                )}

                {mediaOriginalUrl && !mediaDepthUrl && (
                  <Button 
                    variant="primary" 
                    onClick={processMedia} 
                    isLoading={isProcessing}
                    icon={<Layers size={18} />}
                    className="w-full bg-blue-600 hover:bg-blue-500 border-none"
                  >
                    Generate Depth Map
                  </Button>
                )}

                {mediaOriginalUrl && mediaDepthUrl && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4 pt-4 border-t border-white/5">
                    <h3 className="text-xl font-bold text-zinc-200">Result Comparison</h3>
                    {!isVideo ? (
                      <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-950">
                        <ImageCompareSlider 
                          originalImage={mediaOriginalUrl} 
                          processedImage={mediaDepthUrl}
                          onProcessClick={() => {}} 
                          isProcessing={false}
                          processedLabel="Depth Map"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                        <video 
                          controls 
                          src={mediaDepthUrl} 
                          className="w-full h-auto max-h-[600px]" 
                        />
                      </div>
                    )}
                    <Button 
                      variant="primary" 
                      onClick={() => downloadBlob(mediaDepthUrl, `depth_${mediaFile?.name}`)}
                      icon={<Download size={18} />}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 border-none text-white"
                    >
                      Download Depth {isVideo ? 'Video' : 'Map'}
                    </Button>
                  </div>
                )}
              </div>
            </STContainer>
        </div>
      </div>
    </div>
  );
}
