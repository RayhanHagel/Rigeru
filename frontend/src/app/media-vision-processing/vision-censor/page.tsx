"use client";

import React, { useState, useEffect } from "react";
import { Settings, Image as ImageIcon, Film, ShieldAlert } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STColumns, STColumn } from "@/components/streamlit/STColumns";
import { Button } from "@/components/ui/Button";

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
  // Global Media
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const isVideo = mediaFile && mediaFile.name.toLowerCase().match(/\.(mp4|mov|avi|mkv)$/i);
  const isImage = mediaFile && mediaFile.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i);

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
      setResultUrl(null);
      setProcessError("");
    }
  };

  const toggleLabel = (label: string) => {
    if (selectedLabels.includes(label)) {
      setSelectedLabels(selectedLabels.filter(l => l !== label));
    } else {
      setSelectedLabels([...selectedLabels, label]);
    }
  };

  const runProcess = async () => {
    if (!mediaFile) return;
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
    formData.append("file", mediaFile);
    formData.append("selected_labels", JSON.stringify(selectedLabels));
    formData.append("scan_fps", fpsScan.toString());
    formData.append("method", methodStr);
    formData.append("blur_intensity", blurIntensity.toString());
    formData.append("blur_type", blurStyle);
    formData.append("encoder", enc);

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
      a.download = `censored_${mediaFile?.name || "image.png"}`;
    } else {
      const ext = outMethod.includes("Subtitle") ? "ass" : "mp4";
      a.download = `censored_${mediaFile?.name || "video"}.${ext}`;
    }
    a.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="🛡️ AI Media De-Nudifier" />
        <p className="text-zinc-400 mt-2">
          Upload an image or video. The AI will scan and block NSFW content.
        </p>
      </div>

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

          <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5 space-y-3">
            <h4 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <ShieldAlert size={16} className="text-purple-400" /> Target Labels Configuration
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ALL_LABELS.map(label => (
                <label key={label} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
                  <input 
                    type="checkbox" 
                    checked={selectedLabels.includes(label)}
                    onChange={() => toggleLabel(label)}
                    className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500/20"
                  />
                  <span className="truncate">{label}</span>
                </label>
              ))}
            </div>
          </div>

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
                  <label className="flex items-center justify-between text-sm font-medium text-zinc-300">
                    <span>Blur Intensity</span>
                    <span className="text-purple-400 font-mono text-xs">{blurIntensity}</span>
                  </label>
                  <input 
                    type="range" min="1" max="100" 
                    value={blurIntensity} onChange={e => setBlurIntensity(parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            </STColumn>

            <STColumn width={1}>
              <div className="space-y-4">
                {!isImage && (
                  <>
                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between text-sm font-medium text-zinc-300">
                        <span>Scan FPS</span>
                        <span className="text-purple-400 font-mono text-xs">{fpsScan.toFixed(1)}</span>
                      </label>
                      <input 
                        type="range" min="1" max="5" step="0.5"
                        value={fpsScan} onChange={e => setFpsScan(parseFloat(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                    
                    {outMethod.includes("Re-encode") && encoders.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-300">Video Encoder</label>
                        <select 
                          value={chosenEncoder} onChange={e => setChosenEncoder(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none text-sm"
                        >
                          {encoders.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            </STColumn>
          </STColumns>

          {processError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
              {processError}
            </div>
          )}

          <Button 
            variant="primary" 
            onClick={runProcess} 
            disabled={!mediaFile || isProcessing}
            className="w-full py-6 text-lg font-medium shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-shadow"
          >
            {isProcessing ? "Processing Media..." : "🚀 Process Media"}
          </Button>

          {resultUrl && (
            <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-xl space-y-4 animate-in slide-in-from-bottom-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Processing Complete
              </h3>
              
              {!isImage && outMethod.includes("Subtitle") && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400 space-y-2">
                  <p className="font-semibold">💡 Success! No video re-encoding was necessary.</p>
                  <p>Your original video remains completely untouched.</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Open your original video in VLC Media Player.</li>
                    <li>Drag and drop the downloaded .ass file onto the video player.</li>
                  </ol>
                </div>
              )}

              {isImage && (
                <div className="rounded-xl overflow-hidden border border-white/10 bg-zinc-950 flex items-center justify-center min-h-[200px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resultUrl} alt="Result" className="max-h-[500px] object-contain" />
                </div>
              )}
              
              {!isImage && !outMethod.includes("Subtitle") && (
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
                  <video src={resultUrl} controls className="w-full max-h-[500px]" />
                </div>
              )}

              <Button variant="secondary" onClick={downloadBlob} className="w-full border-zinc-700 hover:bg-zinc-800">
                Download Output
              </Button>
            </div>
          )}
        </div>
      </STContainer>
    </div>
  );
}
