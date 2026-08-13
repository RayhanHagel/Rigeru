"use client";

import { useEffect, useState, useMemo } from "react";

import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { useRouter } from "next/navigation";
import { Icon } from "@/lib/utils";

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
      const res = await fetch("/api/media-entertainment/manga-library");
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
      const res = await fetch("/api/media-entertainment/manga-library/refresh", { method: "POST" });
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
      const res = await fetch("/api/media-entertainment/manga-library/update-progress", {
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
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar animate-slide-up flex flex-col font-sans">
      
      {/* Header and Action Bar */}
      <Header 
        className="relative z-50"
        title="Manga and Manhwa" 
        subtitle="Reading Library" 
        actions={
          <div className="flex items-center bg-[var(--theme-ui-bg)] p-1.5 rounded-xl border border-[var(--theme-ui-border)] backdrop-blur-md shadow-sm relative z-[100]">
            <button 
              onClick={() => { setShowSearch(!showSearch); setShowSort(false); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showSearch ? 'bg-[var(--theme-heading)]/15 text-[var(--theme-heading)] shadow-sm' : 'text-[var(--theme-text)] hover:bg-[var(--theme-bg)] hover:text-[var(--theme-heading)]'}`}
            >
              <Icon name="search" size={16} /> <span className="hidden sm:inline">Search</span>
            </button>
            
            <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1" />
            
            <button 
              onClick={() => router.push('/entertainment-reading/manga-search')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--theme-text)] hover:bg-[var(--theme-bg)] hover:text-[var(--theme-heading)] transition-all"
            >
              <Icon name="add_circle" size={16} /> <span className="hidden sm:inline">Add</span>
            </button>

            <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1" />

            <button 
              onClick={handleRefresh}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${refreshing ? 'text-[var(--theme-heading)] opacity-70' : 'text-[var(--theme-text)] hover:bg-[var(--theme-bg)] hover:text-[var(--theme-heading)]'}`}
            >
              <Icon name="refresh" size={16} className={refreshing ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span>
            </button>
            
            <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1" />
            
            <button 
              onClick={() => router.push('/entertainment-reading/manga-sort')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--theme-text)] hover:bg-[var(--theme-bg)] hover:text-[var(--theme-heading)] transition-all"
            >
              <Icon name="swap_vert" size={16} /> <span className="hidden sm:inline">Library Order</span>
            </button>

            <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1" />

            <div className="relative">
              <button 
                onClick={() => { setShowSort(!showSort); setShowSearch(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showSort ? 'bg-[var(--theme-heading)]/15 text-[var(--theme-heading)] shadow-sm' : 'text-[var(--theme-text)] hover:bg-[var(--theme-bg)] hover:text-[var(--theme-heading)]'}`}
              >
                <Icon name="filter_list" size={16} /> <span className="hidden sm:inline">Sort</span>
              </button>
              {showSort && (
                <div className="absolute right-0 top-full mt-3 bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-xl shadow-lg z-50 min-w-[180px] overflow-hidden p-1">
                  {[
                    { key: "default", label: "Default" },
                    { key: "alpha-asc", label: "Title (A-Z)" },
                    { key: "alpha-desc", label: "Title (Z-A)" },
                    { key: "progress", label: "By Progress" },
                    { key: "status", label: "By Status" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortMode(opt.key); setShowSort(false); }}
                      className={`w-full px-4 py-2.5 rounded-lg text-left text-sm transition-all ${
                        sortMode === opt.key ? "bg-[var(--theme-heading)] text-[var(--theme-bg)] font-medium shadow-sm" : "text-[var(--theme-text)] hover:bg-[var(--theme-bg)] hover:text-[var(--theme-heading)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
      }
    />

      {/* Search Bar */}
      {showSearch && (
        <div className="mb-6 flex gap-3 animate-fade-in">
          <div className="flex-1 relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)]" />
            <input
              type="text"
              autoFocus
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl pl-10 pr-4 py-3 text-[var(--theme-heading)] outline-none transition-all border"
              style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
            />
          </div>
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="p-3 text-[var(--theme-text)] hover:text-[var(--theme-heading)] transition-colors">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="mb-4 p-3 bg-[var(--theme-heading)]/20 text-[var(--theme-heading)] rounded-lg border border-[var(--theme-heading)]/30 text-sm font-medium animate-fade-in">
          {toastMsg}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[var(--theme-heading)]/30 border-t-[var(--theme-heading)] rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-dashed border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md">
          <p className="text-[var(--theme-text)] text-lg">{searchQuery ? "No results found." : "Your manga library is empty."}</p>
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
                return `${url.replace('/app/static', '/static')}`;
              }
              return url;
            };

            const imageSrc = resolveImageUrl(data.local_image) || resolveImageUrl(data.image);
            const chapterRead = data.chapter_read || 0;
            const chaptersAmount = data.chapters_amount || 0;

            return (
              <div 
                key={idx} 
                className="flex flex-col rounded-2xl bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] overflow-hidden group hover:border-[var(--theme-heading)]/50 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <a 
                  href={`/entertainment-reading/manga-read?id=${encodeURIComponent(title)}`}
                  className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--theme-bg)] block cursor-pointer"
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
                    <div className="w-full h-full flex items-center justify-center text-[var(--theme-text)]">
                      No Image
                    </div>
                  )}
                  
                  {/* Status badge */}
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold uppercase tracking-wider text-white border border-[var(--theme-ui-border)]">
                    {data.status || 'Unknown'}
                  </div>
                </a>
                
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <a 
                    href={`/entertainment-reading/manga-read?id=${encodeURIComponent(title)}`}
                    className="text-sm font-bold text-[var(--theme-heading)] transition-colors text-center truncate"
                    title={title}
                  >
                    {displayTitle}
                  </a>
                  
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-[var(--theme-ui-border)] gap-2 h-12">
                    <button 
                      onClick={() => handleUpdateProgress(title, chapterRead - 1)}
                      className="p-1 rounded-md text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-[var(--theme-heading)]/10 transition-colors flex-shrink-0"
                      title="Decrease chapter"
                    >
                      <Icon name="remove" size={14} />
                    </button>
                    <span className="text-xs font-mono font-medium text-[var(--theme-heading)] bg-[var(--theme-heading)]/10 px-2 py-1 rounded-md whitespace-nowrap text-center overflow-hidden text-ellipsis flex-1">
                      {chapterRead} / {chaptersAmount}
                    </span>
                    <button 
                      onClick={() => handleUpdateProgress(title, chapterRead + 1)}
                      className="p-1 rounded-md text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-[var(--theme-heading)]/10 transition-colors flex-shrink-0"
                      title="Increase chapter"
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
  );
}

