"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { toast } from "react-hot-toast";
import { Icon } from "@/lib/utils";

interface CachedModel {
  id: string;
  repo_id: string;
  size_bytes: number;
  path: string;
}

interface OllamaModel {
  name: string;
  size_bytes: number;
}

const PRESET_MODELS = {
  expense_tracker: [
    "naver-clova-ix/donut-base-finetuned-cord-v2",
    "Qwen/Qwen2-VL-2B-Instruct",
    "Qwen/Qwen2-VL-7B-Instruct"
  ],
  math_latex: [
    "stepfun-ai/GOT-OCR2_0",
    "ATH-MaaS/OvisOCR2",
    "baidu/Unlimited-OCR",
    "prithivMLmods/Qwen2-VL-OCR-2B-Instruct",
    "breezedeus/pix2text-mfr"
  ],
  audio_transcription: [
    "whisper-tiny", "whisper-base", "whisper-small", "whisper-medium", "whisper-large-v1", "whisper-large-v2", "whisper-large-v3",
    "Systran/faster-whisper-tiny", "Systran/faster-whisper-base", "Systran/faster-whisper-small", "Systran/faster-whisper-medium", "Systran/faster-whisper-large-v1", "Systran/faster-whisper-large-v2", "Systran/faster-whisper-large-v3",
    "UsefulSensors/moonshine-tiny", "UsefulSensors/moonshine-base"
  ],
  speaker_diarization: [
    "pyannote/speaker-diarization-3.1"
  ],
  object_detection: [
    "yolo11n.pt", "yolo11s.pt", "yolo11m.pt", "yolo11l.pt", "yolo11x.pt",
    "yolov8n.pt", "yolov8s.pt", "yolov8m.pt", "yolov8l.pt", "yolov8x.pt"
  ],
  face_blur: [
    "buffalo_l", "buffalo_m", "buffalo_s", "antelopev2", "retinaface", "mediapipe"
  ],
  depth_estimation: [
    "onnx-community/depth-anything-v2-small",
    "onnx-community/depth-anything-v2-base"
  ],
  image_upscaler_scale: [
    "2", "4", "8"
  ],
  translation: [
    "google-t5/t5-small",
    "google-t5/t5-base",
    "facebook/nllb-200-distilled-600M"
  ],
  voice_cloning_tts: [
    "k2-fsa/OmniVoice"
  ]
};

export default function ModelSettingsPage() {
  // Config state
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState("");
  
  // HF Token state
  const [token, setToken] = useState("");
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState("");
  const [showToken, setShowToken] = useState(false);
  
  // Cache state
  const [models, setModels] = useState<CachedModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  
  // Download state
  const [repoIdInput, setRepoIdInput] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState("");
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  
  // Ollama state
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isLoadingOllama, setIsLoadingOllama] = useState(true);
  const [ollamaRepoInput, setOllamaRepoInput] = useState("");
  const [isDownloadingOllama, setIsDownloadingOllama] = useState(false);
  const [ollamaDownloadMsg, setOllamaDownloadMsg] = useState("");
  const [downloadingOllamaId, setDownloadingOllamaId] = useState<string | null>(null);
  
  const fetchModels = async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch("/api/settings/hf/models");
      if (res.ok) {
        const data = await res.json();
        setModels(data.models);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const fetchOllamaModels = async () => {
    setIsLoadingOllama(true);
    try {
      const res = await fetch("/api/settings/ollama/models");
      if (res.ok) {
        const data = await res.json();
        setOllamaModels(data.models);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingOllama(false);
    }
  };

  const fetchToken = async () => {
    try {
      const res = await fetch("/api/settings/hf/token");
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/settings/models/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchToken();
    fetchModels();
    fetchConfig();
    fetchOllamaModels();
  }, []);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    setConfigMessage("");
    try {
      const res = await fetch("/api/settings/models/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config })
      });
      if (res.ok) {
        setConfigMessage("Preferences saved successfully.");
      } else {
        setConfigMessage("Failed to save preferences.");
      }
    } catch (e) {
      setConfigMessage("Error saving preferences.");
    } finally {
      setIsSavingConfig(false);
      setTimeout(() => setConfigMessage(""), 3000);
    }
  };

  const handleSaveToken = async () => {
    setIsSavingToken(true);
    setTokenMessage("");
    try {
      const res = await fetch("/api/settings/hf/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        setTokenMessage("Token saved successfully.");
      } else {
        setTokenMessage("Failed to save token.");
      }
    } catch (e) {
      setTokenMessage("Error saving token.");
    } finally {
      setIsSavingToken(false);
      setTimeout(() => setTokenMessage(""), 3000);
    }
  };

  const handleDownload = async (modelIdToDownload: string) => {
    if (!modelIdToDownload.trim()) return;
    setIsDownloading(true);
    setDownloadingModelId(modelIdToDownload);
    
    const toastId = toast.loading(`Starting download for ${modelIdToDownload}...`);
    
    // Start SSE listener
    const eventSource = new EventSource(`/api/settings/hf/models/download/progress?repo_id=${encodeURIComponent(modelIdToDownload.trim())}`);
    
    eventSource.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.status === "downloading") {
                const mb = (data.progress / 1024 / 1024).toFixed(1);
                toast.loading(`Downloading ${modelIdToDownload}: ${mb}MB`, { id: toastId });
            } else if (data.status === "finished") {
                toast.success(`${modelIdToDownload} downloaded successfully!`, { id: toastId });
                setRepoIdInput("");
                fetchModels();
                eventSource.close();
                setIsDownloading(false);
                setDownloadingModelId(null);
            } else if (data.status === "error") {
                toast.error(`Failed to download ${modelIdToDownload}`, { id: toastId });
                eventSource.close();
                setIsDownloading(false);
                setDownloadingModelId(null);
            }
        } catch(err) {
            // ignore parse errors
        }
    };
    
    try {
      const res = await fetch("/api/settings/hf/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: modelIdToDownload.trim() })
      });
      
      if (!res.ok) {
        let errorMsg = "Download failed to start";
        try {
            const data = await res.json();
            errorMsg = data.detail || errorMsg;
        } catch (err) {
            errorMsg = await res.text() || errorMsg;
        }
        toast.error(`Error: ${errorMsg}`, { id: toastId });
        eventSource.close();
        setIsDownloading(false);
        setDownloadingModelId(null);
      }
      // If OK, the SSE eventSource handles the completion!
    } catch (e: any) {
      eventSource.close();
      setIsDownloading(false);
      setDownloadingModelId(null);
      toast.error(`Error: ${e.message}`, { id: toastId });
    }
  };

  const handleDownloadOllama = async (modelName: string) => {
    if (!modelName.trim()) return;
    setIsDownloadingOllama(true);
    setDownloadingOllamaId(modelName);
    
    const toastId = toast.loading(`Pulling Ollama model ${modelName}...`);
    
    try {
      const res = await fetch("/api/settings/ollama/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: modelName.trim() })
      });
      
      if (res.ok) {
        toast.success(`Ollama model ${modelName} pulled successfully!`, { id: toastId });
        setOllamaRepoInput("");
        fetchOllamaModels();
      } else {
        let errorMsg = "Pull failed";
        try {
            const data = await res.json();
            errorMsg = data.detail || errorMsg;
        } catch (err) {
            errorMsg = await res.text() || errorMsg;
        }
        toast.error(`Error: ${errorMsg}`, { id: toastId });
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`, { id: toastId });
    } finally {
      setIsDownloadingOllama(false);
      setDownloadingOllamaId(null);
    }
  };

  const handleDelete = async (modelId: string) => {
    if (!confirm(`Are you sure you want to delete ${modelId}? This will free up disk space but you will need to re-download it later.`)) return;
    
    const toastId = toast.loading(`Deleting ${modelId}...`);
    try {
      const res = await fetch(`/api/settings/hf/models/${encodeURIComponent(modelId)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success(`${modelId} deleted`, { id: toastId });
        fetchModels();
      } else {
        toast.error("Failed to delete model", { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred", { id: toastId });
    }
  };

  const handleDeleteOllama = async (modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) return;
    const toastId = toast.loading(`Deleting ${modelName}...`);
    try {
      const res = await fetch(`/api/settings/ollama/models/${encodeURIComponent(modelName)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success(`${modelName} deleted`, { id: toastId });
        fetchOllamaModels();
      } else {
        toast.error("Failed to delete model", { id: toastId });
      }
    } catch (e) {
      toast.error("Error deleting model", { id: toastId });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalCacheSize = models.reduce((acc, m) => acc + m.size_bytes, 0);

  const updateConfigVal = (key: string, val: string) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  // Check if a specific model id is downloaded
  const isDownloaded = (repo_id: string) => {
    if (!repo_id) return false;
    // For non HF models, just check if it's in the list roughly. Or we can just use repo_id matching.
    return models.some(m => m.repo_id.toLowerCase() === repo_id.toLowerCase());
  };

  const renderDropdownWithDownload = (label: string, configKey: string, options: string[]) => {
    const currentValue = config[configKey] || (options.length > 0 ? options[0] : "");
    const isModelDownloaded = isDownloaded(currentValue);
    
    return (
      <div className="animate-slide-up flex flex-col gap-1.5">
        <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">{label}</label>
        <div className="flex gap-2">
            <select
              value={currentValue}
              onChange={e => updateConfigVal(configKey, e.target.value)}
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
            >
              {options.map(opt => (
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={opt} value={opt}>{opt}</option>
              ))}
              {!options.includes(currentValue) && currentValue !== "" && (
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={currentValue}>{currentValue} (Custom)</option>
              )}
            </select>
            {isModelDownloaded ? (
                <div className="flex items-center justify-center bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg px-3" title="Model downloaded">
                    <Icon name="check_circle" size={18} />
                </div>
            ) : (
                <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => handleDownload(currentValue)}
                    disabled={isDownloading || !currentValue}
                    className="h-[38px] px-3 shrink-0"
                    title="Download this model"
                >
                    {isDownloading && downloadingModelId === currentValue ? <span className="animate-pulse"><Icon name="download" size={16}/></span> : <Icon name="download" size={16} />}
                </Button>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Model Settings" subtitle="Configure default AI models, manage your API token, and clean up your cache directory to free up disk space." />

      {/* Global Model Preferences */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">Global Model Preferences
            </h3>
            <Button 
                variant="primary" 
                size="sm" 
                onClick={handleSaveConfig} 
                disabled={isSavingConfig}
                className="bg-secondary hover:bg-blue-700 h-9"
            >
                {isSavingConfig ? "Saving" : <span className="flex items-center gap-2"><Icon name="save" size={14}/> Save Preferences</span>}
            </Button>
        </div>
        
        {configMessage && (
          <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 p-2 rounded-lg border border-green-400/20">
            <Icon name="check_circle" size={14} /> {configMessage}
          </div>
        )}

        {/* Global Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-2 pb-6 border-b border-white/5">
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider" title="Configures whether PyTorch models and HuggingFace pipelines should try to load into GPU VRAM or stay on CPU (System RAM). Applies to Whisper, Rembg, Transformers, etc.">Device Preference</label>
                <select
                    value={config.device_preference || "Auto-Detect"}
                    onChange={e => updateConfigVal("device_preference", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
                    title="Configures whether PyTorch models and HuggingFace pipelines should try to load into GPU VRAM or stay on CPU (System RAM). Applies to Whisper, Rembg, Transformers, etc."
                >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Auto-Detect">Auto-Detect</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="CPU Only">CPU Only</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="GPU Preference">GPU Preference</option>
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider" title="Use FP16 or INT8 precision for HuggingFace pipeline models to save VRAM and speed up inference. Applies to Whisper, Translation, and OCR.">Hardware Optimization</label>
                <select
                    value={config.hardware_optimization || "PyTorch (Standard)"}
                    onChange={e => updateConfigVal("hardware_optimization", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
                    title="Use FP16 or INT8 precision for HuggingFace pipeline models to save VRAM and speed up inference. Applies to Whisper, Translation, and OCR."
                >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="PyTorch (Standard)">PyTorch (Standard)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="FP16 (GPU Speedup)">FP16 (GPU Speedup)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="INT8 (Max GPU Memory Save)">INT8 (Max GPU Memory Save)</option>
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider" title="Converts YOLO object detection models into optimized ONNX or TensorRT engines dynamically for faster webcam tracking.">Global Compute Engine</label>
                <select
                    value={config.global_compute_engine || "cpu"}
                    onChange={e => updateConfigVal("global_compute_engine", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
                    title="Converts YOLO object detection models into optimized ONNX or TensorRT engines dynamically for faster webcam tracking."
                >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="cpu">CPU / OpenVINO (cpu)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="cuda">NVIDIA GPU (cuda)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="onnx">ONNX Runtime (onnx)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="tensorrt">TensorRT (tensorrt)</option>
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider" title="Base resolution used for YOLO vision tasks. Lower resolutions process significantly faster but with less accuracy.">Inference Resolution (Vision)</label>
                <select
                    value={config.inference_resolution || "640"}
                    onChange={e => updateConfigVal("inference_resolution", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
                    title="Base resolution used for YOLO vision tasks. Lower resolutions process significantly faster but with less accuracy."
                >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="160">160x160 (Fastest, High RAM savings)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="320">320x320 (Balanced)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="640">640x640 (High Quality, Standard)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="1024">1024x1024 (Highest Quality, Very Slow)</option>
                </select>
            </div>
        </div>

        {/* Model Related */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <h3 className="col-span-1 md:col-span-2 text-lg font-semibold text-white flex items-center gap-2 mt-2 mb-[-8px]">Model Related Settings
            </h3>
            
            <div className="flex flex-col gap-2">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Image Upscaler Scale</label>
                <select
                    value={config.image_upscaler_scale || "4"}
                    onChange={e => updateConfigVal("image_upscaler_scale", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
                >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="2">2x Upscale</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="4">4x Upscale</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="8">8x Upscale</option>
                </select>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Background Removal Model</label>
                <select
                    value={config.background_removal || "u2net"}
                    onChange={e => updateConfigVal("background_removal", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
                >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="u2net">rembg (u2net) - Lightweight & Fast</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="briaai-rmbg-1.4">briaai (RMBG-1.4) - High Quality</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="briaai-rmbg-2.0">briaai (RMBG-2.0) - Best Quality (Needs HF Token)</option>
                </select>
            </div>
            {renderDropdownWithDownload("Expense Tracker / Receipt Parsing", "expense_tracker", PRESET_MODELS.expense_tracker)}
            {renderDropdownWithDownload("Math to LaTeX (OCR)", "math_latex", PRESET_MODELS.math_latex)}
            {renderDropdownWithDownload("Audio Transcription (Whisper)", "audio_transcription", PRESET_MODELS.audio_transcription)}
            {renderDropdownWithDownload("Speaker Diarization", "speaker_diarization", PRESET_MODELS.speaker_diarization)}
            {renderDropdownWithDownload("Object Detection (YOLO)", "object_detection", PRESET_MODELS.object_detection)}
            {renderDropdownWithDownload("Face Detection / Blur", "face_blur", PRESET_MODELS.face_blur)}
            {renderDropdownWithDownload("Depth Estimation (ONNX)", "depth_estimation", PRESET_MODELS.depth_estimation)}
            {renderDropdownWithDownload("Local Translation", "translation", PRESET_MODELS.translation)}
            {renderDropdownWithDownload("Voice Cloning TTS", "voice_cloning_tts", PRESET_MODELS.voice_cloning_tts)}
        </div>

        {/* Obsidian Builder & LLM Chatbot */}
        <div className="mt-8 border-t border-white/5 pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <h3 className="col-span-1 md:col-span-2 text-lg font-semibold text-white flex items-center gap-2 mt-2 mb-[-8px]">Obsidian AI Generator & LLM Chatbot
            </h3>
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Obsidian AI Provider</label>
                <select
                    value={config.obsidian_provider || "Hugging Face API"}
                    onChange={e => updateConfigVal("obsidian_provider", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Hugging Face API">Hugging Face API (Cloud)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Ollama">Ollama (Local CPU/GPU)</option>
                </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Obsidian Agent Model</label>
                <select
                    value={config.obsidian_ollama_model || "llama3:8b-instruct-q4_K_M"}
                    onChange={e => updateConfigVal("obsidian_ollama_model", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    disabled={config.obsidian_provider !== "Ollama"}
                >
                    {ollamaModels.map(m => (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={m.name} value={m.name}>{m.name}</option>
                    ))}
                    {!ollamaModels.find(m => m.name === config.obsidian_ollama_model) && config.obsidian_ollama_model && (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={config.obsidian_ollama_model}>{config.obsidian_ollama_model} (Missing)</option>
                    )}
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Obsidian Generator Model</label>
                <select
                    value={config.obsidian_ollama_generator_model || config.obsidian_ollama_model || "llama3:8b-instruct-q4_K_M"}
                    onChange={e => updateConfigVal("obsidian_ollama_generator_model", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    disabled={config.obsidian_provider !== "Ollama"}
                >
                    {ollamaModels.map(m => (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={m.name} value={m.name}>{m.name}</option>
                    ))}
                    {!ollamaModels.find(m => m.name === (config.obsidian_ollama_generator_model || config.obsidian_ollama_model)) && (config.obsidian_ollama_generator_model || config.obsidian_ollama_model) && (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={config.obsidian_ollama_generator_model || config.obsidian_ollama_model}>{config.obsidian_ollama_generator_model || config.obsidian_ollama_model} (Missing)</option>
                    )}
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Ollama Vision Model (OCR)</label>
                <select
                    value={config.obsidian_ollama_vision_model || "llava"}
                    onChange={e => updateConfigVal("obsidian_ollama_vision_model", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                    {ollamaModels.map(m => (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={m.name} value={m.name}>{m.name}</option>
                    ))}
                    {!ollamaModels.find(m => m.name === (config.obsidian_ollama_vision_model || "llava")) && (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={config.obsidian_ollama_vision_model || "llava"}>{config.obsidian_ollama_vision_model || "llava"} (Missing)</option>
                    )}
                </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Scraper Max URLs</label>
                <input
                    type="number"
                    min={1} max={10}
                    value={config.obsidian_scraper_max_urls || "2"}
                    onChange={e => updateConfigVal("obsidian_scraper_max_urls", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Model Context Length</label>
                <select
                    value={config.obsidian_context_length || "8192"}
                    onChange={e => updateConfigVal("obsidian_context_length", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="4096">4096</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="8192">8192 (Recommended)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="16384">16384</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="32768">32768</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Embedding Model (RAG)</label>
                <select
                    value={config.obsidian_embedding_model || "nomic-embed-text"}
                    onChange={e => updateConfigVal("obsidian_embedding_model", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                    {ollamaModels.map(m => (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={m.name} value={m.name}>{m.name}</option>
                    ))}
                    {!ollamaModels.find(m => m.name === config.obsidian_embedding_model) && config.obsidian_embedding_model && (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={config.obsidian_embedding_model}>{config.obsidian_embedding_model} (Missing)</option>
                    )}
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider" title="Uses facebook/bart-large-cnn model to summarize search context locally before providing it to the main LLM.">Summarize Search (BART)</label>
                <select
                    value={config.obsidian_summarize_searches || "false"}
                    onChange={e => updateConfigVal("obsidian_summarize_searches", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    title="Uses facebook/bart-large-cnn model to summarize search context locally before providing it to the main LLM."
                >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="true">Yes (Enable Summarization)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="false">No (Disable Summarization)</option>
                </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider" title="The maximum amount of words allowed per summarized article when using the BART summarizer.">BART Summary Max Words</label>
                <input
                    type="number"
                    min="10"
                    max="1024"
                    value={config.obsidian_bart_max_words || 150}
                    onChange={e => updateConfigVal("obsidian_bart_max_words", (parseInt(e.target.value) || 150).toString())}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    title="The maximum amount of words allowed per summarized article when using the BART summarizer."
                />
            </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 animate-slide-up mt-8">
        {/* Token Card */}
        <div className="flex flex-col md:flex-row gap-6 w-full">
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 flex-1">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">API Access Token
            </h3>
            <p className="text-xs text-zinc-400">
              Your token is required to bypass rate limits or download private models (like Llama). It is stored securely in your local cache directory.
            </p>
            
            <div className="flex flex-col gap-2">
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  placeholder="hf_..."
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-yellow-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute inset-y-0 right-2 flex items-center text-zinc-500 hover:text-zinc-300"
                >
                  {showToken ? <Icon name="visibility_off" size={16} /> : <Icon name="visibility" size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="h-5">
                  {tokenMessage && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Icon name="check_circle" size={12} /> {tokenMessage}
                    </span>
                  )}
                </div>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleSaveToken} 
                  disabled={isSavingToken}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black h-8"
                >
                  {isSavingToken ? "Saving" : "Save Token"}
                </Button>
              </div>
            </div>
          </div>

          {/* Download Card */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 flex-1">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">Manual Download
            </h3>
            <p className="text-xs text-zinc-400">
              Pre-download any Hugging Face model manually by repository ID.
            </p>
            
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Qwen/Qwen2-VL-2B-Instruct"
                  value={repoIdInput}
                  onChange={e => setRepoIdInput(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
                <Button 
                  variant="primary" 
                  onClick={() => handleDownload(repoIdInput)} 
                  disabled={isDownloading || !repoIdInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 px-6 h-[38px]"
                >
                  {isDownloading && downloadingModelId === repoIdInput ? "Downloading" : "Download"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Cache Browser */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl flex flex-col backdrop-blur-sm overflow-hidden h-[500px] w-full">
          <div className="p-4 border-b border-white/10 bg-zinc-900 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">Local Cache
              </h3>
              <p className="text-xs text-zinc-400">
                Total size: <span className="text-zinc-200 font-medium">{formatBytes(totalCacheSize)}</span>
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchModels}>
              Refresh
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingModels ? (
              <div className="flex justify-center items-center h-full text-zinc-500 text-sm">
                Scanning cache
              </div>
            ) : models.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-zinc-500 text-sm gap-2">
                <Icon name="memory" size={32} className="opacity-20 mb-2" />
                No models downloaded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {models.map(m => (
                  <div key={m.id} className="bg-zinc-950/50 border border-white/5 rounded-lg p-3 flex justify-between items-center hover:bg-zinc-800/50 transition-colors">
                    <div className="flex flex-col truncate mr-4">
                      <span className="text-sm font-medium text-zinc-200 truncate" title={m.repo_id}>{m.repo_id}</span>
                      <span className="text-xs text-zinc-500 mt-0.5">{formatBytes(m.size_bytes)}</span>
                    </div>
                    <button 
                      onClick={() => handleDelete(m.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors shrink-0"
                      title="Delete model"
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-6 animate-slide-up mt-8 border-t border-white/5 pt-8">
          {/* Ollama Download Card */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 w-full">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">Ollama Model Download
          </h3>
          <p className="text-xs text-zinc-400">
            Download a new local model directly from the Ollama registry. (Note: large models take time!)
          </p>
          
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. nomic-embed-text, llama3:8b"
                value={ollamaRepoInput}
                onChange={e => setOllamaRepoInput(e.target.value)}
                className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary/50"
              />
              <Button 
                variant="primary" 
                onClick={() => handleDownloadOllama(ollamaRepoInput)} 
                disabled={isDownloadingOllama || !ollamaRepoInput.trim()}
                className="bg-secondary hover:bg-blue-700 px-6 h-[38px]"
              >
                {isDownloadingOllama && downloadingOllamaId === ollamaRepoInput ? "Pulling" : "Pull"}
              </Button>
            </div>
          </div>
        </div>

        {/* Ollama Models Browser */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl flex flex-col backdrop-blur-sm overflow-hidden h-[500px] w-full">
          <div className="p-4 border-b border-white/10 bg-zinc-900 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">Ollama Models
              </h3>
              <p className="text-xs text-zinc-400">
                Total size: <span className="text-zinc-200 font-medium">{formatBytes(ollamaModels.reduce((acc, m) => acc + m.size_bytes, 0))}</span>
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchOllamaModels}>
              Refresh
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingOllama ? (
              <div className="flex justify-center items-center h-full text-zinc-500 text-sm">
                Fetching models
              </div>
            ) : ollamaModels.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-zinc-500 text-sm gap-2">
                <Icon name="memory" size={32} className="opacity-20 mb-2" />
                No Ollama models found.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {ollamaModels.map(m => (
                  <div key={m.name} className="bg-zinc-950/50 border border-white/5 rounded-lg p-3 flex justify-between items-center hover:bg-zinc-800/50 transition-colors">
                    <div className="flex flex-col truncate mr-4">
                      <span className="text-sm font-medium text-zinc-200 truncate" title={m.name}>{m.name}</span>
                      <span className="text-xs text-zinc-500 mt-0.5">{formatBytes(m.size_bytes)}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteOllama(m.name)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors shrink-0"
                      title="Delete model"
                    >
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
      </div>
  );
}
