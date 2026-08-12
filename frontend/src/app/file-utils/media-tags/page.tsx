"use client";
import { Header } from "@/components/ui/Header";

import React, { useState } from "react";


import { Button } from "@/components/ui/Button";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { Icon } from "@/lib/utils";

export default function MediaTagsPage() {
  const [filePath, setFilePath] = useState("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [tags, setTags] = useState({ title: "", artist: "", album: "", date: "" });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [readError, setReadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const handleReadTags = async () => {
    if (!filePath) {
      setReadError("Please provide a local file path.");
      return;
    }
    
    setIsLoading(true);
    setReadError("");
    setSaveError("");
    setSaveSuccess("");
    
    try {
      const res = await fetch("/api/subtitles/tags/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath })
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to read tags");
      }
      
      const data = await res.json();
      setTags({
        title: data.tags.title || "",
        artist: data.tags.artist || "",
        album: data.tags.album || "",
        date: data.tags.date || ""
      });
    } catch (err: any) {
      setReadError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTags = async () => {
    if (!filePath) return;
    
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess("");
    
    try {
      const res = await fetch("/api/subtitles/tags/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          file_path: filePath,
          ...tags
        })
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to save tags");
      }
      
      const data = await res.json();
      setSaveSuccess(data.message || "Metadata saved successfully.");
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Media Tags Editor" subtitle="Modify internal media tags (ID3/MP4) for your audio and video files." />

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
                placeholder="e.g., C:\Music\Song.mp3"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors"
              />
              <Button 
                variant="primary" 
                onClick={handleReadTags}
                disabled={isLoading || !filePath}
                className="px-6"
              >
                {isLoading ? "Reading" : "Read Tags"}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">Provide the absolute path to your local media file to view and edit its metadata.</p>
          </div>
          
          <FileExplorerModal 
            isOpen={showFilePicker} 
            onClose={() => setShowFilePicker(false)} 
            onSelect={setFilePath} 
            title="Select Media File"
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
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">Edit Internal Tags
          </h3>
        <div className="space-y-6">
          <div className="flex flex-col gap-6 w-full">
            <div className="w-full">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Title</label>
                <input 
                  type="text"
                  value={tags.title}
                  onChange={e => setTags({ ...tags, title: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors"
                />
              </div>
            </div>
            <div className="w-full">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Artist</label>
                <input 
                  type="text"
                  value={tags.artist}
                  onChange={e => setTags({ ...tags, artist: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors"
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-6 w-full">
            <div className="w-full">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Album</label>
                <input 
                  type="text"
                  value={tags.album}
                  onChange={e => setTags({ ...tags, album: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors"
                />
              </div>
            </div>
            <div className="w-full">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Year / Date</label>
                <input 
                  type="text"
                  value={tags.date}
                  onChange={e => setTags({ ...tags, date: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors"
                />
              </div>
            </div>
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
            onClick={handleSaveTags}
            disabled={isSaving || !filePath}
            className="w-full py-4 text-base font-medium shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-shadow"
          >
            <Icon name="save" size={18} className="mr-2" />
            {isSaving ? "Writing metadata" : "Save Media Tags"}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
