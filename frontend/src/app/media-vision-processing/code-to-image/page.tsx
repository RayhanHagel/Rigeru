"use client";

import React, { useState } from "react";
import { Palette, Download, Sparkles } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STColumns, STColumn } from "@/components/streamlit/STColumns";
import { Button } from "@/components/ui/Button";

const LANGUAGES = ["Auto", "Python", "JavaScript", "TypeScript", "HTML", "CSS", "C++", "Java", "Go", "Rust", "JSON"];
const THEMES = ["monokai", "dracula", "github-dark", "nord", "native", "paraiso-dark"];

export default function CodeToImagePage() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("Auto");
  const [theme, setTheme] = useState("monokai");
  const [bgColor, setBgColor] = useState("#ABB8C3");
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerate = async () => {
    if (!code.trim()) {
      setErrorMsg("Please enter some code to generate an image.");
      return;
    }
    
    setIsGenerating(true);
    setErrorMsg("");
    setPreviewUrl(null);
    
    try {
      const payload = {
        code,
        language: language.toLowerCase(),
        theme,
        bg_color: bgColor
      };
      
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/code-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        throw new Error("Failed to generate image.");
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
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
    a.download = "code_snippet.png";
    a.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      <div>
        <STHeader title="🎨 Carbon-style Code to Image" />
        <p className="text-zinc-400 mt-2">
          Transform your source code into beautiful, shareable images.
        </p>
      </div>

      <STColumns>
        {/* Left Column: Configuration */}
        <STColumn width={1}>
          <STContainer title="Configuration" className="h-full">
            <div className="space-y-5">
              
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
                <div className="p-3 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm">
                  {errorMsg}
                </div>
              )}

              <Button 
                variant="primary" 
                onClick={handleGenerate} 
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-none"
                isLoading={isGenerating}
                icon={<Sparkles size={18} />}
              >
                Generate Image
              </Button>
            </div>
          </STContainer>
        </STColumn>

        {/* Right Column: Preview */}
        <STColumn width={2}>
          <STContainer title="Preview" className="h-full flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] bg-zinc-950/50 rounded-lg border border-white/5 p-6">
              
              {!previewUrl ? (
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                    <Palette className="text-zinc-500" size={32} />
                  </div>
                  <p className="text-zinc-500">
                    Paste your code and click <strong>Generate Image</strong><br/>to see the preview here.
                  </p>
                </div>
              ) : (
                <div className="w-full space-y-6 animate-in zoom-in-95 flex flex-col items-center">
                  <div className="relative shadow-2xl rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={previewUrl} 
                      alt="Generated Code Snippet" 
                      className="max-w-full h-auto max-h-[700px] object-contain"
                    />
                  </div>
                  
                  <Button 
                    variant="primary" 
                    onClick={handleDownload}
                    icon={<Download size={18} />}
                    className="w-full max-w-sm bg-emerald-600 hover:bg-emerald-500 border-none"
                  >
                    Download Image
                  </Button>
                </div>
              )}

            </div>
          </STContainer>
        </STColumn>
      </STColumns>
    </div>
  );
}
