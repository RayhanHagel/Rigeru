"use client";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";

import React, { useState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { Icon } from "@/lib/utils";

export default function EbookReaderPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // TTS State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const textRef = useRef<HTMLDivElement>(null);
  
  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0) {
        // Try to find a good default English voice
        const defaultVoice = availableVoices.find(v => v.lang.startsWith("en") && v.name.includes("Google")) || availableVoices[0];
        setSelectedVoice(defaultVoice.name);
      }
    };
    
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleFileUpload = async (fileInfo: { hash_name: string; original_name: string; file_type: string }) => {
    setFile({ name: fileInfo.original_name, size: 0 } as any);
    setText("");
    setErrorMsg("");
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    
    setIsExtracting(true);
    
    const formData = new FormData();
    formData.append("file_hash", fileInfo.hash_name);
    
    try {
      const res = await fetch("/api/files-documents/extract-text", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to extract text");
      }
      
      const data = await res.json();
      setText(data.text);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to read document");
    } finally {
      setIsExtracting(false);
    }
  };
  const speakText = () => {
    if (!text || voices.length === 0) return;
    
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.rate = rate;
    
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      setIsPlaying(false);
      setIsPaused(false);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const pauseText = () => {
    window.speechSynthesis.pause();
    setIsPlaying(false);
    setIsPaused(true);
  };

  const stopText = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Ebook Reader" subtitle="Read and listen to your PDF, DOCX, or TXT documents." />

      <div className="flex flex-col gap-6 w-full animate-slide-up mt-6">
        
        {/* Controls Panel */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <SectionHeader title="Document" icon={<Icon name="description" size={18} />} />
            
            <DirectUploadBox 
              accept=".pdf,.docx,.txt,.epub" 
              label="Upload Ebook Document" 
              onUploadComplete={handleFileUpload}
              onClear={() => {
                setFile(null);
                setText("");
                window.speechSynthesis.cancel();
                setIsPlaying(false);
                setIsPaused(false);
              }}
            />
          </div>
          
          <div className="flex flex-col gap-4">
            <SectionHeader title="Voice Settings" icon={<Icon name="settings_voice" size={18} />} />
            
            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm flex-1">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--theme-text)] block mb-2">Voice Model</label>
                  <select 
                    value={selectedVoice} 
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-[var(--theme-bg)] text-xs text-[var(--theme-text)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] rounded-lg p-2 focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] transition-colors"
                  >
                  {voices.map(v => (
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[var(--theme-text)] block">Speed Rate</label>
                  <span className="text-[10px] text-[var(--theme-text)] font-mono">{rate.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.5" max="2" step="0.1" value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full accent-[var(--theme-heading)]"
                />
              </div>
            </div>
          </div>
        </div>
        </div>
        
        {/* Reading Panel */}
        <div className="w-full mt-4">
          <SectionHeader title="Reading Panel" icon={<Icon name="menu_book" size={18} />} />
          <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-2xl flex flex-col min-h-[600px] max-h-[80vh] shadow-2xl overflow-hidden transition-colors">
            
            <div className="flex items-center justify-between p-4 border-b border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-sm">
              <div className="flex gap-2">
                <button 
                  onClick={isPlaying ? pauseText : speakText}
                  disabled={!text}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${!text ? "opacity-50 bg-[var(--theme-ui-bg)] text-[var(--theme-text)] cursor-not-allowed" : "bg-[var(--theme-heading)] hover:opacity-80 text-white shadow-lg shadow-[var(--theme-heading)]/20"}`}
                >
                  {isPlaying ? <Icon name="pause" size={18} className="fill-white" /> : <Icon name="play_arrow" size={18} className="fill-white translate-x-[1px]" />}
                </button>
                <button 
                  onClick={stopText}
                  disabled={!text || (!isPlaying && !isPaused)}
                  className="w-10 h-10 rounded-full bg-[var(--theme-ui-bg)] hover:bg-[var(--theme-ui-border)] text-[var(--theme-text)] flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <Icon name="stop" size={16} className="fill-current" />
                </button>
              </div>
              <div className="text-sm font-medium text-[var(--theme-text)]">
                {isPlaying ? "Playing..." : isPaused ? "Paused" : "Ready"}
              </div>
            </div>
            
            <div className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar relative">
              {isExtracting ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--theme-text)] gap-4">
                  <Icon name="progress_activity" size={48} className="animate-spin text-[var(--theme-heading)]" />
                  <p>Extracting text from document</p>
                </div>
              ) : errorMsg ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--theme-heading)] gap-4 p-8 text-center">
                  <Icon name="error" size={48} />
                  <p>{errorMsg}</p>
                </div>
              ) : text ? (
                <div 
                  ref={textRef}
                  className="prose prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-lg text-[var(--theme-text)] font-serif whitespace-pre-wrap"
                >
                  {text}
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--theme-text)] gap-4">
                  <Icon name="menu_book" size={64} className="opacity-20" />
                  <p className="text-lg font-medium">No document loaded</p>
                  <p className="text-sm">Upload a PDF, DOCX, or TXT file to start reading.</p>
                </div>
              )}
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
}
