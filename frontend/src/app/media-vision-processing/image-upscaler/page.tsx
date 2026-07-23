"use client";

import React, { useState, useEffect } from 'react';
import { STHeader } from '@/components/streamlit/STHeader';
import { STContainer } from '@/components/streamlit/STContainer';
import { STColumns, STColumn } from '@/components/streamlit/STColumns';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ImageCompareSlider } from '@/components/ui/ImageCompareSlider';
import { Upload, ImageIcon, Cpu, Loader2, Download, Settings2 } from 'lucide-react';

export default function ImageUpscaler() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
  

  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setOriginalUrl(URL.createObjectURL(selectedFile));
      setUpscaledUrl(null); // Reset result on new file
      setErrorMsg("");
    }
  };

  const handleUpscale = async () => {
    if (!file) return;

    setIsLoading(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("file", file);


    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/upscale-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errStr = "Failed to enhance image";
        try {
          const errData = await res.json();
          errStr = errData.detail || errStr;
        } catch(e) {}
        throw new Error(errStr);
      }

      // Read response as Blob
      const blob = await res.blob();
      const upscaledObjUrl = URL.createObjectURL(blob);
      setUpscaledUrl(upscaledObjUrl);
      
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatModelLabel = (s: number) => {
    const labels: Record<number, string> = {
      2: "2x Upscale - Great for large photos",
      4: "4x Upscale - The Standard ESRGAN architecture",
      8: "8x Upscale - Extreme enhancement for tiny images"
    };
    return labels[s] || `${s}x Upscale`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="✨ AI Image Upscaler (Real-ESRGAN)" />
        <p className="text-zinc-400 mt-2">
          Locally restore, enhance, and upscale low-resolution images to 4K+ using Deep Learning.
        </p>
      </div>

      <STContainer>
        <div className="space-y-6">
          {/* Upload Area */}
          <div>
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <ImageIcon className="mb-3 text-zinc-500" size={32} />
                <p className="mb-2 text-sm text-zinc-400">
                  <span className="font-semibold text-zinc-200">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-zinc-500">JPG, JPEG, PNG, WEBP</p>
              </div>
              <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
            </label>
            {file && (
              <div className="mt-2 text-sm text-indigo-400 flex items-center justify-center gap-2">
                <ImageIcon size={16} /> Selected: {file.name}
              </div>
            )}
          </div>



          <Button 
            variant="primary" 
            className="w-full h-12 text-lg"
            onClick={handleUpscale}
            disabled={!file || isLoading}
            icon={isLoading ? <Loader2 className="animate-spin" /> : <ImageIcon />}
          >
            {isLoading ? "Enhancing image..." : "Enhance Image"}
          </Button>

          {errorMsg && (
            <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-md text-sm">
              Error: {errorMsg}
            </div>
          )}
        </div>
      </STContainer>

      {/* Results Section */}
      {upscaledUrl && originalUrl && (
        <div className="space-y-6 pt-4 border-t border-white/10 animate-in slide-in-from-bottom-4 fade-in">
          <div>
            <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <ImageIcon className="text-indigo-400" /> Interactive Comparison
            </h3>
            <p className="text-sm text-zinc-400 mt-1">Drag the slider to compare the original image against the AI-enhanced output.</p>
          </div>

          <div className="bg-zinc-950 p-4 rounded-xl border border-white/5 overflow-hidden">
            <ImageCompareSlider
              originalImage={originalUrl}
              processedImage={upscaledUrl}
              onProcessClick={() => {}}
              isProcessing={false}
              processedLabel="Upscaled Image"
            />
          </div>

          <div className="flex justify-end">
            <a href={upscaledUrl} download={`upscaled_${file?.name || "image"}.png`}>
              <Button variant="primary" icon={<Download />}>
                Download Upscaled Image (.png)
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
