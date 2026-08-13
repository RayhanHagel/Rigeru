"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All Titles");
  const [sortBy, setSortBy] = useState("Title (A-Z)");

  // State: Main Tabs
  const [activeTab, setActiveTab] = useState<"anime" | "manga" | "settings">("anime");
  const mediaType = activeTab === "manga" ? "manga" : "anime";
  
  // State: Data
  const [library, setLibrary] = useState<LibraryData>({});
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);

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
    if (activeTab === "anime" || activeTab === "manga") {
      setFilterStatus("All Titles");
      fetchLibrary();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar animate-slide-up flex flex-col font-sans">
      <Header 
        title="Local MAL Tracker"
        subtitle="Track your watching and reading progress locally and sync directly with your MAL account."
        actions={
          <ModernTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab as (id: string) => void}
            tabs={[
              { id: "anime", label: "Anime" },
              { id: "manga", label: "Manga" },
              { id: "settings", label: "Settings & Sync" }
            ]}
          />
        }
      />

      {isAuthLoading && (
        <div className="mb-6 p-4 bg-[var(--theme-heading)]/10 border border-[var(--theme-heading)]/20 rounded-xl flex items-center gap-3 text-[var(--theme-heading)]">
          <Icon name="refresh" size={20} className="animate-spin" />
          <span>Exchanging code for access token...</span>
        </div>
      )}

      <ModernTabContent activeTab={activeTab}>
          {(activeTab === "anime" || activeTab === "manga") ? (
                  <div className="flex flex-col gap-6">
                    {/* Controls Bar at the Top */}
                    <div className="flex flex-col lg:flex-row gap-4 p-4 bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
                      <div className="flex-1 relative">
                        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)]" size={16} />
                        <input
                          type="text"
                          placeholder="Search Title..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full rounded-md pl-10 pr-4 py-2 outline-none text-sm h-full transition-colors border"
                          style={{
                            backgroundColor: "var(--theme-bg)",
                            borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                        />
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
                        <select 
                          value={filterStatus} 
                          onChange={(e) => setFilterStatus(e.target.value)} 
                          className="w-[140px] rounded-md px-3 py-2 outline-none text-sm transition-colors border"
                          style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                        >
                          {filterOptions.map(opt => <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <select 
                          value={sortBy} 
                          onChange={(e) => setSortBy(e.target.value)} 
                          className="w-[180px] rounded-md px-3 py-2 outline-none text-sm transition-colors border"
                          style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                        >
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Title (A-Z)">Title (A-Z)</option>
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Title (Z-A)">Title (Z-A)</option>
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Progress (High to Low)">Progress (High to Low)</option>
                          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Progress (Low to High)">Progress (Low to High)</option>
                        </select>
                      </div>
                    </div>

                    {Object.keys(library).length === 0 ? (
                      <div className="bg-[var(--theme-bg)] border border-blue-500/30 text-blue-300 p-4 rounded-md flex items-start gap-3 mt-4">
                        <Icon name="error" size={20} className="shrink-0 mt-0.5" />
                        <p>Your {mediaType} library is empty. Go to the Sync tab to pull your data!</p>
                      </div>
                    ) : libItems.length === 0 ? (
                      <div className="bg-[var(--theme-bg)] border border-amber-500/30 text-amber-300 p-4 rounded-md flex items-start gap-3 mt-4">
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
                            <div key={malId} className="flex flex-col border border-[var(--theme-ui-border)] rounded-lg overflow-hidden bg-[var(--theme-ui-bg)] shadow-sm group relative hover:border-[var(--theme-heading)] hover:shadow-md transition-all duration-300">
                              <div className="w-full aspect-[2/3] bg-[var(--theme-bg)] flex items-center justify-center overflow-hidden relative">
                                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                
                                {/* Hover Trash Button */}
                                <button
                                  onClick={(e) => { e.preventDefault(); removeItem(malId); }}
                                  className="absolute top-2 left-2 p-1.5 bg-black/60 backdrop-blur-md rounded-md text-[var(--theme-text)] hover:text-red-400 hover:bg-red-500/20 border border-[var(--theme-ui-border)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
                                  title="Remove from Library"
                                >
                                  <Icon name="delete" size={14} />
                                </button>

                                <div 
                                  style={{ backgroundColor: getStatusColor(item.status) }}
                                  className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold uppercase tracking-wider text-white border border-[var(--theme-ui-border)]"
                                >
                                  {item.status}
                                </div>
                              </div>
                              
                              <div className="p-4 flex flex-col flex-1">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-[var(--theme-heading)] line-clamp-2 min-h-[40px] text-center" title={item.title}>
                                  {item.title}
                                </a>
                                
                                <div className="mt-auto flex items-center justify-between pt-3 border-t border-[var(--theme-ui-border)] gap-2 h-12">
                                  <button 
                                    onClick={() => updateProgress(malId, currentProg, -1)}
                                    className="p-1 rounded-md text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-[var(--theme-heading)]/10 transition-colors flex-shrink-0"
                                    title="Decrease progress"
                                  >
                                    <Icon name="remove" size={14} />
                                  </button>
                                  <span className="text-xs font-mono font-medium text-[var(--theme-heading)] bg-[var(--theme-heading)]/10 px-2 py-1 rounded-md whitespace-nowrap text-center overflow-hidden text-ellipsis flex-1">
                                    {currentProg} / {totalProg > 0 ? totalProg : "?"}
                                  </span>
                                  <button 
                                    onClick={() => updateProgress(malId, currentProg, 1)}
                                    className="p-1 rounded-md text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-[var(--theme-heading)]/10 transition-colors flex-shrink-0"
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
          ) : activeTab === "settings" ? (
                  <div className="flex flex-col gap-10 w-full">
                    
                    {/* Settings Section */}
                    <div>
                      <SectionHeader title="API Configuration" />
                      <div className="mb-6 text-[var(--theme-text)] leading-relaxed mt-4">
                        <p>To connect to MyAnimeList, you need an API Client.</p>
                        <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm">
                          <li>Go to <a href="https://myanimelist.net/apiconfig" target="_blank" rel="noopener noreferrer" className="text-[var(--theme-heading)] hover:underline">MAL API Settings</a></li>
                          <li>Create a New Client (App Type: Web)</li>
                          <li>Set Redirect URL to <code className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] px-1.5 py-0.5 rounded text-sm text-[var(--theme-heading)]">http://localhost:3000/entertainment-reading/malsync</code></li>
                        </ol>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="relative">
                          <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Client ID</label>
                          <div className="relative">
                            <input 
                              type={showClientId ? "text" : "password"}
                              value={clientId}
                              onChange={(e) => setClientId(e.target.value)}
                              className="w-full rounded-md px-3 py-2 outline-none transition-colors border pr-10" 
                              style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                              onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                            />
                            <button 
                              type="button"
                              onClick={() => setShowClientId(!showClientId)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)] hover:text-[var(--theme-heading)]"
                            >
                              <Icon name={showClientId ? "visibility_off" : "visibility"} size={18} />
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Client Secret (Optional)</label>
                          <div className="relative">
                            <input 
                              type={showClientSecret ? "text" : "password"} 
                              value={clientSecret}
                              onChange={(e) => setClientSecret(e.target.value)}
                              className="w-full rounded-md px-3 py-2 outline-none transition-colors border pr-10" 
                              style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                              onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                            />
                            <button 
                              type="button"
                              onClick={() => setShowClientSecret(!showClientSecret)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)] hover:text-[var(--theme-heading)]"
                            >
                              <Icon name={showClientSecret ? "visibility_off" : "visibility"} size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="primary" onClick={saveCredentials} isLoading={isSavingCreds} icon={<Icon name="save" size={18} />} className="w-full py-4 text-base">
                        Save Credentials
                      </Button>
                    </div>

                    {/* Sync Section */}
                    <div>
                      <SectionHeader title="Sync via OAuth" />
                      <div className="mt-4">
                        {!clientId ? (
                          <div className="bg-[var(--theme-bg)] border border-amber-500/30 text-amber-300 p-4 rounded-md flex items-start gap-3">
                            <Icon name="error" size={20} className="shrink-0 mt-0.5" />
                            <p>Please configure your MyAnimeList Client ID above first.</p>
                          </div>
                        ) : !isLoggedIn ? (
                          <div>
                            <div className="bg-[var(--theme-bg)] border border-amber-500/30 text-amber-300 p-4 rounded-md flex justify-center items-center gap-3 mb-6 w-fit">
                              <Icon name="link" size={20} className="shrink-0" />
                              <p>You are not connected to MyAnimeList.</p>
                            </div>
                            <Button variant="primary" onClick={handleLogin} icon={<Icon name="login" size={18} />} className="w-full py-4 text-base">
                              Login with MyAnimeList
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <div className="bg-[var(--theme-bg)] border border-emerald-500/30 text-emerald-400 p-4 rounded-md flex justify-center items-center gap-3 mb-4 w-fit">
                              <Icon name="link" size={20} className="shrink-0" />
                              <p>Linked to MyAnimeList via OAuth2.</p>
                            </div>
                            <p className="text-[var(--theme-text)] mb-6">Pull your latest Anime and Manga lists directly from your account.</p>
                            
                            {syncMessage && (
                              <div className={`p-4 rounded-md mb-6 border w-fit ${syncMessage.includes("Error") ? "bg-[var(--theme-bg)] border-red-500/30 text-red-400" : "bg-[var(--theme-bg)] border-emerald-500/30 text-emerald-400"}`}>
                                {syncMessage}
                              </div>
                            )}
                            
                            <Button variant="primary" onClick={handleSync} isLoading={isSyncing} icon={<Icon name="refresh" size={18} />} className="w-full py-4 text-base">
                              Sync Data from MAL
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                  </div>
                ) : null}
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
