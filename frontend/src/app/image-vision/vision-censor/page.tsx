"use client";

import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { DirectMultiUploadBox } from "@/components/ui/DirectMultiUploadBox";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { ImageCompareSlider } from "@/components/ui/ImageCompareSlider";
import { SectionHeader } from "@/components/ui/SectionHeader";
import BatchFolderSelector from "@/components/ui/BatchFolderSelector";
import { ImageZoomModal } from "@/components/ui/ImageZoomModal";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Icon } from "@/lib/utils";

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
  const [inputMode, setInputMode] = useState("single");
  const [isFolderExplorerOpen, setIsFolderExplorerOpen] = useState(false);
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [batchFiles, setBatchFiles] = useState<any[]>([]);

  const [selectedFileHash, setSelectedFileHash] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  
  const isVideo = inputMode === "single" 
    ? selectedFileName.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/i) 
    : (batchFiles.some(f => f.original_name.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/i)) || selectedFolderPath);
  
  const isImage = inputMode === "single" 
    ? selectedFileName.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/i) 
    : (batchFiles.some(f => f.original_name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/i)) || selectedFolderPath);

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
  
  const [resultZipUrl, setResultZipUrl] = useState<string | null>(null);
  const [originalUrls, setOriginalUrls] = useState<string[]>([]);
  const [processedUrls, setProcessedUrls] = useState<string[]>([]);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | null>(null);

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
    setSelectedFolderPath("");
    setBatchFiles([]);
    setResultZipUrl(null);
    setOriginalUrls([]);
    setProcessedUrls([]);
    setSelectedBatchIndex(null);
  };

  const toggleLabel = (label: string) => {
    if (selectedLabels.includes(label)) {
      setSelectedLabels(selectedLabels.filter(l => l !== label));
    } else {
      setSelectedLabels([...selectedLabels, label]);
    }
  };

  const runProcess = async () => {
    if (inputMode === "single" && !selectedFileHash) return;
    if (inputMode === "batch" && !selectedFolderPath && batchFiles.length === 0) return;

    if (selectedLabels.length === 0) {
      setProcessError("Please select at least one label to censor.");
      return;
    }

    setIsProcessing(true);
    setProcessError("");
    setResultUrl(null);
    setResultZipUrl(null);
    setOriginalUrls([]);
    setProcessedUrls([]);

    const methodStr = (!isImage && outMethod.includes("Subtitle")) ? "subtitle" : "reencode";
    const enc = chosenEncoder.split(" ")[0] || "libx264";

    try {
      if (inputMode === "single") {
        const formData = new FormData();
        formData.append("file_hash", selectedFileHash!);
        formData.append("selected_labels", JSON.stringify(selectedLabels));
        formData.append("scan_fps", fpsScan.toString());
        formData.append("method", methodStr);
        formData.append("blur_intensity", blurIntensity.toString());
        formData.append("blur_type", blurStyle);
        formData.append("encoder", enc);

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
      } else {
        let hashes: string[] = [];
        if (batchFiles.length > 0) {
          hashes = batchFiles.map(f => f.hash_name);
        } else if (selectedFolderPath) {
          const stageData = new FormData();
          stageData.append("folder_path", selectedFolderPath);
          const stageRes = await fetch("/api/system/upload/stage-folder", { method: "POST", body: stageData });
          if (!stageRes.ok) throw new Error("Failed to stage folder");
          const data = await stageRes.json();
          hashes = data.files.map((f: any) => f.hash_name);
        }

        if (hashes.length === 0) throw new Error("No files to process");

        const formData = new FormData();
        formData.append("hashes", JSON.stringify(hashes));
        formData.append("selected_labels", JSON.stringify(selectedLabels));
        formData.append("scan_fps", fpsScan.toString());
        formData.append("method", methodStr);
        formData.append("blur_intensity", blurIntensity.toString());
        formData.append("blur_type", blurStyle);
        formData.append("encoder", enc);

        const token = localStorage.getItem("auth_token") || "";
        const baseUrl = window.location.protocol + "//" + window.location.hostname + ":8000";

        const res = await fetch(`${baseUrl}/api/media-vision/vision-censor/batch`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData
        });

        if (!res.ok) {
          const js = await res.json().catch(() => ({}));
          throw new Error(js.detail || "Failed to process batch");
        }

        const data = await res.json();
        setResultZipUrl(data.zip_url);
        setProcessedUrls(data.processed_urls);
        setOriginalUrls(data.original_urls);
      }
    } catch (err: any) {
      setProcessError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadBlob = () => {
    if (inputMode === "single") {
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
    } else {
      if (!resultZipUrl) return;
      const a = document.createElement("a");
      a.href = `http://127.0.0.1:8000${resultZipUrl}`;
      a.download = resultZipUrl.split('/').pop() || "censored_batch.zip";
      a.click();
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-[var(--theme-ui-border)] pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-[var(--theme-heading)] tracking-tight flex items-center gap-3">
            AI Media De-Nudifier
          </h1>
          <p className="text-[var(--theme-text)] text-sm font-medium">Upload an image or video. The AI will scan and block NSFW content automatically.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs
            tabs={[
              { id: "single", label: "Single File", icon: <Icon name="insert_drive_file" size={16} /> },
              { id: "batch", label: "Batch Folder", icon: <Icon name="folder" size={16} /> }
            ]}
            activeTab={inputMode}
            setActiveTab={(tab) => {
              setInputMode(tab);
              clearState();
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-8 w-full">
        {/* SECTION 1: INPUT */}
        <div className="flex flex-col gap-2">
          <SectionHeader title="Upload media" />
            
            <div className="flex flex-col gap-2">
              {inputMode === "single" ? (
                <ModernTabContent activeTab="single">
                  <DirectUploadBox
                    accept="image/*,video/*"
                    label="Upload Image or Video"
                    onUploadComplete={(info) => {
                      setSelectedFileHash(info.hash_name);
                      setSelectedFileName(info.original_name);
                      setOriginalUrl(`/uploads/${info.hash_name}`);
                    }}
                    onClear={clearState}
                    defaultFileName={selectedFileName}
                  />
                </ModernTabContent>
              ) : (
                <ModernTabContent activeTab="batch">
                  <div className="flex flex-col gap-2">
                    <DirectMultiUploadBox
                      accept="image/*,video/*"
                      label="Select Multiple Files"
                      onUploadComplete={(files) => setBatchFiles(files)}
                      onClear={() => setBatchFiles([])}
                    />

                    <div className="flex items-center gap-4">
                      <div className="h-px bg-white/10 flex-1" />
                      <span className="text-xs text-[var(--theme-text)] font-normal uppercase">OR ENTIRE FOLDER</span>
                      <div className="h-px bg-white/10 flex-1" />
                    </div>

                    <BatchFolderSelector 
                      selectedFolderPath={selectedFolderPath} 
                      onSelectFolderClick={() => setIsFolderExplorerOpen(true)} 
                    />
                  </div>
                </ModernTabContent>
              )}
            </div>

            <SectionHeader title="Configuration" className="mt-8" />
            
            {/* Unified Symmetrical Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              
              {/* CARD 1: Detection Strategy (Labels) */}
              <div 
                className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md"
              >
                <div 
                  className="flex items-center gap-2 font-medium pb-2 border-b"
                  style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                >
                  <h3 className="text-[var(--theme-heading)]">Detection Strategy</h3>
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
                className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md"
              >
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
                  <select 
                    value={blurStyle} onChange={e => setBlurStyle(e.target.value)}
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
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Solid Black</option>
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
                  className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md"
                >
                  <div 
                    className="flex items-center gap-2 font-medium pb-2 border-b"
                    style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  >
                    <h3 className="text-[var(--theme-heading)]">Output Format</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium block" style={{ color: "color-mix(in srgb, var(--theme-heading) 80%, white)" }}>
                      Video Output Method
                    </label>
                    <select 
                      value={outMethod} onChange={e => setOutMethod(e.target.value)}
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
                      FFmpeg Encoder
                    </label>
                    <select 
                      value={chosenEncoder} onChange={e => setChosenEncoder(e.target.value)}
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
              
              {/* CARD 4: Scan Timing (Video Only) */}
              {isVideo && (
                <div 
                  className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md"
                >
                  <div 
                    className="flex items-center gap-2 font-medium pb-2 border-b"
                    style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  >
                    <h3 className="text-[var(--theme-heading)]">Scan Timing</h3>
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
              disabled={
                (inputMode === "single" && !selectedFileHash) || 
                (inputMode === "batch" && !selectedFolderPath && batchFiles.length === 0) || 
                isProcessing
              }
            >
              {isProcessing ? "Processing..." : (inputMode === "batch" ? "Process Batch" : "Process Media")}
            </Button>
          </div>

        {/* SECTION 2: OUTPUT */}
        <div className="flex flex-col gap-2 mt-8 h-full">
            <SectionHeader title="Download Output" />

            <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
              {inputMode === "single" ? (
                !resultUrl ? (
                  <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                    {isVideo ? <Icon name="movie" size={48} className="opacity-30" /> : <Icon name="image" size={48} className="opacity-30" />}
                    <p>Processed media will appear here.</p>
                  </div>
                ) : isImage && originalUrl ? (
                  <div className="w-full h-full flex flex-col gap-4">
                    <ImageCompareSlider 
                      originalImage={`http://127.0.0.1:8000${originalUrl}`}
                      processedImage={resultUrl}
                      processedLabel="Censored"
                    />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="self-center text-[var(--theme-heading)]"
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
                )
              ) : (
                /* BATCH MODE OUTPUT */
                processedUrls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                    <Icon name="folder_zip" size={48} className="opacity-30" />
                    <p>Processed batch will appear here.</p>
                  </div>
                ) : selectedBatchIndex !== null ? (
                  <div className="w-full h-full flex flex-col gap-4">
                    <div className="flex items-center justify-between mb-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBatchIndex(null)} className="text-[var(--theme-heading)] hover:bg-[var(--theme-heading)] hover:text-[var(--theme-bg)] transition-colors border border-[var(--theme-heading)]">
                        <span className="flex items-center gap-2"><Icon name="arrow_back" size={16} /> Back to Grid</span>
                      </Button>
                      <span className="text-sm font-medium text-[var(--theme-text)]">
                        {processedUrls[selectedBatchIndex].split('/').pop()}
                      </span>
                    </div>
                    {processedUrls[selectedBatchIndex].match(/\.(mp4|webm)$/i) ? (
                      <video controls src={`http://127.0.0.1:8000${processedUrls[selectedBatchIndex]}`} className="w-full flex-1 object-contain" />
                    ) : processedUrls[selectedBatchIndex].match(/\.(ass)$/i) ? (
                      <div className="p-4 bg-blue-900/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm text-center space-y-2 m-auto">
                        <p>💡 <strong>Success!</strong> No video re-encoding was necessary.</p>
                        <p>This is a `.ass` subtitle overlay file.</p>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col gap-4">
                        <ImageCompareSlider
                          originalImage={`http://127.0.0.1:8000${originalUrls[selectedBatchIndex]}`}
                          processedImage={`http://127.0.0.1:8000${processedUrls[selectedBatchIndex]}`}
                          processedLabel="Censored"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="self-center text-[var(--theme-heading)]"
                          onClick={() => setPreviewImage(`http://127.0.0.1:8000${processedUrls[selectedBatchIndex]}`)}
                        >
                          View Fullscreen
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col gap-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-max overflow-y-auto max-h-[500px] p-2">
                      {processedUrls.map((url, i) => {
                        const isVid = url.match(/\.(mp4|webm)$/i);
                        const isSub = url.match(/\.(ass)$/i);
                        return (
                          <div 
                            key={i} 
                            onClick={() => setSelectedBatchIndex(i)}
                            className="aspect-square bg-zinc-950/50 rounded-xl border border-[var(--theme-ui-border)] overflow-hidden cursor-pointer hover:border-[var(--theme-heading)] transition-all group relative"
                          >
                            {isVid ? (
                              <div className="w-full h-full flex items-center justify-center bg-black">
                                <Icon name="movie" size={32} className="text-zinc-600 group-hover:text-[var(--theme-heading)] transition-colors" />
                              </div>
                            ) : isSub ? (
                              <div className="w-full h-full flex items-center justify-center bg-black">
                                <Icon name="subtitles" size={32} className="text-zinc-600 group-hover:text-[var(--theme-heading)] transition-colors" />
                              </div>
                            ) : (
                              <img src={`http://127.0.0.1:8000${url}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Icon name="visibility" size={24} className="text-white drop-shadow-md" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                              <p className="text-[10px] text-white truncate">{url.split('/').pop()}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
            <Button
              variant="primary"
              className="w-full mt-4 h-12 text-lg border-none !shadow-none !ring-0 !outline-none transition-colors"
              style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
              onClick={downloadBlob}
              disabled={inputMode === "single" ? !resultUrl : !resultZipUrl}
              icon={<Icon name="download" size={16} />}
            >
              {inputMode === "single" 
                ? `Download ${!isVideo ? 'Image' : outMethod.includes("Subtitle") ? 'Subtitle (.ass)' : 'Video'}`
                : "Download ZIP Archive"}
            </Button>
          </div>
      </div>

      <FileExplorerModal
        isOpen={isFolderExplorerOpen}
        onClose={() => setIsFolderExplorerOpen(false)}
        onSelect={(path) => {
          setSelectedFolderPath(path);
          setBatchFiles([]);
        }}
        title="Select Folder to Censor"
      />

      <ImageZoomModal 
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage || ""}
      />
    </div>
  );
}
