"use client";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";

import React, { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { VirtualCameraBroadcast } from "@/components/ui/VirtualCameraBroadcast";
import { Icon } from "@/lib/utils";

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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const requestRef = useRef<number | null>(null);
  const prevVideoTimeRef = useRef(-1); // used to detect video loop-backs
  // Worker refs — all heavy pixel work runs off the main thread
  const workerRef = useRef<Worker | null>(null);
  const workerBusyRef = useRef(false);
  const offscreenRef = useRef<OffscreenCanvas | null>(null);

  // Keep delay refs in sync with state so processFrame always has latest values
  useEffect(() => { redDelayRef.current = redDelay; }, [redDelay]);
  useEffect(() => { greenDelayRef.current = greenDelay; }, [greenDelay]);
  useEffect(() => { blueDelayRef.current = blueDelay; }, [blueDelay]);

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
    };

    return () => { worker.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => {
    return () => {
      stopMedia();
      stopRecording();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

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

          // Disable worker OBS sending since VirtualCameraBroadcast handles it
          const sendToObs = false;

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-[var(--theme-ui-border)] pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-[var(--theme-heading)] tracking-tight">RGB Shutter Lag</h1>
          <p className="text-[var(--theme-text)] text-sm font-medium">Real-time color channel separation and temporal delay effects.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs 
            tabs={[
              { id: "camera", label: "Live Camera", icon: <Icon name="videocam" size={18} /> },
              { id: "video", label: "Video File", icon: <Icon name="movie" size={18} /> }
            ]} 
            activeTab={sourceType} 
            setActiveTab={(tab) => {
              stopMedia();
              setSourceType(tab as "camera" | "video");
            }} 
          />
        </div>
      </div>

      <div className="flex flex-col gap-8 w-full mt-4">
        {/* SECTION 1: INPUT & CONTROLS */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <SectionHeader title="Upload media" />
            
            <div className="space-y-4">
              {sourceType === "camera" ? (
                isPlaying ? (
                  <Button 
                    variant="primary" 
                    className="w-full h-12 text-lg border-none !shadow-none !ring-0 !outline-none transition-colors"
                    style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
                    onClick={stopMedia}
                    icon={<Icon name="photo_camera" size={16} />}
                  >
                    Stop Camera
                  </Button>
                ) : (
                  <Button 
                    variant="primary" 
                    className="w-full h-12 text-lg border-none !shadow-none !ring-0 !outline-none transition-colors"
                    style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
                    onClick={startCamera}
                    icon={<Icon name="photo_camera" size={16} />}
                  >
                    Use Web Camera
                  </Button>
                )
              ) : (
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
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-8">
            <SectionHeader title="Configuration" />
            
            <div className="grid grid-cols-1 gap-6 mt-2">
              {/* CARD 1: Color Channel Delays */}
              <div className="p-5 rounded-xl space-y-5 shadow-sm border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
                <div className="flex items-center gap-2 font-medium pb-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                  <h3 className="text-[var(--theme-heading)]">Color Channel Delays</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--theme-heading)]">Red Delay</label>
                      <span className="text-xs font-mono text-red-400 bg-[var(--theme-bg)] px-2 py-1 rounded-md border" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                        {redDelay} frames
                      </span>
                    </div>
                    <input 
                      type="range" min="0" max="60" value={redDelay}
                      onChange={(e) => setRedDelay(parseInt(e.target.value))}
                      className="w-full accent-red-500 bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--theme-heading)]">Green Delay</label>
                      <span className="text-xs font-mono text-green-400 bg-[var(--theme-bg)] px-2 py-1 rounded-md border" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                        {greenDelay} frames
                      </span>
                    </div>
                    <input 
                      type="range" min="0" max="60" value={greenDelay}
                      onChange={(e) => setGreenDelay(parseInt(e.target.value))}
                      className="w-full accent-green-500 bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--theme-heading)]">Blue Delay</label>
                      <span className="text-xs font-mono text-blue-400 bg-[var(--theme-bg)] px-2 py-1 rounded-md border" style={{ borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}>
                        {blueDelay} frames
                      </span>
                    </div>
                    <input 
                      type="range" min="0" max="60" value={blueDelay}
                      onChange={(e) => setBlueDelay(parseInt(e.target.value))}
                      className="w-full accent-blue-500 bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
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
                    icon={isVideoPaused ? <Icon name="play_arrow" size={16} /> : <Icon name="pause" size={16} />}
                  >
                    {isVideoPaused ? "Play" : "Pause"}
                  </Button>
                  {!isRecording ? (
                    <Button 
                      variant="primary" 
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-[var(--theme-heading)]" 
                      onClick={startRecording}
                      icon={<Icon name="radio" size={16} />}
                    >
                      Record
                    </Button>
                  ) : (
                    <Button variant="primary" 
                      size="sm"
                      className="bg-zinc-800 hover:bg-zinc-700 text-red-400 animate-pulse border-none !shadow-none !ring-0 !outline-none transition-colors" 
                      onClick={stopRecording}
                      icon={<Icon name="download" size={16} />}
                    >
                      Stop & Save
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[300px] flex items-center justify-center p-2">
              <video 
                ref={videoRef} 
                className="hidden" 
                playsInline 
                muted={sourceType === "camera"} 
                loop={sourceType === "video"} 
              />
              {!isPlaying && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--theme-text)] gap-4">
                  <Icon name="photo_camera" size={48} className="opacity-30" />
                  <p>Select an input source to begin processing.</p>
                </div>
              )}
              <canvas 
                ref={canvasRef} 
                className="max-w-full max-h-full object-contain transition-opacity duration-300"
                style={{ 
                  transform: sourceType === "camera" ? "scaleX(-1)" : "none" // Mirror camera
                }}
              />
            </div>
            
            {isPlaying && (
              <VirtualCameraBroadcast 
                sourceRef={canvasRef} 
                isStreamActive={isPlaying}
                width={1280}
                height={720}
              />
            )}
        </div>
      </div>
    </div>
  );
}
