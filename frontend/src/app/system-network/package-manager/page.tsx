"use client";

import React, { useState, useEffect } from "react";
import { Package, Search, Download, Trash, RefreshCw, AlertTriangle, PlayCircle, Terminal } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STTabs } from "@/components/streamlit/STTabs";
import { Button } from "@/components/ui/Button";

type PackageInfo = {
  name: string;
  id: string;
  version: string;
  available?: string;
  source?: string;
  is_outdated?: boolean;
  new_version?: string;
};

export default function PackageManagerPage() {
  const [cache, setCache] = useState<{winget: PackageInfo[], scoop: PackageInfo[], choco: PackageInfo[]}>({ winget: [], scoop: [], choco: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string>("");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PackageInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Selected packages
  const [selectedWinget, setSelectedWinget] = useState<Set<string>>(new Set());
  const [selectedScoop, setSelectedScoop] = useState<Set<string>>(new Set());
  const [selectedChoco, setSelectedChoco] = useState<Set<string>>(new Set());

  const fetchCache = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/packages/cache");
      if (res.ok) {
        const data = await res.json();
        setCache(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCache();
  }, []);

  const triggerRevalidate = async () => {
    setIsProcessing(true);
    setLogs("Triggering background revalidation...");
    try {
      await fetch("http://127.0.0.1:8000/api/system/packages/revalidate", { method: "POST" });
      setLogs("Background revalidation started. It may take a few minutes. Check back later.");
      // Poll a few times
      setTimeout(fetchCache, 10000);
      setTimeout(fetchCache, 30000);
    } catch (e: any) {
      setLogs(`Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = async (pm: string, action: string, pkgs: string[]) => {
    if (pkgs.length === 0 && action !== "upgrade-all") return;
    setIsProcessing(true);
    setLogs(`Starting ${action} for ${pkgs.length} package(s) via ${pm}...`);
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/system/packages/${pm}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "upgrade-all" ? {} : { packages: pkgs })
      });
      
      const js = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(js.detail || `Failed to ${action}`);
      }
      setLogs(`Success:\n${js.message}`);
      
      // Clear selections
      if (pm === "winget") setSelectedWinget(new Set());
      if (pm === "scoop") setSelectedScoop(new Set());
      if (pm === "choco") setSelectedChoco(new Set());
      
      // Auto revalidate
      triggerRevalidate();
    } catch (e: any) {
      setLogs(`Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearch = async (pm: string) => {
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchResults([]);
    setLogs(`Searching ${pm} for '${searchQuery}'...`);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/system/packages/${pm}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery })
      });
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Search failed");
      }
      const data = await res.json();
      setSearchResults(data.results || []);
      setLogs(`Found ${data.results.length} results.`);
    } catch (e: any) {
      setLogs(`Error: ${e.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const renderPMTab = (pm: string, pkgs: PackageInfo[], selected: Set<string>, setSelected: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const toggleSelect = (id: string) => {
      const newSet = new Set(selected);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelected(newSet);
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">{pkgs.length} Installed Packages</h3>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={fetchCache} icon={<RefreshCw size={16} />}>Refresh Cache</Button>
            <Button 
              variant="primary" 
              onClick={async () => {
                if (pm === "scoop") {
                  setIsProcessing(true);
                  setLogs("Renewing Scoop lists (scoop update)...");
                  try {
                    await fetch("http://127.0.0.1:8000/api/system/packages/scoop/update-manager", { method: "POST" });
                  } catch (e: any) {
                    setLogs(`Scoop update failed: ${e.message}`);
                  }
                  setIsProcessing(false);
                }
                triggerRevalidate();
              }} 
              disabled={isProcessing} 
              icon={<RefreshCw size={16} />}
            >
              Renew Lists & Check Updates
            </Button>
          </div>
        </div>

        {/* Batch Actions */}
        {selected.size > 0 && (
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
            <span className="text-indigo-300 font-medium">{selected.size} package(s) selected</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleAction(pm, "update", Array.from(selected))} disabled={isProcessing} icon={<RefreshCw size={16} />}>
                Update
              </Button>
              <Button variant="danger" onClick={() => handleAction(pm, "uninstall", Array.from(selected))} disabled={isProcessing} icon={<Trash size={16} />}>
                Uninstall
              </Button>
            </div>
          </div>
        )}

        {/* Upgrade All */}
        <div className="flex gap-2 mb-4">
          <Button variant="secondary" onClick={() => handleAction(pm, "upgrade-all", [])} disabled={isProcessing} className="w-full" icon={<RefreshCw size={16} />}>
            Upgrade ALL {pm} Packages
          </Button>
        </div>

        {/* Package List */}
        <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900 text-zinc-400 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 font-medium w-10">
                  <input 
                    type="checkbox" 
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(pkgs.map(p => p.id)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                    checked={selected.size === pkgs.length && pkgs.length > 0}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pkgs.map((p, i) => (
                <tr key={`${p.id}-${i}`} className="hover:bg-zinc-800/50">
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                  </td>
                  <td className="px-4 py-2 font-medium text-zinc-200">{p.name}</td>
                  <td className="px-4 py-2 text-zinc-400">{p.id}</td>
                  <td className="px-4 py-2 text-zinc-300">{p.version}</td>
                  <td className="px-4 py-2">
                    {p.is_outdated ? (
                      <span className="text-amber-400 text-xs font-medium flex items-center gap-1">
                        <AlertTriangle size={12} /> Updatable to {p.new_version || p.available}
                      </span>
                    ) : (
                      <span className="text-emerald-400 text-xs font-medium">Up to date</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.is_outdated && (
                      <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => handleAction(pm, "update", [p.id])} 
                        disabled={isProcessing}
                        className="py-1 px-2 text-xs"
                      >
                        Update
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {pkgs.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No packages found in cache. Try revalidating.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Search & Install */}
        <STContainer title={`Install new ${pm} package`} icon={<Search size={18} className="text-indigo-400"/>}>
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search package name..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
            />
            <Button variant="secondary" onClick={() => handleSearch(pm)} disabled={isSearching || !searchQuery} className="px-6">
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-900 text-zinc-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {searchResults.map((r, i) => (
                    <tr key={i} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-2 font-medium text-zinc-200">{r.name}</td>
                      <td className="px-4 py-2 text-zinc-400">{r.id}</td>
                      <td className="px-4 py-2">
                        <Button variant="primary" size="sm" onClick={() => handleAction(pm, "install", [r.id])} disabled={isProcessing}>
                          Install
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </STContainer>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in flex flex-col md:flex-row gap-6">
      <div className="flex-1 space-y-6">
        <div>
          <STHeader title="📦 Universal Package Manager" />
          <p className="text-zinc-400 mt-2">
            Search, install, and manage your Windows software from a single interface.
          </p>
        </div>

        <STTabs tabs={[`💻 Winget`, `🍦 Scoop`, `🍫 Chocolatey`]}>
          <div>
            {renderPMTab("winget", cache.winget, selectedWinget, setSelectedWinget)}
          </div>
          <div>
            {renderPMTab("scoop", cache.scoop, selectedScoop, setSelectedScoop)}
          </div>
          <div>
            {renderPMTab("choco", cache.choco, selectedChoco, setSelectedChoco)}
          </div>
        </STTabs>
      </div>
      
      {/* Sidebar Terminal Logs */}
      <div className="w-full md:w-80 flex flex-col space-y-4">
        <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden h-full min-h-[400px] flex flex-col">
          <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex items-center gap-2">
            <Terminal size={16} className="text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">Terminal Log</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 bg-black text-green-400 font-mono text-xs whitespace-pre-wrap">
            {logs || "Ready."}
          </div>
        </div>
      </div>
    </div>
  );
}
