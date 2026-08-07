"use client";

import React, { useState, useRef, useEffect } from "react";
import { ImageIcon, Video, Film, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { ImageCompareSlider } from "@/components/ui/ImageCompareSlider";

export default function ObjectDetectPage() {
  const [activeTab, setActiveTab] = useState("Image");

  const [selectedFileHash, setSelectedFileHash] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  const [confThresh, setConfThresh] = useState(0.5);
  const [outMethod, setOutMethod] = useState("Re-encode (Hard Burn)");
  const [chosenEncoder, setChosenEncoder] = useState("libx264");

  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaResultUrl, setMediaResultUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [webcamActive, setWebcamActive] = useState(false);
  const [aiFps, setAiFps] = useState(5);
  const [streamUrl, setStreamUrl] = useState("");

  const isImage = activeTab === "Image";
  const isVideo = activeTab === "Video";
  const isLive = activeTab === "Live Camera";

  const encoders = ["libx264", "libx265", "hevc_nvenc", "h264_nvenc"];

  const clearState = () => {
    setSelectedFileHash(null);
    setSelectedFileName(null);
    setOriginalUrl(null);
    setMediaResultUrl(null);
    setMediaError(null);
    setIsProcessing(false);
  };

  const toggleWebcam = () => {
    if (webcamActive) {
      setWebcamActive(false);
      setStreamUrl("");
    } else {
      setWebcamActive(true);
      const qs = new URLSearchParams({
        conf_thresh: confThresh.toString(),
        ai_fps: aiFps.toString()
      });
      setStreamUrl(`http://127.0.0.1:8000/api/media-vision/object-detect/webcam-stream?${qs.toString()}`);
    }
  };

  const processMedia = async () => {
    if (!selectedFileHash) return;
    setIsProcessing(true);
    setMediaError(null);
    setMediaResultUrl(null);

    const formData = new FormData();
    formData.append("hash_name", selectedFileHash);
    formData.append("conf_thresh", confThresh.toString());
    
    let ep = "http://127.0.0.1:8000/api/media-vision/object-detect/image";
    if (!isImage) {
      ep = "http://127.0.0.1:8000/api/media-vision/object-detect/video";
      const meth = outMethod.includes("Subtitle") ? "ass" : "hard";
      formData.append("output_method", meth);
      let enc = chosenEncoder;
      if (enc === "h264_nvenc") enc = "nvenc_h264";
      if (enc === "hevc_nvenc") enc = "nvenc_hevc";
      formData.append("encoder", enc);
    }

    try {
      const res = await fetch(ep, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to process media");
      }

      const blob = await res.blob();
      setMediaResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setMediaError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadBlob = () => {
    if (!mediaResultUrl) return;
    const a = document.createElement("a");
    a.href = mediaResultUrl;
    if (isImage) {
      a.download = `detected_${selectedFileName || "image.png"}`;
    } else {
      const ext = outMethod.includes("Subtitle") ? "ass" : "mp4";
      a.download = `detected_${selectedFileName || "video"}.${ext}`;
    }
    a.click();
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
             Local Object Detection
          </h1>
          <p className="text-zinc-400 text-sm font-medium">Run fast, highly optimized object detection using YOLO on Images, Videos, or Live Webcams.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs 
            tabs={[
              { id: "Image", label: "Image Detect", icon: <ImageIcon size={18} /> },
              { id: "Video", label: "Video Detect", icon: <Film size={18} /> },
              { id: "Live Camera", label: "Live Camera", icon: <Video size={18} /> }
            ]} 
            activeTab={activeTab} 
            setActiveTab={(tab) => {
              setActiveTab(tab);
              clearState();
              if (webcamActive) toggleWebcam();
            }} 
          />
        </div>
      </div>

      <div className="mt-8 animate-slide-up">
        {(activeTab === "Image" || activeTab === "Video") && (
          <div className="flex flex-col gap-8 w-full">
            {/* SECTION 1: INPUT */}
            <div className="flex flex-col gap-2">
              <SectionHeader title="Upload media" />
                
              <DirectUploadBox
                accept={activeTab === "Image" ? "image/*" : "video/*"}
                label={`Upload ${activeTab}`}
                onUploadComplete={(info) => {
                  setSelectedFileHash(info.hash_name);
                  setSelectedFileName(info.original_name);
                  setOriginalUrl(`http://127.0.0.1:8000/uploads/${info.hash_name}`);
                }}
                onClear={clearState}
                defaultFileName={selectedFileName || ""}
              />

              <SectionHeader title="Configuration" className="mt-8" />
              <div className="flex flex-col gap-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300">Confidence Threshold: {confThresh.toFixed(2)}</label>
                  <input 
                    type="range" min="0.1" max="0.99" step="0.01" value={confThresh} 
                    onChange={(e) => setConfThresh(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                {!isImage && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-300">Video Output Method</label>
                      <select 
                        value={outMethod} onChange={e => setOutMethod(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-md py-2 px-3 text-white focus:border-primary outline-none text-sm"
                      >
                        <option>Re-encode (Hard Burn)</option>
                        <option>Subtitle Overlay (.ass)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-300">FFmpeg Encoder</label>
                      <select 
                        value={chosenEncoder} onChange={e => setChosenEncoder(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-md py-2 px-3 text-white focus:border-primary outline-none text-sm"
                      >
                        {encoders.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {mediaError && (
                <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm mt-4">
                  {mediaError}
                </div>
              )}

              <Button
                variant="primary"
                className="w-full h-12 text-lg mt-2"
                onClick={processMedia}
                disabled={!selectedFileHash || isProcessing}
              >
                {isProcessing ? "Processing..." : `Process ${activeTab}`}
              </Button>
            </div>

            {/* SECTION 2: OUTPUT */}
            <div className="flex flex-col gap-2 mt-8 h-full">
              <SectionHeader title="Download Output" />

              <div className="flex-1 w-full bg-black/50 rounded-xl border border-white/5 relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
                {!mediaResultUrl ? (
                  <div className="flex flex-col items-center justify-center text-zinc-600 gap-3">
                    {isVideo ? <Film size={48} className="opacity-30" /> : <ImageIcon size={48} className="opacity-30" />}
                    <p>Processed media will appear here.</p>
                  </div>
                ) : isImage && originalUrl ? (
                  <div className="w-full h-full flex flex-col gap-4">
                    <ImageCompareSlider 
                      originalImage={originalUrl}
                      processedImage={mediaResultUrl}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black w-full">
                    {!isImage && outMethod.includes("Subtitle") ? (
                      <div className="p-4 bg-blue-900/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm text-center">
                        <p>💡 <strong>Success!</strong> Video was NOT re-encoded.</p>
                        <p className="mt-2">Download the `.ass` file and drag it into VLC along with your original video to see the bounding boxes.</p>
                      </div>
                    ) : (
                      <video controls src={mediaResultUrl} className="w-full h-auto max-h-[600px]" />
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                className="w-full mt-4 h-12 text-lg"
                onClick={downloadBlob}
                disabled={!mediaResultUrl}
                icon={<Download size={16} />}
              >
                Download {!isVideo ? 'Image' : outMethod.includes("Subtitle") ? 'Subtitle (.ass)' : 'Video'}
              </Button>
            </div>
          </div>
        )}

        {isLive && (
          <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
            <div className="flex flex-col gap-2">
              <SectionHeader title="Live Stream Setup" />

              <div className="flex flex-col gap-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300">Confidence Threshold: {confThresh.toFixed(2)}</label>
                  <input 
                    type="range" min="0.1" max="0.99" step="0.01" value={confThresh} 
                    onChange={(e) => {
                      setConfThresh(parseFloat(e.target.value));
                      if (webcamActive) {
                        setWebcamActive(false);
                        setStreamUrl("");
                      }
                    }}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300">AI Max FPS Limit: {aiFps}fps</label>
                  <input 
                    type="range" min="1" max="30" step="1" value={aiFps} 
                    onChange={(e) => {
                      setAiFps(parseInt(e.target.value));
                      if (webcamActive) {
                        setWebcamActive(false);
                        setStreamUrl("");
                      }
                    }}
                    className="w-full accent-primary"
                  />
                  <p className="text-xs text-zinc-500">Lower this if your GPU struggles to keep up.</p>
                </div>

                <Button
                  variant="primary"
                  className={`w-full h-12 text-lg border-none mt-2 transition-colors ${webcamActive ? 'bg-red-600 hover:bg-red-500' : 'bg-primary hover:bg-primary/90'}`}
                  onClick={toggleWebcam}
                >
                  {webcamActive ? "Stop Camera" : "Start Camera"}
                </Button>
              </div>
            </div>

            {webcamActive && (
              <div className="flex flex-col gap-2 mt-8">
                <SectionHeader title="Live Output" />
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black min-h-[400px] flex items-center justify-center">
                  <img src={streamUrl} alt="Webcam Stream" className="w-full h-auto" onError={() => setWebcamActive(false)} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
