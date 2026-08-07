"use client";

import React, { useState } from "react";
import { Download, Sparkles, Palette } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";

const LANGUAGES = [
  "python", "javascript", "typescript", "jsx", "tsx", "html", "css", 
  "json", "java", "c", "cpp", "csharp", "go", "rust", "php", "ruby", 
  "swift", "kotlin", "sql", "bash", "markdown"
];

const THEMES = [
  "monokai", "github-dark", "dracula", "nord", "one-dark", "solarized-dark", "tokyo-night"
];

export default function CodeToImagePage() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [theme, setTheme] = useState("monokai");
  const [bgColor, setBgColor] = useState("#9333EA"); // Default purple
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerate = async () => {
    if (!code.trim()) return;
    
    setIsGenerating(true);
    setErrorMsg("");
    setPreviewUrl(null);
    
    try {
      const formData = new FormData();
      formData.append("code", code);
      formData.append("language", language);
      formData.append("theme", theme);
      formData.append("bg_color", bgColor);
      
      const res = await fetch("/api/media-vision/code-to-image", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to generate image.");
      }
      
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `code_snippet_${language}.png`;
    a.click();
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Code to Image" subtitle="Transform your source code into beautiful, shareable images." />

      <div className="flex flex-col gap-8 w-full">
        {/* SECTION 1: INPUT */}
        <div className="flex flex-col gap-2">
          <SectionHeader title="Configuration" />
            <div className="flex flex-col gap-2">

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none transition-colors"
                >
                  {LANGUAGES.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-md py-2 px-3 text-white focus:border-purple-500 outline-none transition-colors"
                >
                  {THEMES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Background Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer bg-zinc-900 border border-white/10"
                  />
                  <span className="text-sm text-zinc-400 font-mono">{bgColor.toUpperCase()}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Paste your code here:</label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="print('Hello World!')"
                  className="w-full h-64 bg-zinc-900 border border-white/10 rounded-md py-3 px-3 text-zinc-200 font-mono text-sm focus:border-purple-500 outline-none transition-colors resize-y"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm mt-2">
                  {errorMsg}
                </div>
              )}

              <Button
                variant="primary"
                onClick={handleGenerate}
                className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-none mt-2"
                isLoading={isGenerating}
              >
                Generate Image
              </Button>
            </div>

        {/* SECTION 2: OUTPUT */}
        <div className="flex flex-col gap-2 mt-8 h-full">
            <SectionHeader title="Download Output" />

            <div className="flex-1 w-full bg-black/50 rounded-xl border border-white/5 relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
              {!previewUrl ? (
                <div className="flex flex-col items-center justify-center text-zinc-600 gap-3">
                  <Palette size={48} className="opacity-30" />
                  <p>Paste code and generate to see preview.</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Generated Code Snippet"
                    className="max-w-full h-auto max-h-full object-contain"
                  />
                </div>
              )}
            </div>
            <Button
                variant="primary"
                className="w-full mt-4 h-12 text-lg"
                onClick={handleDownload}
                disabled={!previewUrl}
                icon={<Download size={16} />}
              >
                Download Image
              </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
