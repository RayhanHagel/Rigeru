import React, { useState, useRef } from "react";

import { directUploadFile } from "./DirectUploadBox";
import { Icon } from "@/lib/utils";

interface UploadedFileInfo {
  hash_name: string;
  original_name: string;
  file_type: string;
}

interface DirectMultiUploadBoxProps {
  accept?: string;
  label?: string;
  onUploadComplete: (files: UploadedFileInfo[]) => void;
  onClear: () => void;
}

export function DirectMultiUploadBox({
  accept = "*",
  label = "Upload Files",
  onUploadComplete,
  onClear
}: DirectMultiUploadBoxProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progresses, setProgresses] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: File[]) => {
    setUploading(true);
    setError("");
    setProgresses({});
    
    const newUploads: UploadedFileInfo[] = [...uploadedFiles];

    try {
      for (const file of files) {
        setProgresses(prev => ({ ...prev, [file.name]: 0 }));
        const result = await directUploadFile(file, (p) => {
          setProgresses(prev => ({ ...prev, [file.name]: p }));
        });
        newUploads.push(result);
      }
      setUploadedFiles(newUploads);
      onUploadComplete(newUploads);
    } catch (err: any) {
      setError(err.message || "Failed to upload files");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await processFiles(Array.from(e.target.files));
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
    await processFiles(Array.from(e.dataTransfer.files));
  };

  const handleClear = () => {
    setUploadedFiles([]);
    setError("");
    setProgresses({});
    onClear();
  };

  return (
    <div className="w-full flex flex-col space-y-3 relative group">
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full min-h-[7rem] border rounded-3xl cursor-pointer transition-all duration-500 relative overflow-hidden backdrop-blur-md
          ${uploading ? 'border-[var(--theme-heading)] bg-[var(--theme-ui-bg)] shadow-[0_0_30px_var(--theme-glow1)]' 
          : isDragging ? 'border-[var(--theme-heading)] bg-[var(--theme-ui-bg)] shadow-[0_0_30px_var(--theme-glow2)] scale-[1.02]' 
          : 'border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] bg-[var(--theme-ui-bg)] shadow-lg hover:shadow-[0_0_20px_var(--theme-glow1)]'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={accept}
          onChange={handleFileSelect}
          disabled={uploading}
        />
        
        {uploading ? (
          <div className="flex flex-col items-center w-full z-10 transition-all duration-500 py-6">
            <Icon name="upload" size={40} className="mb-4 text-[var(--theme-heading)] animate-bounce drop-shadow-[0_0_10px_var(--theme-glow1)]" />
            <div className="text-base font-semibold tracking-wide text-[var(--theme-heading)] mb-4">Uploading files</div>
            <div className="w-full max-w-sm flex flex-col gap-3">
              {Object.entries(progresses).map(([name, p]) => (
                <div key={name} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-[var(--theme-text)] font-medium px-1">
                    <span className="truncate max-w-[220px]">{name}</span>
                    <span className="text-[var(--theme-heading)]">{p}%</span>
                  </div>
                  <div className="w-full bg-zinc-950/50 rounded-full h-1.5 overflow-hidden shadow-inner shadow-black/50">
                    <div className="bg-[var(--theme-heading)] h-full transition-all duration-300 ease-out shadow-[0_0_10px_var(--theme-glow1)]" style={{ width: `${p}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : uploadedFiles.length > 0 ? (
          <div className="flex flex-col items-center w-full z-10 transition-transform duration-300 scale-105 py-6">
            <div className="p-4 bg-[var(--theme-ui-bg)] rounded-2xl shadow-[0_0_15px_var(--theme-glow1)] mb-4">
              <Icon name="check_circle" size={40} className="text-[var(--theme-heading)] drop-shadow-[0_0_10px_var(--theme-glow1)]" />
            </div>
            <div className="text-lg font-semibold text-[var(--theme-heading)] mb-5 tracking-wide text-center">{uploadedFiles.length} files successfully uploaded</div>
            <div className="flex flex-wrap justify-center gap-4">
              <label className="cursor-pointer flex items-center gap-2 text-sm font-medium text-[var(--theme-heading)] hover:text-[var(--theme-text)] bg-[var(--theme-ui-bg)] px-5 py-2.5 rounded-xl transition-all shadow-sm border border-[var(--theme-ui-border)]">
                Add More
                <input type="file" multiple className="hidden" accept={accept} onChange={handleFileSelect} />
              </label>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClear(); }}
                className="flex items-center gap-2 text-sm font-medium text-[var(--theme-text)] hover:text-red-400 bg-[var(--theme-ui-bg)] hover:bg-red-500/15 px-5 py-2.5 rounded-xl transition-all shadow-sm border border-[var(--theme-ui-border)]"
              >
                <Icon name="close" size={16} /> Clear All
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center w-full px-4 py-6 z-10 transition-transform duration-300 group-hover:scale-[1.01] gap-4 sm:gap-6">
            <div className={`flex items-center justify-center p-3 sm:p-4 rounded-2xl shrink-0 transition-all duration-500 ${isDragging ? 'bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] shadow-[0_0_20px_var(--theme-glow1)]' : 'bg-[var(--theme-bg)] text-[var(--theme-text)] group-hover:bg-[var(--theme-ui-bg)] group-hover:text-[var(--theme-heading)] group-hover:shadow-[0_0_20px_var(--theme-glow1)]'}`}>
              <Icon name="upload" size={32} className={`${isDragging ? 'animate-bounce' : 'group-hover:scale-110 transition-transform duration-500'}`} />
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
      </label>
      
      {error && (
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-[var(--theme-text)] bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] p-3 rounded-2xl shadow-[0_0_15px_var(--theme-glow1)] w-full max-w-sm mx-auto animate-in fade-in slide-in-from-top-2 duration-300">
          <Icon name="close" size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
