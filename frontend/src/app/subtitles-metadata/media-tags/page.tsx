"use client";

import React, { useState } from "react";
import { Tag, Search, Save, CheckCircle2 } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STColumns, STColumn } from "@/components/streamlit/STColumns";
import { Button } from "@/components/ui/Button";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";

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
      const res = await fetch("http://127.0.0.1:8000/api/subtitles/tags/read", {
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
      const res = await fetch("http://127.0.0.1:8000/api/subtitles/tags/save", {
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
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="🏷️ Media Tags Editor" />
        <p className="text-zinc-400 mt-2">
          Modify internal media tags (ID3/MP4) for your audio and video files.
        </p>
      </div>

      <STContainer title="Select File" icon={<Search className="text-indigo-400" size={20} />}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">📁 Local File Path</label>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowFilePicker(true)} icon={<Search size={16} />}>
                Browse File
              </Button>
              <input 
                type="text"
                value={filePath}
                onChange={e => setFilePath(e.target.value)}
                placeholder="e.g., C:\Music\Song.mp3"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <Button 
                variant="primary" 
                onClick={handleReadTags}
                disabled={isLoading || !filePath}
                className="px-6"
              >
                {isLoading ? "Reading..." : "Read Tags"}
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
      </STContainer>

      <STContainer title="Edit Internal Tags" icon={<Tag className="text-indigo-400" size={20} />}>
        <div className="space-y-6">
          <STColumns>
            <STColumn width={1}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Title</label>
                <input 
                  type="text"
                  value={tags.title}
                  onChange={e => setTags({ ...tags, title: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </STColumn>
            <STColumn width={1}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Artist</label>
                <input 
                  type="text"
                  value={tags.artist}
                  onChange={e => setTags({ ...tags, artist: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </STColumn>
          </STColumns>
          
          <STColumns>
            <STColumn width={1}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Album</label>
                <input 
                  type="text"
                  value={tags.album}
                  onChange={e => setTags({ ...tags, album: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </STColumn>
            <STColumn width={1}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Year / Date</label>
                <input 
                  type="text"
                  value={tags.date}
                  onChange={e => setTags({ ...tags, date: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </STColumn>
          </STColumns>
          
          {saveError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {saveError}
            </div>
          )}
          
          {saveSuccess && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 size={18} />
              {saveSuccess}
            </div>
          )}
          
          <Button 
            variant="primary" 
            onClick={handleSaveTags}
            disabled={isSaving || !filePath}
            className="w-full py-4 text-base font-medium shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-shadow"
          >
            <Save size={18} className="mr-2" />
            {isSaving ? "Writing metadata..." : "Save Media Tags"}
          </Button>
        </div>
      </STContainer>
    </div>
  );
}
