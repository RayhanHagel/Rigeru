"use client";

import React, { useState } from "react";
import { Search, Eraser, CheckCircle2, AlertTriangle, FileImage } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STColumns, STColumn } from "@/components/streamlit/STColumns";
import { Button } from "@/components/ui/Button";

export default function ExifRemoverPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStripping, setIsStripping] = useState(false);
  
  const [analyzeError, setAnalyzeError] = useState("");
  const [stripError, setStripError] = useState("");
  const [stripSuccess, setStripSuccess] = useState("");
  
  const [exifData, setExifData] = useState<Record<string, any> | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setExifData(null);
      setAnalyzeError("");
      setStripError("");
      setStripSuccess("");
      
      // Auto analyze when uploaded
      analyzeExif(selected);
    }
  };

  const analyzeExif = async (targetFile: File) => {
    setIsAnalyzing(true);
    setAnalyzeError("");
    setExifData(null);
    
    const formData = new FormData();
    formData.append("file", targetFile);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/subtitles/exif/read", {
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
    if (!file) return;
    
    setIsStripping(true);
    setStripError("");
    setStripSuccess("");
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/subtitles/exif/strip", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to strip EXIF data");
      }
      
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `clean_${file.name}`;
      if (contentDisposition && contentDisposition.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/"/g, "");
      }
      
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
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
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="🕵️‍♂️ EXIF Metadata Stripper" />
        <p className="text-zinc-400 mt-2">
          Upload a photo to view hidden metadata (like GPS coordinates or camera info) and strip it out for privacy.
        </p>
      </div>

      <STContainer title="Upload Image" icon={<FileImage className="text-indigo-400" size={20} />}>
        {!file ? (
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileImage className="mb-2 text-zinc-500" size={32} />
              <p className="mb-1 text-sm text-zinc-400"><span className="font-semibold text-zinc-200">Upload Image</span></p>
              <p className="text-xs text-zinc-500">Supports JPG, JPEG, PNG, WEBP, TIFF</p>
            </div>
            <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.tiff" onChange={handleFileUpload} />
          </label>
        ) : (
          <div className="flex items-center justify-between bg-zinc-950 p-4 border border-white/5 rounded-xl mb-6">
            <div className="flex items-center gap-3">
              <FileImage size={24} className="text-indigo-400" />
              <span className="text-zinc-200 font-medium truncate max-w-[200px]">{file.name}</span>
            </div>
            <label className="cursor-pointer text-sm font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-4 py-2 rounded-lg transition-colors">
              Change Image
              <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.tiff" onChange={handleFileUpload} />
            </label>
          </div>
        )}
        
        {file && previewUrl && (
          <div className="mt-6">
            <STColumns>
              <STColumn width={1}>
                <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950 h-full flex items-center justify-center min-h-[300px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="max-w-full max-h-[400px] object-contain" />
                </div>
              </STColumn>
              
              <STColumn width={1.5}>
                <div className="bg-zinc-900/80 border border-white/5 rounded-xl p-6 h-full space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Search size={18} className="text-indigo-400" />
                    Extracted Metadata
                  </h3>
                  
                  {isAnalyzing && (
                    <div className="text-zinc-400 animate-pulse text-sm">Analyzing EXIF data...</div>
                  )}
                  
                  {analyzeError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                      {analyzeError}
                    </div>
                  )}
                  
                  {!isAnalyzing && exifData && (
                    Object.keys(exifData).length === 0 ? (
                      <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm flex items-center gap-2">
                        <CheckCircle2 size={18} />
                        This image is completely clean! No EXIF data was found.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-lg text-sm flex items-center gap-2">
                          <AlertTriangle size={18} />
                          Found {Object.keys(exifData).length} metadata tags in this image.
                        </div>
                        
                        <div className="bg-zinc-950 border border-white/10 rounded-lg overflow-hidden max-h-[250px] overflow-y-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-900 text-zinc-400 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 font-medium">Tag</th>
                                <th className="px-4 py-3 font-medium">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {Object.entries(exifData).map(([key, value]) => (
                                <tr key={key} className="hover:bg-zinc-800/30">
                                  <td className="px-4 py-2 font-medium text-zinc-300 w-1/3">{key}</td>
                                  <td className="px-4 py-2 text-zinc-400 break-words">{String(value)}</td>
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
                            <CheckCircle2 size={18} />
                            {stripSuccess}
                          </div>
                        )}
                        
                        <Button 
                          variant="primary" 
                          onClick={handleStripExif}
                          disabled={isStripping}
                          className="w-full py-4 shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-shadow"
                        >
                          <Eraser size={18} className="mr-2" />
                          {isStripping ? "Sanitizing image locally..." : "🧹 Strip Metadata & Download Clean Image"}
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </STColumn>
            </STColumns>
          </div>
        )}
      </STContainer>
    </div>
  );
}
