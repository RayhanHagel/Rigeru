"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Icon } from "@/lib/utils";

type MalItem = {
  title: string;
  image_url: string;
  url: string;
  status: string;
  episodes_total?: number;
  episodes_watched?: number;
  chapters_total?: number;
  chapters_read?: number;
};

type LibraryData = Record<string, MalItem>;

function MalSyncContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authCode = searchParams.get("code");

  const { malGridSize } = useSettingsStore();

  // State: Sidebar Controls
  const [mediaType, setMediaType] = useState<"anime" | "manga">("anime");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All Titles");
  const [sortBy, setSortBy] = useState("Title (A-Z)");

  // State: Main Tabs
  const [activeTab, setActiveTab] = useState<"library" | "sync" | "settings">("library");
  
  // State: Data
  const [library, setLibrary] = useState<LibraryData>({});
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isSavingCreds, setIsSavingCreds] = useState(false);

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch("/api/media-entertainment/malsync/auth/status");
      const data = await res.json();
      setIsLoggedIn(data.is_logged_in);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLibrary = async () => {
    try {
      const res = await fetch(`/api/media-entertainment/malsync/library/${mediaType}`);
      const data = await res.json();
      setLibrary(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCredentials = async () => {
    try {
      const res = await fetch("/api/media-entertainment/malsync/credentials");
      const data = await res.json();
      setClientId(data.client_id || "");
      setClientSecret(data.client_secret || "");
    } catch (e) {
      console.error(e);
    }
  };

  // Auth interceptor
  useEffect(() => {
    if (authCode) {
      setIsAuthLoading(true);
      fetch("/api/media-entertainment/malsync/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: authCode })
      })
      .then(res => res.json())
      .then(data => {
        router.replace("/entertainment-reading/malsync"); // Clear URL
        setIsLoggedIn(true);
      })
      .catch(console.error)
      .finally(() => setIsAuthLoading(false));
    }
  }, [authCode, router]);

  useEffect(() => {
    fetchAuthStatus();
    fetchCredentials();
  }, []);

  useEffect(() => {
    if (activeTab === "library") {
      fetchLibrary();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, mediaType]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/media-entertainment/malsync/sync", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message || "Synced successfully!");
        fetchLibrary(); // Refresh library
      } else {
        setSyncMessage(`Error: ${data.detail}`);
      }
    } catch (e) {
      setSyncMessage("Network error during sync.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/media-entertainment/malsync/auth/url");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Please configure your Client ID in the settings first.");
      }
    } catch (e) {
      alert("Failed to get auth URL. Check settings.");
    }
  };

  const saveCredentials = async () => {
    if (!clientId.trim()) {
      alert("Client ID is required.");
      return;
    }
    setIsSavingCreds(true);
    try {
      await fetch("/api/media-entertainment/malsync/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() })
      });
      alert("Credentials saved successfully!");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingCreds(false);
    }
  };

  const updateProgress = async (malId: string, currentProg: number, delta: number) => {
    const newProg = Math.max(0, currentProg + delta);
    try {
      await fetch(`/api/media-entertainment/malsync/progress/${mediaType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mal_id: malId, progress: newProg })
      });
      fetchLibrary(); // Refresh
    } catch (e) {
      console.error(e);
    }
  };

  const removeItem = async (malId: string) => {
    try {
      await fetch(`/api/media-entertainment/malsync/library/${mediaType}/${malId}`, {
        method: "DELETE"
      });
      fetchLibrary(); // Refresh
    } catch (e) {
      console.error(e);
    }
  };

  // Processing Library Items
  let libItems = Object.entries(library);
  
  if (searchQuery) {
    libItems = libItems.filter(([, data]) => data.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }
  
  if (filterStatus !== "All Titles") {
    libItems = libItems.filter(([, data]) => data.status === filterStatus);
  }

  const progKey = mediaType === "anime" ? "episodes_watched" : "chapters_read";
  if (sortBy === "Title (A-Z)") {
    libItems.sort((a, b) => a[1].title.localeCompare(b[1].title));
  } else if (sortBy === "Title (Z-A)") {
    libItems.sort((a, b) => b[1].title.localeCompare(a[1].title));
  } else if (sortBy === "Progress (High to Low)") {
    libItems.sort((a, b) => ((b[1] as any)[progKey] || 0) - ((a[1] as any)[progKey] || 0));
  } else if (sortBy === "Progress (Low to High)") {
    libItems.sort((a, b) => ((a[1] as any)[progKey] || 0) - ((b[1] as any)[progKey] || 0));
  }

  const activeStatusLabel = mediaType === "anime" ? "Watching" : "Reading";
  const planStatusLabel = mediaType === "anime" ? "Plan to Watch" : "Plan to Read";
  const filterOptions = ["All Titles", activeStatusLabel, "Completed", "On Hold", "Dropped", planStatusLabel];

  const getStatusColor = (status: string) => {
    switch(status) {
      case "Completed": return "#198754";
      case "Dropped": return "#dc3545";
      case "On Hold": return "#ffc107";
      case "Plan to Watch":
      case "Plan to Read": return "#6c757d";
      default: return "#0d6efd";
    }
  };

  // Dynamic Grid Style based on slider
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${malGridSize}, minmax(0, 1fr))`,
    gap: '1.5rem'
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Local MAL Tracker</h1>
            <p className="text-zinc-400 text-sm font-medium">Track your watching and reading progress locally and sync directly with your MAL account.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab as (id: string) => void}
            tabs={[
              { id: "library", label: "My Library" },
              { id: "settings", label: "Settings & Sync" }
            ]}
          />
        </div>
      </div>

      {isAuthLoading && (
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-3 text-purple-300">
          <Icon name="refresh" size={20} className="animate-spin" />
          <span>Exchanging code for access token...</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          TAB 1 — Personal Library
          ───────────────────────────────────────────── */}
      <ModernTabContent activeTab={activeTab}>
          {activeTab === "library" && (
                  <div className="flex flex-col gap-6">
                    {/* Controls Bar at the Top */}
                    <div className="flex flex-col lg:flex-row gap-4 p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                      <div className="flex bg-zinc-900 rounded-md p-1 border border-white/10 shrink-0">
                        <button 
                          className={`px-6 py-1.5 text-sm rounded-sm transition-colors flex items-center gap-2 ${mediaType === "anime" ? "bg-primary/20 text-primary font-medium" : "text-zinc-400 hover:text-white"}`}
                          onClick={() => { setMediaType("anime"); setFilterStatus("All Titles"); }}
                        >
                          <Icon name="smart_display" size={16} /> Anime
                        </button>
                        <button 
                          className={`px-6 py-1.5 text-sm rounded-sm transition-colors flex items-center gap-2 ${mediaType === "manga" ? "bg-primary/20 text-primary font-medium" : "text-zinc-400 hover:text-white"}`}
                          onClick={() => { setMediaType("manga"); setFilterStatus("All Titles"); }}
                        >
                          <Icon name="menu_book" size={16} /> Manga
                        </button>
                      </div>
                      
                      <div className="flex-1 relative">
                        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                        <input
                          type="text"
                          placeholder="Search Title..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-md pl-10 pr-4 py-2 text-white focus:border-primary outline-none text-sm h-full"
                        />
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-white outline-none text-sm focus:border-primary">
                          {filterOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-white outline-none text-sm focus:border-primary">
                          <option value="Title (A-Z)">Title (A-Z)</option>
                          <option value="Title (Z-A)">Title (Z-A)</option>
                          <option value="Progress (High to Low)">Progress (High to Low)</option>
                          <option value="Progress (Low to High)">Progress (Low to High)</option>
                        </select>
                      </div>
                    </div>

                    {Object.keys(library).length === 0 ? (
                      <div className="bg-zinc-900/50 border border-secondary/30 text-blue-300 p-4 rounded-md flex items-start gap-3 mt-4">
                        <Icon name="error" size={20} className="shrink-0 mt-0.5" />
                        <p>Your {mediaType} library is empty. Go to the Sync tab to pull your data!</p>
                      </div>
                    ) : libItems.length === 0 ? (
                      <div className="bg-zinc-900/50 border border-amber-500/30 text-amber-300 p-4 rounded-md flex items-start gap-3 mt-4">
                        <Icon name="error" size={20} className="shrink-0 mt-0.5" />
                        <p>No titles found matching your search or filter criteria.</p>
                      </div>
                    ) : (
                      <div style={gridStyle}>
                        {libItems.map(([malId, item]) => {
                          const currentProg = (mediaType === "anime" ? item.episodes_watched : item.chapters_read) || 0;
                          const totalProg = (mediaType === "anime" ? item.episodes_total : item.chapters_total) || 0;
                          const progLabel = mediaType === "anime" ? "Ep" : "Ch";
                          
                          return (
                            <div key={malId} className="flex flex-col border border-white/10 rounded-lg overflow-hidden bg-zinc-900/30 shadow-md group relative">
                              <div className="w-full aspect-[2/3] bg-zinc-950 flex items-center justify-center overflow-hidden relative">
                                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                
                                {/* Hover Trash Button */}
                                <button
                                  onClick={(e) => { e.preventDefault(); removeItem(malId); }}
                                  className="absolute top-2 left-2 p-1.5 bg-black/60 backdrop-blur-md rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/20 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
                                  title="Remove from Library"
                                >
                                  <Icon name="delete" size={14} />
                                </button>

                                {/* Status Badge */}
                                <div 
                                  style={{ backgroundColor: getStatusColor(item.status) }}
                                  className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold uppercase tracking-wider text-white border border-white/10"
                                >
                                  {item.status}
                                </div>
                              </div>
                              
                              <div className="p-4 flex flex-col flex-1">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:text-primary line-clamp-2 min-h-[40px] text-center" title={item.title}>
                                  {item.title}
                                </a>
                                
                                <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5 gap-2 h-12">
                                  <button 
                                    onClick={() => updateProgress(malId, currentProg, -1)}
                                    className="p-1 rounded-md text-zinc-500 hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                                    title="Decrease progress"
                                  >
                                    <Icon name="remove" size={14} />
                                  </button>
                                  <span className="text-xs font-mono font-medium text-primary bg-primary/10 px-2 py-1 rounded-md whitespace-nowrap text-center overflow-hidden text-ellipsis flex-1">
                                    {currentProg} / {totalProg > 0 ? totalProg : "?"}
                                  </span>
                                  <button 
                                    onClick={() => updateProgress(malId, currentProg, 1)}
                                    className="p-1 rounded-md text-zinc-500 hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                                    title="Increase progress"
                                  >
                                    <Icon name="add" size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
          </ModernTabContent>

      {/* ─────────────────────────────────────────────
          TAB 2 — Settings & Sync
          ───────────────────────────────────────────── */}
      <ModernTabContent activeTab={activeTab}>
          {activeTab === "settings" && (
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    
                    {/* Sync Section */}
                    <div className="w-full lg:w-1/2 bg-zinc-900/40 border border-white/5 rounded-xl p-8">
                      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">Sync via OAuth</h2>
                      {!clientId ? (
                        <div className="bg-zinc-900/50 border border-amber-500/30 text-amber-300 p-4 rounded-md flex items-start gap-3">
                          <Icon name="error" size={20} className="shrink-0 mt-0.5" />
                          <p>Please configure your MyAnimeList Client ID below first.</p>
                        </div>
                      ) : !isLoggedIn ? (
                        <div className="text-center">
                          <div className="bg-zinc-900/50 border border-amber-500/30 text-amber-300 p-4 rounded-md flex justify-center items-center gap-3 mb-6 mx-auto w-fit">
                            <Icon name="link" size={20} className="shrink-0" />
                            <p>You are not connected to MyAnimeList.</p>
                          </div>
                          <Button variant="primary" onClick={handleLogin} icon={<Icon name="login" size={18} />} className="w-full max-w-md py-6 text-lg">
                            Login with MyAnimeList
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="bg-zinc-900/50 border border-emerald-500/30 text-emerald-400 p-4 rounded-md flex justify-center items-center gap-3 mb-6 mx-auto w-fit">
                            <Icon name="link" size={20} className="shrink-0" />
                            <p>Linked to MyAnimeList via OAuth2.</p>
                          </div>
                          <p className="text-zinc-300 mb-6">Pull your latest Anime and Manga lists directly from your account.</p>
                          
                          {syncMessage && (
                            <div className={`p-4 rounded-md mb-6 border w-fit mx-auto ${syncMessage.includes("Error") ? "bg-zinc-900/50 border-red-500/30 text-red-400" : "bg-zinc-900/50 border-emerald-500/30 text-emerald-400"}`}>
                              {syncMessage}
                            </div>
                          )}
                          
                          <Button variant="primary" onClick={handleSync} isLoading={isSyncing} icon={<Icon name="refresh" size={18} />} className="w-full max-w-md py-6 text-lg">
                            Sync Data from MAL
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Settings Section */}
                    <div className="w-full lg:w-1/2 bg-zinc-900/40 border border-white/5 rounded-xl p-8">
                      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">API Configuration</h2>
                      <div className="mb-6 text-zinc-300 leading-relaxed">
                        <p>To connect to MyAnimeList, you need an API Client.</p>
                        <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm">
                          <li>Go to <a href="https://myanimelist.net/apiconfig" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MAL API Settings</a></li>
                          <li>Create a New Client (App Type: Web)</li>
                          <li>Set Redirect URL to <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-sm text-primary">http://localhost:3000/entertainment-reading/malsync</code></li>
                        </ol>
                      </div>
                      
                      <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-6">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-zinc-300 mb-2">Client ID</label>
                          <input 
                            type="password"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-white focus:border-primary outline-none" 
                          />
                        </div>
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-zinc-300 mb-2">Client Secret (Optional)</label>
                          <input 
                            type="password" 
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-white focus:border-primary outline-none" 
                          />
                        </div>
                        
                        <Button variant="primary" onClick={saveCredentials} isLoading={isSavingCreds} icon={<Icon name="save" size={18} />} className="w-full py-4 text-base">
                          Save Credentials
                        </Button>
                      </div>
                    </div>
                    
                  </div>
                )}
          </ModernTabContent>
    </div>
  );
}

export default function MalSyncPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white">Loading</div>}>
      <MalSyncContent />
    </Suspense>
  );
}
