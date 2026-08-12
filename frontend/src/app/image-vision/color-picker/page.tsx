"use client";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";

import React, { useState, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { Icon } from "@/lib/utils";

type ColorResult = {
  hex: string;
  rgb: string;
} | null;

export default function ColorPickerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  
  const [colorResult, setColorResult] = useState<ColorResult>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [paletteResult, setPaletteResult] = useState<ColorResult[] | null>(null);
  const [isPaletteLoading, setIsPaletteLoading] = useState(false);
  
  const [copiedText, setCopiedText] = useState("");
  
  const imgRef = useRef<HTMLImageElement>(null);

  const clearState = () => {
    setFile(null);
    setPreviewUrl(null);
    setFilename("");
    setColorResult(null);
    setPaletteResult(null);
    setErrorMsg("");
  };

  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!file || !imgRef.current) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    
    const intrinsicWidth = imgRef.current.naturalWidth;
    const intrinsicHeight = imgRef.current.naturalHeight;
    
    const x = Math.floor(relX * intrinsicWidth);
    const y = Math.floor(relY * intrinsicHeight);
    
    setIsLoading(true);
    setErrorMsg("");
    setColorResult(null);
    setCopiedText("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("x", x.toString());
      formData.append("y", y.toString());
      
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/color-picker", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        let errData = "Failed to extract color";
        try {
          const js = await res.json();
          errData = js.detail || errData;
        } catch(ex) {}
        throw new Error(errData);
      }
      
      const data = await res.json();
      setColorResult({
        hex: data.hex,
        rgb: data.rgb
      });
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePalette = async () => {
    if (!file) return;
    setIsPaletteLoading(true);
    setErrorMsg("");
    setPaletteResult(null);
    setCopiedText("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("num_colors", "5");
      
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/color-palette", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        let errData = "Failed to extract palette";
        try {
          const js = await res.json();
          errData = js.detail || errData;
        } catch(ex) {}
        throw new Error(errData);
      }
      
      const data = await res.json();
      setPaletteResult(data.colors);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsPaletteLoading(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(""), 2000);
  };

  const fetchBlob = async (url: string) => {
    const r = await fetch(url);
    const b = await r.blob();
    return new File([b], "image.jpg", { type: b.type });
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Image Color Picker" subtitle="Upload an image and click anywhere on it to extract the exact HEX and RGB color codes." />

      <div className="flex flex-col gap-8 w-full">
        {/* SECTION 1: INPUT */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <SectionHeader title="Upload media" />
              
              <div className="flex flex-col gap-2">
                <DirectUploadBox
                  accept="image/png, image/jpeg, image/webp"
                  label="Upload Image"
                  onUploadComplete={async (info) => {
                    setFilename(info.original_name);
                    const url = `http://127.0.0.1:8000/uploads/${info.hash_name}`;
                    setPreviewUrl(url);
                    setFile(await fetchBlob(url));
                    setColorResult(null);
                    setPaletteResult(null);
                  }}
                  onClear={clearState}
                  defaultFileName={filename}
                />

                {errorMsg && (
                  <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm mt-2">
                    {errorMsg}
                  </div>
                )}

                <Button variant="primary"
                  className="w-full h-12 text-lg mt-2 border-none !shadow-none !ring-0 !outline-none transition-colors"
                  onClick={generatePalette}
                  disabled={!file || isPaletteLoading}
                  isLoading={isPaletteLoading}
                 style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}>
                  {isPaletteLoading ? "Generating Palette..." : "Generate Full Palette"}
                </Button>
              </div>
            </div>
          </div>

        {/* SECTION 2: OUTPUT */}
        <div className="flex flex-col gap-2 mt-8 h-full">
            <div className="flex items-center justify-between">
              <SectionHeader title="Download Output" className="mb-0" />
            </div>

            <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
              {!previewUrl ? (
                <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                  <Icon name="palette" size={48} className="opacity-30" />
                  <p>Upload an image to start picking colors.</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={previewUrl}
                    alt="Preview"
                    onClick={handleImageClick}
                    className={`max-w-full h-auto max-h-[600px] object-contain mx-auto border-2 transition-all ${
                      isLoading ? "border-primary opacity-70 animate-pulse cursor-wait" : "border-transparent cursor-crosshair hover:border-primary/50"
                    }`}
                  />
                  
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-[var(--theme-ui-bg)] p-4 rounded-full backdrop-blur shadow-sm flex items-center gap-3 border border-[var(--theme-ui-border)]">
                        <Icon name="my_location" className="animate-spin text-primary" />
                        <span className="font-semibold text-[var(--theme-heading)]">Extracting Exact Pixel...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results Display */}
            {colorResult && (
              <div className="animate-in slide-in-from-bottom-4 p-5 bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-xl mt-4 shadow-sm">
                <h4 className="text-[var(--theme-heading)] font-medium mb-4 flex items-center gap-2">
                  <Icon name="my_location" size={18} className="text-primary" /> Selected Color
                </h4>
                <div className="flex items-center gap-6">
                  <div 
                    className="w-20 h-20 rounded-xl shadow-inner border border-[var(--theme-ui-border)] flex-shrink-0"
                    style={{ backgroundColor: colorResult.hex }}
                  />
                  
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between bg-[var(--theme-bg)] p-2.5 rounded-lg border border-[var(--theme-ui-border)] shadow-sm">
                      <span className="text-[var(--theme-text)] font-mono text-sm">HEX</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--theme-heading)] font-mono font-medium">{colorResult.hex}</span>
                        <button 
                          onClick={() => handleCopy(colorResult.hex, "hex")}
                          className="text-[var(--theme-text)] hover:text-[var(--theme-heading)] transition-colors"
                          title="Copy HEX"
                        >
                          {copiedText === "hex" ? <Icon name="check" size={16} className="text-emerald-500" /> : <Icon name="content_copy" size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-[var(--theme-bg)] p-2.5 rounded-lg border border-[var(--theme-ui-border)] shadow-sm">
                      <span className="text-[var(--theme-text)] font-mono text-sm">RGB</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--theme-heading)] font-mono font-medium">{colorResult.rgb}</span>
                        <button 
                          onClick={() => handleCopy(colorResult.rgb, "rgb")}
                          className="text-[var(--theme-text)] hover:text-[var(--theme-heading)] transition-colors"
                          title="Copy RGB"
                        >
                          {copiedText === "rgb" ? <Icon name="check" size={16} className="text-emerald-500" /> : <Icon name="content_copy" size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {paletteResult && (
              <div className="animate-in slide-in-from-bottom-4 p-5 bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-xl mt-4 shadow-sm">
                <h4 className="text-[var(--theme-heading)] font-medium mb-4 flex items-center gap-2">
                  <Icon name="palette" size={18} className="text-primary" /> Generated Palette
                </h4>
                
                <div className="flex w-full h-24 rounded-lg overflow-hidden border border-[var(--theme-ui-border)] shadow-inner mb-4">
                  {paletteResult.map((c, i) => (
                    <div 
                      key={i} 
                      className="flex-1 h-full cursor-pointer hover:flex-[1.5] transition-all duration-300 relative group"
                      style={{ backgroundColor: c?.hex }}
                      onClick={() => {
                        handleCopy(c?.hex || "", `palette-${i}`);
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 backdrop-blur-sm transition-opacity">
                        {copiedText === `palette-${i}` ? <Icon name="check" size={20} className="text-[var(--theme-heading)] drop-shadow-md" /> : <Icon name="content_copy" size={20} className="text-[var(--theme-heading)] drop-shadow-md" />}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono text-[var(--theme-text)] mt-2">
                  {paletteResult.map((c, i) => (
                    <div key={i}>{c?.hex}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
