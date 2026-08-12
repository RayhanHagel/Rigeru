"use client";

import React, { useState, useEffect } from "react";

import { Header } from "@/components/ui/Header";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

const LANGUAGES: Record<string, string> = {
  "English": "en",
  "Spanish": "es",
  "French": "fr",
  "Indonesian": "id",
  "Japanese": "ja"
};

export default function SubtitleFetcherPage() {
  const [osApiKey, setOsApiKey] = useState("");
  const [videoPath, setVideoPath] = useState("");
  const [language, setLanguage] = useState("English");
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  // Load API key from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("os_api_key");
    if (saved) setOsApiKey(saved);
  }, []);

  const saveApiKey = () => {
    localStorage.setItem("os_api_key", osApiKey);
    alert("API Key saved locally!");
  };

  const handleSearch = async () => {
    if (!osApiKey) return setSearchError("Please configure your OpenSubtitles API Key first.");
    if (!videoPath) return setSearchError("Please provide a path to a video file.");
    
    setIsSearching(true);
    setSearchError("");
    setResults([]);
    setHasSearched(false);
    
    const formData = new FormData();
    formData.append("file_path", videoPath);
    formData.append("os_api_key", osApiKey);
    formData.append("language", LANGUAGES[language]);
    
    try {
      const res = await fetch("/api/subtitles/fetcher/search", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to search subtitles");
      }
      
      const data = await res.json();
      setResults(data.results || []);
      setHasSearched(true);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async (fileId: string) => {
    setDownloadingId(fileId);
    
    const formData = new FormData();
    formData.append("file_id", fileId);
    formData.append("os_api_key", osApiKey);
    
    try {
      const res = await fetch("/api/subtitles/fetcher/download", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        throw new Error("Failed to download subtitle");
      }
      
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = "subtitle.srt";
      if (contentDisposition && contentDisposition.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/"/g, "");
      }
      
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error(err);
      alert("Error downloading subtitle");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Local Subtitle Fetcher" subtitle="Find the exact subtitle for your video using digital fingerprints." />

      <Container title="OpenSubtitles Configuration" icon={<Icon name="settings" className="text-secondary" size={20} />}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            You need a free REST API Key from <a href="https://opensubtitles.com/" target="_blank" rel="noreferrer" className="text-secondary hover:underline">OpenSubtitles.com</a>.
          </p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="key" size={16} className="text-zinc-500" />
              </div>
              <input 
                type="password"
                value={osApiKey}
                onChange={e => setOsApiKey(e.target.value)}
                placeholder="OpenSubtitles API Key"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-secondary transition-colors"
              />
            </div>
            <Button variant="secondary" onClick={saveApiKey} className="shrink-0">
              Save Key
            </Button>
          </div>
        </div>
      </Container>

      <Container title="Search Subtitles" icon={<Icon name="search" className="text-secondary" size={20} />}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">🎬 Local Video File Path</label>
              <input 
                type="text"
                value={videoPath}
                onChange={e => setVideoPath(e.target.value)}
                placeholder="e.g., C:\Movies\MyMovie.mkv"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors"
              />
              <p className="text-xs text-zinc-500">Paste the full path to your video file.</p>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">Language</label>
              <select 
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-secondary transition-colors"
              >
                {Object.keys(LANGUAGES).map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>
          
          {searchError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {searchError}
            </div>
          )}
          
          <Button 
            variant="primary" 
            onClick={handleSearch} 
            disabled={isSearching}
            className="w-full py-4 text-base font-medium shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-shadow"
          >
            {isSearching ? "Calculating local video hash and searching" : "🔍 Search Subtitles"}
          </Button>
        </div>
      </Container>
      
      {hasSearched && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white">Match Results</h3>
          
          {results.length === 0 ? (
            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center text-zinc-400">
              No exact matching subtitles found for this video hash.
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((sub, idx) => {
                const attrs = sub.attributes || {};
                const files = attrs.files || [];
                if (files.length === 0) return null;
                
                const file = files[0];
                return (
                  <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-zinc-200 truncate" title={file.file_name || "Unknown.srt"}>
                        {file.file_name || "Unknown.srt"}
                      </h4>
                      <p className="text-xs text-zinc-500">
                        Rating: {attrs.ratings || 0} ⭐ | Downloads: {attrs.download_count || 0}
                      </p>
                    </div>
                    
                    <Button 
                      variant="primary" 
                      className="shrink-0"
                      onClick={() => handleDownload(file.file_id)}
                      disabled={downloadingId === file.file_id}
                    >
                      <Icon name="download" size={16} className="mr-2" />
                      {downloadingId === file.file_id ? "Fetching" : "Fetch"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
