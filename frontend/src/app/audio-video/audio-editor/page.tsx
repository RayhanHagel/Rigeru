"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useRef, useEffect } from "react";
import { Music, Upload, Scissors, Download, Play, Pause, AlertCircle, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";

export default function AudioEditorPage() {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentTime, setCurrentTime] = useState("0:00");
  const [totalTime, setTotalTime] = useState("0:00");
  const [volume, setVolume] = useState(1);
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  
  const [resultAudioUrl, setResultAudioUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState("");
  
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<any>(null);

  // Initialize WaveSurfer
  useEffect(() => {
    if (waveformRef.current && fileHash && !resultAudioUrl) {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }

      const ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "rgba(168, 85, 247, 0.4)", // purple-500 with opacity
        progressColor: "rgba(168, 85, 247, 1)", // purple-500
        cursorColor: "#ffffff",
        barWidth: 2,
        barRadius: 2,
        height: 120,
        normalize: true,
      });

      const wsRegions = ws.registerPlugin(RegionsPlugin.create());
      regionsRef.current = wsRegions;
      
      wsRegions.enableDragSelection({
        color: "rgba(255, 255, 255, 0.2)",
      });
      
      wsRegions.on("region-created", (region: any) => {
        const regions = wsRegions.getRegions();
        regions.forEach((r: any) => {
          if (r.id !== region.id) {
            r.remove();
          }
        });
      });

      ws.on("ready", () => {
        const duration = ws.getDuration();
        setTotalTime(formatTime(duration));
        
        // Add an initial region covering the first 10 seconds or whole file if shorter
        wsRegions.addRegion({
          start: 0,
          end: Math.min(10, duration),
          color: "rgba(255, 255, 255, 0.1)",
          drag: true,
          resize: true,
        });
      });

      ws.on("timeupdate", (t: number) => {
        setCurrentTime(formatTime(t));
      });

      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));

      const objectUrl = `http://127.0.0.1:8000/uploads/${fileHash}`;
      ws.load(objectUrl);
      wavesurferRef.current = ws;

      const container = waveformRef.current;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const currentZoom = ws.options.minPxPerSec || 50;
        const zoomDelta = e.deltaY < 0 ? 1.2 : 0.8;
        ws.zoom(Math.max(10, Math.min(currentZoom * zoomDelta, 2000)));
      };
      container.addEventListener("wheel", onWheel, { passive: false });

      return () => {
        container.removeEventListener("wheel", onWheel);
        ws.destroy();
      };
    }
  }, [fileHash, resultAudioUrl]);



  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleTrim = async () => {
    if (!fileHash || !regionsRef.current) return;
    
    const regions = regionsRef.current.getRegions();
    if (regions.length === 0) {
      setErrorMsg("Please select a region to trim");
      return;
    }
    
    const region = regions[0];
    const start = region.start;
    const end = region.end;
    
    setIsProcessing(true);
    setErrorMsg("");
    
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    formData.append("start", start.toString());
    formData.append("end", end.toString());
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/audio-trim", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        let errStr = "";
        try {
          const raw = await res.text();
          try {
             const data = JSON.parse(raw);
             errStr = data.detail || raw;
          } catch (e) {
             errStr = raw;
          }
        } catch(e) {
          errStr = res.statusText;
        }
        throw new Error(`[HTTP ${res.status}] ${errStr || "Trimming failed"}`);
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultAudioUrl(url);
      
      const originalName = fileName.split('.')[0];
      const ext = fileName.split('.').pop() || "mp3";
      setResultFilename(`${originalName}_trimmed.${ext}`);
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to trim audio");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Audio Editor" subtitle="Visually trim and cut audio files directly in your browser." />

      <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 shadow-xl backdrop-blur-sm min-h-[400px]">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}

        {!fileHash ? (
          <div className="flex flex-col items-center justify-center h-80 rounded-2xl bg-zinc-950/50 transition-colors">
            <DirectUploadBox 
              accept="audio/*"
              label="Upload Audio"
              onUploadComplete={(info) => {
                setFileHash(info.hash_name);
                setFileName(info.original_name);
                setResultAudioUrl(null);
                setErrorMsg("");
              }}
              onClear={() => {
                setFileHash(null);
                setFileName("");
              }}
            />
          </div>
        ) : !resultAudioUrl ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-zinc-200 truncate">{fileName}</h3>
              <button 
                onClick={() => {
                  setFileHash(null);
                  setFileName("");
                }}
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                Change File
              </button>
            </div>
            
            <div className="bg-zinc-950 border border-white/5 rounded-xl p-4">
              <div ref={waveformRef} className="w-full" />
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant="secondary" 
                  onClick={togglePlay}
                  icon={isPlaying ? <Pause size={16} /> : <Play size={16} />}
                >
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <div className="text-sm font-mono text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg border border-white/5">
                  {currentTime} / {totalTime}
                </div>
                <div className="flex items-center gap-2 ml-2 hidden sm:flex">
                  <Volume2 size={16} className="text-zinc-500" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      if (wavesurferRef.current) {
                        wavesurferRef.current.setVolume(val);
                      }
                    }}
                    className="w-24 accent-purple-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
              
              <Button 
                variant="primary" 
                className="bg-primary hover:bg-purple-700 text-white" 
                onClick={handleTrim}
                disabled={isProcessing}
                icon={isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
              >
                {isProcessing ? "Processing" : "Trim Selected Region"}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 text-right">
              Drag the edges of the white region on the waveform to select the area to trim.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[300px] space-y-6">
            <div className="w-full max-w-md bg-zinc-950/80 rounded-xl border border-white/10 p-8 text-center space-y-6 shadow-2xl">
              <div className="inline-flex p-4 bg-emerald-500/10 text-emerald-400 rounded-full mb-2">
                <Scissors size={32} />
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-zinc-100">Audio Trimmed Successfully</h4>
                <p className="text-sm text-zinc-400">{resultFilename}</p>
              </div>
              
              <audio src={resultAudioUrl} controls className="w-full h-10 mt-4 custom-audio-player" />
              
              <div className="flex gap-4 pt-4">
                <Button 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => {
                    setResultAudioUrl(null);
                    setFileHash(null);
                    setFileName("");
                  }}
                >
                  Start Over
                </Button>
                
                <a 
                  href={resultAudioUrl} 
                  download={resultFilename}
                  className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-primary hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={16} /> Download
                </a>
              </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
              .custom-audio-player::-webkit-media-controls-panel {
                background-color: #18181b;
              }
              .custom-audio-player::-webkit-media-controls-current-time-display,
              .custom-audio-player::-webkit-media-controls-time-remaining-display {
                color: #a1a1aa;
              }
            `}} />
          </div>
        )}
      </div>
    </div>
  );
}
