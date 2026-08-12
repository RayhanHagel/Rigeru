"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

interface DictationItem {
  id: string;
  name: string;
  date: number;
  transcript: string | null;
  is_transcribed: boolean;
}

export default function DictationPage() {
  const [dictations, setDictations] = useState<DictationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [batchTranscribing, setBatchTranscribing] = useState(false);
  const [cleaningId, setCleaningId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [copied, setCopied] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDictations();
  }, []);

  const fetchDictations = async () => {
    try {
      const res = await fetch("/api/subtitles/dictations");
      if (res.ok) {
        const data = await res.json();
        setDictations(data.dictations);
      }
    } catch (err) {
      console.error("Failed to load dictations", err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleUpload(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Could not access microphone. Please ensure you have granted permission.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUpload = async (audioBlob: Blob) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", audioBlob, "dictation.webm");

    try {
      const res = await fetch("/api/subtitles/dictations", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const newItem = await res.json();
        setDictations(prev => [newItem, ...prev]);
        setSelectedId(newItem.id);
      } else {
        alert("Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error during upload");
    } finally {
      setIsUploading(false);
    }
  };

  const transcribeItem = async (id: string) => {
    // Optimistically show it's transcribing (we'll just use the dictation state)
    // To show loader, we can keep a set of transcribing IDs, or just block UI if needed.
    // For simplicity, we can do it and then re-fetch or update state.
    try {
      const res = await fetch(`/api/subtitles/dictations/${id}/transcribe`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setDictations(prev => prev.map(d => d.id === id ? updated : d));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClean = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCleaningId(id);
    try {
      const res = await fetch(`/api/subtitles/dictations/${id}/clean`, { method: "POST" });
      if (res.ok) {
        alert("Audio noise reduction complete!");
        // We can force a reload of the audio if it was playing, but it's easier to just let the user click play again.
        if (playingId === id) {
          audioPlayerRef.current?.pause();
          setPlayingId(null);
        }
      } else {
        alert("Failed to clean audio");
      }
    } catch (err) {
      console.error(err);
      alert("Error cleaning audio");
    } finally {
      setCleaningId(null);
    }
  };

  const handleBatchTranscribe = async () => {
    const pending = dictations.filter(d => !d.is_transcribed);
    if (pending.length === 0) return;
    
    setBatchTranscribing(true);
    for (const item of pending) {
      // update state to show this item is currently being transcribed
      await transcribeItem(item.id);
    }
    setBatchTranscribing(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this dictation?")) return;
    
    try {
      const res = await fetch(`/api/subtitles/dictations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDictations(prev => prev.filter(d => d.id !== id));
        if (selectedId === id) setSelectedId(null);
        if (playingId === id) {
          audioPlayerRef.current?.pause();
          setPlayingId(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRename = async (id: string) => {
    try {
      const res = await fetch(`/api/subtitles/dictations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editNameValue })
      });
      if (res.ok) {
        const updated = await res.json();
        setDictations(prev => prev.map(d => d.id === id ? updated : d));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditingNameId(null);
    }
  };

  const togglePlay = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingId === id) {
      audioPlayerRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioPlayerRef.current) {
        setPlayingId(id); // Optimistically set so user sees it reacted
        try {
          const token = localStorage.getItem("auth_token");
          const res = await fetch(`/api/subtitles/dictations/${id}/audio`, {
            headers: {
              ...(token ? { "Authorization": `Bearer ${token}` } : {})
            }
          });
          
          if (!res.ok) throw new Error("Failed to fetch audio");
          
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          audioPlayerRef.current.src = url;
          await audioPlayerRef.current.play();
        } catch (err) {
          console.error("Playback failed:", err);
          setPlayingId(null);
        }
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredDictations = dictations.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.transcript && d.transcript.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedItem = dictations.find(d => d.id === selectedId);

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <audio 
        ref={audioPlayerRef} 
        onEnded={() => setPlayingId(null)} 
        onError={() => setPlayingId(null)}
        className="hidden" 
      />

      <Header title="Audio Dictation" subtitle="Record, manage, and batch transcribe your voice notes." />

      <div className="flex flex-col gap-6 animate-slide-up">
        
        {/* Recorder */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center shadow-xl backdrop-blur-sm shrink-0">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading}
              className={`relative group w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isRecording 
                  ? "bg-red-500 hover:bg-red-600 shadow-red-500/30" 
                  : "bg-zinc-800 hover:bg-zinc-700 hover:scale-105 border border-white/10"
              } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isRecording ? (
                <>
                  <div className="absolute inset-0 rounded-full animate-ping bg-red-500/50"></div>
                  <Icon name="stop" className="text-white fill-white z-10" size={32} />
                </>
              ) : isUploading ? (
                <Icon name="progress_activity" className="text-zinc-300 animate-spin" size={32} />
              ) : (
                <Icon name="mic" className="text-zinc-300" size={36} />
              )}
            </button>
            <p className="mt-4 text-center text-sm text-zinc-400 font-medium">
              {isRecording 
                ? "Recording... Click to stop & save" 
                : isUploading 
                  ? "Saving audio" 
                  : "Click to start recording"}
            </p>
          </div>

        {/* Dictation List */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl flex flex-col shadow-xl backdrop-blur-sm overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-zinc-950/50 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-zinc-200">Saved Dictations</h3>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleBatchTranscribe}
                  disabled={batchTranscribing || dictations.filter(d => !d.is_transcribed).length === 0}
                  icon={batchTranscribing ? <Icon name="progress_activity" size={16} className="animate-spin" /> : <Icon name="description" size={16} />}
                >
                  {batchTranscribing ? "Transcribing" : "Batch Transcribe"}
                </Button>
              </div>
              <div className="relative">
                <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Search dictations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {filteredDictations.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm mt-8">No dictations found.</div>
              ) : (
                filteredDictations.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer group ${
                      selectedId === item.id 
                        ? "bg-amber-500/10 border-amber-500/30" 
                        : "bg-zinc-950/50 border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        {editingNameId === item.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input 
                              type="text"
                              value={editNameValue}
                              onChange={e => setEditNameValue(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleRename(item.id)}
                              className="bg-zinc-900 border border-white/20 rounded px-2 py-1 text-sm text-white w-full"
                              autoFocus
                            />
                            <button onClick={() => handleRename(item.id)} className="p-1 text-emerald-400 hover:bg-zinc-800 rounded">
                              <Icon name="check" size={14} />
                            </button>
                            <button onClick={() => setEditingNameId(null)} className="p-1 text-red-400 hover:bg-zinc-800 rounded">
                              <Icon name="close" size={14} />
                            </button>
                          </div>
                        ) : (
                          <h4 className="font-medium text-zinc-200 text-sm truncate flex items-center gap-2">
                            {item.name}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditNameValue(item.name);
                                setEditingNameId(item.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 transition-opacity"
                            >
                              <Icon name="edit" size={12} />
                            </button>
                          </h4>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-zinc-500">
                            {new Date(item.date * 1000).toLocaleString()}
                          </span>
                          {item.is_transcribed ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Transcribed</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={(e) => togglePlay(item.id, e)}
                          className={`p-1.5 rounded-md transition-colors ${
                            playingId === item.id ? "bg-amber-500 text-amber-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          {playingId === item.id ? <Icon name="pause" size={14} className="fill-current" /> : <Icon name="play_arrow" size={14} className="fill-current" />}
                        </button>
                        {!item.is_transcribed && (
                          <button 
                            onClick={async (e) => { e.stopPropagation(); await transcribeItem(item.id); }}
                            className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:bg-amber-500/20 hover:text-amber-400 transition-colors"
                            title="Transcribe now"
                          >
                            <Icon name="description" size={14} />
                          </button>
                        )}
                        <button 
                          onClick={(e) => handleClean(item.id, e)}
                          className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:bg-primary/20 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                          title="Clean Background Noise"
                        >
                          {cleaningId === item.id ? <Icon name="progress_activity" size={14} className="animate-spin" /> : <Icon name="auto_fix_high" size={14} />}
                        </button>
                        <button 
                          onClick={(e) => handleDelete(item.id, e)}
                          className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Icon name="delete" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        {/* Viewer */}
        <div className="w-full">
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl flex flex-col min-h-[400px] shadow-xl backdrop-blur-sm overflow-hidden">
            {selectedItem ? (
              <>
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-950/50">
                  <div>
                    <h3 className="font-medium text-zinc-200">{selectedItem.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Transcript Viewer</p>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => copyToClipboard(selectedItem.transcript || "")}
                    disabled={!selectedItem.transcript}
                    icon={copied ? <Icon name="check_circle" size={16} className="text-emerald-400" /> : <Icon name="content_copy" size={16} />}
                  >
                    {copied ? "Copied!" : "Copy Text"}
                  </Button>
                </div>
                
                <div className="flex-1 p-6 overflow-y-auto bg-zinc-950/30 custom-scrollbar">
                  {!selectedItem.is_transcribed ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                      {batchTranscribing ? (
                        <>
                          <Icon name="progress_activity" className="animate-spin mb-4" size={32} />
                          <p>Transcribing in progress</p>
                        </>
                      ) : (
                        <>
                          <Icon name="description" size={48} className="mb-4 text-zinc-800" />
                          <p>This dictation hasn't been transcribed yet.</p>
                          <Button 
                            variant="primary" 
                            className="mt-4" 
                            onClick={() => transcribeItem(selectedItem.id)}
                          >
                            Transcribe Now
                          </Button>
                        </>
                      )}
                    </div>
                  ) : selectedItem.transcript ? (
                    <div className="text-zinc-200 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedItem.transcript}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-600 italic">
                      Transcript is empty.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8 text-center">
                <Icon name="description" size={64} className="mb-6 text-zinc-800" />
                <h3 className="text-xl font-medium text-zinc-300 mb-2">No Dictation Selected</h3>
                <p className="text-zinc-500 max-w-sm">
                  Select a dictation from the list on the left to view its transcript, or record a new one.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
