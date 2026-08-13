"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { Icon } from "@/lib/utils";

type ExtractionResult = {
  date: string;
  total: string;
  raw_text: string;
};

export default function ExpenseTrackerPage() {
  const [fileInfo, setFileInfo] = useState<{ hash_name: string; original_name: string; file_type: string } | null>(null);
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

  const handleUploadComplete = (info: { hash_name: string; original_name: string; file_type: string }) => {
    setFileInfo(info);
    setResult(null);
    setErrorMsg("");
    setPreviewUrl(`http://localhost:8000/uploads/${info.hash_name}`);
  };

  const handleClearFile = () => {
    setFileInfo(null);
    setResult(null);
    setErrorMsg("");
    setPreviewUrl(null);
  };

  const handleExtract = async () => {
    if (!fileInfo) return;
    
    setIsLoading(true);
    setErrorMsg("");
    
    try {
      const formData = new FormData();
      formData.append("file_hash", fileInfo.hash_name);
      
      const res = await fetch("/api/files-documents/expense-tracker/extract", {
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
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="AI Expense Tracker" subtitle="Upload a receipt or invoice image. The Qwen2-VL model will scan and parse the document locally into structured JSON." />
      
      <div className="flex flex-col gap-6 animate-slide-up w-full">
          
          {/* Upload Card */}
          <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-2xl p-6 flex flex-col gap-4 w-full shadow-sm">
            <h3 className="text-lg font-bold text-[var(--theme-heading)] flex items-center gap-2">Upload Receipt
            </h3>
            
            <DirectUploadBox
              accept=".png,.jpg,.jpeg,.webp"
              label="Upload Receipt Image"
              onUploadComplete={handleUploadComplete}
              onClear={handleClearFile}
              defaultFileName={fileInfo?.original_name}
            />
            
            {previewUrl && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="relative rounded-xl overflow-hidden border border-[var(--theme-ui-border)] group flex justify-center bg-[var(--theme-bg)] p-4 shadow-inner">
                  <img src={previewUrl} alt="Receipt preview" className="w-auto h-auto max-h-[400px] object-contain" />
                </div>
                
                <Button 
                  variant="primary" 
                  className="w-full h-12 text-base"
                  onClick={handleExtract}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Icon name="refresh" className="animate-spin" size={18} /> 
                      Extracting...
                    </span>
                  ) : (
                    "🔍 Extract Data"
                  )}
                </Button>
                
                {isLoading && (
                  <p className="text-xs text-center text-[var(--theme-text)] animate-pulse">
                    Processing with selected model (May take a moment on first run)
                  </p>
                )}
              </div>
            )}
            
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 mt-2">
                <Icon name="warning" className="text-red-400 shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-red-400">{errorMsg}</p>
              </div>
            )}
          </div>
        
        {/* Results */}
        <div className="flex flex-col gap-6 w-full">
          {result ? (
            <div className="flex flex-col gap-6 animate-slide-up w-full">
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center justify-center w-full">
                <p className="text-green-400 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Extraction Complete
                </p>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 w-full">
                <div className="w-full bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6 backdrop-blur-md flex flex-col gap-2 relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-[var(--theme-heading)]">
                    <Icon name="calendar_today" size={64} />
                  </div>
                  <p className="text-sm text-[var(--theme-text)] font-bold uppercase tracking-wider">Date</p>
                  <p className="text-3xl font-bold text-[var(--theme-heading)]">{result.date}</p>
                </div>
                
                <div className="w-full bg-[var(--theme-bg)] border border-[var(--theme-heading)] rounded-2xl p-6 backdrop-blur-md flex flex-col gap-2 relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-[var(--theme-heading)]">
                    <Icon name="attach_money" size={64} />
                  </div>
                  <p className="text-sm text-[var(--theme-heading)] opacity-80 font-bold uppercase tracking-wider">Total Amount</p>
                  <p className="text-3xl font-bold text-[var(--theme-heading)]">{result.total}</p>
                </div>
              </div>
              
              <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-2xl overflow-hidden w-full shadow-sm">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:border-[var(--theme-heading)] hover:shadow-md transition-all duration-300 border border-transparent"
                  onClick={() => setShowJson(!showJson)}
                >
                  <h3 className="font-bold text-[var(--theme-heading)] flex items-center gap-2">Raw JSON Output
                  </h3>
                  <span className="text-xs text-[var(--theme-text)] font-bold bg-[var(--theme-bg)] px-2 py-1 rounded border border-[var(--theme-ui-border)]">
                    {showJson ? "HIDE" : "SHOW"}
                  </span>
                </div>
                
                {showJson && (
                  <div className="p-4 border-t border-[var(--theme-ui-border)] bg-[var(--theme-bg)] overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                    <pre className="text-sm text-emerald-400 font-mono">
                      {result.raw_text}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full min-h-[400px] bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-2xl border-dashed flex flex-col items-center justify-center p-8 text-center gap-4">
              <div className="p-4 bg-[var(--theme-ui-bg)] rounded-full text-[var(--theme-text)] border border-[var(--theme-ui-border)] shadow-sm">
                <Icon name="receipt" size={48} />
              </div>
              <div>
                <p className="text-[var(--theme-heading)] font-bold">No Data Extracted Yet</p>
                <p className="text-sm text-[var(--theme-text)] max-w-sm">
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
