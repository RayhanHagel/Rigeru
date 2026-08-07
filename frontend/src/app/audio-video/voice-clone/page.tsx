"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Upload, Play, Loader2, AlertCircle, FileAudio, CheckCircle2, Download, Trash2, Wand2, Save, RefreshCw, Sparkles, Mic2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DirectUploadBox, directUploadFile } from '@/components/ui/DirectUploadBox';

type Mode = "clone" | "design";
type Status = "idle" | "recording" | "recorded" | "generating" | "success" | "error";

interface SavedVoice {
    id: string;
    display_name: string;
    ref_text: string;
    created_at: string;
}

const ATTRIBUTE_PRESETS = [
    "A young female speaker with a high-pitched voice and a British accent.",
    "A middle-aged male speaker with a deep voice and an American accent.",
    "An elderly female speaker with a soft voice and a Southern US accent.",
    "A young male speaker with an energetic, upbeat tone and a neutral accent.",
    "A calm, professional female narrator with a neutral accent.",
];

export default function VoiceClonePage() {
    const [mode, setMode] = useState<Mode>("clone");

    // Shared state
    const [text, setText] = useState("");
    const [status, setStatus] = useState<Status>("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);

    // Clone mode state
    const [audioHash, setAudioHash] = useState<string | null>(null);
    const [refText, setRefText] = useState("");
    const [saveAs, setSaveAs] = useState("");
    const [useSavedVoice, setUseSavedVoice] = useState(false);
    const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
    const [selectedVoiceId, setSelectedVoiceId] = useState("");

    // Design mode state
    const [speakerAttributes, setSpeakerAttributes] = useState("");

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const fetchVoices = async () => {
        try {
            const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
            const res = await fetch(`http://${host}:8000/api/media-vision/tts/voices`);
            if (res.ok) {
                const data = await res.json();
                setSavedVoices(data.voices || []);
            }
        } catch (e) {
            console.error("Failed to fetch voices", e);
        }
    };

    useEffect(() => {
        if (useSavedVoice) fetchVoices();
    }, [useSavedVoice]);

    const handleGenerate = async () => {
        if (!text.trim()) return;
        setStatus("generating");
        setErrorMsg("");
        setGeneratedAudio(null);

        try {
            const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
            const formData = new FormData();
            formData.append("text", text);

            let endpoint = `http://${host}:8000/api/media-vision/tts/clone`;

            if (mode === "design") {
                endpoint = `http://${host}:8000/api/media-vision/tts/design`;
                formData.append("speaker_attributes", speakerAttributes);
            } else {
                if (useSavedVoice) {
                    if (!selectedVoiceId) throw new Error("Please select a saved voice.");
                    endpoint = `http://${host}:8000/api/media-vision/tts/clone/saved`;
                    formData.append("voice_id", selectedVoiceId);
                } else {
                    if (!audioHash) throw new Error("Please record or upload reference audio.");
                    if (!refText.trim()) throw new Error("Please provide reference text.");
                    formData.append("ref_audio_hash", audioHash);
                    formData.append("ref_text", refText);
                    if (saveAs.trim()) formData.append("save_as", saveAs);
                }
            }

            const res = await fetch(endpoint, {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                throw new Error(errorData?.detail || "Failed to generate audio");
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setGeneratedAudio(url);
            setStatus("success");
            
            if (!useSavedVoice && saveAs.trim()) {
                setSaveAs("");
                fetchVoices();
            }

        } catch (e: any) {
            console.error(e);
            setStatus("error");
            setErrorMsg(e.message || "An error occurred");
        }
    };

    const handleDeleteVoice = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
            await fetch(`http://${host}:8000/api/media-vision/tts/voices/${id}`, { method: "DELETE" });
            if (selectedVoiceId === id) setSelectedVoiceId("");
            fetchVoices();
        } catch (e) {
            console.error(e);
        }
    };

    const canGenerate = (() => {
        if (!text.trim() || status === "generating") return false;
        if (mode === "design") return !!speakerAttributes.trim();
        if (useSavedVoice) return !!selectedVoiceId;
        return !!audioHash && !!refText.trim();
    })();

    return (
        <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
            <Header title="Voice Cloning TTS" subtitle="Zero-shot voice cloning, voice design, and session reuse powered by OmniVoice." />
            
            <div className="flex flex-col gap-6">
                {/* Mode Tabs */}
                <div className="flex bg-zinc-900/50 p-1 rounded-xl w-fit mb-4 border border-white/5 shadow-inner">
                    <button onClick={() => setMode("clone")}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "clone" ? "bg-secondary text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                        <Mic2 size={16} /> Voice Clone
                    </button>
                    <button onClick={() => setMode("design")}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "design" ? "bg-primary text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                        <Palette size={16} /> Voice Design
                    </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* INPUT COLUMN */}
                    <div className="space-y-6">
                        
                        {mode === "clone" && (
                            <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 space-y-6 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary/50 to-transparent"></div>
                                
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                        <div className="bg-secondary/20 text-secondary w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-[0_0_15px_rgba(236,72,153,0.3)]">1</div>
                                        Reference Voice
                                    </h2>
                                    <div className="flex bg-zinc-900/80 p-1 rounded-lg text-xs font-medium border border-white/10 shadow-inner">
                                        <button onClick={() => setUseSavedVoice(false)}
                                            className={`px-4 py-1.5 rounded-md transition-all ${!useSavedVoice ? "bg-secondary text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}
                                        >New</button>
                                        <button onClick={() => setUseSavedVoice(true)}
                                            className={`px-4 py-1.5 rounded-md transition-all ${useSavedVoice ? "bg-secondary text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}
                                        >Saved</button>
                                    </div>
                                </div>

                                {useSavedVoice ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-zinc-400">Select a previously saved voice profile.</p>
                                        {savedVoices.length === 0 ? (
                                            <div className="p-6 border border-dashed border-white/10 rounded-xl text-center text-zinc-500 bg-black/20">
                                                No saved voices yet. Create one by saving a new reference voice.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                                {savedVoices.map(v => (
                                                    <div key={v.id} 
                                                        onClick={() => setSelectedVoiceId(v.id)}
                                                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedVoiceId === v.id ? 'bg-secondary/10 border-secondary/50' : 'bg-black/40 border-white/5 hover:border-white/10'}`}
                                                    >
                                                        <div>
                                                            <div className="text-zinc-200 font-medium">{v.display_name}</div>
                                                            <div className="text-xs text-zinc-500 mt-1 line-clamp-1">{v.ref_text}</div>
                                                        </div>
                                                        <button onClick={(e) => handleDeleteVoice(v.id, e)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                                        <DirectUploadBox 
                                            onUploadComplete={(fileData: any) => {
                                                setAudioHash(fileData.hash_name);
                                            }} 
                                        />
                                        
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-400">Reference Text <span className="text-zinc-600">(Transcript of the audio)</span></label>
                                            <textarea 
                                                value={refText}
                                                onChange={e => setRefText(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-zinc-200 focus:outline-none focus:border-secondary transition-colors resize-none h-24 custom-scrollbar"
                                                placeholder="Exactly what is being said in the reference audio..."
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                                <Save size={14} /> Save Voice As <span className="text-zinc-600">(Optional)</span>
                                            </label>
                                            <input 
                                                type="text"
                                                value={saveAs}
                                                onChange={e => setSaveAs(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-secondary transition-colors"
                                                placeholder="e.g. British Male Narrator"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {mode === "design" && (
                            <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 space-y-6 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-transparent"></div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="bg-primary/20 text-primary w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-[0_0_15px_rgba(168,85,247,0.3)]">1</div>
                                    Speaker Attributes
                                </h2>
                                
                                <div className="space-y-4">
                                    <textarea 
                                        value={speakerAttributes}
                                        onChange={e => setSpeakerAttributes(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-zinc-200 focus:outline-none focus:border-primary transition-colors resize-none h-32 custom-scrollbar"
                                        placeholder="Describe the voice (e.g. A young male speaker with a British accent and a deep, calm tone...)"
                                    />
                                    
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Try a preset:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {ATTRIBUTE_PRESETS.map((preset, i) => (
                                                <button key={i} onClick={() => setSpeakerAttributes(preset)}
                                                    className="px-3 py-1.5 bg-zinc-900 border border-white/5 hover:border-white/20 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200 transition-all text-left"
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* TARGET COLUMN */}
                    <div className="space-y-6">
                        <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 space-y-6 relative overflow-hidden h-full flex flex-col">
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${mode === 'clone' ? 'from-secondary/50' : 'from-primary/50'} to-transparent`}></div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] ${mode === 'clone' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>2</div>
                                Text to Generate
                            </h2>
                            
                            <div className="flex-1 flex flex-col gap-4">
                                <textarea 
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    className={`flex-1 w-full bg-black/40 border border-white/10 rounded-xl p-5 text-zinc-200 focus:outline-none focus:border-${mode === 'clone' ? 'secondary' : 'primary'} transition-colors resize-none custom-scrollbar min-h-[200px] text-base leading-relaxed`}
                                    placeholder="Type what you want the voice to say..."
                                />
                                
                                <Button 
                                    variant="primary" 
                                    className={`w-full py-4 rounded-xl text-white font-semibold text-base transition-all shadow-lg flex items-center justify-center gap-3
                                        ${!canGenerate ? 'opacity-50 cursor-not-allowed bg-zinc-800' : 
                                        mode === 'clone' ? 'bg-secondary hover:bg-secondary/90 shadow-[0_0_20px_rgba(236,72,153,0.3)]' : 
                                        'bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(168,85,247,0.3)]'}`}
                                    onClick={handleGenerate}
                                    disabled={!canGenerate}
                                >
                                    {status === "generating" ? (
                                        <><Loader2 className="animate-spin" size={20} /> Generating Audio...</>
                                    ) : (
                                        <><Sparkles size={20} /> Generate Speech</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RESULT SECTION */}
                {status === "error" && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 fade-in mt-2">
                        <AlertCircle size={24} className="shrink-0" />
                        <div className="font-medium">{errorMsg}</div>
                    </div>
                )}

                {generatedAudio && (
                    <div className="bg-zinc-950/80 border border-white/10 p-8 rounded-2xl animate-in slide-in-from-bottom-4 fade-in mt-2 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
                        <div className={`absolute -inset-1 bg-gradient-to-r ${mode === 'clone' ? 'from-secondary/20' : 'from-primary/20'} to-transparent opacity-50 blur-2xl`}></div>
                        
                        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 z-10 shadow-lg">
                            <CheckCircle2 size={32} className={mode === 'clone' ? 'text-secondary' : 'text-primary'} />
                        </div>
                        
                        <div className="flex-1 w-full z-10 space-y-4">
                            <h3 className="text-xl font-bold text-white">Generated Audio</h3>
                            <audio ref={audioRef} controls src={generatedAudio} className="w-full rounded-xl custom-audio-player h-12" />
                        </div>
                        
                        <a href={generatedAudio} download="generated_voice.wav" className="z-10 w-full md:w-auto">
                            <Button variant="secondary" className="w-full md:w-auto flex items-center justify-center gap-2 py-3 px-6 h-12 bg-zinc-900/50 hover:bg-white/10 border-white/10">
                                <Download size={18} /> Download
                            </Button>
                        </a>
                    </div>
                )}

            </div>
        </div>
    );
}
