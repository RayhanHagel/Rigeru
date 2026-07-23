"use client";

import React, { useState, useEffect } from "react";
import { Settings, Image as ImageIcon, Film, Download, Play, CheckSquare } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STColumns, STColumn } from "@/components/streamlit/STColumns";
import { Button } from "@/components/ui/Button";
import { STTabs } from "@/components/streamlit/STTabs";

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
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const isVideo = mediaFile && mediaFile.name.toLowerCase().match(/\.(mp4|mov|avi|mkv)$/i);
  const isImage = mediaFile && mediaFile.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i);

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Process State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

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

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setMediaFile(e.target.files[0]);
      // reset state
      setScanned(false);
      setFaceData([]);
      setInputPath("");
      setFrameCachePath("");
      setResultUrl(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const runScan = async () => {
    if (!mediaFile) return;
    setIsScanning(true);
    setScanError("");
    setScanned(false);

    const formData = new FormData();
    formData.append("file", mediaFile);
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
      a.download = `blurred_${mediaFile?.name || "image.jpg"}`;
    } else {
      const ext = outMethod.includes("Subtitle") ? "ass" : "mp4";
      a.download = `blurred_${mediaFile?.name || "video"}.${ext}`;
    }
    a.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="👤 AI Face Blurring" />
        <p className="text-zinc-400 mt-2">
          Automatically detect and selectively blur faces in images and videos using InsightFace ONNX models.
        </p>
      </div>


        <div>
            <STContainer title="Configuration & Upload" icon={<Settings className="text-purple-400" size={20} />}>
              <div className="space-y-6">
                {!mediaFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 hover:border-purple-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className="mb-2 text-zinc-500" size={28} />
                      <p className="mb-1 text-sm text-zinc-400"><span className="font-semibold text-zinc-200">Upload Image or Video</span></p>
                    </div>
                    <input type="file" className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-zinc-950 p-4 border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      {isImage ? <ImageIcon size={20} className="text-zinc-400" /> : <Film size={20} className="text-zinc-400" />}
                      <span className="text-zinc-200 font-medium">{mediaFile.name}</span>
                    </div>
                    <label className="cursor-pointer text-sm font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-lg transition-colors">
                      Change Media
                      <input type="file" className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />
                    </label>
                  </div>
                )}

                <STColumns>


                  <STColumn width={1}>
                    <div className="space-y-4">
                      {!isImage && (
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-zinc-300">Output Method</label>
                          <select 
                            value={outMethod} onChange={e => setOutMethod(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none text-sm"
                          >
                            <option>Re-encode (Hard Blur)</option>
                            <option>Subtitle Overlay (.ass)</option>
                          </select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-300">Blur Style</label>
                        <select 
                          value={blurStyle} onChange={e => setBlurStyle(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none text-sm"
                        >
                          <option>Gaussian</option>
                          <option>Pixelate</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-300">Blur Intensity: {blurIntensity}</label>
                        <input 
                          type="range" min="1" max="100" value={blurIntensity} 
                          onChange={(e) => setBlurIntensity(parseInt(e.target.value))}
                          className="w-full accent-purple-500"
                        />
                      </div>
                    </div>
                  </STColumn>
                </STColumns>

                {!isImage && (
                  <>
                    <hr className="border-white/5 my-4" />
                    <STColumns>
                      <STColumn width={1}>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-zinc-300">Clustering Strategy</label>
                          <select 
                            value={clusterMethod} onChange={e => setClusterMethod(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none text-sm"
                          >
                            <option>Global (Immich-style, High Accuracy)</option>
                            <option>Sequential (Fast, Low RAM)</option>
                          </select>
                        </div>
                      </STColumn>
                      <STColumn width={1}>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-300">Clustering Threshold: {clusterThresh.toFixed(2)}</label>
                            <input 
                              type="range" min="0.1" max="0.99" step="0.01" value={clusterThresh} 
                              onChange={(e) => setClusterThresh(parseFloat(e.target.value))}
                              className="w-full accent-purple-500"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-300">Recognition Match Threshold: {matchThresh.toFixed(2)}</label>
                            <input 
                              type="range" min="0.1" max="0.99" step="0.01" value={matchThresh} 
                              onChange={(e) => setMatchThresh(parseFloat(e.target.value))}
                              className="w-full accent-purple-500"
                            />
                          </div>
                        </div>
                      </STColumn>
                    </STColumns>

                    <hr className="border-white/5 my-4" />
                    <STColumns>
                      <STColumn width={1}>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-zinc-300">Scan FPS: {fpsScan}</label>
                          <input 
                            type="range" min="1.0" max="30.0" step="1.0" value={fpsScan} 
                            onChange={(e) => setFpsScan(parseFloat(e.target.value))}
                            className="w-full accent-purple-500"
                          />
                        </div>
                        <div className="space-y-1.5 mt-4">
                          <label className="text-sm font-medium text-zinc-300">Max Interpolation Gap (sec): {gapLimit}</label>
                          <input 
                            type="range" min="0.1" max="5.0" step="0.1" value={gapLimit} 
                            onChange={(e) => setGapLimit(parseFloat(e.target.value))}
                            className="w-full accent-purple-500"
                          />
                        </div>
                      </STColumn>
                      <STColumn width={1}>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-zinc-300">FFmpeg Video Encoder</label>
                          <select 
                            value={chosenEncoder} onChange={e => setChosenEncoder(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none text-sm"
                          >
                            {encoders.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                        </div>
                      </STColumn>
                    </STColumns>
                  </>
                )}

                {scanError && (
                  <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm">
                    {scanError}
                  </div>
                )}

                <Button 
                  variant="primary" 
                  onClick={runScan} 
                  isLoading={isScanning}
                  disabled={!mediaFile}
                  icon={<Play size={18} />}
                  className="w-full bg-purple-600 hover:bg-purple-500 border-none mt-4"
                >
                  {isScanning ? "Scanning Media (This may take a while)..." : "Step 1: Scan & Detect Faces"}
                </Button>
              </div>
            </STContainer>
        </div>

        <div>
            <STContainer title="Select Faces to Blur" icon={<CheckSquare className="text-purple-400" size={20} />}>
              {!scanned ? (
                <div className="text-zinc-500 py-12 text-center text-sm">
                  Please upload a file and run 'Step 1: Scan & Detect Faces' in the Configuration tab first.
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
                        <h3 className="text-lg font-medium text-zinc-200">Unique Individuals Found: {faceData.length}</h3>

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
                                  <div className="absolute top-1 right-1 bg-purple-500 rounded-full p-0.5 text-white">
                                    <CheckSquare size={14} />
                                  </div>
                                )}
                              </div>
                              <div className="p-1.5 text-center text-xs text-zinc-300 font-medium bg-zinc-950">
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
            </STContainer>
        </div>

        <div>
            <STContainer title="Process & Download" icon={<Download className="text-purple-400" size={20} />}>
              {!scanned ? (
                <div className="text-zinc-500 py-12 text-center text-sm">
                  Please complete the scanning and selection steps first.
                </div>
              ) : (
                <div className="space-y-6">
                  {processError && (
                    <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm">
                      {processError}
                    </div>
                  )}

                  {!resultUrl && (
                    <Button 
                      variant="primary" 
                      onClick={runProcess} 
                      isLoading={isProcessing}
                      icon={<Play size={18} />}
                      className="w-full bg-purple-600 hover:bg-purple-500 border-none"
                    >
                      {isProcessing ? "Processing Media (This may take a while)..." : "Step 2: Process & Apply Blur"}
                    </Button>
                  )}

                  {resultUrl && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 pt-4 border-t border-white/5">
                      <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-center font-medium">
                        Face blurring complete!
                      </div>
                      
                      {!isImage && outMethod.includes("Subtitle") ? (
                        <div className="p-4 bg-blue-900/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm text-center space-y-2">
                          <p>💡 <strong>Success!</strong> No video re-encoding was necessary. Your original video remains completely untouched.</p>
                          <p><strong>How to use:</strong></p>
                          <p>1. Open your <strong>original</strong> video in VLC Media Player.</p>
                          <p>2. Drag and drop the downloaded `.ass` file onto the video player to see the face blurs.</p>
                        </div>
                      ) : (
                        <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resultUrl} alt="Blurred Result" className="w-full h-auto max-h-[600px] object-contain" />
                          ) : (
                            <video controls src={resultUrl} className="w-full h-auto max-h-[600px]" />
                          )}
                        </div>
                      )}
                      
                      <Button 
                        variant="primary" 
                        onClick={() => downloadBlob(resultUrl)}
                        icon={<Download size={18} />}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 border-none text-white"
                      >
                        Download {isImage ? "Image" : (outMethod.includes("Subtitle") ? 'Subtitle (.ass)' : 'Video (.mp4)')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </STContainer>
        </div>

    </div>
  );
}
