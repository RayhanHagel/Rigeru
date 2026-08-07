"use client";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";

import React, { useState, useRef, useEffect } from "react";
import { Camera, Video as VideoIcon, Play, Pause, Upload, Settings2, Radio, Eye, EyeOff, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";

export default function RgbShutterPage() {
  const [sourceType, setSourceType] = useState<"camera" | "video">("camera");
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Delay settings (in frames)
  const [redDelay, setRedDelay] = useState(0);
  const [greenDelay, setGreenDelay] = useState(10);
  const [blueDelay, setBlueDelay] = useState(20);
  // Refs so processFrame always reads the latest delay without stale closure
  const redDelayRef = useRef(0);
  const greenDelayRef = useRef(10);
  const blueDelayRef = useRef(20);
  
  // Video Controls & Recording
  const [isLooping, setIsLooping] = useState(true);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Virtual Camera State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const isBroadcastingRef = useRef(false); // ref so processFrame closure always sees latest value
  const [hideCanvas, setHideCanvas] = useState(false);
  const [showObsWarning, setShowObsWarning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const requestRef = useRef<number | null>(null);
  const prevVideoTimeRef = useRef(-1); // used to detect video loop-backs
  const lastBroadcastTimeRef = useRef(0); // rate-limits OBS sends to ~30fps
  // Worker refs — all heavy pixel work runs off the main thread
  const workerRef = useRef<Worker | null>(null);
  const workerBusyRef = useRef(false);
  const offscreenRef = useRef<OffscreenCanvas | null>(null);

  // Keep delay refs in sync with state so processFrame always has latest values
  useEffect(() => { redDelayRef.current = redDelay; }, [redDelay]);
  useEffect(() => { greenDelayRef.current = greenDelay; }, [greenDelay]);
  useEffect(() => { blueDelayRef.current = blueDelay; }, [blueDelay]);
  // Keep broadcasting ref in sync so processFrame closure always sees the latest value
  useEffect(() => { isBroadcastingRef.current = isBroadcasting; }, [isBroadcasting]);

  // Initialise the Web Worker that handles all pixel compositing off the main thread
  useEffect(() => {
    const worker = new Worker('/rgb-composite-worker.js');
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      workerBusyRef.current = false;
      const { output, rgbBuffer, width, height } = e.data;

      // Draw composited frame to the display canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
        if (ctx) ctx.putImageData(new ImageData(output, width, height), 0, 0);
      }

      // Forward packed RGB frame to OBS (if worker decided to include it)
      if (rgbBuffer && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(rgbBuffer);
        lastBroadcastTimeRef.current = performance.now();
      }
    };

    return () => { worker.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => {
    return () => {
      stopMedia();
      stopBroadcast();
      stopRecording();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const stopBroadcast = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsBroadcasting(false);
  };

  const startBroadcast = async () => {
    if (!canvasRef.current) return;
    
    // Check if OBS Virtual Camera is available
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch("http://localhost:8000/api/virtual-camera/status", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.available) {
        setShowObsWarning(true);
        return;
      }
    } catch (err) {
      console.error("Failed to check OBS status", err);
      alert("Backend not reachable.");
      return;
    }

    setShowObsWarning(false);
    const ws = new WebSocket("ws://localhost:8000/api/virtual-camera/stream");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ 
        width: canvasRef.current!.width || 1280, 
        height: canvasRef.current!.height || 720, 
        fps: 30 
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === "ready") {
        setIsBroadcasting(true);
      }
    };
    
    ws.onclose = () => {
      setIsBroadcasting(false);
    };
  };

  const stopMedia = () => {
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      videoRef.current.pause();
      videoRef.current.src = "";
    }
    setIsPlaying(false);
    setIsVideoPaused(false);
    stopRecording();
  };

  const startCamera = async () => {
    stopMedia();
    setSourceType("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsPlaying(true);
        workerRef.current?.postMessage({ type: 'reset' });
        startProcessing();
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera.");
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsVideoPaused(false);
        startProcessing();
      } else {
        videoRef.current.pause();
        setIsVideoPaused(true);
      }
    }
  };

  const startRecording = () => {
    if (!canvasRef.current) return;
    recordedChunksRef.current = [];
    const stream = canvasRef.current.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rgb_shutter_processed.webm";
      a.click();
      URL.revokeObjectURL(url);
    };
    
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const startProcessing = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    const processFrame = () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        requestRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      if (vw === 0 || vh === 0) {
        requestRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Keep the display canvas sized correctly
      if (canvasRef.current.width !== vw || canvasRef.current.height !== vh) {
        canvasRef.current.width = vw;
        canvasRef.current.height = vh;
      }

      // Detect loop-back: currentTime jumped backward → tell worker to clear its history
      const currentTime = videoRef.current.currentTime;
      if (prevVideoTimeRef.current >= 0 && currentTime < prevVideoTimeRef.current - 0.5) {
        workerRef.current?.postMessage({ type: 'reset' });
      }
      prevVideoTimeRef.current = currentTime;

      // Drop frame if worker is still processing the previous one (never buffer)
      if (!workerBusyRef.current && workerRef.current) {
        // Offscreen canvas is used only for reading video pixels — never displayed
        if (!offscreenRef.current || offscreenRef.current.width !== vw || offscreenRef.current.height !== vh) {
          offscreenRef.current = new OffscreenCanvas(vw, vh);
        }
        const offCtx = offscreenRef.current.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
        if (offCtx) {
          offCtx.drawImage(videoRef.current, 0, 0, vw, vh);
          const frameData = offCtx.getImageData(0, 0, vw, vh);

          // Decide OBS send eligibility before posting (rate-limit + backpressure check)
          const now = performance.now();
          const sendToObs =
            isBroadcastingRef.current &&
            wsRef.current?.readyState === WebSocket.OPEN &&
            (wsRef.current?.bufferedAmount ?? 0) === 0 &&
            now - lastBroadcastTimeRef.current >= 33;

          workerBusyRef.current = true;
          workerRef.current.postMessage(
            {
              type: 'frame',
              buffer: frameData.data.buffer, // transferred zero-copy
              width: vw,
              height: vh,
              redDelay: redDelayRef.current,
              greenDelay: greenDelayRef.current,
              blueDelay: blueDelayRef.current,
              sendToObs,
            },
            [frameData.data.buffer]
          );
        }
      }

      requestRef.current = requestAnimationFrame(processFrame);
    };

    requestRef.current = requestAnimationFrame(processFrame);
  };

  return (
    <div className="w-full h-full p-4 lg:p-6 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="RGB Shutter Lag" subtitle="Real-time color channel separation and temporal delay effects." />

      <div className="flex flex-col gap-8 w-full mt-4">
        {/* SECTION 1: INPUT & CONTROLS */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <SectionHeader title="Upload media" />
            
            <div className="space-y-4">
              {sourceType === "camera" && isPlaying ? (
                <Button 
                  variant="primary" 
                  className="w-full bg-red-600 hover:bg-red-700 text-white" 
                  onClick={stopMedia}
                  icon={<Camera size={16} />}
                >
                  Stop Camera
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white" 
                  onClick={startCamera}
                  icon={<Camera size={16} />}
                >
                  Use Web Camera
                </Button>
              )}
              
              <div className="relative">
                <DirectUploadBox
                  accept="video/*"
                  label="Upload Video"
                  onUploadComplete={(hash) => {
                    stopMedia();
                    setSourceType("video");
                    const fileUrl = `/api/files/download/${hash}`;
                    if (videoRef.current) {
                      videoRef.current.src = fileUrl;
                      videoRef.current.loop = isLooping;
                      videoRef.current.onended = () => {
                        stopRecording();
                      };
                      videoRef.current.play();
                      setIsPlaying(true);
                      setIsVideoPaused(false);
                      workerRef.current?.postMessage({ type: 'reset' });
                      startProcessing();
                    }
                  }}
                  onClear={() => {}}
                  defaultFileName=""
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-8">
            <SectionHeader title="Configuration" />
            
            <div className="flex flex-col gap-2">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-red-400">Red Delay</label>
                  <span className="text-xs text-zinc-500 font-mono">{redDelay} frames</span>
                </div>
                <input 
                  type="range" min="0" max="60" value={redDelay}
                  onChange={(e) => setRedDelay(parseInt(e.target.value))}
                  className="w-full accent-red-500"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-green-400">Green Delay</label>
                  <span className="text-xs text-zinc-500 font-mono">{greenDelay} frames</span>
                </div>
                <input 
                  type="range" min="0" max="60" value={greenDelay}
                  onChange={(e) => setGreenDelay(parseInt(e.target.value))}
                  className="w-full accent-green-500"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-blue-400">Blue Delay</label>
                  <span className="text-xs text-zinc-500 font-mono">{blueDelay} frames</span>
                </div>
                <input 
                  type="range" min="0" max="60" value={blueDelay}
                  onChange={(e) => setBlueDelay(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: OUTPUT & BROADCAST */}
        <div className="flex flex-col gap-2 mt-8 h-full">
            <div className="flex items-center justify-between">
              <SectionHeader title="Download Output" className="mb-0" />
              {sourceType === "video" && isPlaying && (
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={togglePlayPause}
                    icon={isVideoPaused ? <Play size={16} /> : <Pause size={16} />}
                  >
                    {isVideoPaused ? "Play" : "Pause"}
                  </Button>
                  {!isRecording ? (
                    <Button 
                      variant="primary" 
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white" 
                      onClick={startRecording}
                      icon={<Radio size={16} />}
                    >
                      Record
                    </Button>
                  ) : (
                    <Button 
                      variant="primary" 
                      size="sm"
                      className="bg-zinc-800 hover:bg-zinc-700 text-red-400 animate-pulse" 
                      onClick={stopRecording}
                      icon={<Download size={16} />}
                    >
                      Stop & Save
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 w-full bg-black/50 rounded-xl border border-white/5 relative overflow-hidden min-h-[300px] flex items-center justify-center p-2">
              <video 
                ref={videoRef} 
                className="hidden" 
                playsInline 
                muted={sourceType === "camera"} 
                loop={sourceType === "video"} 
              />
              {!isPlaying && (
                <div className="flex flex-col items-center justify-center text-zinc-600 gap-4">
                  <Camera size={48} className="opacity-30" />
                  <p>Select an input source to begin processing.</p>
                </div>
              )}
              <canvas 
                ref={canvasRef} 
                className={`max-w-full max-h-full object-contain ${hideCanvas ? 'opacity-0' : 'opacity-100'}`}
                style={{ 
                  transform: sourceType === "camera" ? "scaleX(-1)" : "none" // Mirror camera
                }}
              />
            </div>

            {/* Virtual Camera Options */}
            <div className="pt-2 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">OBS Virtual Camera</span>
                <button 
                  onClick={() => setHideCanvas(!hideCanvas)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-2 ${hideCanvas ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                >
                  {hideCanvas ? <EyeOff size={14} /> : <Eye size={14} />}
                  {hideCanvas ? "Preview Hidden" : "Hide Preview"}
                </button>
              </div>
              
              {isBroadcasting ? (
                <Button 
                  variant="primary" 
                  className="w-full bg-red-600 hover:bg-red-700 text-white h-10" 
                  onClick={stopBroadcast}
                  icon={<Radio size={18} />}
                >
                  Stop Broadcast
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-10" 
                  onClick={startBroadcast}
                  disabled={!isPlaying}
                  icon={<Radio size={18} />}
                >
                  Start Broadcast to OBS
                </Button>
              )}

              {showObsWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-200 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <p>OBS Virtual Camera is not detected on your system.</p>
                  </div>
                  <Button 
                    variant="secondary"
                    className="w-full text-xs"
                    onClick={() => window.open("https://obsproject.com/", "_blank")}
                    icon={<Download size={14} />}
                  >
                    Download OBS Studio
                  </Button>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
