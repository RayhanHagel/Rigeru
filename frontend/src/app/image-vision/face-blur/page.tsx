"use client";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";

import React, { useState, useEffect, useRef } from "react";


import { Button } from "@/components/ui/Button";
import { ModernTabs } from "@/components/ui/ModernTabs";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { VirtualCameraBroadcast } from "@/components/ui/VirtualCameraBroadcast";
import { Icon } from "@/lib/utils";

const DETECT_MODELS = {
  "buffalo_l": "buffalo_l (High Accuracy)",
  "buffalo_m": "buffalo_m (Balanced)",
  "buffalo_s": "buffalo_s (Fast/Lightweight)",
  "antelopev2": "antelopev2 (Latest/Experimental)",
};

const REC_MODELS = {
  "buffalo_l": "buffalo_l (High Accuracy)",
  "buffalo_m": "buffalo_m (Balanced)",
  "buffalo_s": "buffalo_s (Fast/Lightweight)",
  "antelopev2": "antelopev2 (Latest/Experimental)",
};

export default function FaceBlurPage() {
  // Global Media
  const [mediaHash, setMediaHash] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string | null>(null);
  const isVideo = mediaName && mediaName.toLowerCase().match(/\.(mp4|mov|avi|mkv)$/i);
  const isImage = mediaName && mediaName.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i);

  // Config State
  const [outMethod, setOutMethod] = useState("Re-encode (Hard Blur)");
  const [blurStyle, setBlurStyle] = useState("Gaussian");
  const [blurIntensity, setBlurIntensity] = useState(50);

  // Video clustering
  const [clusterMethod, setClusterMethod] = useState("Global (Immich-style, High Accuracy)");
  const [clusterThresh, setClusterThresh] = useState(0.50);
  const [matchThresh, setMatchThresh] = useState(0.50);
  const [fpsScan, setFpsScan] = useState(5.0);
  const [gapLimit, setGapLimit] = useState(1.0);

  // Encoders
  const [encoders, setEncoders] = useState<string[]>([]);
  const [chosenEncoder, setChosenEncoder] = useState("");

  // Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanned, setScanned] = useState(false);
  const [faceData, setFaceData] = useState<any[]>([]);
  const [inputPath, setInputPath] = useState("");
  const [frameCachePath, setFrameCachePath] = useState("");

  // Selection State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Process State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Webcam State
  const [cameras, setCameras] = useState<number[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [webcamActive, setWebcamActive] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [useExtrapolation, setUseExtrapolation] = useState(true);
  const [activeTab, setActiveTab] = useState("Image");

  const streamImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/media-vision/ffmpeg-encoders")
      .then(res => res.json())
      .then(data => {
        if (data.encoders && data.encoders.length > 0) {
          setEncoders(data.encoders);
          setChosenEncoder(data.encoders[0]);
        }
      })
      .catch(console.error);

    fetch("http://127.0.0.1:8000/api/media-vision/object-detect/cameras")
      .then(res => res.json())
      .then(data => {
        if (data.cameras) setCameras(data.cameras);
      })
      .catch(console.error);
  }, []);

  const handleMediaUpload = (info: { hash_name: string; original_name: string; file_type: string }) => {
    setMediaHash(info.hash_name);
    setMediaName(info.original_name);
    // reset state
    setScanned(false);
    setFaceData([]);
    setInputPath("");
    setFrameCachePath("");
    setResultUrl(null);
  };

  const runScan = async () => {
    if (!mediaHash) return;
    setIsScanning(true);
    setScanError("");
    setScanned(false);

    const formData = new FormData();
    formData.append("file_hash", mediaHash);
    if (!isImage) {
      formData.append("clustering_method", clusterMethod.split(" ")[0]);
      formData.append("fps_scan", fpsScan.toString());
      formData.append("cluster_threshold", clusterThresh.toString());
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/face-blur/scan", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to scan faces");

      setFaceData(data.face_data);
      setInputPath(data.input_path);
      setFrameCachePath(data.frame_cache_path || "");
      setSelectedIds(data.face_data.map((f: any) => f.id)); // select all by default
      setScanned(true);

    } catch (err: any) {
      setScanError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const runProcess = async () => {
    if (!scanned) return;
    setIsProcessing(true);
    setProcessError("");
    setResultUrl(null);

    const selFaces = faceData.filter(f => selectedIds.includes(f.id));
    if (selFaces.length === 0) {
      setProcessError("Please select at least one face to blur.");
      setIsProcessing(false);
      return;
    }

    const methodStr = (!isImage && outMethod.includes("Subtitle")) ? "subtitle" : "reencode";
    const enc = chosenEncoder.split(" ")[0] || "libx264";

    const formData = new FormData();
    formData.append("input_path", inputPath);
    formData.append("frame_cache_path", frameCachePath);
    formData.append("blur_intensity", blurIntensity.toString());
    formData.append("blur_style", blurStyle);
    formData.append("selected_faces", JSON.stringify(selFaces));
    formData.append("fps_scan", fpsScan.toString());
    formData.append("use_extrapolation", useExtrapolation.toString());
    formData.append("gap_limit", gapLimit.toString());
    formData.append("match_threshold", matchThresh.toString());
    formData.append("encoder", enc);
    formData.append("output_method", methodStr);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/face-blur/process", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to process media");
      }

      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setProcessError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleFace = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const downloadBlob = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    if (isImage) {
      a.download = `blurred_${mediaName || "image.jpg"}`;
    } else {
      const ext = outMethod.includes("Subtitle") ? "ass" : "mp4";
      a.download = `blurred_${mediaName || "video"}.${ext}`;
    }
    a.click();
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
      const url = new URL("http://127.0.0.1:8000/api/media-vision/face-blur/webcam-stream");
      url.searchParams.append("camera_index", cameraIndex.toString());
      url.searchParams.append("conf_thresh", "0.5"); // default
      url.searchParams.append("blur_intensity", blurIntensity.toString());
      url.searchParams.append("blur_type", blurStyle);
      url.searchParams.append("ai_fps", fpsScan.toString());
      url.searchParams.append("use_extrapolation", useExtrapolation.toString());
      url.searchParams.append("_t", Date.now().toString());
      setStreamUrl(url.toString());
    }
  };

  useEffect(() => {
    if (webcamActive) {
      const url = new URL("http://127.0.0.1:8000/api/media-vision/face-blur/webcam-stream");
      url.searchParams.append("camera_index", cameraIndex.toString());
      url.searchParams.append("conf_thresh", "0.5"); // default
      url.searchParams.append("blur_intensity", blurIntensity.toString());
      url.searchParams.append("blur_type", blurStyle);
      url.searchParams.append("ai_fps", fpsScan.toString());
      url.searchParams.append("use_extrapolation", useExtrapolation.toString());
      url.searchParams.append("_t", Date.now().toString());
      setStreamUrl(url.toString());
    }
  }, [cameraIndex, blurIntensity, blurStyle, fpsScan, useExtrapolation]);

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header
        title="AI Face Blurring"
        subtitle="Automatically detect and selectively blur faces in images and videos using InsightFace ONNX models."
        actions={
          <ModernTabs
            tabs={[
              { id: "Image", label: "Image", icon: <Icon name="image" size={18} /> },
              { id: "Video", label: "Video", icon: <Icon name="movie" size={18} /> },
              { id: "Live Camera", label: "Live Camera", icon: <Icon name="videocam" size={18} /> }
            ]}
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              if (webcamActive) toggleWebcam();
            }}
          />
        }
      />

      <div className="mt-8">
        {(activeTab === "Image" || activeTab === "Video") && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <SectionHeader title="Upload media" />
              <div className="flex flex-col gap-2">
                {!mediaHash ? (
                  <DirectUploadBox
                    key={activeTab}
                    accept={activeTab === "Image" ? "image/*" : "video/*"}
                    label={`Upload ${activeTab}`}
                    onUploadComplete={handleMediaUpload}
                  />
                ) : (
                  <div className="flex items-center justify-between bg-[var(--theme-bg)] p-4 border border-[var(--theme-ui-border)] rounded-xl">
                    <div className="flex items-center gap-3">
                      {isImage ? <Icon name="image" size={20} className="text-[var(--theme-text)]" /> : <Icon name="movie" size={20} className="text-[var(--theme-text)]" />}
                      <span className="text-[var(--theme-heading)] font-medium">{mediaName}</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setMediaHash(null);
                        setMediaName(null);
                        setScanned(false);
                        setFaceData([]);
                        setSelectedIds([]);
                        setResultUrl(null);
                      }}
                    >
                      Clear Media
                    </Button>
                  </div>
                )}

                <SectionHeader title="Configuration" className="mt-8" />
                {/* Unified Symmetrical Grid */}
                <div className={`grid grid-cols-1 ${activeTab === "Video" ? "md:grid-cols-2" : ""} gap-6 mt-4`}>

                  {/* CARD 1: Blur Appearance (Applies to both Image and Video) */}
                  <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                    <div
                      className="flex items-center gap-2 font-medium pb-2 border-b"
                      style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    >
                      <h3 className="text-[var(--theme-heading)]">Blur Appearance</h3>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                        Blur Style
                      </label>
                      <select value={blurStyle} onChange={e => setBlurStyle(e.target.value)}
                        className="w-full border rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors"
                        style={{
                          backgroundColor: "var(--theme-bg)",
                          borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                      >
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Gaussian</option>
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Pixelate</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <label style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>Blur Intensity</label>
                        <span style={{ color: "var(--theme-heading)" }}>{blurIntensity}%</span>
                      </div>
                      <input
                        type="range" min="1" max="100" value={blurIntensity}
                        onChange={(e) => setBlurIntensity(parseInt(e.target.value))}
                        className="w-full"
                        style={{ accentColor: "var(--theme-heading)" }}
                      />
                    </div>
                  </div>

                  {/* CARD 2: Output Format (Video Only) */}
                  {activeTab === "Video" && (
                    <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                      <div
                        className="flex items-center gap-2 font-medium pb-2 border-b"
                        style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                      >
                        <h3 className="text-[var(--theme-heading)]">Output Format</h3>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                          Output Method
                        </label>
                        <select value={outMethod} onChange={e => setOutMethod(e.target.value)}
                          className="w-full border rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors"
                          style={{
                            backgroundColor: "var(--theme-bg)",
                            borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                        >
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Re-encode (Hard Blur)</option>
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Subtitle Overlay (.ass)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                          FFmpeg Video Encoder
                        </label>
                        <select value={chosenEncoder} onChange={e => setChosenEncoder(e.target.value)}
                          className="w-full border rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors"
                          style={{
                            backgroundColor: "var(--theme-bg)",
                            borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                        >
                          {encoders.map(e => <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* CARD 3: Detection & Clustering (Video Only) */}
                  {activeTab === "Video" && (
                    <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                      <div
                        className="flex items-center gap-2 font-medium pb-2 border-b"
                        style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                      >
                        <h3 className="text-[var(--theme-heading)]">Detection Strategy</h3>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                          Clustering Method
                        </label>
                        <select value={clusterMethod} onChange={e => setClusterMethod(e.target.value)}
                          className="w-full border rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors"
                          style={{
                            backgroundColor: "var(--theme-bg)",
                            borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                        >
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Global (Immich-style, High Accuracy)</option>
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Sequential (Fast, Low RAM)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-medium">
                            <label style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>Cluster</label>
                            <span style={{ color: "var(--theme-heading)" }}>{clusterThresh.toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min="0.1" max="0.99" step="0.01" value={clusterThresh}
                            onChange={(e) => setClusterThresh(parseFloat(e.target.value))}
                            className="w-full"
                            style={{ accentColor: "var(--theme-heading)" }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-medium">
                            <label style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>Match</label>
                            <span style={{ color: "var(--theme-heading)" }}>{matchThresh.toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min="0.1" max="0.99" step="0.01" value={matchThresh}
                            onChange={(e) => setMatchThresh(parseFloat(e.target.value))}
                            className="w-full"
                            style={{ accentColor: "var(--theme-heading)" }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CARD 4: Scan Timing (Video Only) */}
                  {activeTab === "Video" && (
                    <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                      <div
                        className="flex items-center gap-2 font-medium pb-2 border-b"
                        style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                      >
                        <h3 className="text-[var(--theme-heading)]">Scan Timing</h3>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-sm font-medium">
                          <label style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>Scan FPS</label>
                          <span style={{ color: "var(--theme-heading)" }}>{fpsScan}</span>
                        </div>
                        <input
                          type="range" min="1.0" max="30.0" step="1.0" value={fpsScan}
                          onChange={(e) => setFpsScan(parseFloat(e.target.value))}
                          className="w-full"
                          style={{ accentColor: "var(--theme-heading)" }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-sm font-medium">
                          <label style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>Max Interpolation Gap</label>
                          <span style={{ color: "var(--theme-heading)" }}>{gapLimit}s</span>
                        </div>
                        <input
                          type="range" min="0.1" max="5.0" step="0.1" value={gapLimit}
                          onChange={(e) => setGapLimit(parseFloat(e.target.value))}
                          className="w-full"
                          style={{ accentColor: "var(--theme-heading)" }}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <label className="text-sm font-medium" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>Extrapolate In-between Frames</label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={useExtrapolation} onChange={(e) => setUseExtrapolation(e.target.checked)} />
                          <div className="w-9 h-5 bg-[var(--theme-ui-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--theme-heading)]"></div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {scanError && (
                  <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm">
                    {scanError}
                  </div>
                )}

                <Button variant="primary"
                  onClick={runScan}
                  isLoading={isScanning}
                  disabled={!mediaHash}
                  className="w-full h-12 text-lg bg-purple-600 hover:bg-purple-500 border-none mt-4 border-none !shadow-none !ring-0 !outline-none transition-colors"
                  style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}>
                  {isScanning ? `Scanning ${activeTab} (This may take a while)...` : "Scan & Detect Faces"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 h-full mt-4">
              <SectionHeader title="Select Faces to Blur" />
              {!scanned ? (
                <div className="text-[var(--theme-text)] py-12 text-center text-sm">
                  Please upload a file and run 'Scan & Detect Faces' in the Configuration tab first.
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  {faceData.length === 0 ? (
                    <div className="p-4 bg-blue-900/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm text-center">
                      No faces detected in the media.
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-[var(--theme-heading)]">Unique Individuals Found: {faceData.length}</h3>

                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                        {faceData.map((face) => {
                          const isSelected = selectedIds.includes(face.id);
                          return (
                            <div
                              key={face.id}
                              onClick={() => toggleFace(face.id)}
                              className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'border-zinc-800 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 hover:border-zinc-500'}`}
                            >
                              <div className="relative aspect-square">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`data:image/jpeg;base64,${face.crop_b64}`} alt={`Face ${face.id}`} className="w-full h-full object-cover" />
                                {isSelected && (
                                  <div className="absolute top-1 right-1 bg-purple-500 rounded-full p-0.5 text-[var(--theme-heading)]">
                                    <Icon name="check_box" size={14} />
                                  </div>
                                )}
                              </div>
                              <div className="p-1.5 text-center text-xs text-[var(--theme-text)] font-medium bg-[var(--theme-bg)]">
                                Face {face.id}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 h-full py-8 mt-4">
              <SectionHeader title="Download Output" />

              <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
                {!resultUrl ? (
                  <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                    {isImage ? <Icon name="image" size={48} className="opacity-30" /> : <Icon name="movie" size={48} className="opacity-30" />}
                    <p>{!scanned ? "Please complete the scanning and selection steps first." : "Processed media will appear here."}</p>
                  </div>
                ) : (
                  !isImage && outMethod.includes("Subtitle") ? (
                    <div className="p-4 bg-blue-900/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm text-center space-y-2">
                      <p>💡 <strong>Success!</strong> No video re-encoding was necessary. Your original video remains completely untouched.</p>
                      <p><strong>How to use:</strong></p>
                      <p>1. Open your <strong>original</strong> video in VLC Media Player.</p>
                      <p>2. Drag and drop the downloaded `.ass` file onto the video player to see the face blurs.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl overflow-hidden shadow-2xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] w-full">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resultUrl} alt="Blurred Result" className="w-full h-auto max-h-[600px] object-contain" />
                      ) : (
                        <video controls src={resultUrl} className="w-full h-auto max-h-[600px]" />
                      )}
                    </div>
                  )
                )}
              </div>

              {processError && (
                <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm mt-4">
                  {processError}
                </div>
              )}

              {scanned && !resultUrl && (
                <Button variant="primary"
                  onClick={runProcess}
                  disabled={isProcessing}
                  className="w-full h-12 text-lg bg-green-600 hover:bg-green-500 border-none mt-4 border-none !shadow-none !ring-0 !outline-none transition-colors"
                  style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}>
                  {isProcessing ? `Processing ${activeTab} (This may take a while)...` : `Process ${activeTab} & Apply Blur`}
                </Button>
              )}

              <Button variant="primary"
                onClick={() => downloadBlob(resultUrl || "")}
                disabled={!resultUrl}
                icon={<Icon name="download" size={18} />}
                className="w-full mt-4 h-12 text-lg border-none !shadow-none !ring-0 !outline-none transition-colors"
                style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
              >
                Download {isImage ? "Image" : (outMethod.includes("Subtitle") ? 'Subtitle (.ass)' : 'Video (.mp4)')}
              </Button>
            </div>
          </div>
        )}

        {activeTab === "Live Camera" && (
          <div className="flex flex-col w-full">
            <div className="flex flex-col gap-4">
              <SectionHeader title="Live Camera Configuration" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* CARD 1: Camera Source */}
                <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                  <div
                    className="flex items-center gap-2 font-medium pb-2 border-b"
                    style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  >
                    <h3 className="text-[var(--theme-heading)]">Camera Source</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                      Select Camera Index
                    </label>
                    <select value={cameraIndex}
                      onChange={(e) => setCameraIndex(Number(e.target.value))}
                      className="w-full border rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors"
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    >
                      {cameras.length === 0 ? <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={0}>Camera 0</option> : cameras.map(c => (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={c} value={c}>Camera {c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* CARD 2: Blur Appearance */}
                <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                  <div
                    className="flex items-center gap-2 font-medium pb-2 border-b"
                    style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  >
                    <h3 className="text-[var(--theme-heading)]">Blur Appearance</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                      Blur Style
                    </label>
                    <select value={blurStyle} onChange={e => setBlurStyle(e.target.value)}
                      className="w-full border rounded-md py-2 px-3 text-[var(--theme-heading)] outline-none text-sm transition-colors"
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    >
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Gaussian</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Pixelate</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <label style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>Blur Intensity</label>
                      <span style={{ color: "var(--theme-heading)" }}>{blurIntensity}%</span>
                    </div>
                    <input
                      type="range" min="1" max="100" value={blurIntensity}
                      onChange={(e) => setBlurIntensity(parseInt(e.target.value))}
                      className="w-full"
                      style={{ accentColor: "var(--theme-heading)" }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <label style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>AI Inference Rate (FPS)</label>
                      <span style={{ color: "var(--theme-heading)" }}>{fpsScan}</span>
                    </div>
                    <input
                      type="range" min="1.0" max="30.0" step="1.0" value={fpsScan}
                      onChange={(e) => {
                        setFpsScan(parseFloat(e.target.value));
                        if (webcamActive) {
                          setWebcamActive(false);
                          setStreamUrl(null);
                        }
                      }}
                      className="w-full"
                      style={{ accentColor: "var(--theme-heading)" }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="text-sm font-medium" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>Extrapolate In-between Frames</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={useExtrapolation} onChange={(e) => {
                        setUseExtrapolation(e.target.checked);
                        if (webcamActive) {
                          setWebcamActive(false);
                          setStreamUrl(null);
                        }
                      }} />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--theme-heading)]"></div>
                    </label>
                  </div>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={toggleWebcam}
                className={`w-full h-12 text-lg border-none !shadow-none !ring-0 !outline-none mt-4 transition-colors ${webcamActive ? 'bg-red-600 hover:bg-red-500 text-[var(--theme-heading)]' : ''}`}
                style={!webcamActive
                  ? { backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }
                  : { boxShadow: "none" }
                }
              >
                {webcamActive ? "Stop Webcam" : "Start Webcam Stream"}
              </Button>
            </div>

            <div className="flex flex-col gap-4 h-full py-8 mt-4">
              <SectionHeader title="Live Feed" />
              <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
                {!streamUrl ? (
                  <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                    <Icon name="videocam" size={48} className="opacity-30" />
                    <p>Webcam stream is inactive.</p>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
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
    </div>
  );
}
