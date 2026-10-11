"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Header } from "@/components/ui/Header";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { Icon } from "@/lib/utils";

interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface AssStyleConfig {
  font: string;
  size: number;
  margin_v: number;
  primary_color: string;
  primary_trans: number;
  outline_color: string;
  outline_width: number;
}

const DEFAULT_STYLE_CONFIG: AssStyleConfig = {
  font: "Arial",
  size: 52,
  margin_v: 60,
  primary_color: "#FFFFFF",
  primary_trans: 1.0,
  outline_color: "#000000",
  outline_width: 3,
};

const PRESET_STYLES: Record<string, AssStyleConfig> = {
  "Cinema Black": {
    font: "Arial",
    size: 52,
    margin_v: 60,
    primary_color: "#FFFFFF",
    primary_trans: 1.0,
    outline_color: "#000000",
    outline_width: 3,
  },
  "Neon Pop": {
    font: "Impact",
    size: 58,
    margin_v: 55,
    primary_color: "#FFFF00",
    primary_trans: 1.0,
    outline_color: "#000000",
    outline_width: 4,
  },
  "Soft Pastel": {
    font: "Verdana",
    size: 46,
    margin_v: 70,
    primary_color: "#FFE4E1",
    primary_trans: 0.9,
    outline_color: "#333333",
    outline_width: 2,
  },
  "Minimal White": {
    font: "Tahoma",
    size: 44,
    margin_v: 50,
    primary_color: "#FFFFFF",
    primary_trans: 0.85,
    outline_color: "#000000",
    outline_width: 1,
  },
};

const FONT_OPTIONS = [
  "Arial",
  "Impact",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Comic Sans MS",
];

export default function TranscriberPage() {
  const [activeTab, setActiveTab] = useState("transcribe");

  // Model Setup State
  const [modelSize, setModelSize] = useState("base");
  const [hfToken, setHfToken] = useState("");
  const [doDiarize, setDoDiarize] = useState(false);

  // Transcribe State
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileId, setFileId] = useState("");
  const [filename, setFilename] = useState("");
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [rawSpeakerIds, setRawSpeakerIds] = useState<string[]>([]);

  // Speakers State & Diarization
  const [speakerMapping, setSpeakerMapping] = useState<Record<string, string>>({});
  const [speakerCustomStyles, setSpeakerCustomStyles] = useState<Record<string, AssStyleConfig>>({});
  const [speakerThumbnails, setSpeakerThumbnails] = useState<Record<string, string>>({});
  const [playingSpeakerId, setPlayingSpeakerId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Style Studio State
  const [selectedSpeakerForStyle, setSelectedSpeakerForStyle] = useState<string>("ALL");
  const [canvasPreviewImage, setCanvasPreviewImage] = useState<string | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [previewSampleText, setPreviewSampleText] = useState("Hello world! This is a subtitle preview.");

  // Export State
  const [exportFormat, setExportFormat] = useState("ass");
  const [stylePreset, setStylePreset] = useState("Cinema Black");

  // Fetch token and config on mount
  useEffect(() => {
    const fetchTokenAndConfig = async () => {
      try {
        const resToken = await fetch("/api/settings/hf/token");
        if (resToken.ok) {
          const data = await resToken.json();
          setHfToken(data.token);
        }

        const resConfig = await fetch("/api/settings/models/config");
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

  const handleUploadComplete = async (fileInfo: { hash_name: string; original_name: string; file_type: string }) => {
    setFileHash(fileInfo.hash_name);
    setFileId(fileInfo.hash_name);
    setFilename(fileInfo.original_name);

    setIsUploading(true);
    try {
      const res = await fetch(`/api/subtitles/preview-frame/${fileInfo.hash_name}`);
      if (res.ok) {
        const data = await res.json();
        if (data.image_base64) {
          setPreviewFrame(`data:image/jpeg;base64,${data.image_base64}`);
        }
      }
    } catch (e) {
      console.error("Could not fetch preview frame", e);
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
      const res = await fetch("/api/subtitles/transcribe", {
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
      const spkIds: string[] = data.raw_ids || [];
      setRawSpeakerIds(spkIds);

      const initialMap: Record<string, string> = {};
      const initialStyles: Record<string, AssStyleConfig> = {};

      spkIds.forEach((id: string) => {
        initialMap[id] = id;
        initialStyles[id] = { ...DEFAULT_STYLE_CONFIG };
      });
      initialStyles["ALL"] = { ...DEFAULT_STYLE_CONFIG };

      setSpeakerMapping(initialMap);
      setSpeakerCustomStyles(initialStyles);
      if (spkIds.length > 0) {
        setSelectedSpeakerForStyle(spkIds[0]);
      } else {
        setSelectedSpeakerForStyle("ALL");
      }

      // Fetch thumbnails
      const thumbnails: Record<string, string> = {};
      for (const id of spkIds) {
        const firstSeg = data.segments.find((s: any) => s.speaker === id);
        if (firstSeg) {
          try {
            const thumbRes = await fetch(`/api/subtitles/speaker-thumbnail/${fileId}?start=${firstSeg.start}`);
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
    const firstSeg = segments.find((s) => s.speaker === speakerId);
    if (!firstSeg) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPlayingSpeakerId(speakerId);
    const duration = Math.min(firstSeg.end - firstSeg.start + 0.5, 5.0);
    const end = firstSeg.start + duration;

    const audioUrl = `/api/subtitles/speaker-clip/${fileId}?start=${firstSeg.start}&end=${end}`;
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

    audio.play().catch((e) => {
      console.error(e);
      setPlayingSpeakerId(null);
    });
  };

  const activeStyleConfig = speakerCustomStyles[selectedSpeakerForStyle] || DEFAULT_STYLE_CONFIG;

  const updateCurrentStyle = (field: keyof AssStyleConfig, value: any) => {
    const targetKey = selectedSpeakerForStyle;
    setSpeakerCustomStyles((prev) => ({
      ...prev,
      [targetKey]: {
        ...(prev[targetKey] || DEFAULT_STYLE_CONFIG),
        [field]: value,
      },
    }));
  };

  const applyPresetToSelected = (presetName: string) => {
    if (PRESET_STYLES[presetName]) {
      const preset = PRESET_STYLES[presetName];
      const targetKey = selectedSpeakerForStyle;
      setSpeakerCustomStyles((prev) => ({
        ...prev,
        [targetKey]: { ...preset },
      }));
    }
  };

  const applyStyleToAllSpeakers = () => {
    const current = speakerCustomStyles[selectedSpeakerForStyle] || DEFAULT_STYLE_CONFIG;
    const newStyles: Record<string, AssStyleConfig> = {};
    rawSpeakerIds.forEach((id) => {
      newStyles[id] = { ...current };
    });
    newStyles["ALL"] = { ...current };
    setSpeakerCustomStyles(newStyles);
    alert("Current style applied to all speakers!");
  };

  // Render canvas preview whenever style or target changes
  const fetchCanvasPreview = async () => {
    setIsRenderingPreview(true);
    try {
      const style = speakerCustomStyles[selectedSpeakerForStyle] || DEFAULT_STYLE_CONFIG;
      const speakerName = speakerMapping[selectedSpeakerForStyle] || selectedSpeakerForStyle;
      const sample =
        selectedSpeakerForStyle !== "ALL"
          ? `${speakerName}: ${previewSampleText}`
          : previewSampleText;

      const res = await fetch("/api/subtitles/preview-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: fileId,
          sample_text: sample,
          style: style,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.image_base64) {
          setCanvasPreviewImage(`data:image/jpeg;base64,${data.image_base64}`);
        }
      }
    } catch (e) {
      console.error("Preview render failed:", e);
    } finally {
      setIsRenderingPreview(false);
    }
  };

  useEffect(() => {
    if (activeTab === "style") {
      fetchCanvasPreview();
    }
  }, [activeTab, selectedSpeakerForStyle, speakerCustomStyles[selectedSpeakerForStyle]]);

  const handleExport = async () => {
    if (segments.length === 0) return alert("No segments to export");

    try {
      const res = await fetch("/api/subtitles/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments,
          speaker_mapping: speakerMapping,
          speaker_styles: speakerCustomStyles,
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

  const tabs = [
    { id: "transcribe", label: "Transcribe" },
    { id: "speakers", label: "Speakers" },
    { id: "style", label: "Subtitle Studio (ASS)" },
    { id: "export", label: "Export" },
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans custom-scrollbar gap-6">
      <Header
        title="Subtitle & Audio Studio"
        subtitle="Transcribe speech, identify speakers with voice samples, and customize per-speaker ASS subtitles with live video canvas preview."
        actions={<ModernTabs activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />}
      />

      <div className="flex-1 w-full flex flex-col min-h-0 space-y-6">
        {/* TRANSCRIBE TAB */}
        {activeTab === "transcribe" && (
          <ModernTabContent activeTab="transcribe">
            <div className="space-y-6 animate-fade-in">
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-[var(--theme-heading)] mb-4 flex items-center gap-2">
                  <Icon name="psychology" size={20} /> Diarization & Whisper Settings
                </h3>
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg hover:border-[var(--theme-heading)] transition-colors">
                  <input
                    type="checkbox"
                    checked={doDiarize}
                    onChange={(e) => setDoDiarize(e.target.checked)}
                    className="w-5 h-5 rounded border-[var(--theme-ui-border)] accent-[var(--theme-heading)]"
                  />
                  <div>
                    <div className="text-[var(--theme-heading)] font-bold text-sm">
                      Identify Individual Speakers (Pyannote Diarization)
                    </div>
                    <div className="text-[var(--theme-text)] text-xs mt-0.5">
                      Extracts distinct vocal tracks and enables per-speaker styling. Requires Hugging Face token.
                    </div>
                  </div>
                </label>

                {doDiarize && (
                  <div className="mt-4">
                    <input
                      type="password"
                      placeholder="Hugging Face User Access Token (hf_...)"
                      value={hfToken}
                      onChange={(e) => setHfToken(e.target.value)}
                      className="w-full p-3 bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg text-[var(--theme-text)] focus:border-[var(--theme-heading)] outline-none transition-colors text-sm font-mono"
                    />
                    <p className="text-xs text-[var(--theme-text)]/70 mt-1">
                      Must have accepted user conditions for pyannote/speaker-diarization-3.1 on Hugging Face.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-6 flex flex-col justify-between shadow-sm">
                  <h3 className="font-bold text-[var(--theme-heading)] mb-4">Media File</h3>

                  {fileId ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-[var(--theme-bg)] p-3 rounded-lg border border-[var(--theme-ui-border)]">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Icon name="video_file" className="text-[var(--theme-heading)] shrink-0" size={24} />
                          <span className="text-[var(--theme-text)] font-medium truncate">{filename}</span>
                        </div>
                        <Icon name="check_circle" className="text-emerald-500 shrink-0" size={20} />
                      </div>

                      {previewFrame && (
                        <img
                          src={previewFrame}
                          alt="Preview"
                          className="w-full aspect-video object-cover rounded-lg shadow-lg border border-[var(--theme-ui-border)]"
                        />
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setFileHash(null);
                          setFileId("");
                          setFilename("");
                          setPreviewFrame(null);
                        }}
                        className="w-full"
                      >
                        Change Media File
                      </Button>
                    </div>
                  ) : (
                    <DirectUploadBox
                      accept="audio/*,video/*"
                      label="Upload Audio / Video File"
                      onUploadComplete={handleUploadComplete}
                      onClear={() => {
                        setFileHash(null);
                        setFileId("");
                        setFilename("");
                        setPreviewFrame(null);
                      }}
                    />
                  )}
                </div>

                <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-6 flex flex-col justify-between shadow-sm">
                  <div>
                    <h3 className="font-bold text-[var(--theme-heading)] mb-4">Pipeline Status</h3>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--theme-text)]">Media Loaded:</span>
                        <span className={fileId ? "text-emerald-400 font-medium" : "text-[var(--theme-text)]"}>
                          {fileId ? "Yes" : "No"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--theme-text)]">Model Footprint:</span>
                        <span className="text-[var(--theme-heading)] font-medium">{modelSize}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--theme-text)]">Diarization:</span>
                        <span className="text-[var(--theme-heading)] font-medium">
                          {doDiarize ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      {segments.length > 0 && (
                        <div className="flex items-center justify-between text-sm pt-4 border-t border-[var(--theme-ui-border)]">
                          <span className="text-[var(--theme-text)]">Segments:</span>
                          <span className="text-emerald-400 font-medium">{segments.length} transcribed</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    icon={<Icon name={isTranscribing ? "progress_activity" : "play_arrow"} size={18} className={isTranscribing ? "animate-spin" : ""} />}
                    onClick={handleTranscribe}
                    disabled={isTranscribing || !fileId}
                    className="w-full"
                  >
                    {isTranscribing ? "Transcribing & Diarizing..." : "Run Transcription Pipeline"}
                  </Button>
                </div>
              </div>
            </div>
          </ModernTabContent>
        )}

        {/* SPEAKERS TAB */}
        {activeTab === "speakers" && (
          <ModernTabContent activeTab="speakers">
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--theme-heading)]">Speaker Identification</h2>
                  <p className="text-xs text-[var(--theme-text)] mt-0.5">
                    Click the speaker thumbnail avatar to preview their vocal audio sample directly from the track.
                  </p>
                </div>
              </div>

              {rawSpeakerIds.length === 0 ? (
                <div className="p-12 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl text-center backdrop-blur-md">
                  <Icon name="group" className="mx-auto text-[var(--theme-text)]/40 mb-4" size={48} />
                  <h3 className="text-lg font-bold text-[var(--theme-heading)]">No Speakers Detected</h3>
                  <p className="text-[var(--theme-text)] text-sm mt-1">
                    Run transcription with Diarization enabled to automatically separate and sample speakers.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rawSpeakerIds.map((sid) => (
                    <div
                      key={sid}
                      className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-[var(--theme-heading)] transition-all"
                    >
                      {/* Avatar with Play Voice Sample action */}
                      <div
                        className="relative w-16 h-16 rounded-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] flex items-center justify-center shrink-0 overflow-hidden cursor-pointer group shadow-sm"
                        onClick={() => handlePlaySpeaker(sid)}
                        title="Click to play audio sample of this speaker"
                      >
                        {speakerThumbnails[sid] ? (
                          <img
                            src={speakerThumbnails[sid]}
                            alt={sid}
                            className={`w-full h-full object-cover transition-all ${
                              playingSpeakerId === sid ? "scale-110 opacity-75" : "group-hover:opacity-75"
                            }`}
                          />
                        ) : (
                          <Icon name="mic" className="text-[var(--theme-text)]" size={24} />
                        )}

                        <div
                          className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${
                            playingSpeakerId === sid ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {playingSpeakerId === sid ? (
                            <div className="flex gap-1 items-end h-5">
                              <div className="w-1 bg-[var(--theme-heading)] animate-pulse h-3"></div>
                              <div className="w-1 bg-[var(--theme-heading)] animate-pulse h-5 delay-75"></div>
                              <div className="w-1 bg-[var(--theme-heading)] animate-pulse h-2 delay-150"></div>
                            </div>
                          ) : (
                            <Icon name="play_arrow" className="text-white" size={24} />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-bold text-[var(--theme-heading)] uppercase tracking-wider block">
                          Speaker Display Name
                        </label>
                        <input
                          type="text"
                          value={speakerMapping[sid] || sid}
                          onChange={(e) => setSpeakerMapping({ ...speakerMapping, [sid]: e.target.value })}
                          className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-2 text-sm text-[var(--theme-text)] focus:border-[var(--theme-heading)] outline-none transition-colors"
                        />
                        <div className="flex items-center justify-between text-xs text-[var(--theme-text)]/70">
                          <span>Raw ID: {sid}</span>
                          <button
                            onClick={() => {
                              setSelectedSpeakerForStyle(sid);
                              setActiveTab("style");
                            }}
                            className="text-[var(--theme-heading)] hover:underline flex items-center gap-1 font-semibold"
                          >
                            <Icon name="palette" size={12} /> Edit Style
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModernTabContent>
        )}

        {/* SUBTITLE STUDIO (ASS) TAB */}
        {activeTab === "style" && (
          <ModernTabContent activeTab="style">
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--theme-heading)]">ASS Subtitle Style Studio</h2>
                  <p className="text-xs text-[var(--theme-text)] mt-0.5">
                    Fine-tune typography, colors, margins, and outline stroke per speaker with 1080p canvas frame preview.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={applyStyleToAllSpeakers}>
                    Copy Style to All Speakers
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={fetchCanvasPreview}
                    disabled={isRenderingPreview}
                    icon={<Icon name={isRenderingPreview ? "progress_activity" : "refresh"} size={16} className={isRenderingPreview ? "animate-spin" : ""} />}
                  >
                    Refresh Preview
                  </Button>
                </div>
              </div>

              {/* Speaker Selector pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)] mr-2 shrink-0">
                  Editing:
                </span>
                {rawSpeakerIds.length === 0 ? (
                  <button
                    onClick={() => setSelectedSpeakerForStyle("ALL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                      selectedSpeakerForStyle === "ALL"
                        ? "bg-[var(--theme-heading)] text-[var(--theme-bg)]"
                        : "bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)]"
                    }`}
                  >
                    Global Default Style
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setSelectedSpeakerForStyle("ALL")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                        selectedSpeakerForStyle === "ALL"
                          ? "bg-[var(--theme-heading)] text-[var(--theme-bg)]"
                          : "bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)]"
                      }`}
                    >
                      Global Defaults
                    </button>
                    {rawSpeakerIds.map((sid) => (
                      <button
                        key={sid}
                        onClick={() => setSelectedSpeakerForStyle(sid)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 ${
                          selectedSpeakerForStyle === sid
                            ? "bg-[var(--theme-heading)] text-[var(--theme-bg)]"
                            : "bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)]"
                        }`}
                      >
                        <Icon name="mic" size={14} />
                        <span>{speakerMapping[sid] || sid}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Preset Selector */}
              <div className="flex items-center gap-2 bg-[var(--theme-ui-bg)] p-3 rounded-xl border border-[var(--theme-ui-border)]">
                <span className="text-xs font-semibold text-[var(--theme-text)]">Quick Presets:</span>
                {Object.keys(PRESET_STYLES).map((pName) => (
                  <button
                    key={pName}
                    onClick={() => applyPresetToSelected(pName)}
                    className="px-2.5 py-1 text-xs rounded-md bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:border-[var(--theme-heading)] transition-colors"
                  >
                    {pName}
                  </button>
                ))}
              </div>

              {/* Style Controls & Canvas Preview Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Controls */}
                <div className="lg:col-span-5 bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] space-y-4 shadow-sm backdrop-blur-md">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--theme-heading)]">
                    Typography & Rendering
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[var(--theme-text)] mb-1 block">Font Family</label>
                      <select
                        value={activeStyleConfig.font}
                        onChange={(e) => updateCurrentStyle("font", e.target.value)}
                        className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-2 text-xs text-[var(--theme-text)] focus:border-[var(--theme-heading)] outline-none"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f} value={f} className="bg-[var(--theme-bg)] text-[var(--theme-text)]">
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--theme-text)] mb-1 block">
                        Font Size ({activeStyleConfig.size}px)
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={activeStyleConfig.size}
                        onChange={(e) => updateCurrentStyle("size", parseInt(e.target.value))}
                        className="w-full accent-[var(--theme-heading)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[var(--theme-text)] mb-1 block">Text Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={activeStyleConfig.primary_color}
                          onChange={(e) => updateCurrentStyle("primary_color", e.target.value)}
                          className="w-9 h-9 rounded cursor-pointer border border-[var(--theme-ui-border)] bg-transparent"
                        />
                        <span className="text-xs font-mono text-[var(--theme-text)]">
                          {activeStyleConfig.primary_color}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--theme-text)] mb-1 block">
                        Outline Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={activeStyleConfig.outline_color}
                          onChange={(e) => updateCurrentStyle("outline_color", e.target.value)}
                          className="w-9 h-9 rounded cursor-pointer border border-[var(--theme-ui-border)] bg-transparent"
                        />
                        <span className="text-xs font-mono text-[var(--theme-text)]">
                          {activeStyleConfig.outline_color}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[var(--theme-text)] mb-1 block">
                        Outline Width ({activeStyleConfig.outline_width}px)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="8"
                        value={activeStyleConfig.outline_width}
                        onChange={(e) => updateCurrentStyle("outline_width", parseInt(e.target.value))}
                        className="w-full accent-[var(--theme-heading)]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--theme-text)] mb-1 block">
                        Bottom Margin ({activeStyleConfig.margin_v}px)
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="200"
                        value={activeStyleConfig.margin_v}
                        onChange={(e) => updateCurrentStyle("margin_v", parseInt(e.target.value))}
                        className="w-full accent-[var(--theme-heading)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[var(--theme-text)] mb-1 block">
                      Sample Text for Canvas
                    </label>
                    <input
                      type="text"
                      value={previewSampleText}
                      onChange={(e) => setPreviewSampleText(e.target.value)}
                      placeholder="Type preview text..."
                      className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-2 text-xs text-[var(--theme-text)] focus:border-[var(--theme-heading)] outline-none"
                    />
                  </div>
                </div>

                {/* Canvas Video Preview */}
                <div className="lg:col-span-7 bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-heading)] flex items-center gap-1.5">
                      <Icon name="visibility" size={16} /> 1080p Canvas Preview
                    </span>
                    <span className="text-xs text-[var(--theme-text)]/70">
                      Target: {selectedSpeakerForStyle}
                    </span>
                  </div>

                  <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-[var(--theme-ui-border)] flex items-center justify-center">
                    {canvasPreviewImage ? (
                      <img src={canvasPreviewImage} alt="Subtitle Preview" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[var(--theme-text)]/40 gap-2">
                        <Icon name="movie" size={36} />
                        <span className="text-xs">No video frame or preview generated</span>
                      </div>
                    )}

                    {isRenderingPreview && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Icon name="progress_activity" size={32} className="animate-spin text-[var(--theme-heading)]" />
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[var(--theme-text)]/60 mt-3">
                    Preview renders exact pixel font scales, alpha transparency, and vertical baseline offsets as they will appear in media players (VLC, mpv).
                  </p>
                </div>
              </div>
            </div>
          </ModernTabContent>
        )}

        {/* EXPORT TAB */}
        {activeTab === "export" && (
          <ModernTabContent activeTab="export">
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-semibold text-[var(--theme-heading)]">Export Subtitles</h2>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-6 space-y-4 shadow-sm">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--theme-heading)] mb-2">
                      Export Format
                    </label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-3 text-sm text-[var(--theme-text)] focus:border-[var(--theme-heading)] outline-none transition-colors"
                    >
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="ass">
                        ASS (Advanced SubStation Alpha - Fully Styled)
                      </option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="srt">
                        SRT (SubRip - Universal Timed Subtitles)
                      </option>
                    </select>
                  </div>

                  <Button
                    variant="primary"
                    icon={<Icon name="download" size={18} />}
                    onClick={handleExport}
                    className="w-full mt-4"
                    disabled={segments.length === 0}
                  >
                    Download {exportFormat.toUpperCase()}
                  </Button>
                </div>

                <div className="lg:col-span-8 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-6 shadow-sm">
                  <h3 className="font-bold text-[var(--theme-heading)] mb-4 flex items-center gap-2">
                    Transcript Preview ({segments.length} segments)
                  </h3>
                  <div className="bg-[var(--theme-bg)] rounded-lg border border-[var(--theme-ui-border)] p-4 h-[350px] overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed">
                    {segments.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[var(--theme-text)] text-sm">
                        No segments transcribed yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {segments.map((seg, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-[var(--theme-text)]/50 shrink-0">
                              [{new Date(seg.start * 1000).toISOString().substring(14, 19)}]
                            </span>
                            {seg.speaker && (
                              <span className="text-[var(--theme-heading)] font-bold shrink-0">
                                {speakerMapping[seg.speaker] || seg.speaker}:
                              </span>
                            )}
                            <span className="text-[var(--theme-text)]">{seg.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ModernTabContent>
        )}
      </div>
    </div>
  );
}
