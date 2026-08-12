"use client";
import { Header } from "@/components/ui/Header";

import React, { useState } from "react";


import { Button } from "@/components/ui/Button";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { Icon } from "@/lib/utils";

// Helper to format ISO string into YYYY-MM-DDThh:mm for datetime-local input
const toLocalDatetimeString = (isoString: string) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Helper to convert datetime-local input string back to ISO string for backend
const toIsoString = (localString: string) => {
  if (!localString) return "";
  return new Date(localString).toISOString();
};

export default function FileTimestampsPage() {
  const [filePath, setFilePath] = useState("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  
  // Datetime strings formatted for <input type="datetime-local" />
  const [created, setCreated] = useState("");
  const [modified, setModified] = useState("");
  const [accessed, setAccessed] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [readError, setReadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const handleReadTimestamps = async () => {
    if (!filePath) {
      setReadError("Please provide a local file path.");
      return;
    }
    
    setIsLoading(true);
    setReadError("");
    setSaveError("");
    setSaveSuccess("");
    
    try {
      const res = await fetch("/api/subtitles/timestamps/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath })
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to read timestamps");
      }
      
      const data = await res.json();
      const ts = data.timestamps || {};
      
      setCreated(toLocalDatetimeString(ts.created));
      setModified(toLocalDatetimeString(ts.modified));
      setAccessed(toLocalDatetimeString(ts.accessed));
      
    } catch (err: any) {
      setReadError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTimestamps = async () => {
    if (!filePath) return;
    
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess("");
    
    try {
      const res = await fetch("/api/subtitles/timestamps/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          file_path: filePath,
          created: toIsoString(created),
          modified: toIsoString(modified),
          accessed: toIsoString(accessed)
        })
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to save timestamps");
      }
      
      const data = await res.json();
      setSaveSuccess(data.message || "OS Timestamps updated successfully.");
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Timestamp Modifier" subtitle="Forcefully rewrite OS-level file creation, modification, and access timestamps for any file." />

      <div className="flex flex-col gap-6 animate-slide-up w-full">
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">Select File
          </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">📁 Local File Path</label>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowFilePicker(true)} icon={<Icon name="search" size={16} />}>
                Browse File
              </Button>
              <input 
                type="text"
                value={filePath}
                onChange={e => setFilePath(e.target.value)}
                placeholder="e.g., C:\Docs\SecretFile.pdf"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors"
              />
              <Button 
                variant="primary" 
                onClick={handleReadTimestamps}
                disabled={isLoading || !filePath}
                className="px-6"
              >
                {isLoading ? "Reading" : "Read Timestamps"}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">Provide the absolute path to your local file to view and modify its OS timestamps.</p>
          </div>
          
          <FileExplorerModal 
            isOpen={showFilePicker} 
            onClose={() => setShowFilePicker(false)} 
            onSelect={setFilePath} 
            title="Select File to Modify"
            selectionMode="file"
          />
          
          {readError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {readError}
            </div>
          )}
        </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">Edit File Timestamps
          </h3>
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Date Created</label>
            <input 
              type="datetime-local"
              step="1"
              value={created}
              onChange={e => setCreated(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors [color-scheme:dark]"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Date Modified</label>
            <input 
              type="datetime-local"
              step="1"
              value={modified}
              onChange={e => setModified(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors [color-scheme:dark]"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Date Accessed</label>
            <input 
              type="datetime-local"
              step="1"
              value={accessed}
              onChange={e => setAccessed(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors [color-scheme:dark]"
            />
          </div>
          
          {saveError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {saveError}
            </div>
          )}
          
          {saveSuccess && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm flex items-center gap-2">
              <Icon name="check_circle" size={18} />
              {saveSuccess}
            </div>
          )}
          
          <Button 
            variant="primary" 
            onClick={handleSaveTimestamps}
            disabled={isSaving || !filePath}
            className="w-full py-4 text-base font-medium shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-shadow"
          >
            <Icon name="save" size={18} className="mr-2" />
            {isSaving ? "Injecting timestamps via Win32 API..." : "⏱️ Override OS Timestamps"}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
