"use client";

import React, { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { ImageCompareSlider } from "@/components/ui/ImageCompareSlider";
import { VirtualCameraBroadcast } from "@/components/ui/VirtualCameraBroadcast";
import { Icon } from "@/lib/utils";

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
  const [useExtrapolation, setUseExtrapolation] = useState(true);
  const [streamUrl, setStreamUrl] = useState("");
  const [cameras, setCameras] = useState<number[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<number>(0);
  
  const streamImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token") || "";
    fetch("http://127.0.0.1:8000/api/media-vision/object-detect/cameras", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.cameras && data.cameras.length > 0) {
          setCameras(data.cameras);
          setSelectedCamera(data.cameras[0]);
        }
      })
      .catch(err => console.error("Failed to fetch cameras", err));
  }, []);

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

  const toggleWebcam = async () => {
    if (webcamActive) {
      setWebcamActive(false);
      setStreamUrl("");
      const fd = new FormData();
      fd.append("camera_index", selectedCamera.toString());
      fetch("http://127.0.0.1:8000/api/media-vision/webcam/stop", { method: "POST", body: fd }).catch(console.error);
    } else {
      setWebcamActive(true);
      
      const token = localStorage.getItem("auth_token") || "";
      const fd = new FormData();
      fd.append("camera_index", selectedCamera.toString());
      fd.append("ai_fps", aiFps.toString());
      fd.append("selected_classes", "");
      
      try {
        await fetch("http://127.0.0.1:8000/api/media-vision/object-detect/webcam-config", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: fd
        });
      } catch (e) {
        console.error("Failed to configure webcam", e);
      }

      const qs = new URLSearchParams({
        conf_thresh: confThresh.toString(),
        camera_index: selectedCamera.toString(),
        use_extrapolation: useExtrapolation.toString(),
        token: token,
        _t: Date.now().toString()
      });
      setStreamUrl(`http://127.0.0.1:8000/api/media-vision/object-detect/webcam-stream?${qs.toString()}`);
    }
  };

  useEffect(() => {
    if (webcamActive) {
      const token = localStorage.getItem("auth_token") || "";
      const fd = new FormData();
      fd.append("camera_index", selectedCamera.toString());
      fd.append("ai_fps", aiFps.toString());
      fd.append("selected_classes", "");
      
      fetch("http://127.0.0.1:8000/api/media-vision/object-detect/webcam-config", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: fd
      }).catch(e => console.error("Failed to configure webcam", e));

      const qs = new URLSearchParams({
        conf_thresh: confThresh.toString(),
        camera_index: selectedCamera.toString(),
        use_extrapolation: useExtrapolation.toString(),
        token: token,
        _t: Date.now().toString()
      });
      setStreamUrl(`http://127.0.0.1:8000/api/media-vision/object-detect/webcam-stream?${qs.toString()}`);
    }
  }, [confThresh, selectedCamera, useExtrapolation, aiFps]);

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
      formData.append("ai_fps", aiFps.toString());
      formData.append("use_extrapolation", useExtrapolation.toString());
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-[var(--theme-ui-border)] pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-[var(--theme-heading)] tracking-tight flex items-center gap-3">
             Local Object Detection
          </h1>
          <p className="text-[var(--theme-text)] text-sm font-medium">Run fast, highly optimized object detection using YOLO on Images, Videos, or Live Webcams.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs 
            tabs={[
              { id: "Image", label: "Image Detect", icon: <Icon name="image" size={18} /> },
              { id: "Video", label: "Video Detect", icon: <Icon name="movie" size={18} /> },
              { id: "Live Camera", label: "Live Camera", icon: <Icon name="videocam" size={18} /> }
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
              
              <div className={`grid grid-cols-1 ${!isImage ? "md:grid-cols-2" : ""} gap-6 mt-4`}>
                {/* CARD 1: Detection Settings */}
                <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                  <div className="flex items-center gap-2 font-medium pb-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                    <h3 className="text-[var(--theme-heading)]">Detection Settings</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-[var(--theme-heading)]">Confidence Threshold</label>
                        <span className="text-xs font-mono text-[var(--theme-text)] bg-[var(--theme-bg)] px-2 py-1 rounded-md border" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                          {confThresh.toFixed(2)}
                        </span>
                      </div>
                      <input 
                        type="range" min="0.1" max="0.99" step="0.01" value={confThresh} 
                        onChange={(e) => setConfThresh(parseFloat(e.target.value))}
                        className="w-full accent-[var(--theme-heading)] bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    {!isImage && (
                      <>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-[var(--theme-heading)]">AI Inference Rate (FPS)</label>
                            <span className="text-xs font-mono text-[var(--theme-text)] bg-[var(--theme-bg)] px-2 py-1 rounded-md border" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                              {aiFps}
                            </span>
                          </div>
                          <input 
                            type="range" min="1" max="60" step="1" value={aiFps} 
                            onChange={(e) => setAiFps(parseInt(e.target.value))}
                            className="w-full accent-[var(--theme-heading)] bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <label className="text-sm font-medium text-[var(--theme-text)]">Extrapolate In-between Frames</label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={useExtrapolation} onChange={(e) => setUseExtrapolation(e.target.checked)} />
                            <div className="w-9 h-5 bg-[var(--theme-ui-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--theme-heading)]"></div>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* CARD 2: Video Export (Only for Video) */}
                {!isImage && (
                  <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                    <div className="flex items-center gap-2 font-medium pb-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                      <h3 className="text-[var(--theme-heading)]">Video Export Options</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-[var(--theme-text)]">Video Output Method</label>
                        <select value={outMethod} onChange={e => setOutMethod(e.target.value)}
                          className="w-full bg-[var(--theme-bg)] rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors border"
                          style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                        >
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Re-encode (Hard Burn)</option>
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Subtitle Overlay (.ass)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-[var(--theme-text)]">FFmpeg Encoder</label>
                        <select value={chosenEncoder} onChange={e => setChosenEncoder(e.target.value)}
                          className="w-full bg-[var(--theme-bg)] rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors border"
                          style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                        >
                          {encoders.map(e => <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {mediaError && (
                <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm mt-4">
                  {mediaError}
                </div>
              )}

              <Button variant="primary"
                className="w-full h-12 text-lg mt-2 border-none !shadow-none !ring-0 !outline-none transition-colors"
                onClick={processMedia}
                disabled={!selectedFileHash || isProcessing}
               style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}>
                {isProcessing ? "Processing..." : `Process ${activeTab}`}
              </Button>
            </div>

            {/* SECTION 2: OUTPUT */}
            <div className="flex flex-col gap-2 mt-8 h-full">
              <SectionHeader title="Download Output" />

              <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
                {!mediaResultUrl ? (
                  <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                    {isVideo ? <Icon name="movie" size={48} className="opacity-30" /> : <Icon name="image" size={48} className="opacity-30" />}
                    <p>Processed media will appear here.</p>
                  </div>
                ) : isImage && originalUrl ? (
                  <div className="w-full h-full flex flex-col gap-4">
                    <ImageCompareSlider 
                      originalImage={originalUrl}
                      processedImage={mediaResultUrl}
                      processedLabel="Detected"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden shadow-2xl border border-[var(--theme-ui-border)] bg-[var(--theme-bg)] w-full">
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
              <Button variant="primary"
                className="w-full mt-4 h-12 text-lg border-none !shadow-none !ring-0 !outline-none transition-colors"
                style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
                onClick={downloadBlob}
                disabled={!mediaResultUrl}
                icon={<Icon name="download" size={16} />}
              >
                Download {!isVideo ? 'Image' : outMethod.includes("Subtitle") ? 'Subtitle (.ass)' : 'Video'}
              </Button>
            </div>
          </div>
        )}

        {isLive && (
          <div className="flex flex-col gap-8 w-full mx-auto">
            <div className="flex flex-col gap-2">
              <SectionHeader title="Live Stream Setup" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* CARD 1: Camera Source */}
                <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                  <div className="flex items-center gap-2 font-medium pb-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                    <h3 className="text-[var(--theme-heading)]">Camera Source</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-[var(--theme-text)]">Select Camera</label>
                      <select value={selectedCamera} 
                        onChange={e => {
                          setSelectedCamera(parseInt(e.target.value));
                          if (webcamActive) {
                            setWebcamActive(false);
                            setStreamUrl("");
                          }
                        }}
                        className="w-full bg-[var(--theme-bg)] rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors border"
                        style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                      >
                        {cameras.length > 0 ? (
                          cameras.map(c => <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={c} value={c}>Camera {c}</option>)
                        ) : (
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={0}>Camera 0</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* CARD 2: Model Configuration */}
                <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                  <div className="flex items-center gap-2 font-medium pb-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                    <h3 className="text-[var(--theme-heading)]">Model Configuration</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-[var(--theme-heading)]">Confidence Threshold</label>
                        <span className="text-xs font-mono text-[var(--theme-text)] bg-[var(--theme-bg)] px-2 py-1 rounded-md border" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                          {confThresh.toFixed(2)}
                        </span>
                      </div>
                      <input 
                        type="range" min="0.1" max="0.99" step="0.01" value={confThresh} 
                        onChange={(e) => {
                          setConfThresh(parseFloat(e.target.value));
                          if (webcamActive) {
                            setWebcamActive(false);
                            setStreamUrl("");
                          }
                        }}
                        className="w-full accent-[var(--theme-heading)] bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-xs text-[var(--theme-text)] mt-1">Lower this if your GPU struggles to keep up.</p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-[var(--theme-heading)]">AI Inference Rate (FPS)</label>
                        <span className="text-xs font-mono text-[var(--theme-text)] bg-[var(--theme-bg)] px-2 py-1 rounded-md border" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                          {aiFps}
                        </span>
                      </div>
                      <input 
                        type="range" min="1" max="60" step="1" value={aiFps} 
                        onChange={(e) => {
                          setAiFps(parseInt(e.target.value));
                          if (webcamActive) {
                            setWebcamActive(false);
                            setStreamUrl("");
                          }
                        }}
                        className="w-full accent-[var(--theme-heading)] bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="text-sm font-medium text-[var(--theme-text)]">Extrapolate In-between Frames</label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={useExtrapolation} onChange={(e) => {
                          setUseExtrapolation(e.target.checked);
                          if (webcamActive) {
                            setWebcamActive(false);
                            setStreamUrl("");
                          }
                        }} />
                        <div className="w-9 h-5 bg-[var(--theme-ui-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--theme-heading)]"></div>
                      </label>
                    </div>

                  </div>
                </div>
              </div>

                <Button variant="primary"
                  className={`w-full h-12 text-lg border-none mt-2 transition-colors ${webcamActive ? 'bg-red-600 hover:bg-red-500' : 'bg-primary hover:bg-primary/90'}`}
                  onClick={toggleWebcam}
                 style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}>
                  {webcamActive ? "Stop Camera" : "Start Camera"}
                </Button>
              </div>

            {webcamActive && (
              <div className="flex flex-col gap-2 mt-8">
                <SectionHeader title="Live Output" />
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md min-h-[400px] flex items-center justify-center">
                  {streamUrl ? (
                    <img ref={streamImageRef} crossOrigin="anonymous" src={streamUrl} alt="Webcam Stream" className="w-full h-auto transition-opacity duration-300" onError={() => setWebcamActive(false)} />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-[var(--theme-text)]">
                      <Icon name="progress_activity" size={32} className="animate-spin" />
                      <span>Starting camera...</span>
                    </div>
                  )}
                </div>
                
                {streamUrl && (
                  <VirtualCameraBroadcast 
                    sourceRef={streamImageRef} 
                    isStreamActive={webcamActive} 
                    mode="backend"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
