"use client";

import { useEffect, useState, Suspense } from "react";
import { 
  Tv, Search, Plus, Trash2, RefreshCw, Upload, Clock, ListVideo 
} from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    fetchFeedCache();
  }, []);

  const fetchChannels = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/web-downloads/youtube-rss/channels");
      if (res.ok) setChannels(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFeedCache = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/web-downloads/youtube-rss/feed");
      if (res.ok) setFeedCache(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const refreshFeeds = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/web-downloads/youtube-rss/feed/refresh", { method: "POST" });
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
      const res = await fetch("http://127.0.0.1:8000/api/web-downloads/youtube-rss/channels/search", {
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
      const res = await fetch("http://127.0.0.1:8000/api/web-downloads/youtube-rss/channels", {
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        // Simple CSV parser
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) throw new Error("CSV is empty or missing headers");

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const idIndex = headers.indexOf('Channel Id');
        const titleIndex = headers.indexOf('Channel Title');

        if (idIndex === -1 || titleIndex === -1) {
          throw new Error("Invalid CSV format. Could not find 'Channel Id' and 'Channel Title'.");
        }

        const toAdd = [];
        for (let i = 1; i < lines.length; i++) {
          // Simple regex to split by comma outside quotes
          const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
          const idCol = (cols[idIndex] || '').replace(/^"|"$/g, '').trim();
          const titleCol = (cols[titleIndex] || '').replace(/^"|"$/g, '').trim();
          if (idCol) {
            toAdd.push({ name: titleCol || idCol, id: idCol });
          }
        }

        if (toAdd.length === 0) {
          throw new Error("No channels found to import.");
        }

        const res = await fetch("http://127.0.0.1:8000/api/web-downloads/youtube-rss/channels/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channels: toAdd })
        });
        const data = await res.json();
        if (res.ok) {
          alert(data.message);
          fetchChannels();
        } else {
          alert(data.detail);
        }
      } catch (err: any) {
        alert(err.message || "Failed to parse CSV");
        console.error(err);
      } finally {
        setIsImporting(false);
        // Reset file input
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteChannels = async () => {
    if (selectedToDelete.size === 0) return;
    if (!confirm(`Unsubscribe from ${selectedToDelete.size} channel(s)?`)) return;

    for (const c_id of selectedToDelete) {
      await fetch(`http://127.0.0.1:8000/api/web-downloads/youtube-rss/channels/${c_id}`, { method: "DELETE" });
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
    <div className="w-full h-full flex flex-col p-6 lg:p-10 animate-fade-in overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-red-500/20 text-red-500 rounded-xl">
          <Tv size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">YouTube RSS Feed</h1>
          <p className="text-zinc-400 text-sm mt-1">Track your favorite YouTube channels locally without logging into an account.</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Plus size={18} /> Track New Channel
        </h2>
        
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
          <button onClick={() => setAddMethod("search")} className={`text-sm px-4 py-2 rounded-md transition-colors ${addMethod === "search" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}>Search by Name</button>
          <button onClick={() => setAddMethod("manual")} className={`text-sm px-4 py-2 rounded-md transition-colors ${addMethod === "manual" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}>Manual ID Entry</button>
          <button onClick={() => setAddMethod("import")} className={`text-sm px-4 py-2 rounded-md transition-colors ${addMethod === "import" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}>Import Takeout CSV</button>
        </div>

        {addMethod === "search" && (
          <form onSubmit={handleSearchAdd} className="flex gap-4">
            <input 
              type="text" 
              placeholder="e.g., Linus Tech Tips" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-2.5 text-white focus:border-red-500 outline-none" 
            />
            <Button variant="primary" type="submit" isLoading={isSearching} icon={<Search size={18} />}>Search & Add</Button>
          </form>
        )}

        {addMethod === "manual" && (
          <form onSubmit={handleManualAdd} className="flex gap-4">
            <input 
              type="text" 
              placeholder="Channel Alias (e.g., MKBHD)" 
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-2.5 text-white focus:border-red-500 outline-none" 
            />
            <input 
              type="text" 
              placeholder="Channel ID (e.g., UCBJycsmduvYEL83R_U4JriQ)" 
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-2.5 text-white focus:border-red-500 outline-none" 
            />
            <Button variant="secondary" type="submit" isLoading={isAddingManual}>Track Channel</Button>
          </form>
        )}

        {addMethod === "import" && (
          <div>
            <p className="text-zinc-400 text-sm mb-4">Import a <code className="bg-zinc-800 px-1 rounded text-zinc-300">subscriptions.csv</code> file directly from Google Takeout.</p>
            <div className="relative">
              <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isImporting} />
              <Button variant="secondary" icon={<Upload size={18} />} isLoading={isImporting}>Upload subscriptions.csv</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-white/10 mb-6">
        <div className="flex">
          <button 
            onClick={() => setActiveTab("timeline")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === "timeline" ? "border-red-500 text-red-500" : "border-transparent text-zinc-400 hover:text-white"}`}
          >
            <Clock size={16} /> Timeline View
          </button>
          <button 
            onClick={() => setActiveTab("channels")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === "channels" ? "border-red-500 text-red-500" : "border-transparent text-zinc-400 hover:text-white"}`}
          >
            <ListVideo size={16} /> Channel View
          </button>
        </div>
        <Button variant="secondary" onClick={refreshFeeds} isLoading={isRefreshing} icon={<RefreshCw size={16} />}>
          Refresh Feeds
        </Button>
      </div>

      {activeTab === "timeline" && (
        <div className="flex gap-8">
          <div className="w-48 flex-shrink-0 border-r border-white/10 pr-6">
            <h3 className="text-white font-semibold mb-4">Jump to Date</h3>
            <div className="flex flex-col gap-2">
              {uniqueYms.map((ym, idx) => (
                <button 
                  key={ym}
                  onClick={() => setSelectedYm(ym)}
                  className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedYm === ym ? "bg-red-500/20 text-red-400" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
                >
                  {ymLabels[idx]}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 space-y-4">
            {filteredVideos.length === 0 ? (
              <p className="text-zinc-500">No videos found in timeline.</p>
            ) : (
              filteredVideos.map((vid, idx) => {
                let dateStr = vid.published;
                try {
                  dateStr = new Date(vid.published).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
                } catch {}
                
                return (
                  <div key={idx} className="p-4 bg-zinc-900/50 border border-white/5 rounded-xl hover:border-white/20 transition-colors">
                    <a href={vid.link} target="_blank" rel="noreferrer" className="text-lg font-semibold text-white hover:text-red-400 mb-1 block">
                      {vid.title}
                    </a>
                    <div className="text-sm font-medium text-zinc-300 mb-2">{vid.channel_name}</div>
                    <div className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock size={12} /> {dateStr}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {activeTab === "channels" && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search subscriptions..." 
                value={channelSearch}
                onChange={e => setChannelSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:border-red-500 outline-none" 
              />
            </div>
            
            <select 
              value={channelSort}
              onChange={e => setChannelSort(e.target.value)}
              className="bg-zinc-950 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-red-500 outline-none"
            >
              <option>Added Order</option>
              <option>A-Z</option>
              <option>Z-A</option>
            </select>
            
            <Button 
              variant="primary" 
              onClick={handleDeleteChannels}
              disabled={selectedToDelete.size === 0}
              icon={<Trash2 size={16} />}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Unsubscribe ({selectedToDelete.size})
            </Button>
          </div>
          
          <div className="space-y-4">
            {displayChannels.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">No channels match your search.</p>
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
                  <div key={channel.id} className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden">
                    <div className="flex items-center px-4 py-3 bg-zinc-950/50 border-b border-white/5">
                      <input type="checkbox" checked={isSelected} onChange={toggleSelect} className="mr-4 w-4 h-4 rounded bg-zinc-800 border-white/20 text-red-500 focus:ring-red-500" />
                      <div className="font-medium text-white flex-1">{channel.name}</div>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {cData.videos.length === 0 ? (
                        <p className="text-sm text-zinc-500">No recent videos found.</p>
                      ) : (
                        cData.videos.map((vid, idx) => {
                          let dateStr = vid.published;
                          try {
                            dateStr = new Date(vid.published).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          } catch {}
                          
                          return (
                            <div key={idx} className={idx !== cData.videos.length - 1 ? "border-b border-white/5 pb-4" : ""}>
                              <a href={vid.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-zinc-200 hover:text-red-400 block mb-1">
                                {vid.title}
                              </a>
                              <div className="text-xs text-zinc-500">📅 {dateStr}</div>
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
    </div>
  );
}

export default function YoutubeRss() {
  return (
    <Suspense fallback={<div className="p-10">Loading...</div>}>
      <YoutubeRssContent />
    </Suspense>
  );
}
