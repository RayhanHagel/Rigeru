"use client";
import { Header } from "@/components/ui/Header";

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
        <Header 
          title="Everything Search" 
          subtitle="Lightning-fast local file search powered by Everything CLI" 
          actions={
            <Button 
              variant="secondary" 
              onClick={handleStartService} 
              disabled={startingService}
              icon={startingService ? <Icon name="progress_activity" size={16} className="animate-spin" /> : <Icon name="play_arrow" size={16} />}
            >
              Start Service
            </Button>
          }
        />

        {status === "loading" && (
            <div className="flex flex-col items-center justify-center p-12 bg-[var(--theme-ui-bg)] rounded-2xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md">
                <Icon name="progress_activity" className="animate-spin text-[var(--theme-heading)] mb-4" size={32} />
                <p className="text-[var(--theme-text)]">Checking Everything CLI installation</p>
            </div>
        )}

        {status === "error" && (
            <div className="flex flex-col items-center justify-center p-12 bg-red-500/10 rounded-2xl border border-red-500/20 shadow-sm backdrop-blur-md">
                <Icon name="error" className="text-red-400 mb-4" size={32} />
                <p className="text-red-300 font-medium mb-2">Failed to prepare Everything CLI</p>
                <p className="text-red-400/70 text-sm mb-6 max-w-lg text-center">{errorMsg}</p>
                <Button onClick={checkStatus} variant="secondary" icon={<Icon name="refresh" size={16} />}>Retry</Button>
            </div>
        )}

        {status === "ready" && (
            <div className="space-y-6">
                <form onSubmit={handleSearch} className="bg-[var(--theme-ui-bg)] p-6 rounded-2xl border border-[var(--theme-ui-border)] space-y-4 shadow-sm backdrop-blur-md">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-8 flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider ml-1">Filename</label>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g. report, final_draft"
                                className="w-full rounded-xl p-3 text-[var(--theme-text)] border focus:outline-none transition-colors font-mono text-sm"
                                autoFocus
                                style={{ 
                                  backgroundColor: "var(--theme-bg)",
                                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                            />
                        </div>
                        <div className="md:col-span-4 flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider ml-1">Extension</label>
                            <input
                                type="text"
                                value={extension}
                                onChange={(e) => setExtension(e.target.value)}
                                placeholder="e.g. pdf, png"
                                className="w-full rounded-xl p-3 text-[var(--theme-text)] border focus:outline-none transition-colors font-mono text-sm"
                                style={{ 
                                  backgroundColor: "var(--theme-bg)",
                                  borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider ml-1">Search Path (Optional)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--theme-text)]">
                                    <Icon name="folder" size={16} />
                                </div>
                                <input
                                    type="text"
                                    value={searchPath}
                                    onChange={(e) => setSearchPath(e.target.value)}
                                    placeholder="e.g. C:\Users\Rigeru\Downloads"
                                    className="w-full rounded-xl py-3 pl-10 pr-4 text-[var(--theme-text)] border focus:outline-none transition-colors font-mono text-sm"
                                    style={{ 
                                      backgroundColor: "var(--theme-bg)",
                                      borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                                    }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                                />
                            </div>
                            <Button type="button" variant="secondary" onClick={() => setIsExplorerOpen(true)}>
                                Browse
                            </Button>
                        </div>
                    </div>
                    
                    <div className="pt-2">
                        <Button variant="primary" type="submit" disabled={(!query.trim() && !extension.trim() && !searchPath.trim()) || searching} className="w-full">
                            {searching ? <Icon name="progress_activity" size={18} className="animate-spin mx-auto" /> : "Search Everything"}
                        </Button>
                    </div>
                </form>

                <div className="bg-[var(--theme-ui-bg)] rounded-2xl border border-[var(--theme-ui-border)] overflow-hidden backdrop-blur-sm min-h-[400px]">
                    {results.length > 0 ? (
                        <div className="overflow-auto max-h-[600px] custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[var(--theme-bg)]/80 sticky top-0 backdrop-blur-md z-10 border-b border-[var(--theme-ui-border)]">
                                    <tr>
                                        <th className="py-3 px-6 text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider">File Path</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--theme-ui-border)]">
                                    {results.map((res, i) => (
                                        <tr key={i} className="hover:bg-[var(--theme-bg)]/50 transition-colors group">
                                            <td className="py-3 px-6 flex items-center gap-3">
                                                <div className="text-[var(--theme-text)] group-hover:text-[var(--theme-heading)] transition-colors">
                                                    <Icon name="insert_drive_file" size={16} />
                                                </div>
                                                <span className="font-mono text-sm text-[var(--theme-text)] break-all select-all">{res}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[400px] text-[var(--theme-text)]">
                            {searching ? (
                                <>
                                    <Icon name="progress_activity" size={32} className="animate-spin text-[var(--theme-text)] mb-4" />
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
                                    <Icon name="search" size={48} className="text-[var(--theme-text)] mb-4 opacity-50" />
                                    <p className="text-lg text-[var(--theme-heading)]">No results found</p>
                                    <p className="text-sm text-[var(--theme-text)]">Try a different search term or extension</p>
                                </>
                            ) : (
                                <>
                                    <Icon name="hard_drive" size={48} className="text-[var(--theme-text)] mb-4 opacity-50" />
                                    <p className="text-lg text-[var(--theme-heading)]">Ready to search</p>
                                    <p className="text-sm text-[var(--theme-text)]">Enter a query above to start searching</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {results.length > 0 && (
                    <div className="text-right text-xs text-[var(--theme-text)] mt-2">
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
