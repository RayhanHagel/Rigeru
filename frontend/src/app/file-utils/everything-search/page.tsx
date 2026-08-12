"use client";

import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { FileExplorerModal } from '@/components/ui/FileExplorerModal';
import { Icon } from "@/lib/utils";

export default function EverythingSearchPage() {
    const [query, setQuery] = useState("");
    const [extension, setExtension] = useState("");
    const [searchPath, setSearchPath] = useState("");
    
    const [status, setStatus] = useState<"loading" | "ready" | "downloading" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");
    
    const [results, setResults] = useState<string[]>([]);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchError, setSearchError] = useState("");
    
    const [isExplorerOpen, setIsExplorerOpen] = useState(false);
    const [startingService, setStartingService] = useState(false);
    
    useEffect(() => {
        checkStatus();
    }, []);
    
    const checkStatus = async () => {
        setStatus("loading");
        try {
            const res = await fetch("/api/files-documents/everything/status");
            const data = await res.json();
            if (res.ok && data.status !== "error") {
                setStatus("ready");
            } else {
                setStatus("error");
                setErrorMsg(data.message || data.detail || "Unknown error occurred.");
            }
        } catch (e: any) {
            setStatus("error");
            setErrorMsg(e.message || "Failed to connect to backend");
        }
    };
    
    const handleStartService = async () => {
        setStartingService(true);
        try {
            const res = await fetch("/api/files-documents/everything/start", { method: "POST" });
            const data = await res.json();
            if (!res.ok || data.error) {
                alert(data.error || data.detail || "Failed to start service");
            } else {
                setSearchError(""); 
                alert("Everything service started successfully! Please wait a moment for it to initialize.");
            }
        } catch (e: any) {
            alert(e.message || "Failed to connect to backend");
        } finally {
            setStartingService(false);
        }
    };
    
    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim() && !extension.trim() && !searchPath.trim()) return;
        if (status !== "ready") return;
        
        setSearching(true);
        setSearchError("");
        setHasSearched(false);
        try {
            const res = await fetch("/api/files-documents/everything/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, extension, path: searchPath, max_results: 500 })
            });
            const data = await res.json();
            
            if (!res.ok || data.error) {
                const err = data.error || data.detail;
                console.error(err);
                setSearchError(err);
                setResults([]);
            } else {
                setResults(data.results || []);
                setHasSearched(true);
            }
        } catch (e) {
            console.error("Search failed", e);
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    return (
      <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
          <div className="flex items-center gap-0">
            
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Everything Search</h1>
              <p className="text-zinc-400 text-sm font-medium">Lightning-fast local file search powered by Everything CLI</p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            onClick={handleStartService} 
            disabled={startingService}
            icon={startingService ? <Icon name="progress_activity" size={16} className="animate-spin" /> : <Icon name="play_arrow" size={16} />}
          >
            Start Service
          </Button>
        </div>

        {status === "loading" && (
            <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/50 rounded-2xl border border-white/5">
                <Icon name="progress_activity" className="animate-spin text-secondary mb-4" size={32} />
                <p className="text-zinc-300">Checking Everything CLI installation</p>
            </div>
        )}

        {status === "error" && (
            <div className="flex flex-col items-center justify-center p-12 bg-red-500/10 rounded-2xl border border-red-500/20">
                <Icon name="error" className="text-red-400 mb-4" size={32} />
                <p className="text-red-300 font-medium mb-2">Failed to prepare Everything CLI</p>
                <p className="text-red-400/70 text-sm mb-6 max-w-lg text-center">{errorMsg}</p>
                <Button onClick={checkStatus} variant="secondary" icon={<Icon name="refresh" size={16} />}>Retry</Button>
            </div>
        )}

        {status === "ready" && (
            <div className="space-y-6">
                <form onSubmit={handleSearch} className="bg-zinc-900/40 p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl backdrop-blur-sm">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-8 flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Filename</label>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g. report, final_draft"
                                className="w-full bg-zinc-950/50 border border-white/10 rounded-xl p-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-secondary transition-all font-mono text-sm"
                                autoFocus
                            />
                        </div>
                        <div className="md:col-span-4 flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Extension</label>
                            <input
                                type="text"
                                value={extension}
                                onChange={(e) => setExtension(e.target.value)}
                                placeholder="e.g. pdf, png"
                                className="w-full bg-zinc-950/50 border border-white/10 rounded-xl p-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-secondary transition-all font-mono text-sm"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Search Path (Optional)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                                    <Icon name="folder" size={16} />
                                </div>
                                <input
                                    type="text"
                                    value={searchPath}
                                    onChange={(e) => setSearchPath(e.target.value)}
                                    placeholder="e.g. C:\Users\Rigeru\Downloads"
                                    className="w-full bg-zinc-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-secondary transition-all font-mono text-sm"
                                />
                            </div>
                            <Button type="button" variant="secondary" onClick={() => setIsExplorerOpen(true)}>
                                Browse
                            </Button>
                        </div>
                    </div>
                    
                    <div className="pt-2">
                        <Button type="submit" disabled={(!query.trim() && !extension.trim() && !searchPath.trim()) || searching} className="w-full">
                            {searching ? <Icon name="progress_activity" size={18} className="animate-spin mx-auto" /> : "Search Everything"}
                        </Button>
                    </div>
                </form>

                <div className="bg-zinc-900/30 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm min-h-[400px]">
                    {results.length > 0 ? (
                        <div className="overflow-auto max-h-[600px] custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-900/80 sticky top-0 backdrop-blur-md z-10 border-b border-white/5">
                                    <tr>
                                        <th className="py-3 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">File Path</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {results.map((res, i) => (
                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="py-3 px-6 flex items-center gap-3">
                                                <div className="text-zinc-600 group-hover:text-secondary transition-colors">
                                                    <Icon name="insert_drive_file" size={16} />
                                                </div>
                                                <span className="font-mono text-sm text-zinc-300 break-all select-all">{res}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[400px] text-zinc-500">
                            {searching ? (
                                <>
                                    <Icon name="progress_activity" size={32} className="animate-spin text-zinc-600 mb-4" />
                                    <p>Searching everywhere</p>
                                </>
                            ) : searchError ? (
                                <>
                                    <Icon name="error" size={48} className="text-red-500/50 mb-4" />
                                    <p className="text-lg text-red-400">Search Error</p>
                                    <p className="text-sm max-w-lg text-center">{searchError}</p>
                                    {searchError.includes("IPC") && (
                                        <Button onClick={handleStartService} variant="secondary" className="mt-4" icon={<Icon name="play_arrow" size={16} />}>Start Everything Service</Button>
                                    )}
                                </>
                            ) : hasSearched ? (
                                <>
                                    <Icon name="search" size={48} className="text-zinc-800 mb-4 opacity-50" />
                                    <p className="text-lg">No results found</p>
                                    <p className="text-sm">Try a different search term or extension</p>
                                </>
                            ) : (
                                <>
                                    <Icon name="hard_drive" size={48} className="text-zinc-800 mb-4 opacity-50" />
                                    <p className="text-lg">Ready to search</p>
                                    <p className="text-sm">Enter a query above to start searching</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {results.length > 0 && (
                    <div className="text-right text-xs text-zinc-500 mt-2">
                        Showing {results.length} results
                    </div>
                )}
            </div>
        )}
        
        <FileExplorerModal 
            isOpen={isExplorerOpen}
            onClose={() => setIsExplorerOpen(false)}
            onSelect={(path) => {
                setSearchPath(path);
                setIsExplorerOpen(false);
            }}
            title="Select Search Directory"
            selectionMode="folder"
        />
      </div>
    );
}
