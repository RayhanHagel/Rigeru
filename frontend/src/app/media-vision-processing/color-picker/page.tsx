"use client";

import React, { useState, useRef } from "react";
import { Palette, ImageIcon, Crosshair, Copy, Check } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STColumns, STColumn } from "@/components/streamlit/STColumns";
import { Button } from "@/components/ui/Button";

type ColorResult = {
  hex: string;
  rgb: string;
} | null;

export default function ColorPickerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [colorResult, setColorResult] = useState<ColorResult>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [paletteResult, setPaletteResult] = useState<ColorResult[] | null>(null);
  const [isPaletteLoading, setIsPaletteLoading] = useState(false);
  
  const [copiedText, setCopiedText] = useState("");
  
  const imgRef = useRef<HTMLImageElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setColorResult(null);
      setPaletteResult(null);
      setErrorMsg("");
    }
  };

  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!file || !imgRef.current) return;
    
    // Calculate exact pixel coordinates on the intrinsic image
    const rect = imgRef.current.getBoundingClientRect();
    
    // The relative click position (0.0 to 1.0)
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    
    // Multiply by intrinsic dimensions to get exact pixel index
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="🎨 Image Color Picker" />
        <p className="text-zinc-400 mt-2">
          Upload an image and <strong className="text-zinc-200">click anywhere on it</strong> to extract the exact HEX and RGB color codes.
        </p>
      </div>

      <STContainer>
        <div className="space-y-6">
          
          {/* Uploader (Hidden if there is an image, or just shown compactly above) */}
          {!previewUrl ? (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-700 hover:border-fuchsia-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <ImageIcon className="mb-3 text-zinc-500" size={32} />
                <p className="mb-2 text-sm text-zinc-400">
                  <span className="font-semibold text-zinc-200">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-zinc-500">PNG, JPG, WEBP, BMP</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
          ) : (
            <div className="flex items-center justify-between bg-zinc-950 p-4 border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <ImageIcon size={20} className="text-zinc-400" />
                <span className="text-zinc-200 font-medium">{file?.name}</span>
              </div>
              <label className="cursor-pointer text-sm font-medium text-fuchsia-400 hover:text-fuchsia-300 bg-fuchsia-500/10 px-3 py-1.5 rounded-lg transition-colors">
                Change Image
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm">
              {errorMsg}
            </div>
          )}

          {/* Interactive Image Area */}
          {previewUrl && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
              <div className="bg-zinc-950 border border-white/5 p-2 rounded-xl text-center">
                <h3 className="text-zinc-400 font-medium flex items-center justify-center gap-2 mb-4 mt-2">
                  <Crosshair size={18} className="text-fuchsia-400" /> Click on the image below to extract color
                </h3>
                
                <div className="relative inline-block max-w-full overflow-hidden rounded-lg cursor-crosshair">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    ref={imgRef}
                    src={previewUrl} 
                    alt="Upload preview" 
                    className="max-w-full h-auto max-h-[600px] object-contain transition-opacity duration-200 hover:opacity-90"
                    onClick={handleImageClick}
                  />
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                      <div className="animate-pulse bg-zinc-900 px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-white shadow-xl">
                        Extracting...
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Color Result */}
              {colorResult && (
                <div className="bg-zinc-950 border border-white/5 p-6 rounded-xl animate-in slide-in-from-bottom-4 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
                  <div className="flex-shrink-0">
                    <div 
                      className="w-24 h-24 rounded-2xl border-4 border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all"
                      style={{ backgroundColor: colorResult.hex }}
                    />
                  </div>
                  
                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">HEX Code</h4>
                      <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 p-1 rounded-lg">
                        <input 
                          type="text" 
                          readOnly 
                          value={colorResult.hex} 
                          className="bg-transparent w-full font-mono text-zinc-200 px-3 outline-none"
                        />
                        <button 
                          onClick={() => handleCopy(colorResult.hex, "hex")}
                          className="p-2 hover:bg-white/5 rounded-md text-zinc-400 hover:text-white transition-colors"
                        >
                          {copiedText === "hex" ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">RGB Value</h4>
                      <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 p-1 rounded-lg">
                        <input 
                          type="text" 
                          readOnly 
                          value={colorResult.rgb} 
                          className="bg-transparent w-full font-mono text-zinc-200 px-3 outline-none"
                        />
                        <button 
                          onClick={() => handleCopy(colorResult.rgb, "rgb")}
                          className="p-2 hover:bg-white/5 rounded-md text-zinc-400 hover:text-white transition-colors"
                        >
                          {copiedText === "rgb" ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Palette Generation */}
              <div className="pt-4 border-t border-white/5 space-y-4">
                <Button 
                  variant="primary" 
                  onClick={generatePalette} 
                  isLoading={isPaletteLoading}
                  icon={<Palette size={18} />}
                  className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 border-none"
                >
                  Generate 5-Color Palette
                </Button>

                {paletteResult && (
                  <div className="bg-zinc-950 border border-white/5 p-6 rounded-xl animate-in slide-in-from-bottom-4 shadow-2xl space-y-6">
                    <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-2">Extracted Palette</h4>
                    <div className="flex flex-wrap gap-4 justify-center">
                      {paletteResult.filter((c): c is {hex: string; rgb: string} => c !== null).map((color, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                          <div 
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-zinc-800 shadow-md cursor-pointer hover:scale-105 transition-transform"
                            style={{ backgroundColor: color.hex }}
                            onClick={() => handleCopy(color.hex, `hex-${idx}`)}
                            title="Click to copy HEX"
                          />
                          <div className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-1 rounded-md border border-white/5 flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => handleCopy(color.hex, `hex-${idx}`)}>
                            {copiedText === `hex-${idx}` ? <Check size={12} className="text-emerald-400" /> : color.hex}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </STContainer>
    </div>
  );
}
