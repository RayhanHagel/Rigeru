"use client";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";

import React, { useState } from "react";


import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { Icon } from "@/lib/utils";

export default function ExifRemoverPage() {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStripping, setIsStripping] = useState(false);
  
  const [analyzeError, setAnalyzeError] = useState("");
  const [stripError, setStripError] = useState("");
  const [stripSuccess, setStripSuccess] = useState("");
  
  const [exifData, setExifData] = useState<Record<string, any> | null>(null);

  const analyzeExif = async (hashName: string) => {
    setIsAnalyzing(true);
    setAnalyzeError("");
    setExifData(null);
    
    const formData = new FormData();
    formData.append("file_hash", hashName);
    
    try {
      const res = await fetch("/api/subtitles/exif/read", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to analyze EXIF data");
      }
      
      const data = await res.json();
      setExifData(data.exif || {});
    } catch (err: any) {
      setAnalyzeError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStripExif = async () => {
    if (!fileHash) return;
    
    setIsStripping(true);
    setStripError("");
    setStripSuccess("");
    
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    
    try {
      const res = await fetch("/api/subtitles/exif/strip", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to strip EXIF data");
      }
      
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let downloadFilename = `clean_${fileName}`;
      if (contentDisposition && contentDisposition.includes("filename=")) {
        downloadFilename = contentDisposition.split("filename=")[1].replace(/"/g, "");
      }
      
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = downloadFilename;
      a.click();
      URL.revokeObjectURL(a.href);
      
      setStripSuccess("Metadata successfully stripped and image downloaded!");
    } catch (err: any) {
      setStripError(err.message);
    } finally {
      setIsStripping(false);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="EXIF Metadata Stripper" subtitle="Upload a photo to view hidden metadata (like GPS coordinates or camera info) and strip it out for privacy." />

      <div className="flex flex-col gap-6 animate-slide-up w-full">
        <SectionHeader title="Upload Image" />
        {!fileHash ? (
          <div className="flex flex-col items-center justify-center w-full min-h-[160px] rounded-xl transition-colors">
            <DirectUploadBox 
              accept=".jpg,.jpeg,.png,.webp,.tiff"
              label="Upload Image"
              onUploadComplete={(info) => {
                setFileHash(info.hash_name);
                setFileName(info.original_name);
                setPreviewUrl(`http://127.0.0.1:8000/uploads/${info.hash_name}`);
                setExifData(null);
                setAnalyzeError("");
                setStripError("");
                setStripSuccess("");
                analyzeExif(info.hash_name);
              }}
              onClear={() => {
                setFileHash(null);
                setFileName("");
                setPreviewUrl(null);
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between bg-[var(--theme-bg)] p-4 border border-[var(--theme-ui-border)] rounded-xl mb-6">
            <div className="flex items-center gap-3">
              <Icon name="image" size={24} className="text-[var(--theme-heading)]" />
              <span className="text-[var(--theme-heading)] font-medium truncate max-w-[200px]">{fileName}</span>
            </div>
            <button
              className="cursor-pointer text-sm font-medium text-[var(--theme-text)] hover:text-[var(--theme-heading)] bg-[var(--theme-heading)]/10 px-4 py-2 rounded-lg transition-colors"
              onClick={() => {
                setFileHash(null);
                setFileName("");
                setPreviewUrl(null);
              }}
            >
              Change Image
            </button>
          </div>
        )}
        
        {fileHash && previewUrl && (
          <div className="mt-6">
            <div className="flex flex-col gap-6 w-full">
              <div className="w-full">
                <div className="border border-[var(--theme-ui-border)] rounded-xl overflow-hidden bg-[var(--theme-bg)] flex items-center justify-center min-h-[300px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="max-w-full max-h-[400px] object-contain" />
                </div>
              </div>
              
              <div className="w-full">
                <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-6 h-full space-y-4 backdrop-blur-md shadow-sm">
                  <SectionHeader title="Extracted Metadata" />
                  
                  {isAnalyzing && (
                    <div className="text-[var(--theme-text)] animate-pulse text-sm">Analyzing EXIF data</div>
                  )}
                  
                  {analyzeError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                      {analyzeError}
                    </div>
                  )}
                  
                  {!isAnalyzing && exifData && (
                    Object.keys(exifData).length === 0 ? (
                      <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm flex items-center gap-2">
                        <Icon name="check_circle" size={18} />
                        This image is completely clean! No EXIF data was found.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-lg text-sm flex items-center gap-2">
                          <Icon name="warning" size={18} />
                          Found {Object.keys(exifData).length} metadata tags in this image.
                        </div>
                        
                        <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg overflow-hidden max-h-[250px] overflow-y-auto custom-scrollbar">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-[var(--theme-bg)]/80 text-[var(--theme-text)] sticky top-0 backdrop-blur-sm">
                              <tr>
                                <th className="px-4 py-3 font-medium">Tag</th>
                                <th className="px-4 py-3 font-medium">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--theme-ui-border)]">
                              {Object.entries(exifData).map(([key, value]) => (
                                <tr key={key} className="hover:bg-[var(--theme-bg)]/50">
                                  <td className="px-4 py-2 font-medium text-[var(--theme-text)] w-1/3">{key}</td>
                                  <td className="px-4 py-2 text-[var(--theme-text)] break-words">{String(value)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {stripError && (
                          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                            {stripError}
                          </div>
                        )}
                        
                        {stripSuccess && (
                          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm flex items-center gap-2">
                            <Icon name="check_circle" size={18} />
                            {stripSuccess}
                          </div>
                        )}
                        
                        <Button 
                          variant="primary" 
                          onClick={handleStripExif}
                          disabled={isStripping}
                          className="w-full py-4 transition-shadow"
                        >
                          <Icon name="ink_eraser" size={18} className="mr-2" />
                          {isStripping ? "Sanitizing image locally..." : "🧹 Strip Metadata & Download Clean Image"}
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
