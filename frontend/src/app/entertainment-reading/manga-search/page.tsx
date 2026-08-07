"use client";

import { useState } from "react";
import { Search, Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

export default function MangaSearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [websites, setWebsites] = useState<string[]>(["🌑 AsuraScans", "😺 MangaDex"]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [adding, setAdding] = useState<Record<string, boolean>>({});

  const handleSearch = async () => {
    if (!searchQuery.trim() || websites.length === 0) return;
    setLoading(true);
    setErrorMsg("");
    setResults({});
    try {
      const res = await fetch(`/api/media-entertainment/manga-search/query?title=${encodeURIComponent(searchQuery)}&websites=${encodeURIComponent(websites.join(","))}`);
      if (!res.ok) throw new Error("Search failed.");
      const data = await res.json();
      setResults(data.results || {});
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (title: string, urlStr: string) => {
    let website = "";
    if (urlStr.includes("asurascans.com")) website = "asurascans.com/";
    else if (urlStr.includes("mangadex.org")) website = "mangadex.org/";
    
    const url = urlStr.split("||")[0];
    
    const cleanTitle = title.replace(/^🌑 /, '').replace(/^😺 /, '');

    setAdding(prev => ({ ...prev, [title]: true }));
    try {
      const res = await fetch("/api/media-entertainment/manga-search/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanTitle, url, website })
      });
      if (!res.ok) throw new Error("Failed to add to library.");
      alert(`Successfully added ${cleanTitle} to your library!`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setAdding(prev => ({ ...prev, [title]: false }));
    }
  };

  const toggleSite = (site: string) => {
    setWebsites(prev => 
      prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site]
    );
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 border-b border-primary/30 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/20 text-primary shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Search size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Manga Search</h1>
            <p className="text-zinc-400 text-sm font-medium">Find and add new manga to your library.</p>
          </div>
        </div>
        <Button variant="secondary" icon={<BookOpen size={16} />} onClick={() => router.push('/entertainment-reading/manga-library')}>
          Library
        </Button>
      </div>

      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm mb-8">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Search Title</label>
            <div className="flex gap-3">
              <input 
                type="text" 
                placeholder="e.g. Solo Leveling" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-zinc-950 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none transition-all"
              />
              <Button variant="primary" icon={<Search size={16} />} onClick={handleSearch} isLoading={loading} className="bg-primary hover:bg-primary text-white border-none px-6">
                Search
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Sources</label>
            <div className="flex gap-3">
              {["🌑 AsuraScans", "😺 MangaDex"].map(site => (
                <button
                  key={site}
                  onClick={() => toggleSite(site)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    websites.includes(site) 
                      ? "bg-primary/20 border-primary text-primary" 
                      : "bg-zinc-950 border-white/10 text-zinc-500 hover:bg-white/5"
                  }`}
                >
                  {site}
                </button>
              ))}
            </div>
          </div>
        </div>
        {errorMsg && <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-6">Search Results</h2>
        {Object.keys(results).length === 0 && !loading && (
          <div className="p-10 border border-dashed border-zinc-800 rounded-2xl text-center text-zinc-500">
            No results found. Try a different query.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(results).map(([title, urlStr]) => {
            const coverUrl = urlStr.includes("||") ? urlStr.split("||")[1] : null;
            return (
              <div key={title} className="bg-zinc-900/30 border border-white/10 rounded-xl overflow-hidden flex flex-col group hover:border-primary/50 transition-all">
                {coverUrl && (
                  <div className="h-48 w-full overflow-hidden bg-zinc-950">
                    <img src={coverUrl} alt={title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <h4 className="font-bold text-zinc-200 mb-2 truncate" title={title}>{title}</h4>
                  <div className="mt-auto pt-4 flex justify-end">
                    <Button 
                      variant="secondary" 
                      icon={<Plus size={16} />} 
                      onClick={() => handleAdd(title, urlStr)}
                      isLoading={adding[title]}
                      className="text-xs py-1.5 px-3 h-auto"
                    >
                      Add to Library
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
