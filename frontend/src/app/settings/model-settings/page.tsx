"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, Download, Trash2, Database, AlertTriangle, CheckCircle2, HardDrive, Cpu, Settings2, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CachedModel {
  id: string;
  repo_id: string;
  size_bytes: number;
  path: string;
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
    "tiny", "base", "small", "medium", "large-v1", "large-v2", "large-v3"
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
  
  const fetchModels = async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/settings/hf/models");
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

  const fetchToken = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/settings/hf/token");
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
      const res = await fetch("http://127.0.0.1:8000/api/settings/models/config");
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
  }, []);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    setConfigMessage("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/settings/models/config", {
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
      const res = await fetch("http://127.0.0.1:8000/api/settings/hf/token", {
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
    setDownloadMsg("");
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/settings/hf/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: modelIdToDownload.trim() })
      });
      
      if (res.ok) {
        setDownloadMsg("Model downloaded successfully!");
        setRepoIdInput("");
        fetchModels();
      } else {
        const data = await res.json();
        setDownloadMsg(`Error: ${data.detail || "Download failed"}`);
      }
    } catch (e: any) {
      setDownloadMsg(`Error: ${e.message}`);
    } finally {
      setIsDownloading(false);
      setDownloadingModelId(null);
    }
  };

  const handleDelete = async (modelId: string) => {
    if (!confirm(`Are you sure you want to delete ${modelId}? This will free up disk space but you will need to re-download it later.`)) return;
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/settings/hf/models/${encodeURIComponent(modelId)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchModels();
      } else {
        alert("Failed to delete model.");
      }
    } catch (e) {
      alert("Error deleting model.");
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
      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">{label}</label>
        <div className="flex gap-2">
            <select
              value={currentValue}
              onChange={e => updateConfigVal(configKey, e.target.value)}
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              {!options.includes(currentValue) && currentValue !== "" && (
                  <option value={currentValue}>{currentValue} (Custom)</option>
              )}
            </select>
            {isModelDownloaded ? (
                <div className="flex items-center justify-center bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg px-3" title="Model downloaded">
                    <CheckCircle2 size={18} />
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
                    {isDownloading && downloadingModelId === currentValue ? <span className="animate-pulse"><Download size={16}/></span> : <Download size={16} />}
                </Button>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full h-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Database className="text-yellow-500" size={32} />
          Model Settings
        </h1>
        <p className="text-zinc-400 text-sm font-medium">
          Configure default AI models, manage your API token, and clean up your cache directory to free up disk space.
        </p>
      </div>

      {/* Global Model Preferences */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings2 size={18} className="text-blue-400" />
            Global Model Preferences
            </h3>
            <Button 
                variant="primary" 
                size="sm" 
                onClick={handleSaveConfig} 
                disabled={isSavingConfig}
                className="bg-blue-600 hover:bg-blue-700 h-9"
            >
                {isSavingConfig ? "Saving..." : <span className="flex items-center gap-2"><Save size={14}/> Save Preferences</span>}
            </Button>
        </div>
        
        {configMessage && (
          <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 p-2 rounded-lg border border-green-400/20">
            <CheckCircle2 size={14} /> {configMessage}
          </div>
        )}

        {/* Global Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-2 pb-6 border-b border-white/5">
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Device Preference</label>
                <select
                    value={config.device_preference || "Auto-Detect"}
                    onChange={e => updateConfigVal("device_preference", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="Auto-Detect">Auto-Detect</option>
                    <option value="CPU Only">CPU Only</option>
                    <option value="GPU Preference">GPU Preference</option>
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Hardware Optimization</label>
                <select
                    value={config.hardware_optimization || "PyTorch (Standard)"}
                    onChange={e => updateConfigVal("hardware_optimization", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    title="INT8 requires bitsandbytes library"
                >
                    <option value="PyTorch (Standard)">PyTorch (Standard)</option>
                    <option value="FP16 (GPU Speedup)">FP16 (GPU Speedup)</option>
                    <option value="INT8 (Max GPU Memory Save)">INT8 (Max GPU Memory Save)</option>
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Global Compute Engine</label>
                <select
                    value={config.global_compute_engine || "cpu"}
                    onChange={e => updateConfigVal("global_compute_engine", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="cpu">CPU / OpenVINO (cpu)</option>
                    <option value="cuda">NVIDIA GPU (cuda)</option>
                    <option value="onnx">ONNX Runtime (onnx)</option>
                    <option value="tensorrt">TensorRT (tensorrt)</option>
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Inference Resolution (Vision)</label>
                <select
                    value={config.inference_resolution || "640"}
                    onChange={e => updateConfigVal("inference_resolution", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="160">160x160 (Fastest, High RAM savings)</option>
                    <option value="320">320x320 (Balanced)</option>
                    <option value="640">640x640 (High Quality, Standard)</option>
                    <option value="1024">1024x1024 (Highest Quality, Very Slow)</option>
                </select>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Image Upscaler Scale</label>
                <select
                    value={config.image_upscaler_scale || "4"}
                    onChange={e => updateConfigVal("image_upscaler_scale", e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="2">2x Upscale</option>
                    <option value="4">4x Upscale</option>
                    <option value="8">8x Upscale</option>
                </select>
            </div>
        </div>

        {/* Models */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {renderDropdownWithDownload("Expense Tracker / Receipt Parsing", "expense_tracker", PRESET_MODELS.expense_tracker)}
            {renderDropdownWithDownload("Math to LaTeX (OCR)", "math_latex", PRESET_MODELS.math_latex)}
            {renderDropdownWithDownload("Audio Transcription (Whisper)", "audio_transcription", PRESET_MODELS.audio_transcription)}
            {renderDropdownWithDownload("Speaker Diarization", "speaker_diarization", PRESET_MODELS.speaker_diarization)}
            {renderDropdownWithDownload("Object Detection (YOLO)", "object_detection", PRESET_MODELS.object_detection)}
            {renderDropdownWithDownload("Face Detection / Blur", "face_blur", PRESET_MODELS.face_blur)}
            {renderDropdownWithDownload("Depth Estimation (ONNX)", "depth_estimation", PRESET_MODELS.depth_estimation)}
            {renderDropdownWithDownload("Local Translation", "translation", PRESET_MODELS.translation)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          {/* Token Card */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <KeyRound size={18} className="text-yellow-400" />
              API Access Token
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
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="h-5">
                  {tokenMessage && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle2 size={12} /> {tokenMessage}
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
                  {isSavingToken ? "Saving..." : "Save Token"}
                </Button>
              </div>
            </div>
          </div>

          {/* Download Card */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Download size={18} className="text-emerald-400" />
              Manual Download
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
                  {isDownloading && downloadingModelId === repoIdInput ? "Downloading..." : "Download"}
                </Button>
              </div>
              
              {downloadMsg && (
                <div className={`text-xs mt-2 p-2 border rounded-lg ${downloadMsg.includes("Error") ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-green-500/10 border-green-500/20 text-green-400"}`}>
                  {downloadMsg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Cache Browser */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl flex flex-col backdrop-blur-sm overflow-hidden h-[500px]">
          <div className="p-4 border-b border-white/10 bg-zinc-900 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <HardDrive size={18} className="text-blue-400" />
                Local Cache
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
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
                Scanning cache...
              </div>
            ) : models.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-zinc-500 text-sm gap-2">
                <Cpu size={32} className="opacity-20 mb-2" />
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
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
