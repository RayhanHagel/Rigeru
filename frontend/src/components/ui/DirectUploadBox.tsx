"use client";

import React, { useState, useRef } from "react";
import { Icon } from "@/lib/utils";

interface DirectUploadBoxProps {
  accept?: string;
  label?: string;
  onUploadComplete: (fileInfo: { hash_name: string; original_name: string; file_type: string }) => void;
  onClear?: () => void;
  className?: string;
  defaultFileName?: string;
}
export const computeFastHash = async (file: File | Blob): Promise<string> => {
  const chunkSize = 1024 * 1024; // 1MB
  let buffer: ArrayBuffer;
  
  if (file.size <= chunkSize * 2) {
    buffer = await file.arrayBuffer();
  } else {
    const start = await file.slice(0, chunkSize).arrayBuffer();
    const end = await file.slice(file.size - chunkSize).arrayBuffer();
    const combined = new Uint8Array(start.byteLength + end.byteLength + 8);
    combined.set(new Uint8Array(start), 0);
    combined.set(new Uint8Array(end), start.byteLength);
    const view = new DataView(combined.buffer);
    view.setFloat64(start.byteLength + end.byteLength, file.size);
    buffer = combined.buffer;
  }
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const directUploadFile = async (
  file: File | Blob, 
  onProgress?: (progress: number) => void,
  fileName?: string,
  fileType?: string
): Promise<{ hash_name: string; original_name: string; file_type: string }> => {
  const hash = await computeFastHash(file);
  const actualName = fileName || (file instanceof File ? file.name : "upload.bin");
  const actualType = fileType || file.type;
  
  const ext = actualName.includes('.') ? '.' + actualName.split('.').pop() : '';
  const hashName = hash + ext;
  
  const token = localStorage.getItem("auth_token") || "";
  const baseUrl = window.location.protocol + "//" + window.location.hostname + ":8000";
  
  const checkRes = await fetch(`${baseUrl}/api/system/upload/check?file_hash=${encodeURIComponent(hashName)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  let exists = false;
  if (checkRes.ok) {
    const checkData = await checkRes.json();
    exists = checkData.exists;
  }
  
  if (!exists) {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${baseUrl}/api/system/upload/direct`, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const res = JSON.parse(xhr.responseText);
            reject(new Error(res.detail || "Upload failed"));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };
      
      xhr.onerror = () => reject(new Error("Network error during upload"));
      
      const formData = new FormData();
      formData.append("file_hash", hashName);
      
      // Ensure we send it as a file with a name so fastapi parses it correctly
      if (file instanceof File) {
        formData.append("file", file);
      } else {
        formData.append("file", file, actualName);
      }
      
      xhr.send(formData);
    });
  }
  
  return {
    hash_name: hashName,
    original_name: actualName,
    file_type: actualType
  };
};
export function DirectUploadBox({ 
  accept = "*", 
  label = "Upload File", 
  onUploadComplete, 
  onClear,
  className = "",
  defaultFileName = ""
}: DirectUploadBoxProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState(defaultFileName);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.match(/\.(jpg|jpeg|png|webp|gif)$/i)) return <Icon name="image" size={24} />;
    if (n.match(/\.(mp4|mov|avi|mkv|webm)$/i)) return <Icon name="movie" size={24} />;
    if (n.match(/\.(mp3|wav|ogg|flac)$/i)) return <Icon name="music_note" size={24} />;
    return <Icon name="description" size={24} />;
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setError("");
    setProgress(0);
    
    try {
      const result = await directUploadFile(file, setProgress);
      
      setUploadedFileName(result.original_name);
      onUploadComplete(result);
      
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsUploading(false);
      setProgress(100);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await processFile(e.target.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    await processFile(e.dataTransfer.files[0]);
  };

  const handleClear = () => {
    setUploadedFileName("");
    setProgress(0);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (onClear) onClear();
  };

  if (uploadedFileName && !isUploading && !error) {
    return (
      <div className={`flex items-center justify-between bg-[var(--theme-ui-bg)] backdrop-blur-md p-4 border border-[var(--theme-ui-border)] rounded-2xl shadow-xl hover:border-[var(--theme-heading)] transition-all duration-300 group w-full h-full min-h-[160px] ${className || ""}`}>
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="p-2.5 bg-[var(--theme-ui-bg)] rounded-xl shadow-[0_0_15px_var(--theme-glow1)] text-[var(--theme-heading)] group-hover:scale-105 transition-all">
            {getFileIcon(uploadedFileName)}
          </div>
          <div className="flex flex-col">
            <span className="text-[var(--theme-heading)] font-medium truncate max-w-[180px] sm:max-w-sm tracking-wide">{uploadedFileName}</span>
            <span className="text-xs text-green-400/90 font-medium flex items-center gap-1 mt-0.5">
              <Icon name="check_circle" size={12} /> Upload Complete
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer text-sm font-medium text-[var(--theme-heading)] hover:text-white bg-[var(--theme-ui-bg)] px-4 py-2 rounded-xl transition-all shadow-sm border border-[var(--theme-ui-border)]">
            Change
            <input ref={fileInputRef} type="file" className="hidden" accept={accept} onChange={handleFileSelect} />
          </label>
          <button onClick={handleClear} className="text-[var(--theme-text)] hover:text-red-400 bg-[var(--theme-ui-bg)] hover:bg-red-500/15 px-3 py-2 rounded-xl transition-all shadow-sm border border-[var(--theme-ui-border)]">
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 flex flex-col h-full w-full">
      <label 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group flex flex-col items-center justify-center w-full h-full min-h-[7rem] flex-1 border rounded-3xl cursor-pointer transition-all duration-500 relative overflow-hidden backdrop-blur-md
          ${isUploading ? 'border-[var(--theme-heading)] bg-[var(--theme-ui-bg)] shadow-[0_0_30px_var(--theme-glow1)]' 
          : isDragging ? 'border-[var(--theme-heading)] bg-[var(--theme-ui-bg)] shadow-[0_0_30px_var(--theme-glow2)] scale-[1.02]' 
          : 'border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] bg-[var(--theme-ui-bg)] shadow-lg hover:shadow-[0_0_20px_var(--theme-glow1)]'} ${className}`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center z-10 scale-110 transition-transform duration-500 py-6">
            <div className="w-12 h-12 border-[4px] border-[var(--theme-ui-border)] border-t-[var(--theme-heading)] rounded-full animate-spin mb-4 shadow-[0_0_15px_var(--theme-glow1)]"></div>
            <p className="text-base font-semibold tracking-wide text-[var(--theme-heading)]">Uploading {progress}%</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center w-full px-4 py-6 z-10 transition-transform duration-300 group-hover:scale-[1.01] gap-4 sm:gap-6">
            <div className={`flex items-center justify-center p-3 sm:p-4 rounded-2xl shrink-0 transition-all duration-500 ${isDragging ? 'bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] shadow-[0_0_20px_var(--theme-glow1)]' : 'bg-[var(--theme-bg)] text-[var(--theme-text)] group-hover:bg-[var(--theme-ui-bg)] group-hover:text-[var(--theme-heading)] group-hover:shadow-[0_0_20px_var(--theme-glow1)]'}`}>
              <Icon name="cloud_upload" size={32} className={`${isDragging ? 'animate-bounce' : 'group-hover:scale-110 transition-transform duration-500'}`} />
            </div>
            
            <div className="flex flex-col items-center text-center">
              <p className="text-base sm:text-lg text-[var(--theme-text)] group-hover:text-[var(--theme-heading)] transition-colors duration-300"><span className="font-bold tracking-wide">Drag and Drop</span></p>
              <p className="text-xs sm:text-sm font-normal text-[var(--theme-text)] group-hover:text-[var(--theme-heading)] transition-colors duration-300 mt-1">or Select Here</p>
              
              <div className="flex flex-wrap gap-1.5 mt-3 items-center justify-center">
                {accept === "*" || !accept ? (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--theme-bg)] text-[var(--theme-text)] text-[10px] sm:text-xs font-medium border border-[var(--theme-ui-border)]">ANY FORMAT</span>
                ) : (
                  <>
                    {accept.split(',').slice(0, 6).map((ext, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-[var(--theme-bg)] text-[var(--theme-text)] text-[10px] sm:text-xs font-medium uppercase border border-[var(--theme-ui-border)]">
                        {ext.trim().replace('.', '')}
                      </span>
                    ))}
                    {accept.split(',').length > 6 && (
                      <span className="px-2 py-0.5 rounded-md bg-[var(--theme-bg)] text-[var(--theme-text)] text-[10px] sm:text-xs font-medium border border-[var(--theme-ui-border)]">
                        +{accept.split(',').length - 6}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        
        {isUploading && (
          <div className="absolute bottom-0 left-0 h-1.5 bg-[var(--theme-heading)] transition-all duration-300 ease-out shadow-[0_0_15px_var(--theme-glow1)]" style={{ width: `${progress}%` }} />
        )}
        
        <input ref={fileInputRef} type="file" className="hidden" accept={accept} onChange={handleFileSelect} disabled={isUploading} />
      </label>
      
      {error && (
        <div className="flex items-center gap-3 text-sm font-medium text-[var(--theme-text)] bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] px-4 py-3 rounded-2xl shadow-[0_0_15px_var(--theme-glow1)] animate-in slide-in-from-top-2 fade-in duration-300">
          <Icon name="error" size={18} className="shrink-0" />
          <span className="leading-tight">{error}</span>
        </div>
      )}
    </div>
  );
}
