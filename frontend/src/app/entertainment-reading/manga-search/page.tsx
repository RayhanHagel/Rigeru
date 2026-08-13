"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { useRouter } from "next/navigation";
import { Icon } from "@/lib/utils";

export default function MangaSearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [websites, setWebsites] = useState<string[]>(["AsuraScans", "MangaDex"]);
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
    
    const cleanTitle = title;

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
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar animate-slide-up flex flex-col font-sans">
      <Header 
        title="Manga Search"
        subtitle="Find and add new manga to your library."
        actions={
          <Button variant="secondary" icon={<Icon name="menu_book" size={16} />} onClick={() => router.push('/entertainment-reading/manga-library')}>
            Library
          </Button>
        }
      />

      <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Search Title</label>
            <div className="flex gap-3">
              <input 
                type="text" 
                placeholder="e.g. Solo Leveling" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 rounded-xl p-3 outline-none transition-all border"
                style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              />
              <Button variant="primary" icon={<Icon name="search" size={16} />} onClick={handleSearch} isLoading={loading} className="px-6">
                Search
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Sources</label>
            <div className="flex gap-3">
              {["AsuraScans", "MangaDex"].map(site => (
                <button
                  key={site}
                  onClick={() => toggleSite(site)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    websites.includes(site) 
                      ? "bg-[var(--theme-heading)]/20 border-[var(--theme-heading)] text-[var(--theme-heading)]" 
                      : "bg-[var(--theme-bg)] border-[var(--theme-ui-border)] text-[var(--theme-text)] hover:bg-white/5"
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
        <h2 className="text-xl font-bold mb-6">Search Results</h2>
        {Object.keys(results).length === 0 && !loading && (
          <div className="p-10 border border-dashed border-[var(--theme-ui-border)] rounded-2xl text-center text-[var(--theme-text)]">
            No results found. Try a different query.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(results).map(([title, urlStr]) => {
            const coverUrl = urlStr.includes("||") ? urlStr.split("||")[1] : null;
            return (
              <div key={title} className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] shadow-sm rounded-xl overflow-hidden flex flex-col group hover:border-[var(--theme-heading)]/50 hover:shadow-md transition-all">
                {coverUrl && (
                  <div className="h-48 w-full overflow-hidden bg-[var(--theme-bg)]">
                    <img src={coverUrl} alt={title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <h4 className="font-bold mb-2 truncate" title={title}>{title}</h4>
                  <div className="mt-auto pt-4 flex justify-end">
                    <Button 
                      variant="secondary" 
                      icon={<Icon name="add" size={16} />} 
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

