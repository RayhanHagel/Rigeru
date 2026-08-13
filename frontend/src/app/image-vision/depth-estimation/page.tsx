"use client";

import React, { useState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { ImageCompareSlider } from "@/components/ui/ImageCompareSlider";
import { ModernTabs } from "@/components/ui/ModernTabs";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ImageZoomModal } from "@/components/ui/ImageZoomModal";
import { VirtualCameraBroadcast } from "@/components/ui/VirtualCameraBroadcast";
import { Icon } from "@/lib/utils";

export default function DepthEstimationPage() {
  const [activeTab, setActiveTab] = useState("Image");

  // Config State
  const [colormap, setColormap] = useState("INFERNO");
  const [invert, setInvert] = useState(false);

  // Media State
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaHash, setMediaHash] = useState<string | null>(null);
  const [mediaOriginalUrl, setMediaOriginalUrl] = useState<string | null>(null);
  const [mediaDepthUrl, setMediaDepthUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaError, setMediaError] = useState("");

  // Preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Webcam State
  const [cameras, setCameras] = useState<number[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [aiFps, setAiFps] = useState(5);
  const [webcamActive, setWebcamActive] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const streamImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Fetch cameras
    fetch("http://127.0.0.1:8000/api/media-vision/object-detect/cameras")
      .then(res => res.json())
      .then(data => {
        if (data.cameras) setCameras(data.cameras);
      })
      .catch(err => console.error("Failed to load cameras", err));
  }, []);

  const clearState = () => {
    setMediaFile(null);
    setMediaHash(null);
    setMediaOriginalUrl(null);
    setMediaDepthUrl(null);
    setMediaError("");
  };

  const processMedia = async () => {
    if (!mediaHash) return;

    setIsProcessing(true);
    setMediaError("");
    setMediaDepthUrl(null);

    const formData = new FormData();
    formData.append("file_hash", mediaHash);
    formData.append("colormap", colormap);
    formData.append("invert", invert.toString());

    let endpoint = "http://127.0.0.1:8000/api/media-vision/depth-image";
    if (activeTab === "Video") {
      formData.append("encoder", "libx264"); // Default encoder
      formData.append("ai_fps", aiFps.toString());
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

  const toggleWebcam = () => {
    if (webcamActive) {
      setWebcamActive(false);
      setStreamUrl(null);
      const fd = new FormData();
      fd.append("camera_index", cameraIndex.toString());
      fetch("http://127.0.0.1:8000/api/media-vision/webcam/stop", { method: "POST", body: fd }).catch(console.error);
    } else {
      setWebcamActive(true);
      const url = new URL("http://127.0.0.1:8000/api/media-vision/depth-estimation/webcam-stream");
      url.searchParams.append("camera_index", cameraIndex.toString());
      url.searchParams.append("colormap", colormap);
      url.searchParams.append("invert", invert.toString());
      url.searchParams.append("ai_fps", aiFps.toString());
      url.searchParams.append("_t", Date.now().toString());
      setStreamUrl(url.toString());
    }
  };

  useEffect(() => {
    if (webcamActive) {
      const url = new URL("http://127.0.0.1:8000/api/media-vision/depth-estimation/webcam-stream");
      url.searchParams.append("camera_index", cameraIndex.toString());
      url.searchParams.append("colormap", colormap);
      url.searchParams.append("invert", invert.toString());
      url.searchParams.append("ai_fps", aiFps.toString());
      url.searchParams.append("_t", Date.now().toString());
      setStreamUrl(url.toString());
    }
  }, [cameraIndex, colormap, invert, aiFps]);

  const downloadBlob = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const renderSettings = () => (
    <div className="flex flex-col gap-2 mt-8">
      <SectionHeader title="Configuration" />

      <div className="grid grid-cols-1 gap-6 mt-4">

        {/* CARD 1: Depth Details */}
        <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
          <div className="flex items-center gap-2 font-medium pb-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
            <h3 className="text-[var(--theme-heading)]">Depth Map Settings</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--theme-text)]">Depth Colormap</label>
              <select value={colormap}
                onChange={e => setColormap(e.target.value)}
                className="w-full bg-[var(--theme-bg)] rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors border"
                style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              >
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="inferno">Inferno (Standard)</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="plasma">Plasma</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="magma">Magma</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="viridis">Viridis</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="cividis">Cividis</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="twilight">Twilight</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="gray">Grayscale (Linear Depth)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={invert}
                onChange={(e) => setInvert(e.target.checked)}
                className="rounded accent-[var(--theme-heading)] border border-[var(--theme-ui-border)] w-4 h-4 cursor-pointer"
              />
              <span className="text-sm font-medium text-[var(--theme-text)]">Invert Depth Map</span>
            </label>

            {activeTab !== "Image" && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--theme-heading)]">Video Processing Rate (FPS)</label>
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
                      setStreamUrl(null);
                    }
                  }}
                  className="w-full accent-[var(--theme-heading)] bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-[var(--theme-ui-border)] pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-[var(--theme-heading)] tracking-tight">Depth Estimation</h1>
          <p className="text-[var(--theme-text)] text-sm font-medium">Generate high-quality monocular depth maps from images, videos, and webcams.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs
            tabs={[
              { id: "Image", label: "Image Depth", icon: <Icon name="image" size={18} /> },
              { id: "Video", label: "Video Depth", icon: <Icon name="movie" size={18} /> },
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

      <div className="mt-8">
        {(activeTab === "Image" || activeTab === "Video") && (
          <div className="flex flex-col gap-8 w-full">
            {/* SECTION 1: INPUT */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <SectionHeader title="Upload media" />

                <DirectUploadBox
                  accept={activeTab === "Image" ? "image/png, image/jpeg, image/webp" : "video/mp4, video/webm, video/quicktime"}
                  label={`Upload ${activeTab}`}
                  onUploadComplete={(info) => {
                    setMediaHash(info.hash_name);
                    setMediaOriginalUrl(`http://127.0.0.1:8000/uploads/${info.hash_name}`);
                  }}
                  onClear={clearState}
                />

                {renderSettings()}

                {mediaError && (
                  <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm mt-2">
                    {mediaError}
                  </div>
                )}

                <Button variant="primary"
                  className="w-full h-12 text-lg mt-2 border-none !shadow-none !ring-0 !outline-none transition-colors"
                  onClick={processMedia}
                  disabled={!mediaHash || isProcessing}
                  style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}>
                  {isProcessing ? "Processing..." : `Process ${activeTab}`}
                </Button>
              </div>
            </div>

            {/* SECTION 2: OUTPUT */}
            <div className="flex flex-col gap-2 mt-8 h-full">
              <SectionHeader title="Download Output" />

              <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
                {!mediaDepthUrl ? (
                  <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                    {activeTab === "Image" ? <Icon name="image" size={48} className="opacity-30" /> : <Icon name="movie" size={48} className="opacity-30" />}
                    <p>Processed {activeTab.toLowerCase()} will appear here.</p>
                  </div>
                ) : activeTab === "Image" && mediaOriginalUrl ? (
                  <div className="w-full h-full flex flex-col gap-4">
                    <ImageCompareSlider
                      originalImage={mediaOriginalUrl}
                      processedImage={mediaDepthUrl}
                      processedLabel="Depth Map"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-center"
                      onClick={() => setPreviewImage(mediaDepthUrl)}
                    >
                      View Fullscreen
                    </Button>
                  </div>
                ) : (
                  <video src={mediaDepthUrl} controls className="w-full h-full object-contain" />
                )}
              </div>
              <Button variant="primary"
                className="w-full mt-4 h-12 text-lg border-none !shadow-none !ring-0 !outline-none transition-colors"
                style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
                onClick={() => mediaDepthUrl && downloadBlob(mediaDepthUrl, `depth_${activeTab.toLowerCase()}.${activeTab === "Image" ? 'png' : 'mp4'}`)}
                disabled={!mediaDepthUrl}
                icon={<Icon name="download" size={16} />}
              >
                Download
              </Button>
            </div>
          </div>
        )}

        {activeTab === "Live Camera" && (
          <div className="flex flex-col gap-8 w-full">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <SectionHeader title="Upload media" />

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--theme-text)]">Select Camera Index</label>
                  <select value={cameraIndex}
                    onChange={(e) => setCameraIndex(Number(e.target.value))}
                    className="w-full bg-[var(--theme-bg)] rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors border"
                    style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                  >
                    {cameras.length === 0 ? <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={0}>Camera 0</option> : cameras.map(c => (
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={c} value={c}>Camera {c}</option>
                    ))}
                  </select>
                </div>

                {renderSettings()}

                <Button variant="primary"
                  onClick={toggleWebcam}
                  icon={webcamActive ? <Icon name="stop_circle" size={18} /> : <Icon name="play_arrow" size={18} />}
                  className={`w-full h-12 text-lg border-none transition-colors mt-2 ${webcamActive ? 'bg-red-600 hover:bg-red-500' : 'bg-primary hover:bg-primary/90'}`}
                >
                  {webcamActive ? "Stop Webcam" : "Start Webcam Stream"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-8 h-full">
              <SectionHeader title="Download Output" />
              <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
                {!streamUrl ? (
                  <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                    <Icon name="videocam" size={48} className="opacity-30" />
                    <p>Webcam stream is inactive.</p>
                  </div>
                ) : (
                  <img
                    ref={streamImageRef}
                    crossOrigin="anonymous"
                    src={streamUrl}
                    alt="Live Stream"
                    className="w-full h-full object-contain transition-opacity duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
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
          </div>
        )}
      </div>

      <ImageZoomModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage || ""}
      />
    </div>
  );
}
