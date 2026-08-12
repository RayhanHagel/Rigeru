"use client";

import React, { useState, useEffect } from "react";

import { Header } from "@/components/ui/Header";
import { Container } from "@/components/ui/Container";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

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
  const [activeTab, setActiveTab] = useState("winget");
  
  // Search state for installed packages
  const [installedSearchQuery, setInstalledSearchQuery] = useState("");
  
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

  const hasInitialized = React.useRef(false);
  const terminalContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    fetchCache().then(() => {
      const lastFetch = localStorage.getItem("lastPackageFetchDate");
      const today = new Date().toDateString();
      
      if (lastFetch !== today) {
        triggerRevalidate().then(() => {
          localStorage.setItem("lastPackageFetchDate", today);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerRevalidate = async () => {
    setIsProcessing(true);
    setLogs("Starting package list revalidation. This may take a few minutes...\n");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/packages/revalidate", { method: "POST" });
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Revalidation failed");
      }
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body stream");
      const decoder = new TextDecoder("utf-8");
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setLogs(prev => prev + chunk);
      }
      
      setLogs(prev => prev + "\nRevalidation completed successfully.\n");
      await fetchCache();
    } catch (e: any) {
      setLogs(prev => prev + `\nError: ${e.message}\n`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = async (pm: string, action: string, pkgs: string[]) => {
    if (pkgs.length === 0 && action !== "upgrade-all") return;
    setIsProcessing(true);
    setLogs(`Starting ${action} for ${pkgs.length} package(s) via ${pm}...\n`);
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/system/packages/${pm}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "upgrade-all" ? {} : { packages: pkgs })
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || `Failed to ${action}`);
      }
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body stream");
      const decoder = new TextDecoder("utf-8");
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setLogs(prev => prev + chunk);
      }
      
      setLogs(prev => prev + `\nSuccess: ${action} completed.\n`);
      
      if (action === "update" || action === "upgrade-all") {
        alert("Application(s) have been successfully updated!");
      } else if (action === "uninstall") {
        alert("Application(s) have been successfully uninstalled!");
      } else if (action === "install") {
        alert("Application(s) have been successfully installed!");
      } else {
        alert(`Success: ${action} completed.`);
      }
      
      // Clear selections
      if (pm === "winget") setSelectedWinget(new Set());
      if (pm === "scoop") setSelectedScoop(new Set());
      if (pm === "choco") setSelectedChoco(new Set());
      
      // Auto revalidate
      triggerRevalidate();
    } catch (e: any) {
      setLogs(prev => prev + `\nError: ${e.message}\n`);
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

    const filteredPkgs = pkgs.filter(p => 
      p.name.toLowerCase().includes(installedSearchQuery.toLowerCase()) || 
      p.id.toLowerCase().includes(installedSearchQuery.toLowerCase())
    );

    return (
      <div className="w-full h-full relative z-10 overflow-y-auto animate-slide-up flex flex-col gap-8 font-sans">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">{pkgs.length} Installed Packages</h3>
          <div className="flex gap-2">
            <Button 
              variant="primary" 
              onClick={async () => {
                if (pm === "scoop") {
                  setIsProcessing(true);
                  setLogs("Renewing Scoop lists (scoop update)...\n");
                  try {
                    const res = await fetch("http://127.0.0.1:8000/api/system/packages/scoop/update-manager", { method: "POST" });
                    if (res.ok) {
                      const reader = res.body?.getReader();
                      if (reader) {
                        const decoder = new TextDecoder("utf-8");
                        while (true) {
                          const { done, value } = await reader.read();
                          if (done) break;
                          setLogs(prev => prev + decoder.decode(value, { stream: true }));
                        }
                      }
                    } else {
                      const js = await res.json().catch(() => ({}));
                      throw new Error(js.detail || "Failed to update scoop");
                    }
                  } catch (e: any) {
                    setLogs(prev => prev + `Scoop update failed: ${e.message}\n`);
                  }
                  setIsProcessing(false);
                }
                triggerRevalidate();
              }} 
              disabled={isProcessing} 
              icon={<Icon name="refresh" size={16} />}
            >
              Force Fetch Updates
            </Button>
          </div>
        </div>

        {/* Search for Installed Packages & Batch Actions */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              value={installedSearchQuery}
              onChange={e => setInstalledSearchQuery(e.target.value)}
              placeholder="Search installed packages..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-3 text-white focus:outline-none focus:border-secondary"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => handleAction(pm, "upgrade-all", [])} disabled={isProcessing} icon={<Icon name="refresh" size={16} />}>
              Upgrade ALL
            </Button>
            {selected.size > 0 && (
              <>
                <Button variant="primary" onClick={() => handleAction(pm, "update", Array.from(selected))} disabled={isProcessing} icon={<Icon name="refresh" size={16} />}>
                  Update Selected ({selected.size})
                </Button>
                <Button variant="danger" onClick={() => handleAction(pm, "uninstall", Array.from(selected))} disabled={isProcessing} icon={<Icon name="delete" size={16} />}>
                  Uninstall Selected ({selected.size})
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Package List Grid */}
        <div className="bg-zinc-950/50 rounded-xl overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                className="w-4 h-4 accent-indigo-500"
                onChange={(e) => {
                  if (e.target.checked) {
                    const upgradable = filteredPkgs.filter(p => p.is_outdated);
                    setSelected(new Set(upgradable.map(p => p.id)));
                  } else {
                    setSelected(new Set());
                  }
                }}
                checked={
                  filteredPkgs.filter(p => p.is_outdated).length > 0 &&
                  filteredPkgs.filter(p => p.is_outdated).every(p => selected.has(p.id))
                }
                disabled={filteredPkgs.filter(p => p.is_outdated).length === 0}
              />
              <span className="text-sm font-medium text-zinc-400">Select All (Upgradable)</span>
            </div>
            <span className="text-sm text-zinc-500">Showing {filteredPkgs.length} packages</span>
          </div>

          <div className="p-4 max-h-[500px] overflow-y-auto custom-scrollbar">
            {filteredPkgs.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">
                {isLoading ? "Loading packages..." : "No packages found."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPkgs.map((p, i) => {
                  const isSelected = selected.has(p.id);
                  return (
                  <div 
                    key={`${p.id}-${i}`} 
                    onClick={() => toggleSelect(p.id)}
                    className={`bg-zinc-900 border transition-all rounded-xl p-4 flex flex-col gap-3 cursor-pointer ${
                      isSelected ? 'border-secondary shadow-[0_0_10px] shadow-secondary/20' : (
                        p.is_outdated ? 'border-primary/40 shadow-[0_0_5px] shadow-primary/20' : 'border-white/5 hover:border-secondary/30'
                      )
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0 transition-colors">
                        {isSelected ? (
                          <Icon name="check_circle" size={18} className="text-secondary" />
                        ) : (
                          <Icon name="circle" size={18} className="text-zinc-600 hover:text-zinc-400 transition-colors" />
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden w-full">
                        <div className="flex justify-between items-start w-full gap-2">
                          <span className="font-medium text-zinc-100 truncate" title={p.name}>{p.name}</span>
                          <span className="text-xs text-zinc-300 font-mono bg-black/30 px-2 py-0.5 rounded whitespace-nowrap">{p.version}</span>
                        </div>
                        <span className="text-xs text-zinc-500 truncate mt-0.5" title={p.id}>{p.id}</span>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>

        {/* Search & Install */}
        <Container title={`Install new ${pm} package`} icon={<Icon name="search" size={18} className="text-secondary"/>}>
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search package name..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary"
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
        </Container>
      </div>
    );
  };

  return (
    <div className="p-6 w-full h-full space-y-8 animate-in fade-in flex flex-col gap-6">
      <div className="w-full space-y-6">
        <Header title="Universal Package Manager" subtitle="Search, install, and manage your Windows software from a single interface." />

        <ModernTabs 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={[
            { id: 'winget', label: 'Winget', icon: '💻 ' },
            { id: 'scoop', label: 'Scoop', icon: '🍦 ' },
            { id: 'choco', label: 'Chocolatey', icon: '🍫 ' }
          ]} 
        />
        <ModernTabContent activeTab={activeTab}>
          {activeTab === 'winget' && (
            <div>
              {renderPMTab("winget", cache.winget, selectedWinget, setSelectedWinget)}
            </div>
          )}
        </ModernTabContent>
        <ModernTabContent activeTab={activeTab}>
          {activeTab === 'scoop' && (
            <div>
              {renderPMTab("scoop", cache.scoop, selectedScoop, setSelectedScoop)}
            </div>
          )}
        </ModernTabContent>
        <ModernTabContent activeTab={activeTab}>
          {activeTab === 'choco' && (
            <div>
              {renderPMTab("choco", cache.choco, selectedChoco, setSelectedChoco)}
            </div>
          )}
        </ModernTabContent>
      </div>
      
      {/* Bottom Terminal Logs */}
      <div className="w-full flex flex-col space-y-4">
        <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden min-h-[300px] flex flex-col">
          <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex items-center gap-2">
            <Icon name="terminal" size={16} className="text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">Terminal Log</span>
          </div>
          <div 
            ref={terminalContainerRef}
            className="p-4 overflow-y-auto flex-1 bg-black text-green-400 font-mono text-xs whitespace-pre-wrap max-h-[400px]"
          >
            {logs || "Ready."}
          </div>
        </div>
      </div>
    </div>
  );
}
