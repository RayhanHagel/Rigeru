"use client";

import React, { useState } from "react";
import { Download, Palette, Code2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function CodeToImagePage() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("Auto");
  const [theme, setTheme] = useState("monokai");
  const [bgColor, setBgColor] = useState("#ABB8C3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const generateImage = async () => {
    if (!code.trim()) return;

    setIsGenerating(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/code-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          theme,
          bg_color: bgColor,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await res.json();
      setPreviewImage(`data:image/png;base64,${data.image_base64}`);
    } catch (e) {
      console.error(e);
      alert("Error generating image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!previewImage) return;
    const a = document.createElement("a");
    a.href = previewImage;
    a.download = "code_snippet.png";
    a.click();
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <Palette className="text-purple-400" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Carbon-style Code to Image</h1>
          <p className="text-zinc-400 mt-1">Transform your source code into beautiful, shareable images.</p>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Config Column */}
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-6">
              <Code2 size={18} className="text-purple-400" />
              Configuration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-lg p-2.5 text-zinc-100 focus:border-purple-500 outline-none transition-colors"
                >
                  {["Auto", "Python", "JavaScript", "TypeScript", "HTML", "CSS", "C++", "Java", "Go", "Rust", "JSON"].map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-lg p-2.5 text-zinc-100 focus:border-purple-500 outline-none transition-colors"
                >
                  {["monokai", "dracula", "github-dark", "nord", "native", "paraiso-dark"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Background Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-10 w-20 rounded cursor-pointer bg-zinc-950/50 border border-white/10"
                  />
                  <span className="text-zinc-400 text-sm">{bgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Paste your code here:</label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="print('Hello World!')"
                  className="w-full h-64 bg-zinc-950/50 border border-white/10 rounded-lg p-3 text-zinc-100 font-mono text-sm focus:border-purple-500 outline-none transition-colors resize-none"
                />
              </div>

              <Button
                variant="primary"
                onClick={generateImage}
                disabled={isGenerating || !code.trim()}
                className="w-full"
              >
                {isGenerating ? "Generating..." : "Generate Image"}
              </Button>
            </div>
          </div>
        </div>

        {/* Preview Column */}
        <div>
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 backdrop-blur-sm min-h-[500px] flex flex-col">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-6">
              Preview
            </h2>

            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950/50 border border-white/5 rounded-lg p-4 overflow-hidden">
              {previewImage ? (
                <div className="flex flex-col items-center w-full">
                  <img
                    src={previewImage}
                    alt="Code Preview"
                    className="max-w-full h-auto object-contain drop-shadow-2xl mb-6 rounded-xl"
                  />
                  <Button variant="secondary" onClick={handleDownload} icon={<Download size={18} />}>
                    Download Image
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Palette className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500">Paste your code and click 'Generate Image' to see the preview here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
