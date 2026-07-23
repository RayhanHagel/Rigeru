"use client";

import React, { useState, useEffect, useRef } from "react";
import { Settings, Image as ImageIcon, Film, Download, Play, StopCircle, Video } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STColumns, STColumn } from "@/components/streamlit/STColumns";
import { Button } from "@/components/ui/Button";
import { STTabs } from "@/components/streamlit/STTabs";

const YOLO_MODELS = {
  "yolov8n.pt": "YOLOv8n (Standard Nano)",
  "yolov8s.pt": "YOLOv8s (Standard Small)",
  "yolo11n.pt": "YOLO11n (New SOTA - Nano)",
  "yolo11s.pt": "YOLO11s (New SOTA - Small)",
  "yolov10n.pt": "YOLOv10n (Ultra-low latency)",
  "rtdetr-l.pt": "RT-DETR Large (Transformer - High Accuracy)"
};

export default function ObjectDetectionPage() {
  // Config State
  const [confThresh, setConfThresh] = useState(0.3);
  
  // Media State
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaResultUrl, setMediaResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaError, setMediaError] = useState("");
  
  const isVideo = mediaFile && mediaFile.name.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/i);
  const isImage = mediaFile && mediaFile.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/i);
  const [encoders, setEncoders] = useState<string[]>([]);
  const [chosenEncoder, setChosenEncoder] = useState("");
  const [outMethod, setOutMethod] = useState("Subtitle Overlay (.ass)");

  // Webcam State
  const [cameras, setCameras] = useState<number[]>([]);
  const [cameraIndex, setCameraIndex] = useState<number>(0);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamMode, setWebcamMode] = useState("CPU Extrapolation (Smooth)");
  const [aiFps, setAiFps] = useState(6.0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

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
      .catch(console.error);

    // Fetch cameras
    fetch("http://127.0.0.1:8000/api/media-vision/object-detect/cameras")
      .then(res => res.json())
      .then(data => {
        if (data.cameras) {
          setCameras(data.cameras);
          if (data.cameras.length > 0) setCameraIndex(data.cameras[0]);
        }
      })
      .catch(console.error);
  }, []);

  // --- Handlers ---

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setMediaFile(e.target.files[0]);
      if (mediaResultUrl) URL.revokeObjectURL(mediaResultUrl);
      setMediaResultUrl(null);
      setMediaError("");
    }
  };

  const processMedia = async () => {
    if (!mediaFile) return;
    setIsProcessing(true);
    setMediaError("");
    setMediaResultUrl(null);

    const formData = new FormData();
    formData.append("file", mediaFile);
    formData.append("conf_thresh", confThresh.toString());

    let endpoint = "http://127.0.0.1:8000/api/media-vision/object-detect/image";
    if (isVideo) {
      formData.append("output_method", outMethod.includes("Subtitle") ? "subtitle" : "reencode");
      formData.append("encoder", chosenEncoder.split(" ")[0]);
      endpoint = "http://127.0.0.1:8000/api/media-vision/object-detect/video";
    } else {
      formData.append("selected_ids", "[]");
    }

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
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

  const toggleWebcam = () => {
    if (webcamActive) {
      setWebcamActive(false);
      setStreamUrl(null);
    } else {
      setWebcamActive(true);
      const isExtrap = webcamMode.includes("Extrapolation");
      // Build the URL with query params
      const qs = new URLSearchParams({
        conf_thresh: confThresh.toString(),
        camera_index: cameraIndex.toString(),
        use_extrapolation: isExtrap.toString(),
        ai_fps: aiFps.toString()
      });
      // The img tag will seamlessly handle the MJPEG stream natively!
      setStreamUrl(`http://127.0.0.1:8000/api/media-vision/object-detect/webcam-stream?${qs.toString()}`);
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
        <STHeader title="🔍 Local Object Detection" />
        <p className="text-zinc-400 mt-2">
          Run fast, highly optimized object detection using YOLO on Images, Videos, or Live Webcams.
        </p>
      </div>

      <div className="space-y-6">
        <div>
            <STContainer>
              <div className="space-y-6">
                {!mediaFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-700 hover:border-purple-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
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
                      <span className="text-zinc-200 font-medium">{mediaFile.name}</span>
                    </div>
                    <label className="cursor-pointer text-sm font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-lg transition-colors">
                      Change Media
                      <input type="file" className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />
                    </label>
                  </div>
                )}

                {mediaFile && (
                  <div className="space-y-6 pt-4 border-t border-white/10">
                    <STColumns>
                      <STColumn width={1}>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-zinc-300">Confidence Threshold: {confThresh.toFixed(2)}</label>
                          <input 
                            type="range" 
                            min="0.1" 
                            max="0.9" 
                            step="0.05" 
                            value={confThresh} 
                            onChange={(e) => setConfThresh(parseFloat(e.target.value))}
                            className="w-full accent-purple-500"
                          />
                        </div>
                      </STColumn>
                    </STColumns>

                    {isVideo && (
                      <STColumns>
                        <STColumn width={1}>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-300">Output Method</label>
                            <select 
                              value={outMethod} 
                              onChange={(e) => setOutMethod(e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none"
                            >
                              <option value="Subtitle Overlay (.ass)">Subtitle Overlay (.ass)</option>
                              <option value="Re-encode Video (Hard burned)">Re-encode Video (Hard burned)</option>
                            </select>
                            <p className="text-xs text-zinc-500 mt-1">Subtitle is instant and non-destructive. Re-encode modifies the actual pixels.</p>
                          </div>
                        </STColumn>
                        <STColumn width={1}>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-300">FFmpeg Video Encoder</label>
                            <select 
                              value={chosenEncoder} 
                              onChange={(e) => setChosenEncoder(e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none"
                            >
                              {encoders.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                          </div>
                        </STColumn>
                      </STColumns>
                    )}

                    {mediaError && (
                      <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm">
                        {mediaError}
                      </div>
                    )}

                    {!mediaResultUrl && (
                      <Button 
                        variant="primary" 
                        onClick={processMedia} 
                        isLoading={isProcessing}
                        icon={<Play size={18} />}
                        className="w-full bg-purple-600 hover:bg-purple-500 border-none"
                      >
                        {isProcessing ? "Processing (This may take a while)..." : "Process Media"}
                      </Button>
                    )}

                    {mediaResultUrl && (
                      <div className="space-y-6 animate-in slide-in-from-bottom-4 pt-4 border-t border-white/5">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-center font-medium">
                          Processing complete!
                        </div>
                        
                        <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                          {!isVideo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaResultUrl} alt="Result" className="w-full h-auto max-h-[600px] object-contain" />
                          ) : (
                            outMethod.includes("Re-encode") ? (
                              <video controls src={mediaResultUrl} className="w-full h-auto max-h-[600px]" />
                            ) : (
                              <div className="p-4 bg-blue-900/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm text-center">
                                💡 Open your original video in VLC, then drag and drop the downloaded `.ass` file onto it to see the tracking boxes.
                              </div>
                            )
                          )}
                        </div>
                        
                        <Button 
                          variant="primary" 
                          onClick={() => downloadBlob(mediaResultUrl, `detected_${mediaFile.name.split('.')[0]}.${!isVideo ? 'png' : outMethod.includes("Subtitle") ? 'ass' : 'mp4'}`)}
                          icon={<Download size={18} />}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 border-none text-white"
                        >
                          Download {!isVideo ? 'Image' : outMethod.includes("Subtitle") ? 'Subtitle (.ass)' : 'Video (.mp4)'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </STContainer>
        </div>

        <div>
            <STContainer title="Live MJPEG Stream" icon={<Video className="text-purple-400" size={20} />}>
              <div className="space-y-6">
                <STColumns>
                  <STColumn width={1}>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-300">Select Camera Index</label>
                      <select 
                        value={cameraIndex} 
                        onChange={(e) => setCameraIndex(Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none"
                      >
                        {cameras.length === 0 ? <option value={0}>Camera 0</option> : cameras.map(c => (
                          <option key={c} value={c}>Camera {c}</option>
                        ))}
                      </select>
                    </div>
                  </STColumn>
                  <STColumn width={1}>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-300">Webcam Performance Strategy</label>
                      <select 
                        value={webcamMode} 
                        onChange={(e) => setWebcamMode(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none"
                      >
                        <option value="Native GPU (Every Frame)">Native GPU (Every Frame)</option>
                        <option value="CPU Extrapolation (Smooth)">CPU Extrapolation (Smooth)</option>
                      </select>
                    </div>
                  </STColumn>
                </STColumns>

                {webcamMode.includes("Extrapolation") && (
                  <div className="space-y-1.5 pt-2">
                    <label className="text-sm font-medium text-zinc-300">AI Inference Rate (FPS): {aiFps}</label>
                    <input 
                      type="range" 
                      min="1.0" 
                      max="30.0" 
                      step="1.0" 
                      value={aiFps} 
                      onChange={(e) => setAiFps(parseFloat(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>
                )}

                <Button 
                  variant="primary" 
                  onClick={toggleWebcam} 
                  icon={webcamActive ? <StopCircle size={18} /> : <Play size={18} />}
                  className={`w-full border-none transition-colors ${webcamActive ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'}`}
                >
                  {webcamActive ? "Stop Webcam" : "Start Webcam Stream"}
                </Button>

                {streamUrl && (
                  <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black animate-in zoom-in-95 mt-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={streamUrl} 
                      alt="Live MJPEG Stream" 
                      className="w-full h-auto object-contain bg-zinc-900 min-h-[400px]" 
                      onError={(e) => {
                        // If the stream fails, we stop it from looping error reloads.
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </STContainer>
        </div>
      </div>
    </div>
  );
}
