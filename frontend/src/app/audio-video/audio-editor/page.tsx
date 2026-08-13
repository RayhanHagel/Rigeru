"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/lib/utils";

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

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 mt-4">
          <Icon name="error" className="text-red-400 shrink-0 mt-0.5" size={18} />
          <p className="text-red-400 text-sm">{errorMsg}</p>
        </div>
      )}

      <div className="flex flex-col gap-6 mt-4">
        {!resultAudioUrl && (
          <div className="flex flex-col gap-2">
            <SectionHeader title="Upload Audio" />
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
        )}

        <SectionHeader title="Audio Editor" />
        
        {!fileHash ? (
          <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-10 flex flex-col items-center justify-center opacity-50 min-h-[250px]">
            <Icon name="graphic_eq" size={48} className="mb-4 opacity-50" />
            <p className="text-[var(--theme-text)]">Upload an audio file to view the waveform and trim.</p>
          </div>
        ) : !resultAudioUrl ? (
          <div className="space-y-6 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[var(--theme-heading)] truncate">{fileName}</h3>
            </div>
            
            <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl p-4">
              <div ref={waveformRef} className="w-full" />
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant="secondary" 
                  onClick={togglePlay}
                  icon={isPlaying ? <Icon name="pause" size={16} /> : <Icon name="play_arrow" size={16} />}
                >
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <div className="text-sm font-mono text-[var(--theme-text)] bg-[var(--theme-bg)] px-3 py-1.5 rounded-lg border border-[var(--theme-ui-border)]">
                  {currentTime} / {totalTime}
                </div>
                <div className="flex items-center gap-2 ml-2 hidden sm:flex">
                  <Icon name="volume_up" size={16} className="text-[var(--theme-text)]" />
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
                    className="w-24 accent-[var(--theme-heading)] bg-[var(--theme-bg)] h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
              
              <Button 
                variant="primary" 
                onClick={handleTrim}
                disabled={isProcessing}
                icon={isProcessing ? <Icon name="progress_activity" size={16} className="animate-spin" /> : <Icon name="content_cut" size={16} />}
              >
                {isProcessing ? "Processing" : "Trim Selected Region"}
              </Button>
            </div>
            <p className="text-xs text-[var(--theme-text)] text-right">
              Drag the edges of the white region on the waveform to select the area to trim.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[300px] space-y-6">
            <div className="w-full max-w-md bg-[var(--theme-ui-bg)] rounded-xl border border-[var(--theme-ui-border)] p-8 text-center space-y-6 shadow-2xl">
              <div className="inline-flex p-4 bg-emerald-500/10 text-emerald-400 rounded-full mb-2">
                <Icon name="content_cut" size={32} />
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-[var(--theme-heading)]">Audio Trimmed Successfully</h4>
                <p className="text-sm text-[var(--theme-text)]">{resultFilename}</p>
              </div>
              
              <audio src={resultAudioUrl} controls className="w-full h-12 mt-4" />
              
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
                  className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-[var(--theme-heading)] hover:opacity-90 text-[var(--theme-bg)] rounded-lg text-sm font-bold transition-colors"
                >
                  <Icon name="download" size={16} /> Download
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
