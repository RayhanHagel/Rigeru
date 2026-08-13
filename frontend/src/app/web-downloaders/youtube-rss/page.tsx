"use client";
import { Header } from "@/components/ui/Header";

import { useEffect, useState, Suspense } from "react";
import { Icon } from "@/lib/utils";

import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";

type Channel = {
  id: string;
  name: string;
};

type Video = {
  title: string;
  link: string;
  published: string;
  author: string;
  thumbnail: string;
  channel_name: string;
  channel_id: string;
};

type FeedCache = {
  tracked_ids: string[];
  channel_data: Record<string, { name: string; videos: Video[] }>;
  all_videos: Video[];
};

function YoutubeRssContent() {
  const [activeTab, setActiveTab] = useState<"timeline" | "channels">("timeline");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [feedCache, setFeedCache] = useState<FeedCache | null>(null);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addMethod, setAddMethod] = useState<"search" | "manual" | "import">("search");

  // Search/Add states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  const [manualName, setManualName] = useState("");
  const [manualId, setManualId] = useState("");
  const [isAddingManual, setIsAddingManual] = useState(false);

  const [isImporting, setIsImporting] = useState(false);

  // Filter/Sort states
  const [selectedYm, setSelectedYm] = useState<string | null>(null);
  const [channelSearch, setChannelSearch] = useState("");
  const [channelSort, setChannelSort] = useState("Added Order");
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchChannels();
    // Load cached feed first for instant display, then auto-refresh in background
    fetchFeedCache().then(() => {
      refreshFeeds();
    });
  }, []);

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/web-downloads/youtube-rss/channels");
      if (res.ok) setChannels(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFeedCache = async () => {
    try {
      const res = await fetch("/api/web-downloads/youtube-rss/feed");
      if (res.ok) setFeedCache(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const refreshFeeds = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/web-downloads/youtube-rss/feed/refresh", { method: "POST" });
      if (res.ok) setFeedCache(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSearchAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch("/api/web-downloads/youtube-rss/channels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setSearchQuery("");
        fetchChannels();
      } else {
        alert(data.detail);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualId) return;
    setIsAddingManual(true);
    try {
      const res = await fetch("/api/web-downloads/youtube-rss/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: manualName, channel_id: manualId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setManualName("");
        setManualId("");
        fetchChannels();
      } else {
        alert(data.detail);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingManual(false);
    }
  };

  const handleUploadComplete = async (info: { hash_name: string; original_name: string; file_type: string }) => {
    setIsImporting(true);
    try {
        const bulkRes = await fetch("/api/web-downloads/youtube-rss/channels/import-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_hash: info.hash_name })
        });
        const data = await bulkRes.json();
        
        if (!bulkRes.ok) throw new Error(data.detail || "Failed to import bulk channels.");
        
        alert(data.message);
        fetchChannels();
        setAddMethod("manual");
    } catch (err: any) {
      alert(err.message || "Failed to import CSV");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteChannels = async () => {
    if (selectedToDelete.size === 0) return;
    if (!confirm(`Unsubscribe from ${selectedToDelete.size} channel(s)?`)) return;

    for (const c_id of selectedToDelete) {
      await fetch(`/api/web-downloads/youtube-rss/channels/${c_id}`, { method: "DELETE" });
    }
    setSelectedToDelete(new Set());
    fetchChannels();
  };

  // Timeline preparation
  const allVideos = feedCache?.all_videos || [];
  const uniqueYms = Array.from(new Set(allVideos.map(v => v.published.substring(0, 7)))).sort().reverse();
  const ymLabels = uniqueYms.map(ym => {
    try {
      const d = new Date(ym + "-01T00:00:00Z");
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return ym;
    }
  });

  useEffect(() => {
    if (uniqueYms.length > 0) {
      if (!selectedYm || !uniqueYms.includes(selectedYm)) {
        setSelectedYm(uniqueYms[0]);
      }
    }
  }, [feedCache]); // Sync when feedCache updates

  const filteredVideos = allVideos.filter(v => selectedYm && v.published.startsWith(selectedYm));

  // Channel View preparation
  let displayChannels = [...channels];
  if (channelSearch) {
    displayChannels = displayChannels.filter(c => c.name.toLowerCase().includes(channelSearch.toLowerCase()));
  }
  if (channelSort === "A-Z") displayChannels.sort((a, b) => a.name.localeCompare(b.name));
  else if (channelSort === "Z-A") displayChannels.sort((a, b) => b.name.localeCompare(a.name));


  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header
        title="YouTube RSS Feed"
        subtitle="Track your favorite YouTube channels locally without logging into an account."
        actions={
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {isRefreshing && (
              <span className="text-xs text-[var(--theme-text)] flex items-center gap-1.5 animate-pulse mr-2">
                <Icon name="refresh" size={12} className="animate-spin" />
                Refreshing...
              </span>
            )}
            <Button variant="secondary" onClick={refreshFeeds} isLoading={isRefreshing}>
              Refresh Feeds
            </Button>
            <ModernTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab as (id: string) => void}
              tabs={[
                { id: "timeline", label: "Timeline View" },
                { id: "channels", label: "Channel View" }
              ]}
            />
          </div>
        }
      />

      <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-6 mb-8 backdrop-blur-md shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--theme-heading)] mb-4 flex items-center gap-2">Track New Channel
        </h2>
        
        <div className="flex gap-2 mb-6 border-b border-[var(--theme-ui-border)] pb-2">
          <button onClick={() => setAddMethod("search")} className={`text-sm px-4 py-2 rounded-md transition-colors ${addMethod === "search" ? "bg-[var(--theme-heading)]/20 text-[var(--theme-heading)] font-semibold" : "text-[var(--theme-text)] hover:text-[var(--theme-heading)]"}`}>Search by Name</button>
          <button onClick={() => setAddMethod("manual")} className={`text-sm px-4 py-2 rounded-md transition-colors ${addMethod === "manual" ? "bg-[var(--theme-heading)]/20 text-[var(--theme-heading)] font-semibold" : "text-[var(--theme-text)] hover:text-[var(--theme-heading)]"}`}>Manual ID Entry</button>
          <button onClick={() => setAddMethod("import")} className={`text-sm px-4 py-2 rounded-md transition-colors ${addMethod === "import" ? "bg-[var(--theme-heading)]/20 text-[var(--theme-heading)] font-semibold" : "text-[var(--theme-text)] hover:text-[var(--theme-heading)]"}`}>Import Takeout CSV</button>
        </div>

        {addMethod === "search" && (
          <form onSubmit={handleSearchAdd} className="flex gap-4">
            <input 
              type="text" 
              placeholder="e.g., Linus Tech Tips" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 rounded-lg p-2.5 text-[var(--theme-text)] border focus:outline-none transition-colors"
              style={{ 
                backgroundColor: "var(--theme-bg)",
                borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"} 
            />
            <Button variant="primary" type="submit" isLoading={isSearching} icon={<Icon name="search" size={18} />}>Search &amp; Add</Button>
          </form>
        )}

        {addMethod === "manual" && (
          <form onSubmit={handleManualAdd} className="flex gap-4">
            <input 
              type="text" 
              placeholder="Channel Alias (e.g., MKBHD)" 
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              className="flex-1 rounded-lg p-2.5 text-[var(--theme-text)] border focus:outline-none transition-colors"
              style={{ 
                backgroundColor: "var(--theme-bg)",
                borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"} 
            />
            <input 
              type="text" 
              placeholder="Channel ID (e.g., UCBJycsmduvYEL83R_U4JriQ)" 
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              className="flex-1 rounded-lg p-2.5 text-[var(--theme-text)] border focus:outline-none transition-colors"
              style={{ 
                backgroundColor: "var(--theme-bg)",
                borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"} 
            />
            <Button variant="secondary" type="submit" isLoading={isAddingManual}>Track Channel</Button>
          </form>
        )}

        {addMethod === "import" && (
          <div>
            <p className="text-[var(--theme-text)] text-sm mb-4">Import a <code className="bg-[var(--theme-bg)] px-1 rounded text-[var(--theme-text)]">subscriptions.csv</code> file directly from Google Takeout.</p>
            <div className="relative">
              <DirectUploadBox
                accept=".csv"
                label={isImporting ? "Importing..." : "Upload subscriptions.csv"}
                onUploadComplete={handleUploadComplete}
              />
            </div>
          </div>
        )}
      </div>


      <ModernTabContent activeTab={activeTab}>
          {activeTab === "timeline" && (
                  <div className="flex gap-8">
                    <div className="w-48 flex-shrink-0 border-r border-[var(--theme-ui-border)] pr-6">
                      <h3 className="text-[var(--theme-heading)] font-semibold mb-4">Jump to Date</h3>
                      <div className="flex flex-col gap-2">
                        {uniqueYms.map((ym, idx) => (
                          <button 
                            key={ym}
                            onClick={() => setSelectedYm(ym)}
                            className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedYm === ym ? "bg-[var(--theme-heading)]/20 text-[var(--theme-heading)] font-semibold" : "text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-[var(--theme-bg)]"}`}
                          >
                            {ymLabels[idx]}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      {filteredVideos.length === 0 ? (
                        <p className="text-[var(--theme-text)]">No videos found in timeline.</p>
                      ) : (
                        filteredVideos.map((vid, idx) => {
                          let dateStr = vid.published;
                          try {
                            dateStr = new Date(vid.published).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
                          } catch {}
                          
                          return (
                            <div key={idx} className="p-4 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl hover:border-[var(--theme-heading)] transition-colors">
                              <a href={vid.link} target="_blank" rel="noreferrer" className="text-lg font-semibold text-[var(--theme-text)] hover:text-[var(--theme-heading)] mb-1 block">
                                {vid.title}
                              </a>
                              <div className="text-sm font-medium text-[var(--theme-text)] mb-2">{vid.channel_name}</div>
                              <div className="text-xs text-[var(--theme-text)] flex items-center gap-1">
                                <Icon name="schedule" size={12} /> {dateStr}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
          </ModernTabContent>

      <ModernTabContent activeTab={activeTab}>
          {activeTab === "channels" && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative flex-1">
                        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)]" />
                        <input 
                          type="text" 
                          placeholder="Search subscriptions..." 
                          value={channelSearch}
                          onChange={e => setChannelSearch(e.target.value)}
                          className="w-full rounded-lg py-2 pl-9 pr-4 text-sm text-[var(--theme-text)] border focus:outline-none transition-colors"
                          style={{ 
                            backgroundColor: "var(--theme-bg)",
                            borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"} 
                        />
                      </div>
                      
                      <select 
                        value={channelSort}
                        onChange={e => setChannelSort(e.target.value)}
                        className="rounded-lg px-4 py-2 text-sm text-[var(--theme-text)] border focus:outline-none transition-colors"
                        style={{ 
                          backgroundColor: "var(--theme-bg)",
                          borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)"
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"} 
                      >
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Added Order</option>
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">A-Z</option>
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]">Z-A</option>
                      </select>
                      
                      <Button 
                        variant="primary" 
                        onClick={handleDeleteChannels}
                        disabled={selectedToDelete.size === 0}
                        icon={<Icon name="delete" size={16} />}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
                      >
                        Unsubscribe ({selectedToDelete.size})
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      {displayChannels.length === 0 ? (
                        <p className="text-[var(--theme-text)] text-center py-8">No channels match your search.</p>
                      ) : (
                        displayChannels.map(channel => {
                          const isSelected = selectedToDelete.has(channel.id);
                          const toggleSelect = () => {
                            const newSet = new Set(selectedToDelete);
                            if (newSet.has(channel.id)) newSet.delete(channel.id);
                            else newSet.add(channel.id);
                            setSelectedToDelete(newSet);
                          };
                          
                          const cData = feedCache?.channel_data?.[channel.id] || { videos: [] };
                          
                          return (
                            <div key={channel.id} className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl overflow-hidden shadow-sm backdrop-blur-md">
                              <div className="flex items-center px-4 py-3 bg-[var(--theme-bg)]/50 border-b border-[var(--theme-ui-border)]">
                                <input type="checkbox" checked={isSelected} onChange={toggleSelect} className="mr-4 w-4 h-4 rounded bg-[var(--theme-bg)] border-[var(--theme-ui-border)] text-[var(--theme-heading)] focus:ring-[var(--theme-heading)]" />
                                <div className="font-medium text-[var(--theme-heading)] flex-1">{channel.name}</div>
                              </div>
                              
                              <div className="p-4 space-y-4">
                                {cData.videos.length === 0 ? (
                                  <p className="text-sm text-[var(--theme-text)]">No recent videos found.</p>
                                ) : (
                                  cData.videos.map((vid, idx) => {
                                    let dateStr = vid.published;
                                    try {
                                      dateStr = new Date(vid.published).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    } catch {}
                                    
                                    return (
                                      <div key={idx} className={idx !== cData.videos.length - 1 ? "border-b border-[var(--theme-ui-border)] pb-4" : ""}>
                                        <a href={vid.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-[var(--theme-text)] hover:text-[var(--theme-heading)] block mb-1">
                                          {vid.title}
                                        </a>
                                        <div className="text-xs text-[var(--theme-text)]">📅 {dateStr}</div>
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
          </ModernTabContent>
    </div>
  );
}

export default function YoutubeRss() {
  return (
    <Suspense fallback={<div className="p-10">Loading</div>}>
      <YoutubeRssContent />
    </Suspense>
  );
}
