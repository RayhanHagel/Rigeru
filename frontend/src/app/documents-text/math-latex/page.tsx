"use client";

import React, { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { DirectUploadBox, directUploadFile } from "@/components/ui/DirectUploadBox";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Icon } from "@/lib/utils";

export default function MathLatexPage() {
  const [fileInfo, setFileInfo] = useState<{ hash_name: string; original_name: string; file_type: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<string | null>(null);
  
  // Format tab states
  const [activeTab, setActiveTab] = useState<"latex" | "word" | "text">("latex");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const defaultCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, 1, width, height),
      width,
      height
    );
    setCrop(defaultCrop);
  };

  const handleUploadComplete = (info: { hash_name: string; original_name: string; file_type: string }) => {
    setFileInfo(info);
    setResult(null);
    setErrorMsg("");
    setCompletedCrop(null);
    setPreviewUrl(`http://localhost:8000/uploads/${info.hash_name}`);
  };

  const handleClearFile = () => {
    setFileInfo(null);
    setResult(null);
    setErrorMsg("");
    setCompletedCrop(null);
    setPreviewUrl(null);
  };

  const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("No 2d context");

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  };

  const handleExtract = async () => {
    if (!fileInfo || !imgRef.current) return;
    
    let imageToUpload: Blob | null = null;
    if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        try {
            imageToUpload = await getCroppedImg(imgRef.current, completedCrop);
        } catch (e) {
            console.error("Failed to crop", e);
        }
    }

    setIsLoading(true);
    setErrorMsg("");
    
    try {
      let finalHash = fileInfo.hash_name;
      if (imageToUpload) {
        const uploaded = await directUploadFile(imageToUpload, undefined, "cropped.png", "image/png");
        finalHash = uploaded.hash_name;
      }

      const formData = new FormData();
      formData.append("file_hash", finalHash);
      
      const res = await fetch("/api/files-documents/math-latex/convert", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || "Failed to extract data");
      
      setResult(data.latex);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopy = () => {
    if (!result) return;
    let textToCopy = "";
    if (activeTab === "latex") textToCopy = result;
    if (activeTab === "word") textToCopy = `\\[\n${result}\n\\]`;
    if (activeTab === "text") textToCopy = `$${result}$`;
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Math Screenshot to LaTeX</h1>
            <p className="text-zinc-400 text-sm font-medium">Upload a screenshot of a mathematical equation, crop it, and convert it to copyable LaTeX code.</p>
          </div>
        </div>
      
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs
                  activeTab={activeTab}
                  setActiveTab={setActiveTab as (id: string) => void}
                  tabs={[
                    { id: "latex", label: "Pure LaTeX" },
                    { id: "word", label: "Word Format (\\[...\\])" },
                    { id: "text", label: "Inline Text Format ($...$)" }
                  ]}
                />
        </div>
      </div>
      
      <div className="flex flex-col gap-6 animate-slide-up w-full">
        <div className="w-full flex flex-col gap-6">
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">Upload & Crop
            </h3>
            
            <DirectUploadBox
              accept=".png,.jpg,.jpeg,.webp"
              label="Upload Math Image"
              onUploadComplete={handleUploadComplete}
              onClear={handleClearFile}
            />
            
            {previewUrl && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-zinc-400 italic mb-1">Drag the box to frame the equation perfectly.</p>
                <div className="bg-zinc-950 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center p-2">
                  <ReactCrop 
                    crop={crop} 
                    onChange={c => setCrop(c)} 
                    onComplete={c => setCompletedCrop(c)}
                  >
                    <img 
                      ref={imgRef}
                      src={previewUrl} 
                      alt="Upload" 
                      className="max-h-[500px] object-contain"
                      onLoad={onImageLoad}
                    />
                  </ReactCrop>
                </div>
                
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleClearFile} className="flex-1">
                      Change Image
                    </Button>
                    <Button 
                      variant="primary" 
                      className="flex-[2] bg-primary hover:bg-purple-700"
                      onClick={handleExtract}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <Icon name="refresh" className="animate-spin" size={16} /> 
                          Converting...
                        </span>
                      ) : (
                        "Convert to LaTeX"
                      )}
                    </Button>
                </div>
              </div>
            )}
            
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 mt-2">
                <Icon name="warning" className="text-red-400 shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-red-400">{errorMsg}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Results */}
        <div className="w-full flex flex-col gap-6">
            

          {/* Results */}
          {result && (
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 animate-slide-up">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">Rendered Output
                </h3>
                
              </div>
              
              <div className="p-4 bg-white rounded-lg text-black overflow-x-auto">
                 <pre className="font-mono text-sm">{result}</pre>
              </div>
              
              <div className="mt-4">
                  
                  <div className="bg-zinc-950 p-4 rounded-xl border border-white/5 relative group">
                      <ModernTabContent activeTab={activeTab}>
                                  {activeTab === "word" && (
                                                            <p className="text-xs text-secondary mb-2 font-medium">
                                                                Copy the block below and paste directly into MS Word (it natively converts \[\ \] blocks into equations).
                                                            </p>
                                                        )}
                                  </ModernTabContent>
                      
                      <pre className="text-sm text-zinc-300 font-mono overflow-x-auto pr-12 whitespace-pre-wrap">
                          <ModernTabContent activeTab={activeTab}>
                                      {activeTab === "latex" && result}
                                      </ModernTabContent>
                          <ModernTabContent activeTab={activeTab}>
                                      {activeTab === "word" && `\\[\n${result}\n\\]`}
                                      </ModernTabContent>
                          <ModernTabContent activeTab={activeTab}>
                                      {activeTab === "text" && `$${result}$`}
                                      </ModernTabContent>
                      </pre>
                      
                      <button 
                        onClick={handleCopy}
                        className="absolute top-4 right-4 p-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
                        title="Copy to clipboard"
                      >
                          {copied ? <Icon name="check" size={16} className="text-green-500" /> : <Icon name="content_copy" size={16} />}
                      </button>
                  </div>
              </div>
            </div>
          )}
          
        </div>
        
      </div>
    </div>
  );
}
