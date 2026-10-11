"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";
import { toast } from "react-hot-toast";

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

interface OllamaStatus {
  connected: boolean;
  host: string;
  model_count: number;
  message?: string;
  error?: string;
}

const PRESET_MODELS: Record<string, string[]> = {
  expense_tracker: [
    "Qwen/Qwen2.5-VL-3B-Instruct",
    "Qwen/Qwen2.5-VL-7B-Instruct",
    "Qwen/Qwen2-VL-2B-Instruct",
    "naver-clova-ix/donut-base-finetuned-cord-v2"
  ],
  math_latex: [
    "Qwen/Qwen2.5-VL-3B-Instruct",
    "stepfun-ai/GOT-OCR2_0",
    "prithivMLmods/Qwen2-VL-OCR-2B-Instruct",
    "ATH-MaaS/OvisOCR2",
    "baidu/Unlimited-OCR",
    "breezedeus/pix2text-mfr"
  ],
  audio_transcription: [
    "Systran/faster-whisper-small",
    "Systran/faster-whisper-base",
    "Systran/faster-whisper-medium",
    "whisper-base",
    "whisper-small",
    "whisper-medium",
    "whisper-large-v3",
    "UsefulSensors/moonshine-tiny",
    "UsefulSensors/moonshine-base"
  ],
  speaker_diarization: [
    "pyannote/speaker-diarization-3.1"
  ],
  object_detection: [
    "yolo11n.pt",
    "yolo11s.pt",
    "yolo11m.pt",
    "yolo11l.pt",
    "yolo11x.pt",
    "yolov8n.pt",
    "yolov8s.pt",
    "yolov8m.pt",
    "yolov8l.pt",
    "yolov8x.pt"
  ],
  face_blur: [
    "buffalo_l",
    "buffalo_m",
    "buffalo_s",
    "antelopev2"
  ],
  depth_estimation: [
    "onnx-community/depth-anything-v2-small",
    "onnx-community/depth-anything-v2-base"
  ],
  background_removal: [
    "u2net",
    "briaai/RMBG-1.4",
    "briaai/RMBG-2.0"
  ],
  image_upscaler_scale: [
    "2",
    "4",
    "8"
  ],
  translation: [
    "facebook/nllb-200-distilled-600M",
    "google-t5/t5-base",
    "google-t5/t5-small"
  ],
  voice_cloning_tts: [
    "k2-fsa/OmniVoice"
  ]
};

const TABS = [
  { id: "overview", label: "Overview & Diagnostics", icon: "dashboard" },
  { id: "hardware", label: "Hardware & Compute", icon: "memory" },
  { id: "vision", label: "Vision & Graphics", icon: "visibility" },
  { id: "documents", label: "OCR & Documents", icon: "description" },
  { id: "audio", label: "Audio & Speech", icon: "graphic_eq" },
  { id: "llm", label: "LLMs & Agentic AI", icon: "psychology" },
  { id: "storage", label: "Model Storage & Downloads", icon: "download" },
];

export default function ModelSettingsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Config state
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // HF Token state
  const [token, setToken] = useState("");
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Cached models state
  const [models, setModels] = useState<CachedModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [cacheFilter, setCacheFilter] = useState("all");
  const [cacheSearch, setCacheSearch] = useState("");

  // Download state
  const [repoIdInput, setRepoIdInput] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);

  // Ollama state
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ connected: false, host: "http://localhost:11434", model_count: 0 });
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isLoadingOllama, setIsLoadingOllama] = useState(true);
  const [ollamaRepoInput, setOllamaRepoInput] = useState("");
  const [isDownloadingOllama, setIsDownloadingOllama] = useState(false);
  const [downloadingOllamaId, setDownloadingOllamaId] = useState<string | null>(null);

  // Testing state
  const [testingCategory, setTestingCategory] = useState<string | null>(null);

  const fetchModels = async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch("/api/settings/hf/models");
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const fetchOllama = async () => {
    setIsLoadingOllama(true);
    try {
      const [statusRes, modelsRes] = await Promise.all([
        fetch("/api/settings/ollama/status"),
        fetch("/api/settings/ollama/models")
      ]);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setOllamaStatus(statusData);
      }
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        setOllamaModels(modelsData.models || []);
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
        setToken(data.token || "");
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
        setConfig(data.config || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchToken();
    fetchModels();
    fetchConfig();
    fetchOllama();
  }, []);

  const updateConfigVal = (key: string, val: string) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const res = await fetch("/api/settings/models/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config })
      });
      if (res.ok) {
        toast.success("All model preferences saved successfully.");
      } else {
        toast.error("Failed to save model preferences.");
      }
    } catch (e) {
      toast.error("Error saving model preferences.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveToken = async () => {
    setIsSavingToken(true);
    try {
      const res = await fetch("/api/settings/hf/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        toast.success("Hugging Face API token saved.");
      } else {
        toast.error("Failed to save Hugging Face token.");
      }
    } catch (e) {
      toast.error("Error saving Hugging Face token.");
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleDownload = async (modelIdToDownload: string) => {
    if (!modelIdToDownload.trim()) return;
    setIsDownloading(true);
    setDownloadingModelId(modelIdToDownload);

    const toastId = toast.loading(`Starting download for ${modelIdToDownload}...`);

    const eventSource = new EventSource(
      `/api/settings/hf/models/download/progress?repo_id=${encodeURIComponent(modelIdToDownload.trim())}`
    );

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === "downloading") {
          const progressDesc = data.desc ? `${data.desc}` : "";
          const mb = data.progress && data.total && data.total > 1000
            ? ` (${(data.progress / 1024 / 1024).toFixed(1)}MB)`
            : "";
          toast.loading(`Downloading ${modelIdToDownload}: ${progressDesc}${mb}`, { id: toastId });
        } else if (data.status === "finished") {
          toast.success(`${modelIdToDownload} downloaded and verified!`, { id: toastId });
          setRepoIdInput("");
          fetchModels();
          eventSource.close();
          setIsDownloading(false);
          setDownloadingModelId(null);
        } else if (data.status === "error") {
          toast.error(`Failed to download ${modelIdToDownload}: ${data.desc || "Unknown error"}`, { id: toastId });
          eventSource.close();
          setIsDownloading(false);
          setDownloadingModelId(null);
        }
      } catch (err) {
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
        } catch {
          errorMsg = (await res.text()) || errorMsg;
        }
        toast.error(`Error: ${errorMsg}`, { id: toastId });
        eventSource.close();
        setIsDownloading(false);
        setDownloadingModelId(null);
      }
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

    const toastId = toast.loading(`Initiating pull for ${modelName}...`);

    const eventSource = new EventSource(
      `/api/settings/ollama/models/download/progress?repo_id=${encodeURIComponent(modelName.trim())}`
    );

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === "downloading") {
          const desc = data.desc || "Pulling layers";
          const pct = data.total > 0 && data.progress > 0
            ? ` (${((data.progress / data.total) * 100).toFixed(0)}%)`
            : "";
          toast.loading(`Ollama: ${desc}${pct}`, { id: toastId });
        } else if (data.status === "finished") {
          toast.success(`Ollama model ${modelName} pulled successfully!`, { id: toastId });
          setOllamaRepoInput("");
          fetchOllama();
          eventSource.close();
          setIsDownloadingOllama(false);
          setDownloadingOllamaId(null);
        } else if (data.status === "error") {
          toast.error(`Failed to pull ${modelName}: ${data.desc || "Error"}`, { id: toastId });
          eventSource.close();
          setIsDownloadingOllama(false);
          setDownloadingOllamaId(null);
        }
      } catch (err) {}
    };

    try {
      const res = await fetch("/api/settings/ollama/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: modelName.trim() })
      });

      if (!res.ok) {
        let errorMsg = "Pull failed to start";
        try {
          const data = await res.json();
          errorMsg = data.detail || errorMsg;
        } catch {
          errorMsg = (await res.text()) || errorMsg;
        }
        toast.error(`Error: ${errorMsg}`, { id: toastId });
        eventSource.close();
        setIsDownloadingOllama(false);
        setDownloadingOllamaId(null);
      }
    } catch (e: any) {
      eventSource.close();
      setIsDownloadingOllama(false);
      setDownloadingOllamaId(null);
      toast.error(`Error: ${e.message}`, { id: toastId });
    }
  };

  const handleDelete = async (modelId: string) => {
    if (!confirm(`Delete model ${modelId} from local disk cache?`)) return;

    const toastId = toast.loading(`Deleting ${modelId}...`);
    try {
      const res = await fetch(`/api/settings/hf/models/${encodeURIComponent(modelId)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success(`${modelId} removed from cache`, { id: toastId });
        fetchModels();
      } else {
        toast.error("Failed to delete model", { id: toastId });
      }
    } catch (e) {
      toast.error("An error occurred while deleting", { id: toastId });
    }
  };

  const handleDeleteOllama = async (modelName: string) => {
    if (!confirm(`Delete Ollama model ${modelName}?`)) return;
    const toastId = toast.loading(`Deleting Ollama model ${modelName}...`);
    try {
      const res = await fetch(`/api/settings/ollama/models/${encodeURIComponent(modelName)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success(`${modelName} deleted`, { id: toastId });
        fetchOllama();
      } else {
        toast.error("Failed to delete model", { id: toastId });
      }
    } catch (e) {
      toast.error("Error deleting model", { id: toastId });
    }
  };

  const handleTestModel = async (category: string, modelId?: string) => {
    setTestingCategory(category);
    const toastId = toast.loading(`Running smoke test for ${category}...`);
    try {
      const res = await fetch("/api/settings/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, model_id: modelId || null })
      });
      const data = await res.json();
      if (data.status === "ok") {
        toast.success(data.message || "Model test passed!", { id: toastId, duration: 4000 });
      } else {
        toast.error(`Test failed: ${data.message || "Unknown error"}`, { id: toastId, duration: 6000 });
      }
    } catch (e: any) {
      toast.error(`Verification error: ${e.message}`, { id: toastId });
    } finally {
      setTestingCategory(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const totalCacheSize = models.reduce((acc, m) => acc + m.size_bytes, 0);
  const totalOllamaSize = ollamaModels.reduce((acc, m) => acc + m.size_bytes, 0);

  const isDownloaded = (modelId: string) => {
    if (!modelId) return false;
    const clean = modelId.toLowerCase().trim();
    return models.some(m => {
      const repo = m.repo_id.toLowerCase().trim();
      const id = m.id.toLowerCase().trim();
      if (repo === clean || id === clean) return true;
      if (clean.includes("/") && repo.endsWith(clean)) return true;
      if (repo.includes("/") && clean.endsWith(repo)) return true;
      if (clean.replace(".pt", "") === repo.replace(".pt", "")) return true;
      if (clean.replace(".onnx", "") === repo.replace(".onnx", "")) return true;
      return false;
    });
  };

  const filteredCachedModels = models.filter(m => {
    const term = cacheSearch.toLowerCase();
    const matchSearch = !term || m.repo_id.toLowerCase().includes(term) || m.id.toLowerCase().includes(term);
    if (!matchSearch) return false;

    if (cacheFilter === "all") return true;
    if (cacheFilter === "yolo") return m.repo_id.endsWith(".pt") || m.id.endsWith(".pt");
    if (cacheFilter === "onnx") return m.repo_id.endsWith(".onnx") || m.id.endsWith(".onnx") || m.repo_id.includes("onnx");
    if (cacheFilter === "face") return ["buffalo_l", "buffalo_m", "buffalo_s", "antelopev2"].includes(m.repo_id);
    if (cacheFilter === "whisper") return m.repo_id.includes("whisper");
    if (cacheFilter === "hf") return m.id.includes("models--");
    return true;
  });

  const renderDropdownWithDownload = (
    label: string,
    configKey: string,
    options: string[],
    categoryTestKey?: string,
    description?: string
  ) => {
    const currentValue = config[configKey] || (options.length > 0 ? options[0] : "");
    const modelDownloaded = isDownloaded(currentValue);
    const isTestingThis = testingCategory === categoryTestKey;

    return (
      <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] hover:border-[var(--theme-heading)] transition-all duration-300">
        <div className="flex justify-between items-start">
          <div>
            <label className="text-sm font-semibold text-[var(--theme-heading)] block">{label}</label>
            {description && <p className="text-xs text-[var(--theme-text)] opacity-70 mt-0.5">{description}</p>}
          </div>
          {modelDownloaded ? (
            <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Icon name="check_circle" size={13} /> Downloaded
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Icon name="cloud" size={13} /> Needs Download
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center mt-1">
          <select
            value={currentValue}
            onChange={e => updateConfigVal(configKey, e.target.value)}
            style={{
              backgroundColor: "var(--theme-bg)",
              borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--theme-heading)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)")}
            className="flex-1 rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none transition-colors"
          >
            {options.map(opt => (
              <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={opt} value={opt}>
                {opt}
              </option>
            ))}
            {!options.includes(currentValue) && currentValue !== "" && (
              <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={currentValue}>
                {currentValue} (Custom)
              </option>
            )}
          </select>

          {modelDownloaded ? (
            categoryTestKey && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTestModel(categoryTestKey, currentValue)}
                disabled={isTestingThis}
                title="Verify this model with live test"
                className="h-[38px] px-3 shrink-0 flex items-center gap-1.5"
              >
                <Icon name={isTestingThis ? "sync" : "play_arrow"} size={16} className={isTestingThis ? "animate-spin" : ""} />
                <span>Test</span>
              </Button>
            )
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownload(currentValue)}
              disabled={isDownloading || !currentValue}
              title="Download model to local disk"
              className="h-[38px] px-3 shrink-0 flex items-center gap-1.5"
            >
              <Icon
                name={isDownloading && downloadingModelId === currentValue ? "sync" : "download"}
                size={16}
                className={isDownloading && downloadingModelId === currentValue ? "animate-spin" : ""}
              />
              <span>Download</span>
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <Header
          title="Model Configuration Center"
          subtitle="Configure default AI architectures, verify documentation compatibility, test active models, and manage local weights."
        />
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="primary"
            onClick={handleSaveConfig}
            disabled={isSavingConfig}
            className="flex items-center gap-2 h-10 px-5 shadow-md"
          >
            <Icon name={isSavingConfig ? "sync" : "save"} size={16} className={isSavingConfig ? "animate-spin" : ""} />
            <span>{isSavingConfig ? "Saving..." : "Save Preferences"}</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <ModernTabs tabs={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="mt-6 flex-1">
        {/* ==================== TAB: OVERVIEW & DIAGNOSTICS ==================== */}
        {activeTab === "overview" && (
          <ModernTabContent activeTab={activeTab}>
          <div className="flex flex-col gap-6">
            <SectionHeader title="System & Service Diagnostics" />

            {/* Quick Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Hardware Device */}
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] p-4 rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--theme-bg)] flex items-center justify-center text-[var(--theme-heading)]">
                  <Icon name="memory" size={24} />
                </div>
                <div>
                  <span className="text-xs uppercase text-[var(--theme-text)] opacity-60 font-semibold">Active Device</span>
                  <p className="text-base font-bold text-[var(--theme-heading)] mt-0.5">
                    {config.device_preference || "Auto-Detect"}
                  </p>
                  <span className="text-[11px] text-[var(--theme-text)] opacity-70">
                    Engine: {config.global_compute_engine || "cpu"}
                  </span>
                </div>
              </div>

              {/* Ollama Service */}
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] p-4 rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--theme-bg)] flex items-center justify-center text-[var(--theme-heading)]">
                  <Icon name="psychology" size={24} />
                </div>
                <div>
                  <span className="text-xs uppercase text-[var(--theme-text)] opacity-60 font-semibold">Ollama Daemon</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${ollamaStatus.connected ? "bg-emerald-400" : "bg-rose-400"}`}
                    />
                    <p className="text-base font-bold text-[var(--theme-heading)]">
                      {ollamaStatus.connected ? "Connected" : "Offline"}
                    </p>
                  </div>
                  <span className="text-[11px] text-[var(--theme-text)] opacity-70">
                    {ollamaStatus.connected ? `${ollamaModels.length} models installed` : "Port 11434 unreachable"}
                  </span>
                </div>
              </div>

              {/* HuggingFace Token */}
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] p-4 rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--theme-bg)] flex items-center justify-center text-[var(--theme-heading)]">
                  <Icon name="key" size={24} />
                </div>
                <div>
                  <span className="text-xs uppercase text-[var(--theme-text)] opacity-60 font-semibold">HF Access Token</span>
                  <p className="text-base font-bold text-[var(--theme-heading)] mt-0.5">
                    {token ? "Configured" : "Not Set"}
                  </p>
                  <span className="text-[11px] text-[var(--theme-text)] opacity-70">
                    {token ? "Bypasses rate limits & gates" : "Required for gated models"}
                  </span>
                </div>
              </div>

              {/* Cache Disk Usage */}
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] p-4 rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--theme-bg)] flex items-center justify-center text-[var(--theme-heading)]">
                  <Icon name="folder_zip" size={24} />
                </div>
                <div>
                  <span className="text-xs uppercase text-[var(--theme-text)] opacity-60 font-semibold">Local Storage</span>
                  <p className="text-base font-bold text-[var(--theme-heading)] mt-0.5">
                    {formatBytes(totalCacheSize)}
                  </p>
                  <span className="text-[11px] text-[var(--theme-text)] opacity-70">
                    {models.length} model repositories cached
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Readiness Smoke Tests */}
            <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--theme-heading)] flex items-center gap-2">
                    <Icon name="verified" size={20} />
                    Model Readiness Smoke Tests
                  </h3>
                  <p className="text-xs text-[var(--theme-text)] opacity-70 mt-0.5">
                    Instantly execute a diagnostic check on each subsystem to ensure model weights, tokenizers, and dependencies are usable.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[
                  { id: "object_detection", label: "Object Detection", icon: "center_focus_strong" },
                  { id: "face_blur", label: "Face Blur", icon: "face" },
                  { id: "background_removal", label: "Background Removal", icon: "content_cut" },
                  { id: "depth_estimation", label: "Depth Anything", icon: "layers" },
                  { id: "image_upscaler", label: "Real-ESRGAN", icon: "high_quality" },
                  { id: "math_latex", label: "Math OCR", icon: "functions" },
                  { id: "expense_tracker", label: "Receipt Parser", icon: "receipt_long" },
                  { id: "translation", label: "Translation", icon: "translate" },
                  { id: "audio_transcription", label: "Speech Transcription", icon: "mic" },
                  { id: "voice_cloning_tts", label: "Voice Cloning", icon: "record_voice_over" },
                  { id: "ollama", label: "Ollama Daemon", icon: "psychology" },
                ].map(item => (
                  <Button
                    key={item.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTestModel(item.id)}
                    disabled={testingCategory === item.id}
                    className="flex items-center justify-start gap-2 h-10 px-3 truncate"
                  >
                    <Icon
                      name={testingCategory === item.id ? "sync" : item.icon}
                      size={16}
                      className={testingCategory === item.id ? "animate-spin text-[var(--theme-heading)]" : ""}
                    />
                    <span className="truncate">{item.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ModernTabContent>
        )}

        {/* ==================== TAB: HARDWARE & COMPUTE ==================== */}
        {activeTab === "hardware" && (
          <ModernTabContent activeTab={activeTab}>
          <div className="flex flex-col gap-6">
            <SectionHeader title="Compute & Execution Acceleration" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Device Preference */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">Device Preference</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Select whether PyTorch and ONNX models should run on CUDA GPU or host CPU.
                </p>
                <select
                  value={config.device_preference || "Auto-Detect"}
                  onChange={e => updateConfigVal("device_preference", e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Auto-Detect">Auto-Detect (GPU if available, else CPU)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="CPU Only">CPU Only (Enforce CPU execution)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="GPU Preference">GPU Preference (CUDA required)</option>
                </select>
              </div>

              {/* Hardware Precision */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">Hardware Precision Optimization</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Controls FP16 or INT8 quantization for Whisper, Transformers, and CTranslate2.
                </p>
                <select
                  value={config.hardware_optimization || "PyTorch (Standard)"}
                  onChange={e => updateConfigVal("hardware_optimization", e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="PyTorch (Standard)">PyTorch (Standard FP32)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="FP16 (GPU Speedup)">FP16 (GPU Speedup & Lower VRAM)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="INT8 (Max GPU Memory Save)">INT8 (Max Quantization & Memory Save)</option>
                </select>
              </div>

              {/* Global Compute Engine */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">Global Compute Engine</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Target runtime engine for computer vision and object detection workloads.
                </p>
                <select
                  value={config.global_compute_engine || "cpu"}
                  onChange={e => updateConfigVal("global_compute_engine", e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="cpu">CPU / OpenVINO (cpu)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="cuda">NVIDIA GPU (cuda)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="onnx">ONNX Runtime (onnx)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="tensorrt">TensorRT (tensorrt)</option>
                </select>
              </div>

              {/* Inference Resolution */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">Inference Resolution (Vision)</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Base spatial square resolution used for YOLO tracking and InsightFace scans.
                </p>
                <select
                  value={config.inference_resolution || "640"}
                  onChange={e => updateConfigVal("inference_resolution", e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="160">160x160 (Fastest, High RAM savings)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="320">320x320 (Balanced)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="640">640x640 (High Quality Standard)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="1024">1024x1024 (Highest Quality, Resource Heavy)</option>
                </select>
              </div>
            </div>
          </div>
        </ModernTabContent>
        )}

        {/* ==================== TAB: VISION & GRAPHICS ==================== */}
        {activeTab === "vision" && (
          <ModernTabContent activeTab={activeTab}>
          <div className="flex flex-col gap-6">
            <SectionHeader title="Computer Vision & Deep Learning Models" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderDropdownWithDownload(
                "Object Detection (YOLO)",
                "object_detection",
                PRESET_MODELS.object_detection,
                "object_detection",
                "Ultralytics YOLOv8 / YOLO11 for real-time webcam and video object tracking."
              )}

              {renderDropdownWithDownload(
                "Face Detection & Blur (InsightFace)",
                "face_blur",
                PRESET_MODELS.face_blur,
                "face_blur",
                "InsightFace detection & recognition packs (buffalo_l, buffalo_m, antelopev2)."
              )}

              {renderDropdownWithDownload(
                "Background Removal Model",
                "background_removal",
                PRESET_MODELS.background_removal,
                "background_removal",
                "rembg (u2net) or BriaAI RMBG-1.4/2.0 for image matting and background removal."
              )}

              {renderDropdownWithDownload(
                "Depth Estimation (ONNX)",
                "depth_estimation",
                PRESET_MODELS.depth_estimation,
                "depth_estimation",
                "Depth Anything V2 ONNX Community models for monocular 3D depth mapping."
              )}

              {/* Real-ESRGAN Upscaler Scale */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] hover:border-[var(--theme-heading)] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <label className="text-sm font-semibold text-[var(--theme-heading)] block">Image Upscaler Factor (Real-ESRGAN)</label>
                    <p className="text-xs text-[var(--theme-text)] opacity-70 mt-0.5">
                      Super-resolution factor using RRDBNet weights (x2plus / x4plus).
                    </p>
                  </div>
                  {isDownloaded("RealESRGAN_x4plus.pth") ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Icon name="check_circle" size={13} /> Weights Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Icon name="cloud" size={13} /> Needs Download
                    </span>
                  )}
                </div>

                <div className="flex gap-2 items-center mt-1">
                  <select
                    value={config.image_upscaler_scale || "4"}
                    onChange={e => updateConfigVal("image_upscaler_scale", e.target.value)}
                    style={{
                      backgroundColor: "var(--theme-bg)",
                      borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                    }}
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none"
                  >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="2">2x Magnification (RealESRGAN_x2plus)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="4">4x Magnification (RealESRGAN_x4plus)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="8">8x Magnification (Chained x4 + x2)</option>
                  </select>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTestModel("image_upscaler")}
                    disabled={testingCategory === "image_upscaler"}
                    className="h-[38px] px-3 shrink-0 flex items-center gap-1"
                  >
                    <Icon name={testingCategory === "image_upscaler" ? "sync" : "play_arrow"} size={16} className={testingCategory === "image_upscaler" ? "animate-spin" : ""} />
                    <span>Test</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ModernTabContent>
        )}

        {/* ==================== TAB: OCR & DOCUMENTS ==================== */}
        {activeTab === "documents" && (
          <ModernTabContent activeTab={activeTab}>
          <div className="flex flex-col gap-6">
            <SectionHeader title="Document, OCR & Language Models" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderDropdownWithDownload(
                "Math formula to LaTeX (OCR)",
                "math_latex",
                PRESET_MODELS.math_latex,
                "math_latex",
                "Extract mathematical expressions into formatted LaTeX formulas from images."
              )}

              {renderDropdownWithDownload(
                "Expense Tracker & Receipt Parsing",
                "expense_tracker",
                PRESET_MODELS.expense_tracker,
                "expense_tracker",
                "Multimodal VLM models (Qwen2-VL / Donut) for receipt structure and amount extraction."
              )}

              {renderDropdownWithDownload(
                "Local Text Translation",
                "translation",
                PRESET_MODELS.translation,
                "translation",
                "CTranslate2 Flores-200 (NLLB) or T5 models for offline multilingual translation."
              )}
            </div>
          </div>
        </ModernTabContent>
        )}

        {/* ==================== TAB: AUDIO & SPEECH ==================== */}
        {activeTab === "audio" && (
          <ModernTabContent activeTab={activeTab}>
          <div className="flex flex-col gap-6">
            <SectionHeader title="Speech Recognition & Audio Processing" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderDropdownWithDownload(
                "Audio Transcription (Whisper)",
                "audio_transcription",
                PRESET_MODELS.audio_transcription,
                "audio_transcription",
                "CTranslate2 Faster-Whisper, WhisperX, or Moonshine speech-to-text models."
              )}

              {renderDropdownWithDownload(
                "Speaker Diarization",
                "speaker_diarization",
                PRESET_MODELS.speaker_diarization,
                undefined,
                "PyAnnote Audio pipeline for identifying and separating distinct speakers in audio."
              )}

              {renderDropdownWithDownload(
                "Voice Cloning & Voice Design TTS",
                "voice_cloning_tts",
                PRESET_MODELS.voice_cloning_tts,
                "voice_cloning_tts",
                "k2-fsa/OmniVoice zero-shot neural voice cloning and prompt-based voice synthesis."
              )}
            </div>
          </div>
        </ModernTabContent>
        )}

        {/* ==================== TAB: LLM & AGENTIC AI ==================== */}
        {activeTab === "llm" && (
          <ModernTabContent activeTab={activeTab}>
          <div className="flex flex-col gap-6">
            <SectionHeader title="Large Language Models & Agentic Vault Configuration" />

            {/* Provider and Host */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">Obsidian & Chat Provider</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Select between local Ollama engine or remote Hugging Face Inference API.
                </p>
                <select
                  value={config.obsidian_provider || "Hugging Face API"}
                  onChange={e => updateConfigVal("obsidian_provider", e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Hugging Face API">Hugging Face API (Cloud)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Ollama">Ollama (Local Machine GPU/CPU)</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-[var(--theme-heading)]">Ollama Daemon Host URL</label>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ollamaStatus.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {ollamaStatus.connected ? "Connected" : "Offline"}
                  </span>
                </div>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Address of the local or network Ollama API server.
                </p>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={config.ollama_host || "http://localhost:11434"}
                    onChange={e => updateConfigVal("ollama_host", e.target.value)}
                    style={{
                      backgroundColor: "var(--theme-bg)",
                      borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                    }}
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none"
                    placeholder="http://localhost:11434"
                  />
                  <Button variant="secondary" size="sm" onClick={fetchOllama} className="h-[38px] px-3">
                    <Icon name="refresh" size={16} />
                  </Button>
                </div>
              </div>

              {/* Ollama Agent Model */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">Obsidian Agent Model (Ollama)</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Autonomous LLM used for tool selection and iterative research loops.
                </p>
                <select
                  value={config.obsidian_ollama_model || "llama3:8b-instruct-q4_K_M"}
                  onChange={e => updateConfigVal("obsidian_ollama_model", e.target.value)}
                  disabled={config.obsidian_provider !== "Ollama"}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  {ollamaModels.map(m => (
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                  {!ollamaModels.some(m => m.name === config.obsidian_ollama_model) && config.obsidian_ollama_model && (
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={config.obsidian_ollama_model}>
                      {config.obsidian_ollama_model} (Manual)
                    </option>
                  )}
                </select>
              </div>

              {/* Ollama Generator Model */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">Obsidian Generator Model</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Model for comprehensive long-form Markdown synthesis and graph linking.
                </p>
                <select
                  value={config.obsidian_ollama_generator_model || config.obsidian_ollama_model || "llama3:8b-instruct-q4_K_M"}
                  onChange={e => updateConfigVal("obsidian_ollama_generator_model", e.target.value)}
                  disabled={config.obsidian_provider !== "Ollama"}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  {ollamaModels.map(m => (
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* RAG Embedding Model */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">RAG Embedding Model (Ollama)</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Generates vector embeddings for semantic chunk reranking during agent research.
                </p>
                <select
                  value={config.obsidian_embedding_model || "nomic-embed-text"}
                  onChange={e => updateConfigVal("obsidian_embedding_model", e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  {ollamaModels.map(m => (
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                  {!ollamaModels.some(m => m.name === config.obsidian_embedding_model) && (
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={config.obsidian_embedding_model || "nomic-embed-text"}>
                      {config.obsidian_embedding_model || "nomic-embed-text"}
                    </option>
                  )}
                </select>
              </div>

              {/* Context Length */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">Model Context Window (Tokens)</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Maximum context window passed to Ollama (`num_ctx`). Higher values use more VRAM.
                </p>
                <select
                  value={config.obsidian_context_length || "8192"}
                  onChange={e => updateConfigVal("obsidian_context_length", e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="4096">4096 Tokens</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="8192">8192 Tokens (Recommended)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="16384">16384 Tokens</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="32768">32768 Tokens</option>
                </select>
              </div>

              {/* BART Summarizer */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">BART Search Summarization</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Uses local `facebook/bart-large-cnn` to summarize long search results before feeding to the LLM.
                </p>
                <select
                  value={config.obsidian_summarize_searches || "false"}
                  onChange={e => updateConfigVal("obsidian_summarize_searches", e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                >
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="false">Disabled (Pass full context directly)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="true">Enabled (Summarize with BART)</option>
                </select>
              </div>

              {/* SearXNG Search URL */}
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]">
                <label className="text-sm font-semibold text-[var(--theme-heading)]">SearXNG Search Endpoint</label>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Target endpoint URL for web searches executed by the agent tools.
                </p>
                <input
                  type="text"
                  value={config.searxng_url || "http://127.0.0.1:8080/search"}
                  onChange={e => updateConfigVal("searxng_url", e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none mt-2"
                  placeholder="http://127.0.0.1:8080/search"
                />
              </div>
            </div>
          </div>
        </ModernTabContent>
        )}

        {/* ==================== TAB: MODEL STORAGE & DOWNLOADS ==================== */}
        {activeTab === "storage" && (
          <ModernTabContent activeTab={activeTab}>
          <div className="flex flex-col gap-8">
            {/* Tokens and Downloaders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* HF Token Box */}
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-[var(--theme-heading)] flex items-center gap-2">
                    <Icon name="vpn_key" size={20} />
                    Hugging Face Access Token
                  </h3>
                </div>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Required for gated model downloads (e.g., Llama, PyAnnote Diarization, RMBG-2.0) and to bypass rate limits.
                </p>

                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      placeholder="hf_..."
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                      }}
                      className="w-full rounded-lg px-3 py-2 pr-10 text-sm text-[var(--theme-text)] border focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute inset-y-0 right-2 flex items-center text-[var(--theme-text)] opacity-60 hover:opacity-100"
                    >
                      <Icon name={showToken ? "visibility_off" : "visibility"} size={16} />
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" onClick={handleSaveToken} disabled={isSavingToken}>
                      {isSavingToken ? "Saving..." : "Save Token"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* HF Model Downloader */}
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6 flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-[var(--theme-heading)] flex items-center gap-2">
                  <Icon name="cloud_download" size={20} />
                  Hugging Face / Hub Downloader
                </h3>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Pre-download any model snapshot or weight file to local disk (e.g. `Qwen/Qwen2.5-VL-3B-Instruct`, `yolo11s.pt`).
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Qwen/Qwen2.5-VL-3B-Instruct"
                    value={repoIdInput}
                    onChange={e => setRepoIdInput(e.target.value)}
                    style={{
                      backgroundColor: "var(--theme-bg)",
                      borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                    }}
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDownload(repoIdInput)}
                    disabled={isDownloading || !repoIdInput.trim()}
                    className="px-4 h-[38px]"
                  >
                    {isDownloading && downloadingModelId === repoIdInput ? "Downloading..." : "Download"}
                  </Button>
                </div>
              </div>

              {/* Ollama Model Puller */}
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6 flex flex-col gap-4 md:col-span-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-[var(--theme-heading)] flex items-center gap-2">
                    <Icon name="download_for_offline" size={20} />
                    Ollama Registry Model Puller
                  </h3>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ollamaStatus.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {ollamaStatus.connected ? "Daemon Online" : "Daemon Offline"}
                  </span>
                </div>
                <p className="text-xs text-[var(--theme-text)] opacity-70">
                  Pull LLM weights directly from the Ollama library into your local Ollama daemon.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. llama3:8b, nomic-embed-text, mistral, llava"
                    value={ollamaRepoInput}
                    onChange={e => setOllamaRepoInput(e.target.value)}
                    disabled={!ollamaStatus.connected}
                    style={{
                      backgroundColor: "var(--theme-bg)",
                      borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                    }}
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] border focus:outline-none"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDownloadOllama(ollamaRepoInput)}
                    disabled={isDownloadingOllama || !ollamaRepoInput.trim() || !ollamaStatus.connected}
                    className="px-6 h-[38px]"
                  >
                    {isDownloadingOllama && downloadingOllamaId === ollamaRepoInput ? "Pulling..." : "Pull Model"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Local Disk Cache Browser */}
            <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-[var(--theme-ui-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--theme-heading)] flex items-center gap-2">
                    <Icon name="storage" size={20} />
                    Local Disk Model Cache
                  </h3>
                  <p className="text-xs text-[var(--theme-text)] opacity-70">
                    Total storage occupied: <span className="font-semibold text-[var(--theme-heading)]">{formatBytes(totalCacheSize)}</span> across {models.length} entries.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Filter models..."
                    value={cacheSearch}
                    onChange={e => setCacheSearch(e.target.value)}
                    style={{
                      backgroundColor: "var(--theme-bg)",
                      borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs text-[var(--theme-text)] border focus:outline-none w-48"
                  />
                  <select
                    value={cacheFilter}
                    onChange={e => setCacheFilter(e.target.value)}
                    style={{
                      backgroundColor: "var(--theme-bg)",
                      borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs text-[var(--theme-text)] border focus:outline-none"
                  >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="all">All Formats</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="hf">Hugging Face</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="yolo">YOLO (.pt)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="onnx">ONNX</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="face">InsightFace</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="whisper">Whisper</option>
                  </select>
                  <Button variant="secondary" size="sm" onClick={fetchModels}>
                    <Icon name="refresh" size={14} />
                  </Button>
                </div>
              </div>

              <div className="p-4 max-h-[460px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
                {isLoadingModels ? (
                  <div className="py-12 text-center text-sm text-[var(--theme-text)] opacity-60">Scanning cache storage...</div>
                ) : filteredCachedModels.length === 0 ? (
                  <div className="py-12 text-center text-sm text-[var(--theme-text)] opacity-60">
                    No models match the filter criteria.
                  </div>
                ) : (
                  filteredCachedModels.map(m => (
                    <div
                      key={m.id}
                      className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)]/60 rounded-xl p-3 flex justify-between items-center hover:border-[var(--theme-heading)] transition-all"
                    >
                      <div className="flex flex-col truncate mr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--theme-heading)] truncate" title={m.repo_id}>
                            {m.repo_id}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--theme-ui-bg)] text-[var(--theme-text)] opacity-80 border border-[var(--theme-ui-border)]">
                            {m.repo_id.endsWith(".pt") ? "YOLO" : m.repo_id.endsWith(".pth") ? "PyTorch" : m.repo_id.endsWith(".onnx") ? "ONNX" : m.repo_id.startsWith("Systran/") ? "Whisper" : ["buffalo_l", "buffalo_m", "antelopev2"].includes(m.repo_id) ? "InsightFace" : "HuggingFace"}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--theme-text)] opacity-60 mt-0.5">
                          {formatBytes(m.size_bytes)} • Path: <code className="text-[11px] font-mono">{m.id}</code>
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-2 text-[var(--theme-text)] opacity-60 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                        title="Delete from local cache"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ollama Local Models Table */}
            {ollamaStatus.connected && (
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[var(--theme-ui-border)] flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--theme-heading)] flex items-center gap-2">
                      <Icon name="psychology" size={20} />
                      Ollama Local Models
                    </h3>
                    <p className="text-xs text-[var(--theme-text)] opacity-70">
                      Total Ollama disk space: {formatBytes(totalOllamaSize)} across {ollamaModels.length} models.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={fetchOllama}>
                    <Icon name="refresh" size={14} />
                  </Button>
                </div>

                <div className="p-4 max-h-[320px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
                  {ollamaModels.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[var(--theme-text)] opacity-60">No Ollama models pulled yet.</div>
                  ) : (
                    ollamaModels.map(m => (
                      <div
                        key={m.name}
                        className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)]/60 rounded-xl p-3 flex justify-between items-center hover:border-[var(--theme-heading)] transition-all"
                      >
                        <div className="flex flex-col truncate mr-4">
                          <span className="text-sm font-semibold text-[var(--theme-heading)] truncate">{m.name}</span>
                          <span className="text-xs text-[var(--theme-text)] opacity-60">{formatBytes(m.size_bytes)}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteOllama(m.name)}
                          className="p-2 text-[var(--theme-text)] opacity-60 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                          title="Delete Ollama model"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </ModernTabContent>
        )}
      </div>
    </div>
  );
}
