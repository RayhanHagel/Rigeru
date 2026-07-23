"use client";

import React, { useState } from "react";
import { Image as ImageIcon, Upload, Download, Sparkles, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ImageCompareSlider } from "@/components/ui/ImageCompareSlider";

export default function BackgroundRemoverPage() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileToProcess, setFileToProcess] = useState<File | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setFileToProcess(file);
    setFilename(file.name);
    
    // Create local preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setProcessedImage(null); // reset
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = async () => {
    if (!fileToProcess) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("file", fileToProcess);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/remove-background", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to remove background");
      }

      const data = await res.json();
      setProcessedImage(`data:image/png;base64,${data.image_base64}`);
    } catch (e) {
      console.error(e);
      alert("Error removing background.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    const a = document.createElement("a");
    a.href = processedImage;
    a.download = `nobg_${filename.split(".")[0]}.png`;
    a.click();
  };

  const clearState = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setFileToProcess(null);
    setFilename("");
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-fuchsia-500/10 rounded-xl border border-fuchsia-500/20">
          <Sparkles className="text-fuchsia-400" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">AI Background Remover</h1>
          <p className="text-zinc-400 mt-1">Upload an image to instantly remove its background locally.</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-8 backdrop-blur-sm min-h-[500px]">
        
        {!originalImage ? (
          <div className="flex items-center justify-center h-[400px]">
            <label className="flex flex-col items-center justify-center w-full max-w-lg h-64 border-2 border-dashed border-zinc-700 hover:border-fuchsia-500 rounded-xl cursor-pointer bg-zinc-950/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <ImageIcon className="mb-3 text-zinc-500" size={48} />
                <p className="mb-2 text-lg text-zinc-400">
                  <span className="font-semibold text-zinc-200">Click to upload</span> or drag and drop
                </p>
                <p className="text-sm text-zinc-500">PNG, JPG, WEBP (Clear subject recommended)</p>
              </div>
              <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-lg border border-white/5">
                <CheckCircle2 className="text-emerald-500" size={20} />
                <span className="text-zinc-200 font-medium">{filename}</span>
              </div>
              <Button variant="danger" icon={<Trash2 size={18} />} onClick={clearState}>
                Clear
              </Button>
            </div>

            <div className="pt-4 pb-8">
              <ImageCompareSlider 
                originalImage={originalImage} 
                processedImage={processedImage} 
                onProcessClick={handleRemoveBackground} 
                isProcessing={isProcessing} 
              />
            </div>

            {processedImage && (
              <div className="flex justify-center pt-6 border-t border-white/5">
                <Button 
                  variant="primary" 
                  onClick={handleDownload} 
                  icon={<Download size={18} />}
                  className="w-full max-w-md bg-emerald-600 hover:bg-emerald-500 border-none text-white"
                >
                  Download Transparent PNG
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
