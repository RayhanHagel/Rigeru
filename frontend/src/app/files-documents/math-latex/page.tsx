"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Upload, FileImage, Settings2, Sigma, Code, AlertTriangle, RefreshCcw, Copy, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export default function MathLatexPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Format tab states
  const [activeTab, setActiveTab] = useState<"latex" | "word" | "text">("latex");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Optionally keep fetch models to show which ones are available but since it's global now we can just leave it out,
    // wait I'll just remove the whole useEffect.
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // Default crop taking 80% of the center
    const defaultCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, 1, width, height),
      width,
      height
    );
    setCrop(defaultCrop);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setResult(null);
      setErrorMsg("");
      setCompletedCrop(null);
      
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

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
    if (!file || !imgRef.current) return;
    
    // If no crop is selected, or width/height is zero, fallback to original
    let imageToUpload: Blob = file;
    if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        try {
            imageToUpload = await getCroppedImg(imgRef.current, completedCrop);
        } catch (e) {
            console.error("Failed to crop", e);
            imageToUpload = file;
        }
    }

    setIsLoading(true);
    setErrorMsg("");
    
    try {
      const formData = new FormData();
      formData.append("file", imageToUpload, "cropped.png");
      
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/math-latex/convert", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Failed to extract data");
      }
      
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
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full h-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Sigma className="text-purple-500" size={32} />
          Math Screenshot to LaTeX
        </h1>
        <p className="text-zinc-400 text-sm font-medium">
          Upload a screenshot of a mathematical equation, crop it, and convert it to copyable LaTeX code.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Image Processing */}
        <div className="flex flex-col gap-6">
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Upload size={18} className="text-purple-400" />
              Upload & Crop
            </h3>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".png,.jpg,.jpeg,.webp" 
              onChange={handleFileChange} 
            />
            
            {!previewUrl ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/5 hover:border-purple-500/50 transition-all group"
              >
                <div className="p-3 bg-zinc-800 rounded-full group-hover:scale-110 transition-transform">
                  <FileImage className="text-zinc-400" size={24} />
                </div>
                <div className="text-center">
                  <p className="text-sm text-zinc-300 font-medium">Click to upload screenshot</p>
                </div>
              </div>
            ) : (
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
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="flex-1">
                      Change Image
                    </Button>
                    <Button 
                      variant="primary" 
                      className="flex-[2] bg-purple-600 hover:bg-purple-700"
                      onClick={handleExtract}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <RefreshCcw className="animate-spin" size={16} /> 
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
                <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-red-400">{errorMsg}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Right Column: Settings & Results */}
        <div className="flex flex-col gap-6">
            

          {/* Results */}
          {result && (
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Code size={18} className="text-emerald-400" />
                  Rendered Output
                </h3>
              </div>
              
              <div className="p-4 bg-white rounded-lg text-black overflow-x-auto">
                 {/* 
                   In a real application you might want to use a math renderer like KaTeX or MathJax here. 
                   For now, we'll display the raw latex text as code, matching the user's Streamlit output formatting.
                 */}
                 <pre className="font-mono text-sm">{result}</pre>
              </div>
              
              <div className="mt-4">
                  <div className="flex items-center border-b border-white/10 mb-4">
                      <button 
                        onClick={() => setActiveTab("latex")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "latex" ? "border-purple-500 text-purple-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
                      >
                          LaTeX
                      </button>
                      <button 
                        onClick={() => setActiveTab("word")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "word" ? "border-purple-500 text-purple-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
                      >
                          MS Word
                      </button>
                      <button 
                        onClick={() => setActiveTab("text")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "text" ? "border-purple-500 text-purple-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
                      >
                          Plain Text
                      </button>
                  </div>
                  
                  <div className="bg-zinc-950 border border-white/10 rounded-lg p-4 relative group">
                      {activeTab === "word" && (
                          <p className="text-xs text-blue-400 mb-2 font-medium">
                              Copy the block below and paste directly into MS Word (it natively converts \[\ \] blocks into equations).
                          </p>
                      )}
                      
                      <pre className="text-sm text-zinc-300 font-mono overflow-x-auto pr-12 whitespace-pre-wrap">
                          {activeTab === "latex" && result}
                          {activeTab === "word" && `\\[\n${result}\n\\]`}
                          {activeTab === "text" && `$${result}$`}
                      </pre>
                      
                      <button 
                        onClick={handleCopy}
                        className="absolute top-4 right-4 p-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
                        title="Copy to clipboard"
                      >
                          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
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
