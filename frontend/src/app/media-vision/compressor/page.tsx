"use client";

import React, { useState } from "react";
import { Film, Image as ImageIcon, Settings2, Folder, HardDrive, Cpu, Scissors, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";

export default function CompressorPage() {
  const [activeTab, setActiveTab] = useState("video");
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [explorerTarget, setExplorerTarget] = useState<"videoOut" | "imageIn" | "imageOut" | null>(null);

  // Video State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFilename, setVideoFilename] = useState("");
  const [videoOutDir, setVideoOutDir] = useState("C:\\Users\\Rigeru\\Videos");
  const [vidStart, setVidStart] = useState(0);
  const [vidEnd, setVidEnd] = useState(99999);
  const [vidProfile, setVidProfile] = useState("Handbrake: High Quality 1080p");
  
  // Custom Video Settings
  const [vidMaxRes, setVidMaxRes] = useState("1080p");
  const [vidCrf, setVidCrf] = useState(23);
  const [vidPreset, setVidPreset] = useState("fast");
  const [vidKeepAudio, setVidKeepAudio] = useState(true);
  const [vidAudioCodec, setVidAudioCodec] = useState("copy");
  
  const [isVideoProcessing, setIsVideoProcessing] = useState(false);

  // Image State
  const [imageInDir, setImageInDir] = useState("C:\\Users\\Rigeru\\Pictures");
  const [imageOutDir, setImageOutDir] = useState("C:\\Users\\Rigeru\\Pictures\\Compressed");
  const [imgQuality, setImgQuality] = useState(80);
  const [imgWidth, setImgWidth] = useState(1920);
  const [imgHeight, setImgHeight] = useState(0);
  
  const [isImageProcessing, setIsImageProcessing] = useState(false);

  const openExplorer = (target: "videoOut" | "imageIn" | "imageOut") => {
    setExplorerTarget(target);
    setIsExplorerOpen(true);
  };

  const handleDirectorySelect = (path: string) => {
    if (explorerTarget === "videoOut") setVideoOutDir(path);
    else if (explorerTarget === "imageIn") setImageInDir(path);
    else if (explorerTarget === "imageOut") setImageOutDir(path);
    setIsExplorerOpen(false);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setVideoFile(e.target.files[0]);
      setVideoFilename(e.target.files[0].name);
    }
  };

  const processVideo = async () => {
    if (!videoFile) return alert("Upload a video first");
    
    setIsVideoProcessing(true);
    
    try {
      // 1. Upload the video first
      const formData = new FormData();
      formData.append("file", videoFile);
      
      const uploadRes = await fetch("http://127.0.0.1:8000/api/subtitles/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error("Failed to upload video to temp cache");
      const uploadData = await uploadRes.json();
      const inputPath = `cache/temp/${uploadData.file_id}`;
      
      // 2. Resolve Profile settings
      let pRes = vidMaxRes, pCrf = vidCrf, pPreset = vidPreset, pAudio = vidKeepAudio, pACodec = vidAudioCodec;
      
      if (vidProfile === "Handbrake: Fast 1080p") {
        pRes = "1080p"; pCrf = 22; pPreset = "fast"; pAudio = false; pACodec = "aac";
      } else if (vidProfile === "Handbrake: High Quality 1080p") {
        pRes = "1080p"; pCrf = 18; pPreset = "slow"; pAudio = true; pACodec = "copy";
      } else if (vidProfile === "Handbrake: Web Optimized 720p") {
        pRes = "720p"; pCrf = 28; pPreset = "veryfast"; pAudio = false; pACodec = "aac";
      }
      
      // 3. Process video
      const processRes = await fetch("http://127.0.0.1:8000/api/media-vision/compress-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_path: inputPath,
          output_dir: videoOutDir,
          start_time: vidStart,
          end_time: vidEnd,
          target_res: pRes,
          crf: pCrf,
          preset: pPreset,
          keep_audio: pAudio,
          audio_codec: pACodec
        })
      });
      
      const data = await processRes.json();
      if (!processRes.ok) throw new Error(data.detail || "Video processing failed");
      
      alert(data.message || "Video processed successfully!");
      
    } catch (e: any) {
      console.error(e);
      alert(e.message || "An error occurred during video processing");
    } finally {
      setIsVideoProcessing(false);
    }
  };

  const processImages = async () => {
    if (!imageInDir || !imageOutDir) return alert("Please specify input and output directories");
    
    setIsImageProcessing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/compress-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_dir: imageInDir,
          output_dir: imageOutDir,
          quality: imgQuality,
          max_width: imgWidth,
          max_height: imgHeight
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Image processing failed");
      
      alert(data.message || "Images processed successfully!");
    } catch (e: any) {
      console.error(e);
      alert(e.message || "An error occurred during image processing");
    } finally {
      setIsImageProcessing(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <HardDrive className="text-blue-400" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Visual Media Compressor</h1>
          <p className="text-zinc-400 mt-1">Locally trim videos and batch-compress images to save hard drive space.</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden shadow-xl backdrop-blur-sm">
        {/* Tabs Header */}
        <div className="flex border-b border-white/5 bg-zinc-950/50">
          <button
            onClick={() => setActiveTab("video")}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "video" 
                ? "border-blue-500 text-blue-400 bg-blue-500/5" 
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            }`}
          >
            <Film size={16} /> Video Trimmer & Compressor
          </button>
          <button
            onClick={() => setActiveTab("image")}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "image" 
                ? "border-blue-500 text-blue-400 bg-blue-500/5" 
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            }`}
          >
            <ImageIcon size={16} /> Image Batch Compressor
          </button>
        </div>

        <div className="p-6">
          {/* VIDEO TAB */}
          {activeTab === "video" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">1. Select Input Video</h3>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 hover:border-blue-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
                    <div className="flex flex-col items-center justify-center">
                      <Film className="mb-2 text-zinc-500" size={24} />
                      <p className="text-sm text-zinc-400">
                        {videoFilename ? <span className="text-blue-400 font-medium">{videoFilename}</span> : "Click to upload video"}
                      </p>
                    </div>
                    <input type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} />
                  </label>
                </div>

                <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">2. Output Folder</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={videoOutDir}
                      onChange={(e) => setVideoOutDir(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-white/10 rounded-lg p-3 text-zinc-100 text-sm focus:border-blue-500 outline-none"
                    />
                    <Button variant="secondary" onClick={() => openExplorer("videoOut")} icon={<Folder size={18} />}>
                      Browse
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">The compressed video will be saved here.</p>
                </div>
              </div>

              <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6">
                <h3 className="font-medium text-zinc-100 mb-4 flex items-center gap-2"><Scissors size={18} className="text-blue-400"/> Trimming & Profile</h3>
                
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Start Time (seconds)</label>
                    <input 
                      type="number" 
                      min="0" step="1" 
                      value={vidStart} onChange={(e) => setVidStart(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-zinc-100 focus:border-blue-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">End Time (seconds)</label>
                    <input 
                      type="number" 
                      min="0" step="1" 
                      value={vidEnd} onChange={(e) => setVidEnd(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-zinc-100 focus:border-blue-500 outline-none" 
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Compression Profile</label>
                  <select 
                    value={vidProfile} onChange={(e) => setVidProfile(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-zinc-100 focus:border-blue-500 outline-none"
                  >
                    <option value="Custom Configuration">Custom Configuration</option>
                    <option value="Handbrake: Fast 1080p">Handbrake: Fast 1080p</option>
                    <option value="Handbrake: High Quality 1080p">Handbrake: High Quality 1080p</option>
                    <option value="Handbrake: Web Optimized 720p">Handbrake: Web Optimized 720p</option>
                  </select>
                </div>

                {vidProfile === "Custom Configuration" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-black/20 rounded-lg border border-white/5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Max Resolution</label>
                      <select value={vidMaxRes} onChange={(e) => setVidMaxRes(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded p-2 text-sm text-zinc-200 outline-none">
                        <option value="Keep Original">Keep Original</option>
                        <option value="1080p">1080p</option>
                        <option value="720p">720p</option>
                        <option value="480p">480p</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Encoding Speed Preset</label>
                      <select value={vidPreset} onChange={(e) => setVidPreset(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded p-2 text-sm text-zinc-200 outline-none">
                        {["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"].map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">CRF Quality (Lower = Better/Larger)</label>
                      <input type="range" min="0" max="51" value={vidCrf} onChange={(e) => setVidCrf(Number(e.target.value))} className="w-full" />
                      <div className="text-right text-xs text-blue-400">{vidCrf}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Audio Codec</label>
                      <select value={vidAudioCodec} onChange={(e) => setVidAudioCodec(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded p-2 text-sm text-zinc-200 outline-none">
                        <option value="aac">AAC (Recompress)</option>
                        <option value="copy">Copy (Original Quality)</option>
                      </select>
                    </div>
                    <div className="col-span-full">
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" checked={vidKeepAudio} onChange={(e) => setVidKeepAudio(e.target.checked)} className="rounded bg-zinc-900 border-white/10" />
                        Keep All Audio Tracks (Multi-track)
                      </label>
                    </div>
                  </div>
                )}
                
                <div className="mt-6">
                  <Button variant="primary" icon={<Play size={18} />} onClick={processVideo} disabled={isVideoProcessing} className="w-full">
                    {isVideoProcessing ? "Processing Video..." : "Process Video"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* IMAGE TAB */}
          {activeTab === "image" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">1. Input Image Folder</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={imageInDir}
                      onChange={(e) => setImageInDir(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-white/10 rounded-lg p-3 text-zinc-100 text-sm focus:border-blue-500 outline-none"
                    />
                    <Button variant="secondary" onClick={() => openExplorer("imageIn")} icon={<Folder size={18} />}>
                      Browse
                    </Button>
                  </div>
                </div>

                <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">2. Output Image Folder</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={imageOutDir}
                      onChange={(e) => setImageOutDir(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-white/10 rounded-lg p-3 text-zinc-100 text-sm focus:border-blue-500 outline-none"
                    />
                    <Button variant="secondary" onClick={() => openExplorer("imageOut")} icon={<Folder size={18} />}>
                      Browse
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6">
                <h3 className="font-medium text-zinc-100 mb-4 flex items-center gap-2"><Settings2 size={18} className="text-blue-400"/> Compression Settings</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">JPEG Quality: {imgQuality}</label>
                    <input 
                      type="range" min="10" max="100" 
                      value={imgQuality} onChange={(e) => setImgQuality(Number(e.target.value))}
                      className="w-full accent-blue-500" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Target Box Width (px)</label>
                      <input 
                        type="number" min="0" 
                        value={imgWidth} onChange={(e) => setImgWidth(Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-zinc-100 focus:border-blue-500 outline-none" 
                      />
                      <p className="text-xs text-zinc-500 mt-1">Set to 0 to ignore</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Target Box Height (px)</label>
                      <input 
                        type="number" min="0" 
                        value={imgHeight} onChange={(e) => setImgHeight(Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-zinc-100 focus:border-blue-500 outline-none" 
                      />
                      <p className="text-xs text-zinc-500 mt-1">Set to 0 to ignore</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Button variant="primary" icon={<Play size={18} />} onClick={processImages} disabled={isImageProcessing} className="w-full">
                    {isImageProcessing ? "Compressing Images..." : "Batch Compress Images"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <FileExplorerModal
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        onSelect={handleDirectorySelect}
        title="Select Folder"
      />
    </div>
  );
}
