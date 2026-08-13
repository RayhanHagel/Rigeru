"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useRef, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/Button';
import { DirectUploadBox, directUploadFile } from '@/components/ui/DirectUploadBox';
import { Icon } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";

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
        fetchVoices();
    }, []);

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
        <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up font-sans">
            <Header 
                title="Voice Cloning TTS" 
                subtitle="Zero-shot voice cloning, voice design, and session reuse powered by OmniVoice." 
                actions={
                    <ModernTabs
                        activeTab={mode}
                        setActiveTab={(m) => setMode(m as Mode)}
                        tabs={[
                            { id: "clone", label: "Voice Clone", icon: <Icon name="mic" size={16} /> },
                            { id: "design", label: "Voice Design", icon: <Icon name="palette" size={16} /> }
                        ]}
                    />
                }
            />
            
            <div className="flex flex-col gap-6 shrink-0">
                <ModernTabContent activeTab={mode}>
                    {mode === "clone" && (
                        <div className="space-y-6">
                            <SectionHeader title="Reference Voice" />
                            
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                {/* New Voice */}
                                <div className="flex flex-col gap-6">
                                    <h3 className="font-bold text-[var(--theme-heading)]">New Reference</h3>
                                    <DirectUploadBox 
                                        onUploadComplete={(fileData: any) => {
                                            setAudioHash(fileData.hash_name);
                                            setUseSavedVoice(false);
                                            setSelectedVoiceId("");
                                        }} 
                                    />
                                    
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-[var(--theme-heading)]">Reference Text <span className="text-[var(--theme-text)] font-normal">(Transcript of the audio)</span></label>
                                        <textarea 
                                            value={refText}
                                            onChange={e => {
                                                setRefText(e.target.value);
                                                setUseSavedVoice(false);
                                                setSelectedVoiceId("");
                                            }}
                                            className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl p-4 text-sm text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors resize-none h-24 custom-scrollbar"
                                            placeholder="Exactly what is being said in the reference audio..."
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-[var(--theme-heading)] flex items-center gap-2">
                                            Save Voice As <span className="text-[var(--theme-text)] font-normal">(Optional)</span>
                                        </label>
                                        <input 
                                            type="text"
                                            value={saveAs}
                                            onChange={e => setSaveAs(e.target.value)}
                                            className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl p-3 text-sm text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors"
                                            placeholder="e.g. British Male Narrator"
                                        />
                                    </div>
                                </div>
                                
                                {/* Saved Voices */}
                                <div className="flex flex-col gap-6">
                                    <h3 className="font-bold text-[var(--theme-heading)]">Saved Voices</h3>
                                    <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-4 rounded-xl border border-[var(--theme-ui-border)] shadow-sm h-[392px] flex flex-col">
                                        {savedVoices.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--theme-text)]">
                                                <Icon name="mic_off" size={32} className="mb-4 opacity-50" />
                                                <p>No saved voices yet.<br/>Create one by saving a new reference voice.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 overflow-y-auto custom-scrollbar pr-2 flex-1">
                                                {savedVoices.map(v => (
                                                    <div key={v.id} 
                                                        onClick={() => {
                                                            setSelectedVoiceId(v.id);
                                                            setUseSavedVoice(true);
                                                        }}
                                                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedVoiceId === v.id ? 'bg-[var(--theme-heading)]/10 border-[var(--theme-heading)]/50 shadow-sm' : 'bg-[var(--theme-bg)] border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)]/30'}`}
                                                    >
                                                        <div>
                                                            <div className="text-[var(--theme-heading)] font-bold">{v.display_name}</div>
                                                            <div className="text-xs text-[var(--theme-text)] mt-1 line-clamp-1">{v.ref_text}</div>
                                                        </div>
                                                        <button onClick={(e) => handleDeleteVoice(v.id, e)} className="p-2 text-[var(--theme-text)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors shrink-0 ml-4">
                                                            <Icon name="delete" size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {mode === "design" && (
                        <div className="space-y-6">
                            <SectionHeader title="Design Target Voice" />
                            
                            <div className="space-y-4">
                                <textarea 
                                    value={speakerAttributes}
                                    onChange={e => setSpeakerAttributes(e.target.value)}
                                    className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl p-4 text-sm text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors resize-none h-32 custom-scrollbar"
                                    placeholder="Describe the voice (e.g. A young male speaker with a British accent and a deep, calm tone...)"
                                />
                                
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-[var(--theme-heading)] uppercase tracking-wider">Try a preset:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {ATTRIBUTE_PRESETS.map((preset, i) => (
                                            <button key={i} onClick={() => setSpeakerAttributes(preset)}
                                                className="px-3 py-1.5 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] hover:border-[var(--theme-ui-border)] rounded-lg text-[11px] text-[var(--theme-text)] hover:text-[var(--theme-heading)] transition-all text-left hover:bg-[var(--theme-heading)]/10"
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </ModernTabContent>

                <div className="w-full h-2 shrink-0"></div>

                <div className="flex flex-col gap-6">
                    <SectionHeader title="Text to Generate" />
                        
                        <div className="flex flex-col gap-4">
                            <textarea 
                                value={text}
                                onChange={e => setText(e.target.value)}
                                className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl p-5 text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors resize-none custom-scrollbar min-h-[200px] text-base leading-relaxed"
                                placeholder="Type what you want the voice to say..."
                            />
                            
                            <Button 
                                variant="primary" 
                                className={`w-full py-4 rounded-xl font-semibold text-base transition-all shadow-lg flex items-center justify-center gap-3
                                    ${!canGenerate ? 'opacity-50 cursor-not-allowed bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)]' : 
                                    'bg-[var(--theme-heading)] text-[var(--theme-bg)] hover:brightness-110 shadow-md'}`}
                                onClick={handleGenerate}
                                disabled={!canGenerate}
                            >
                                {status === "generating" ? (
                                    <><Icon name="progress_activity" className="animate-spin" size={20} /> Generating Audio...</>
                                ) : (
                                    <><Icon name="auto_awesome" size={20} /> Generate Speech</>
                                )}
                            </Button>
                        </div>
                </div>

                {/* RESULT SECTION */}
                {status === "error" && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 fade-in mt-2">
                        <Icon name="error" size={24} className="shrink-0" />
                        <div className="font-medium">{errorMsg}</div>
                    </div>
                )}

                {generatedAudio && (
                    <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] p-8 rounded-2xl animate-in slide-in-from-bottom-4 fade-in mt-2 flex flex-col md:flex-row items-center gap-8 shadow-xl relative overflow-hidden">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] flex items-center justify-center shrink-0 z-10 shadow-lg">
                            <Icon name="check_circle" size={32} className="text-[var(--theme-heading)]" />
                        </div>
                        
                        <div className="flex-1 w-full z-10 space-y-4">
                            <h3 className="text-xl font-bold text-[var(--theme-heading)]">Generated Audio</h3>
                            <audio ref={audioRef} controls src={generatedAudio} className="w-full rounded-xl custom-audio-player h-12" />
                        </div>
                        
                        <a href={generatedAudio} download="generated_voice.wav" className="z-10 w-full md:w-auto">
                            <Button variant="secondary" className="w-full md:w-auto flex items-center justify-center gap-2 py-3 px-6 h-12 bg-[var(--theme-ui-bg)] hover:bg-[var(--theme-bg)] border-[var(--theme-ui-border)]">
                                <Icon name="download" size={18} /> Download
                            </Button>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}