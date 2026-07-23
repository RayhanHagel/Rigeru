"use client";

import { useEffect, useState, useMemo } from "react";
import { BookOpen, Search, RefreshCw, ArrowUpDown, Plus, Minus, X, PlusCircle } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

interface MangaData {
  main_url: string;
  chapters_amount: number;
  status: string;
  type: string;
  rating: number;
  website: string;
  image: string;
  local_image: string;
  chapter_read?: number;
}

export default function MangaLibrary() {
  const router = useRouter();
  const { mangaGridSize } = useSettingsStore();
  const [library, setLibrary] = useState<Record<string, MangaData>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Search & Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortMode, setSortMode] = useState("default");
  const [showSort, setShowSort] = useState(false);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-entertainment/manga-library");
      if (res.ok) {
        const data = await res.json();
        setLibrary(data);
      }
    } catch (e) {
      console.error("Failed to fetch manga library:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setToastMsg("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-entertainment/manga-library/refresh", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        setToastMsg(`Refreshed ${successCount}/${data.results?.length || 0} titles.`);
        await fetchLibrary();
      } else {
        setToastMsg("Refresh failed.");
      }
    } catch (e) {
      setToastMsg("Refresh failed: network error.");
    } finally {
      setRefreshing(false);
      setTimeout(() => setToastMsg(""), 4000);
    }
  };

  const handleUpdateProgress = async (title: string, newChapter: number) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-entertainment/manga-library/update-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, chapter_read: newChapter })
      });
      if (res.ok) {
        const data = await res.json();
        setLibrary(prev => ({
          ...prev,
          [title]: { ...prev[title], chapter_read: data.chapter_read }
        }));
      }
    } catch (e) {
      console.error("Failed to update progress:", e);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  // Filtered & Sorted entries
  const entries = useMemo(() => {
    let items = Object.entries(library);

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(([title]) => title.toLowerCase().includes(q));
    }

    // Sort
    switch (sortMode) {
      case "alpha-asc":
        items.sort(([a], [b]) => a.localeCompare(b));
        break;
      case "alpha-desc":
        items.sort(([a], [b]) => b.localeCompare(a));
        break;
      case "progress":
        items.sort(([, a], [, b]) => {
          const pa = a.chapters_amount > 0 ? (a.chapter_read || 0) / a.chapters_amount : 0;
          const pb = b.chapters_amount > 0 ? (b.chapter_read || 0) / b.chapters_amount : 0;
          return pb - pa;
        });
        break;
      case "status":
        items.sort(([, a], [, b]) => (a.status || "").localeCompare(b.status || ""));
        break;
      default:
        break;
    }

    return items;
  }, [library, searchQuery, sortMode]);

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10">
      
      {/* Header and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-purple-500/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Manga and Manhwa</h1>
            <p className="text-zinc-400 text-sm font-medium mt-1">Reading Library</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Button 
            variant="secondary" 
            onClick={() => { setShowSearch(!showSearch); setShowSort(false); }}
            className={showSearch ? "border-purple-500 text-purple-400" : ""}
            icon={<Search size={16} />}
          >
            Search
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => router.push('/media-entertainment/manga-search')}
            icon={<PlusCircle size={16} />}
          >
            WebSearch
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleRefresh}
            isLoading={refreshing}
            icon={<RefreshCw size={16} />}
          >
            Refresh
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => router.push('/media-entertainment/manga-sort')}
            icon={<ArrowUpDown size={16} />}
          >
            Sort Order
          </Button>
          <div className="relative">
            <Button 
              variant="secondary" 
              onClick={() => { setShowSort(!showSort); setShowSearch(false); }}
              className={showSort ? "border-purple-500 text-purple-400" : ""}
              icon={<ArrowUpDown size={16} />}
            >
              Sort
            </Button>
            {showSort && (
              <div className="absolute right-0 top-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 min-w-[180px] overflow-hidden">
                {[
                  { key: "default", label: "Default" },
                  { key: "alpha-asc", label: "A → Z" },
                  { key: "alpha-desc", label: "Z → A" },
                  { key: "progress", label: "By Progress" },
                  { key: "status", label: "By Status" },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortMode(opt.key); setShowSort(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                      sortMode === opt.key ? "bg-purple-500/20 text-purple-400 font-medium" : "text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="mb-6 flex gap-3 animate-fade-in">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              autoFocus
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
            />
          </div>
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="p-3 text-zinc-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="mb-4 p-3 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30 text-sm font-medium animate-fade-in">
          {toastMsg}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 backdrop-blur-sm">
          <p className="text-zinc-500 text-lg">{searchQuery ? "No results found." : "Your manga library is empty."}</p>
        </div>
      ) : (
        <div 
          className="grid gap-6 animate-slide-up"
          style={{ gridTemplateColumns: `repeat(${mangaGridSize}, minmax(0, 1fr))` }}
        >
          {entries.map(([title, data], idx) => {
            const displayTitle = title.length <= 30 ? title : `${title.substring(0, 27)}...`;
            
            const resolveImageUrl = (url?: string) => {
              if (!url) return "";
              if (url.startsWith('/app/static/')) {
                return `http://127.0.0.1:8000${url.replace('/app/static', '/static')}`;
              }
              return url;
            };

            const imageSrc = resolveImageUrl(data.local_image) || resolveImageUrl(data.image);
            const chapterRead = data.chapter_read || 0;
            const chaptersAmount = data.chapters_amount || 0;

            return (
              <div 
                key={idx} 
                className="flex flex-col rounded-2xl bg-zinc-900/50 backdrop-blur-md border border-white/10 overflow-hidden group hover:border-purple-500/50 hover:bg-zinc-900/80 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]"
              >
                <a 
                  href={`/media-entertainment/manga-read?id=${encodeURIComponent(title)}`}
                  className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-950 block cursor-pointer"
                >
                  {imageSrc ? (
                    <img 
                      src={imageSrc} 
                      alt={title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://placehold.co/400x600/1e1b4b/a855f7?text=Missing+Cover";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      No Image
                    </div>
                  )}
                  
                  {/* Status badge */}
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold uppercase tracking-wider text-white border border-white/10">
                    {data.status || 'Unknown'}
                  </div>
                </a>
                
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <a 
                    href={`/media-entertainment/manga-read?id=${encodeURIComponent(title)}`}
                    className="text-sm font-bold text-zinc-200 hover:text-purple-400 transition-colors text-center truncate"
                    title={title}
                  >
                    {displayTitle}
                  </a>
                  
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5 gap-2 h-12">
                    <button 
                      onClick={() => handleUpdateProgress(title, chapterRead - 1)}
                      className="p-1 rounded-md text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors flex-shrink-0"
                      title="Decrease chapter"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-xs font-mono font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md whitespace-nowrap text-center overflow-hidden text-ellipsis flex-1">
                      {chapterRead} / {chaptersAmount}
                    </span>
                    <button 
                      onClick={() => handleUpdateProgress(title, chapterRead + 1)}
                      className="p-1 rounded-md text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors flex-shrink-0"
                      title="Increase chapter"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
