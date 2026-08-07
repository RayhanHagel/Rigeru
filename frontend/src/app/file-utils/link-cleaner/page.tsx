"use client";

import React, { useState } from "react";
import { FolderArchive, Trash2, Plus, ArrowUp, ArrowDown, List, FileText, AlertTriangle, Zap, Download } from "lucide-react";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";

interface LinkResult {
  link: string;
  error: string | null;
  raw?: string;
  named?: string;
  logs?: string;
  original_size_bytes?: number;
  cleaned_size_bytes?: number;
}

export default function LinkCleanerPage() {
  const [links, setLinks] = useState<string[]>([""]);
  const [maxImageSize, setMaxImageSize] = useState(20);
  const [maxVideoSize, setMaxVideoSize] = useState(2000);
  const [maxOtherSize, setMaxOtherSize] = useState(200);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<LinkResult[] | null>(null);
  
  const [activeTab, setActiveTab] = useState<"raw" | "named" | "logs">("raw");

  const addLink = () => {
    setLinks([...links, ""]);
  };

  const updateLink = (index: number, value: string) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const removeLink = (index: number) => {
    if (links.length === 1) {
      setLinks([""]);
      return;
    }
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
  };

  const moveLink = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === links.length - 1) return;
    
    const newLinks = [...links];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newLinks[index];
    newLinks[index] = newLinks[targetIndex];
    newLinks[targetIndex] = temp;
    setLinks(newLinks);
  };

  const handleAnalyze = async () => {
    const validLinks = links.map(l => l.trim()).filter(l => l.length > 0);
    
    if (validLinks.length === 0) {
      setErrorMsg("Please enter at least one MEGA.nz folder link.");
      return;
    }
    
    setIsLoading(true);
    setErrorMsg("");
    setResults(null);
    
    try {
      const res = await fetch("/api/files-documents/mega-cleaner/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder_links: validLinks,
          max_image_size_mb: maxImageSize,
          max_video_size_mb: maxVideoSize,
          max_other_size_mb: maxOtherSize
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Failed to process folder");
      }
      
      setResults(data.results);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalOriginal = results?.reduce((acc, r) => acc + (r.original_size_bytes || 0), 0) || 0;
  const totalCleaned = results?.reduce((acc, r) => acc + (r.cleaned_size_bytes || 0), 0) || 0;

  // Aggregate tabs content
  const aggregatedRaw = results?.filter(r => !r.error && r.raw).map(r => r.raw).join("\n") || "";
  const aggregatedNamed = results?.filter(r => !r.error && r.named).map(r => r.named).join("\n") || "";
  const aggregatedLogs = results?.filter(r => !r.error && r.logs).map(r => `--- ${r.link} ---\n${r.logs}`).join("\n\n") || "";

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Link Cleaner</h1>
            <p className="text-zinc-400 text-sm font-medium">Extract individual file links from master MEGA folders, filter by size, and remove duplicates automatically.</p>
          </div>
        </div>
        {results && (
          <ModernTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab as (id: string) => void}
            tabs={[
              { id: "raw", label: "Raw Links" },
              { id: "named", label: "With Names" },
              { id: "logs", label: "Action Logs" }
            ]}
          />
        )}
      </div>

      <div className="flex flex-col gap-6 w-full">
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">
            Target Links
          </label>
          <Button variant="secondary" size="sm" onClick={addLink} icon={<Plus size={14} />} className="h-8 text-xs">
            Add Link
          </Button>
        </div>
        
        <div className="flex flex-col gap-3">
          {links.map((link, idx) => (
            <div key={idx} className="flex gap-2 items-center group">
              <input
                value={link}
                onChange={(e) => updateLink(idx, e.target.value)}
                placeholder="https://mega.nz/folder/ID#KEY"
                className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors font-mono"
              />
              <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-9 w-9 text-zinc-400 hover:text-white"
                  onClick={() => moveLink(idx, 'up')}
                  disabled={idx === 0}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-9 w-9 text-zinc-400 hover:text-white"
                  onClick={() => moveLink(idx, 'down')}
                  disabled={idx === links.length - 1}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => removeLink(idx)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
          <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">
            Filter Settings
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Max Image Size (MB)</label>
              <input
                type="number"
                value={maxImageSize}
                onChange={(e) => setMaxImageSize(parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                min="0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Max Video Size (MB)</label>
              <input
                type="number"
                value={maxVideoSize}
                onChange={(e) => setMaxVideoSize(parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                min="0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Max Other Size (MB)</label>
              <input
                type="number"
                value={maxOtherSize}
                onChange={(e) => setMaxOtherSize(parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                min="0"
              />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm">
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <p>{errorMsg}</p>
          </div>
        )}

        <Button 
          variant="primary" 
          onClick={handleAnalyze} 
          disabled={isLoading}
          className="w-full bg-red-600 hover:bg-red-700 py-3 mt-2"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Processing Folders
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap size={18} />
              Clean Links
            </span>
          )}
        </Button>
      </div>

      {results && (
        <div className="flex flex-col gap-6 animate-slide-up">
          {/* Summary Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col justify-center items-center gap-1">
                <span className="text-sm text-zinc-400 uppercase tracking-wider font-semibold">Total Original Size</span>
                <span className="text-3xl font-bold text-white">{formatBytes(totalOriginal)}</span>
            </div>
            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-sm flex flex-col justify-center items-center gap-1">
                <span className="text-sm text-emerald-500/80 uppercase tracking-wider font-semibold">Total Cleaned Size</span>
                <span className="text-3xl font-bold text-emerald-400">{formatBytes(totalCleaned)}</span>
            </div>
          </div>

          {/* Per-Link Stats Table */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-4 bg-zinc-900/80 border-b border-white/10">
                <h3 className="font-semibold text-white">Folder Summary</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="bg-zinc-950/50 text-xs uppercase text-zinc-500 border-b border-white/10">
                        <tr>
                            <th className="px-4 py-3 font-medium">Link</th>
                            <th className="px-4 py-3 font-medium">Original Size</th>
                            <th className="px-4 py-3 font-medium">Cleaned Size</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {results.map((res, i) => (
                            <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]" title={res.link}>
                                    {res.link}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">{res.error ? "-" : formatBytes(res.original_size_bytes)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-emerald-400">{res.error ? "-" : formatBytes(res.cleaned_size_bytes)}</td>
                                <td className="px-4 py-3 max-w-[200px]">
                                    {res.error ? (
                                        <span className="text-red-400 flex items-center gap-1 text-xs"><AlertTriangle size={12}/> {res.error}</span>
                                    ) : (
                                        <span className="text-emerald-400 text-xs">Success</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>

          {/* Aggregated Output */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm flex flex-col h-[500px]">
            
            <div className="flex-1 p-0 overflow-hidden relative">
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => {
                    const content = activeTab === 'raw' ? aggregatedRaw : activeTab === 'named' ? aggregatedNamed : aggregatedLogs;
                    navigator.clipboard.writeText(content);
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-xs border border-white/10"
                >
                  Copy All
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  icon={<Download size={14} />}
                  onClick={() => {
                    const content = activeTab === 'raw' ? aggregatedRaw : activeTab === 'named' ? aggregatedNamed : aggregatedLogs;
                    const blob = new Blob([content], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `mega_links_${activeTab}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-xs border border-white/10"
                >
                  Save File
                </Button>
              </div>
              <textarea
                readOnly
                value={activeTab === "raw" ? aggregatedRaw : activeTab === "named" ? aggregatedNamed : aggregatedLogs}
                className="w-full h-full bg-zinc-950 text-white font-mono text-xs p-4 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
