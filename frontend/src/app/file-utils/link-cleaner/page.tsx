"use client";

import React, { useState } from "react";

import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";
import { Header } from "@/components/ui/Header";

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-[var(--theme-ui-border)] pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Link Cleaner</h1>
            <p className="text-[var(--theme-text)] text-sm font-medium">Extract individual file links from master MEGA folders, filter by size, and remove duplicates automatically.</p>
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
        <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6 shadow-sm backdrop-blur-md flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-[var(--theme-ui-border)] pb-4">
          <label className="text-xs uppercase text-[var(--theme-text)] font-semibold tracking-wider">
            Target Links
          </label>
          <Button variant="secondary" size="sm" onClick={addLink} icon={<Icon name="add" size={14} />} className="h-8 text-xs">
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
                className="flex-1 rounded-lg px-4 py-2.5 text-sm text-white border focus:outline-none transition-colors font-mono"
                style={{ 
                  backgroundColor: "var(--theme-bg)",
                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              />
              <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-9 w-9 text-[var(--theme-text)] hover:text-white"
                  onClick={() => moveLink(idx, 'up')}
                  disabled={idx === 0}
                >
                  <Icon name="arrow_upward" size={16} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-9 w-9 text-[var(--theme-text)] hover:text-white"
                  onClick={() => moveLink(idx, 'down')}
                  disabled={idx === links.length - 1}
                >
                  <Icon name="arrow_downward" size={16} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => removeLink(idx)}
                >
                  <Icon name="delete" size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col gap-3 pt-4 border-t border-[var(--theme-ui-border)]">
          <label className="text-xs uppercase text-[var(--theme-text)] font-semibold tracking-wider">
            Filter Settings
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--theme-text)]">Max Image Size (MB)</label>
              <input
                type="number"
                value={maxImageSize}
                onChange={(e) => setMaxImageSize(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white border focus:outline-none transition-colors"
                min="0"
                style={{ 
                  backgroundColor: "var(--theme-bg)",
                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--theme-text)]">Max Video Size (MB)</label>
              <input
                type="number"
                value={maxVideoSize}
                onChange={(e) => setMaxVideoSize(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white border focus:outline-none transition-colors"
                min="0"
                style={{ 
                  backgroundColor: "var(--theme-bg)",
                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--theme-text)]">Max Other Size (MB)</label>
              <input
                type="number"
                value={maxOtherSize}
                onChange={(e) => setMaxOtherSize(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white border focus:outline-none transition-colors"
                min="0"
                style={{ 
                  backgroundColor: "var(--theme-bg)",
                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm">
            <Icon name="warning" className="shrink-0 mt-0.5" size={16} />
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
              <Icon name="bolt" size={18} />
              Clean Links
            </span>
          )}
        </Button>
      </div>

      {results && (
        <div className="flex flex-col gap-6 animate-slide-up mt-6">
          <ModernTabContent activeTab={activeTab}>
            {/* Summary Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6 shadow-sm backdrop-blur-md flex flex-col justify-center items-center gap-1">
                  <span className="text-sm text-[var(--theme-text)] uppercase tracking-wider font-semibold">Total Original Size</span>
                  <span className="text-3xl font-bold text-white">{formatBytes(totalOriginal)}</span>
              </div>
              <div className="bg-[var(--theme-bg)] border border-emerald-500/20 rounded-2xl p-6 shadow-sm backdrop-blur-md flex flex-col justify-center items-center gap-1">
                  <span className="text-sm text-emerald-500/80 uppercase tracking-wider font-semibold">Total Cleaned Size</span>
                  <span className="text-3xl font-bold text-emerald-400">{formatBytes(totalCleaned)}</span>
              </div>
            </div>

            {/* Per-Link Stats Table */}
            <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl overflow-hidden shadow-sm backdrop-blur-md mb-6">
              <div className="p-4 bg-[var(--theme-bg)]/80 border-b border-[var(--theme-ui-border)]">
                  <h3 className="font-semibold text-white">Folder Summary</h3>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-sm text-[var(--theme-text)]">
                      <thead className="bg-[var(--theme-bg)]/50 text-xs uppercase text-[var(--theme-text)] border-b border-[var(--theme-ui-border)]">
                          <tr>
                              <th className="px-4 py-3 font-medium">Link</th>
                              <th className="px-4 py-3 font-medium">Original Size</th>
                              <th className="px-4 py-3 font-medium">Cleaned Size</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--theme-ui-border)]">
                          {results.map((res, i) => (
                              <tr key={i} className="hover:bg-[var(--theme-bg)]/50 transition-colors">
                                  <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]" title={res.link}>
                                      {res.link}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">{res.error ? "-" : formatBytes(res.original_size_bytes)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-emerald-400">{res.error ? "-" : formatBytes(res.cleaned_size_bytes)}</td>
                                  <td className="px-4 py-3 max-w-[200px]">
                                      {res.error ? (
                                          <span className="text-red-400 flex items-center gap-1 text-xs"><Icon name="warning" size={12}/> {res.error}</span>
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
            <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl overflow-hidden shadow-sm backdrop-blur-md flex flex-col h-[500px]">
              
              <div className="flex-1 p-0 overflow-hidden relative">
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => {
                      const content = activeTab === 'raw' ? aggregatedRaw : activeTab === 'named' ? aggregatedNamed : aggregatedLogs;
                      navigator.clipboard.writeText(content);
                    }}
                    className="text-xs"
                  >
                    Copy All
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    icon={<Icon name="download" size={14} />}
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
                    className="text-xs"
                  >
                    Save File
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={activeTab === "raw" ? aggregatedRaw : activeTab === "named" ? aggregatedNamed : aggregatedLogs}
                  className="w-full h-full bg-[var(--theme-bg)] text-white font-mono text-xs p-4 focus:outline-none resize-none custom-scrollbar"
                />
              </div>
            </div>
          </ModernTabContent>
        </div>
      )}
      </div>
    </div>
  );
}
