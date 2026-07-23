"use client";

import React, { useState, useRef, useEffect } from "react";
import { Film, Upload, Settings2, Play, Users, Palette, Download, Mic, CheckCircle2, AlertTriangle, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export default function TranscriberPage() {
  const [activeTab, setActiveTab] = useState("transcribe");
  
  // Model Setup State
  const [modelSize, setModelSize] = useState("base");
  const [hfToken, setHfToken] = useState("");
  const [doDiarize, setDoDiarize] = useState(false);
  
  // Transcribe State
  const [fileId, setFileId] = useState("");
  const [filename, setFilename] = useState("");
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [rawSpeakerIds, setRawSpeakerIds] = useState<string[]>([]);
  
  // Speakers State
  const [speakerMapping, setSpeakerMapping] = useState<Record<string, string>>({});
  const [speakerStyles, setSpeakerStyles] = useState<Record<string, string>>({});
  const [speakerThumbnails, setSpeakerThumbnails] = useState<Record<string, string>>({});
  const [playingSpeakerId, setPlayingSpeakerId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Export State
  const [exportFormat, setExportFormat] = useState("srt");
  const [stylePreset, setStylePreset] = useState("Cinema Black");

  // Fetch token and config on mount
  useEffect(() => {
    const fetchTokenAndConfig = async () => {
      try {
        const resToken = await fetch("http://127.0.0.1:8000/api/settings/hf/token");
        if (resToken.ok) {
          const data = await resToken.json();
          setHfToken(data.token);
        }
        
        const resConfig = await fetch("http://127.0.0.1:8000/api/settings/models/config");
        if (resConfig.ok) {
          const data = await resConfig.json();
          if (data.config && data.config.audio_transcription) {
            setModelSize(data.config.audio_transcription);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTokenAndConfig();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/subtitles/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setFileId(data.file_id);
        setFilename(data.filename);
        
        // Fetch preview frame
        const frameRes = await fetch(`http://127.0.0.1:8000/api/subtitles/preview-frame/${data.file_id}`);
        if (frameRes.ok) {
          const frameData = await frameRes.json();
          if (frameData.image_base64) {
            setPreviewFrame(`data:image/jpeg;base64,${frameData.image_base64}`);
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!fileId) return alert("Upload a file first");
    if (doDiarize && !hfToken) return alert("Hugging Face token is required for Diarization");
    
    setIsTranscribing(true);
    setSegments([]);
    setRawSpeakerIds([]);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/subtitles/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: fileId,
          model_size: modelSize,
          do_diarize: doDiarize,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Transcription failed");
      }
      
      const data = await res.json();
      setSegments(data.segments);
      setRawSpeakerIds(data.raw_ids || []);
      
      const initialMap: Record<string, string> = {};
      const initialStyles: Record<string, string> = {};
      (data.raw_ids || []).forEach((id: string) => {
        initialMap[id] = id;
        initialStyles[id] = stylePreset; // default to the global preset
      });
      setSpeakerMapping(initialMap);
      setSpeakerStyles(initialStyles);
      
      // Fetch Thumbnails for each speaker
      const thumbnails: Record<string, string> = {};
      for (const id of data.raw_ids || []) {
        // Find the first segment for this speaker
        const firstSeg = data.segments.find((s: any) => s.speaker === id);
        if (firstSeg) {
          try {
            const thumbRes = await fetch(`http://127.0.0.1:8000/api/subtitles/speaker-thumbnail/${fileId}?start=${firstSeg.start}`);
            if (thumbRes.ok) {
              const thumbData = await thumbRes.json();
              if (thumbData.image_base64) {
                thumbnails[id] = `data:image/jpeg;base64,${thumbData.image_base64}`;
              }
            }
          } catch (e) {
            console.error(`Failed to fetch thumbnail for ${id}`, e);
          }
        }
      }
      setSpeakerThumbnails(thumbnails);
      
      setActiveTab("speakers");
      
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error during transcription");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handlePlaySpeaker = async (speakerId: string) => {
    // Find the first segment for this speaker to get start and end times
    const firstSeg = segments.find(s => s.speaker === speakerId);
    if (!firstSeg) return;
    
    // Stop currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    setPlayingSpeakerId(speakerId);
    
    // We add a tiny buffer (0.5s) to the end time to ensure we catch the full phrase, max 5 seconds
    const duration = Math.min(firstSeg.end - firstSeg.start + 0.5, 5.0);
    const end = firstSeg.start + duration;
    
    const audioUrl = `http://127.0.0.1:8000/api/subtitles/speaker-clip/${fileId}?start=${firstSeg.start}&end=${end}`;
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onended = () => {
      if (audioRef.current === audio) {
        setPlayingSpeakerId(null);
      }
    };
    
    audio.onerror = () => {
      console.error("Failed to play audio clip");
      setPlayingSpeakerId(null);
    };
    
    audio.play().catch(e => {
      console.error(e);
      setPlayingSpeakerId(null);
    });
  };

  const handleExport = async () => {
    if (segments.length === 0) return alert("No segments to export");
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/subtitles/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments,
          speaker_mapping: speakerMapping,
          speaker_styles: speakerStyles,
          format: exportFormat,
          style_preset: stylePreset,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([data.content], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = data.filename;
        a.click();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to export subtitles");
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
          <Film className="text-indigo-400" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Transcriber</h1>
          <p className="text-zinc-400 mt-1">Transcribe media, identify speakers, and style subtitles.</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden shadow-xl backdrop-blur-sm">
        {/* Tabs Header */}
        <div className="flex border-b border-white/5 bg-zinc-950/50 overflow-x-auto">
          {[
            { id: "transcribe", label: "Transcribe", icon: <Mic size={16} /> },
            { id: "speakers", label: "Speakers", icon: <Users size={16} /> },
            { id: "export", label: "Export", icon: <Download size={16} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id 
                  ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" 
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 min-h-[500px]">
          {/* TRANSCRIBE TAB */}
          {activeTab === "transcribe" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-semibold text-zinc-100">Upload & Transcribe</h2>
              
              <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6 mb-6">
                <h3 className="font-medium text-zinc-100 mb-4 flex items-center gap-2"><Settings2 size={18} className="text-indigo-400"/> Diarization Settings</h3>
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-zinc-900 border border-white/5 rounded-lg hover:border-white/10 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={doDiarize}
                    onChange={(e) => setDoDiarize(e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-700 text-indigo-500 focus:ring-indigo-500 bg-zinc-800"
                  />
                  <div>
                    <div className="text-zinc-200 font-medium text-sm">Identify Individual Speakers</div>
                    <div className="text-zinc-500 text-xs mt-0.5">Requires Hugging Face token</div>
                  </div>
                </label>
                
                {doDiarize && (
                  <div className="mt-4">
                    <input 
                      type="password"
                      placeholder="hf_xxxxxxxx"
                      value={hfToken}
                      onChange={(e) => setHfToken(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-zinc-100 focus:border-indigo-500 outline-none transition-colors"
                    />
                    <p className="text-xs text-zinc-500 mt-2">Required for Pyannote diarization.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
                  {filename ? (
                    <div className="w-full space-y-4">
                      <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-white/5">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileVideo className="text-indigo-400 shrink-0" size={24} />
                          <span className="text-zinc-200 font-medium truncate">{filename}</span>
                        </div>
                        <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                      </div>
                      
                      {previewFrame && (
                        <img src={previewFrame} alt="Preview" className="w-full aspect-video object-cover rounded-lg shadow-lg border border-white/10" />
                      )}
                    </div>
                  ) : (
                    <div className="w-full">
                      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {isUploading ? (
                            <div className="text-indigo-400 mb-2 animate-pulse"><Upload size={40} /></div>
                          ) : (
                            <Upload className="mb-3 text-zinc-500" size={32} />
                          )}
                          <p className="mb-2 text-sm text-zinc-400">
                            <span className="font-semibold text-zinc-200">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-zinc-500">MP4, MP3, WAV, MKV</p>
                        </div>
                        <input type="file" className="hidden" accept="audio/*,video/*" onChange={handleFileUpload} disabled={isUploading} />
                      </label>
                    </div>
                  )}
                </div>
                
                <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-medium text-zinc-100 mb-4">Pipeline Status</h3>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Media Loaded:</span>
                        <span className={fileId ? "text-emerald-400 font-medium" : "text-zinc-500"}>{fileId ? "Yes" : "No"}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Model Selected:</span>
                        <span className="text-zinc-200 font-medium">{modelSize}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Diarization:</span>
                        <span className="text-zinc-200 font-medium">{doDiarize ? "Enabled" : "Disabled"}</span>
                      </div>
                      {segments.length > 0 && (
                        <div className="flex items-center justify-between text-sm pt-4 border-t border-white/5">
                          <span className="text-zinc-400">Segments:</span>
                          <span className="text-indigo-400 font-medium">{segments.length} transcribed</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button 
                    variant="primary" 
                    icon={isTranscribing ? undefined : <Play size={18} />} 
                    onClick={handleTranscribe}
                    disabled={isTranscribing || !fileId}
                    className="w-full"
                  >
                    {isTranscribing ? "Transcribing..." : "Run Transcription"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* SPEAKERS TAB */}
          {activeTab === "speakers" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-semibold text-zinc-100">Speaker Identification</h2>
              
              {rawSpeakerIds.length === 0 ? (
                <div className="p-8 bg-zinc-950/50 border border-white/5 rounded-xl text-center">
                  <Users className="mx-auto text-zinc-600 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-zinc-300">No Speakers Detected</h3>
                  <p className="text-zinc-500 mt-2">Run transcription with Diarization enabled to detect speakers.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rawSpeakerIds.map(sid => (
                    <div key={sid} className="bg-zinc-950/50 border border-white/5 rounded-xl p-4 flex items-center gap-4">
                      <div 
                        className="relative w-16 h-16 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer group"
                        onClick={() => handlePlaySpeaker(sid)}
                      >
                        {speakerThumbnails[sid] ? (
                          <img src={speakerThumbnails[sid]} alt={sid} className={`w-full h-full object-cover transition-all ${playingSpeakerId === sid ? 'scale-110 opacity-75' : 'group-hover:opacity-75'}`} />
                        ) : (
                          <Mic className="text-zinc-500" size={24} />
                        )}
                        
                        {/* Play Overlay */}
                        <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${playingSpeakerId === sid ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          {playingSpeakerId === sid ? (
                            <div className="flex gap-1">
                              <div className="w-1 h-3 bg-fuchsia-500 animate-pulse"></div>
                              <div className="w-1 h-4 bg-fuchsia-500 animate-pulse delay-75"></div>
                              <div className="w-1 h-2 bg-fuchsia-500 animate-pulse delay-150"></div>
                            </div>
                          ) : (
                            <Play className="text-white fill-white" size={20} />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Rename Speaker</label>
                          <input
                            type="text"
                            value={speakerMapping[sid] || sid}
                            onChange={(e) => setSpeakerMapping({...speakerMapping, [sid]: e.target.value})}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-zinc-200 focus:border-indigo-500 outline-none transition-colors"
                          />
                          <div className="text-xs text-zinc-500 mt-1">Original ID: {sid}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Subtitle Style Preset</label>
                          <select
                            value={speakerStyles[sid] || stylePreset}
                            onChange={(e) => setSpeakerStyles({...speakerStyles, [sid]: e.target.value})}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-zinc-200 focus:border-indigo-500 outline-none transition-colors"
                          >
                            <option value="Cinema Black">Cinema Black</option>
                            <option value="Neon Pop">Neon Pop</option>
                            <option value="Vlog Friendly">Vlog Friendly</option>
                            <option value="Classic Yellow">Classic Yellow</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EXPORT TAB */}
          {activeTab === "export" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-semibold text-zinc-100">Export Subtitles</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Export Format</label>
                      <select 
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-zinc-100 focus:border-indigo-500 outline-none transition-colors"
                      >
                        <option value="srt">SRT (Standard)</option>
                        <option value="ass">ASS (Styled)</option>
                      </select>
                    </div>

                    {exportFormat === "ass" && !doDiarize && (
                      <div className="pt-2">
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Style Preset</label>
                        <select 
                          value={stylePreset}
                          onChange={(e) => setStylePreset(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-zinc-100 focus:border-indigo-500 outline-none transition-colors"
                        >
                          {["Cinema Black", "Neon Pop", "Soft Pastel", "Minimal White"].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div className="pt-4">
                      <Button variant="primary" icon={<Download size={18} />} onClick={handleExport} className="w-full" disabled={segments.length === 0}>
                        Download {exportFormat.toUpperCase()}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-6 h-full min-h-[300px]">
                    <h3 className="font-medium text-zinc-100 mb-4 flex items-center gap-2"><FileVideo size={18} className="text-indigo-400"/> Transcript Preview</h3>
                    <div className="bg-zinc-900 rounded-lg border border-white/5 p-4 h-[300px] overflow-y-auto">
                      {segments.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                          No segments transcribed yet
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {segments.slice(0, 50).map((seg, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="text-zinc-500 mr-3">[{new Date(seg.start * 1000).toISOString().substr(14, 5)}]</span>
                              {seg.speaker && <span className="text-indigo-400 font-medium mr-2">{speakerMapping[seg.speaker] || seg.speaker}:</span>}
                              <span className="text-zinc-300">{seg.text}</span>
                            </div>
                          ))}
                          {segments.length > 50 && (
                            <div className="text-zinc-500 text-center text-sm pt-4 italic">
                              ... and {segments.length - 50} more segments. Download to view full transcript.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
