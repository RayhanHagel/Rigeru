"use client";

import React, { useState, useEffect } from "react";
import { Settings, Image as ImageIcon, Film, Download, LayoutTemplate, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { ImageCompareSlider } from "@/components/ui/ImageCompareSlider";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ImageZoomModal } from "@/components/ui/ImageZoomModal";

const ALL_LABELS = [
  "FEMALE_GENITALIA_COVERED", "FACE_FEMALE", "BUTTOCKS_EXPOSED",
  "FEMALE_BREAST_EXPOSED", "FEMALE_GENITALIA_EXPOSED", "MALE_BREAST_EXPOSED",
  "ANUS_EXPOSED", "FEET_EXPOSED", "BELLY_COVERED", "FEET_COVERED",
  "ARMPITS_COVERED", "ARMPITS_EXPOSED", "FACE_MALE", "BELLY_EXPOSED",
  "MALE_GENITALIA_EXPOSED", "ANUS_COVERED", "FEMALE_BREAST_COVERED", "BUTTOCKS_COVERED"
];

const DEFAULT_LABELS = [
  "FEMALE_GENITALIA_EXPOSED", "MALE_GENITALIA_EXPOSED", 
  "FEMALE_BREAST_EXPOSED", "BUTTOCKS_EXPOSED", "ANUS_EXPOSED"
];

export default function VisionCensorPage() {
  const [selectedFileHash, setSelectedFileHash] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  
  const isVideo = selectedFileName.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/i);
  const isImage = selectedFileName.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/i);

  // Config State
  const [selectedLabels, setSelectedLabels] = useState<string[]>(DEFAULT_LABELS);
  const [outMethod, setOutMethod] = useState("Re-encode (Hard Blur)");
  const [blurStyle, setBlurStyle] = useState("Gaussian");
  const [blurIntensity, setBlurIntensity] = useState(50);
  const [fpsScan, setFpsScan] = useState(2.0);
  
  // Encoders
  const [encoders, setEncoders] = useState<string[]>([]);
  const [chosenEncoder, setChosenEncoder] = useState("");

  // Process State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
  }, []);

  const clearState = () => {
    setSelectedFileHash(null);
    setSelectedFileName("");
    setOriginalUrl(null);
    setResultUrl(null);
    setProcessError("");
  };

  const toggleLabel = (label: string) => {
    if (selectedLabels.includes(label)) {
      setSelectedLabels(selectedLabels.filter(l => l !== label));
    } else {
      setSelectedLabels([...selectedLabels, label]);
    }
  };

  const runProcess = async () => {
    if (!selectedFileHash) return;
    if (selectedLabels.length === 0) {
      setProcessError("Please select at least one label to censor.");
      return;
    }

    setIsProcessing(true);
    setProcessError("");
    setResultUrl(null);

    const methodStr = (!isImage && outMethod.includes("Subtitle")) ? "subtitle" : "reencode";
    const enc = chosenEncoder.split(" ")[0] || "libx264";

    const formData = new FormData();
    formData.append("file_hash", selectedFileHash);
    formData.append("selected_labels", JSON.stringify(selectedLabels));
    formData.append("scan_fps", fpsScan.toString());
    formData.append("method", methodStr);
    formData.append("blur_intensity", blurIntensity.toString());
    formData.append("blur_type", blurStyle);
    formData.append("encoder", enc);
    
    // Pass global config variables explicitly or backend fetches them (backend fetches model_type, engine, precision automatically from config if not sent)

    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/vision-censor", {
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

  const downloadBlob = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    if (isImage) {
      a.download = `censored_${selectedFileName || "image.png"}`;
    } else {
      const ext = outMethod.includes("Subtitle") ? "ass" : "mp4";
      a.download = `censored_${selectedFileName || "video"}.${ext}`;
    }
    a.click();
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            AI Media De-Nudifier
          </h1>
          <p className="text-zinc-400 text-sm font-medium">Upload an image or video. The AI will scan and block NSFW content automatically.</p>
        </div>
      </div>

      <div className="flex flex-col gap-8 w-full">
        {/* SECTION 1: INPUT */}
        <div className="flex flex-col gap-2">
          <SectionHeader title="Upload media" />
            
            <DirectUploadBox
              accept="image/*,video/*"
              label="Upload Image or Video"
              onUploadComplete={(info) => {
                setSelectedFileHash(info.hash_name);
                setSelectedFileName(info.original_name);
                setOriginalUrl(`http://127.0.0.1:8000/uploads/${info.hash_name}`);
              }}
              onClear={clearState}
              defaultFileName={selectedFileName}
            />

            <SectionHeader title="Configuration" className="mt-8" />
            
            {/* Unified Symmetrical Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              
              {/* CARD 1: Detection Strategy (Labels) */}
              <div 
                className="p-5 rounded-xl space-y-5 shadow-sm border"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--theme-heading) 5%, transparent)",
                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                }}
              >
                <div 
                  className="flex items-center gap-2 font-medium pb-2 border-b"
                  style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                >
                  <h3 className="text-zinc-200">Detection Strategy</h3>
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                    Select Labels to Censor
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_LABELS.map(lbl => {
                      const isSel = selectedLabels.includes(lbl);
                      return (
                        <button
                          key={lbl}
                          onClick={() => toggleLabel(lbl)}
                          className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                            isSel ? "" : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                          }`}
                          style={isSel ? { 
                            backgroundColor: "color-mix(in srgb, var(--theme-heading) 15%, transparent)", 
                            borderColor: "var(--theme-heading)", 
                            color: "var(--theme-heading)" 
                          } : undefined}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CARD 2: Blur Appearance */}
              <div 
                className="p-5 rounded-xl space-y-5 shadow-sm border"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--theme-heading) 5%, transparent)",
                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                }}
              >
                <div 
                  className="flex items-center gap-2 font-medium pb-2 border-b"
                  style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                >
                  <h3 className="text-zinc-200">Blur Appearance</h3>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                    Blur Style
                  </label>
                  <select 
                    value={blurStyle} onChange={e => setBlurStyle(e.target.value)}
                    className="w-full border rounded-md py-2 px-3 text-white outline-none text-sm transition-colors"
                    style={{ 
                      backgroundColor: "var(--theme-bg)",
                      borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                  >
                    <option>Gaussian</option>
                    <option>Pixelate</option>
                    <option>Solid Black</option>
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

              {/* CARD 3: Output Format (Video Only) */}
              {isVideo && (
                <div 
                  className="p-5 rounded-xl space-y-5 shadow-sm border"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--theme-heading) 5%, transparent)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                  }}
                >
                  <div 
                    className="flex items-center gap-2 font-medium pb-2 border-b"
                    style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  >
                    <h3 className="text-zinc-200">Output Format</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                      Video Output Method
                    </label>
                    <select 
                      value={outMethod} onChange={e => setOutMethod(e.target.value)}
                      className="w-full border rounded-md py-2 px-3 text-white outline-none text-sm transition-colors"
                      style={{ 
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    >
                      <option>Re-encode (Hard Blur)</option>
                      <option>Subtitle Overlay (.ass)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                      FFmpeg Encoder
                    </label>
                    <select 
                      value={chosenEncoder} onChange={e => setChosenEncoder(e.target.value)}
                      className="w-full border rounded-md py-2 px-3 text-white outline-none text-sm transition-colors"
                      style={{ 
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    >
                      {encoders.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>
              )}
              
              {/* CARD 4: Scan Timing (Video Only) */}
              {isVideo && (
                <div 
                  className="p-5 rounded-xl space-y-5 shadow-sm border"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--theme-heading) 5%, transparent)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                  }}
                >
                  <div 
                    className="flex items-center gap-2 font-medium pb-2 border-b"
                    style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  >
                    <h3 className="text-zinc-200">Scan Timing</h3>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <label style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>Video Scan FPS</label>
                      <span style={{ color: "var(--theme-heading)" }}>{fpsScan}</span>
                    </div>
                    <input 
                      type="range" min="1.0" max="30.0" step="1.0" value={fpsScan} 
                      onChange={(e) => setFpsScan(parseFloat(e.target.value))}
                      className="w-full"
                      style={{ accentColor: "var(--theme-heading)" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {processError && (
              <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm mt-4">
                {processError}
              </div>
            )}

            <Button
              variant="primary"
              className="w-full h-12 text-lg mt-6 border-none !shadow-none !ring-0 !outline-none transition-colors"
              style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
              onClick={runProcess}
              disabled={!selectedFileHash || isProcessing}
            >
              {isProcessing ? "Processing..." : "Process Media"}
            </Button>
          </div>

        {/* SECTION 2: OUTPUT */}
        <div className="flex flex-col gap-2 mt-8 h-full">
            <SectionHeader title="Download Output" />

            <div className="flex-1 w-full bg-black/50 rounded-xl border border-white/5 relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
              {!resultUrl ? (
                <div className="flex flex-col items-center justify-center text-zinc-600 gap-3">
                  {isVideo ? <Film size={48} className="opacity-30" /> : <ImageIcon size={48} className="opacity-30" />}
                  <p>Processed media will appear here.</p>
                </div>
              ) : isImage && originalUrl ? (
                <div className="w-full h-full flex flex-col gap-4">
                  <ImageCompareSlider 
                    originalImage={originalUrl}
                    processedImage={resultUrl}
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="self-center"
                    onClick={() => setPreviewImage(resultUrl)}
                  >
                    View Fullscreen
                  </Button>
                </div>
              ) : !isImage && outMethod.includes("Subtitle") ? (
                <div className="p-4 bg-blue-900/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm text-center space-y-2">
                  <p>💡 <strong>Success!</strong> No video re-encoding was necessary.</p>
                  <p><strong>How to use:</strong></p>
                  <p>1. Open your original video in VLC.</p>
                  <p>2. Drag and drop the downloaded `.ass` file onto it.</p>
                </div>
              ) : (
                <video controls src={resultUrl} className="w-full h-full object-contain" />
              )}
            </div>
            <Button
              variant="primary"
              className="w-full mt-4 h-12 text-lg"
              onClick={downloadBlob}
              disabled={!resultUrl}
              icon={<Download size={16} />}
            >
              Download {!isVideo ? 'Image' : outMethod.includes("Subtitle") ? 'Subtitle (.ass)' : 'Video'}
            </Button>
          </div>
      </div>

      <ImageZoomModal 
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage || ""}
      />
    </div>
  );
}
