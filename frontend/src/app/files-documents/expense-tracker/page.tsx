"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, FileImage, Settings2, Receipt, Calendar, DollarSign, Code, AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ExtractionResult = {
  date: string;
  total: string;
  raw_text: string;
};

export default function ExpenseTrackerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [showJson, setShowJson] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setResult(null);
      setErrorMsg("");
      
      // Create local preview URL
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    
    setIsLoading(true);
    setErrorMsg("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/expense-tracker/extract", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Failed to extract data");
      }
      
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full h-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Receipt className="text-blue-500" size={32} />
          AI Expense Tracker
        </h1>
        <p className="text-zinc-400 text-sm font-medium">
          Upload a receipt or invoice image. The Qwen2-VL model will scan and parse the document locally into structured JSON.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Controls & Image */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          

          {/* Upload Card */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Upload size={18} className="text-blue-400" />
              Upload Receipt
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
                className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/5 hover:border-blue-500/50 transition-all group"
              >
                <div className="p-3 bg-zinc-800 rounded-full group-hover:scale-110 transition-transform">
                  <FileImage className="text-zinc-400" size={24} />
                </div>
                <div className="text-center">
                  <p className="text-sm text-zinc-300 font-medium">Click to upload image</p>
                  <p className="text-xs text-zinc-500 mt-1">PNG, JPG, WEBP formats</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="relative rounded-xl overflow-hidden border border-white/10 group">
                  <img src={previewUrl} alt="Receipt preview" className="w-full h-auto max-h-[400px] object-contain bg-zinc-950" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                      Change Image
                    </Button>
                  </div>
                </div>
                
                <Button 
                  variant="primary" 
                  className="w-full h-12"
                  onClick={handleExtract}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCcw className="animate-spin" size={16} /> 
                      Extracting...
                    </span>
                  ) : (
                    "🔍 Extract Data"
                  )}
                </Button>
                
                {isLoading && (
                  <p className="text-xs text-center text-zinc-400 animate-pulse">
                    Processing with selected model... (May take a moment on first run)
                  </p>
                )}
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
        
        {/* Right Column: Results */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {result ? (
            <div className="flex flex-col gap-6 animate-fade-in">
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center justify-center">
                <p className="text-green-400 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Extraction Complete
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Calendar size={64} />
                  </div>
                  <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider">Date</p>
                  <p className="text-3xl font-bold text-white">{result.date}</p>
                </div>
                
                <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-blue-500">
                    <DollarSign size={64} />
                  </div>
                  <p className="text-sm text-blue-400/80 font-medium uppercase tracking-wider">Total Amount</p>
                  <p className="text-3xl font-bold text-blue-400">{result.total}</p>
                </div>
              </div>
              
              <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setShowJson(!showJson)}
                >
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Code size={18} className="text-zinc-400" />
                    Raw JSON Output
                  </h3>
                  <span className="text-xs text-zinc-500 font-medium bg-zinc-950 px-2 py-1 rounded">
                    {showJson ? "HIDE" : "SHOW"}
                  </span>
                </div>
                
                {showJson && (
                  <div className="p-4 border-t border-white/10 bg-zinc-950/80 overflow-x-auto max-h-[500px] overflow-y-auto">
                    <pre className="text-sm text-emerald-400 font-mono">
                      {result.raw_text}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] bg-zinc-900/20 border border-white/5 rounded-2xl border-dashed flex flex-col items-center justify-center p-8 text-center gap-4">
              <div className="p-4 bg-zinc-900/50 rounded-full text-zinc-700">
                <Receipt size={48} />
              </div>
              <div>
                <p className="text-zinc-400 font-medium">No Data Extracted Yet</p>
                <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                  Upload a receipt image and click extract to see the parsed AI JSON output here.
                </p>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
