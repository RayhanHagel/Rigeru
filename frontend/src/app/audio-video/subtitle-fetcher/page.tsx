"use client";

import React, { useState, useEffect } from "react";

import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
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

      <SectionHeader title="OpenSubtitles Configuration" />
      <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm mb-6">
        <div className="space-y-4">
          <p className="text-sm text-[var(--theme-text)]">
            You need a free REST API Key from <a href="https://opensubtitles.com/" target="_blank" rel="noreferrer" className="text-[var(--theme-heading)] hover:underline">OpenSubtitles.com</a>.
          </p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="key" size={16} className="text-[var(--theme-text)]" />
              </div>
              <input
                type="password"
                value={osApiKey}
                onChange={e => setOsApiKey(e.target.value)}
                placeholder="OpenSubtitles API Key"
                className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg py-3 pl-10 pr-4 text-[var(--theme-heading)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors"
              />
            </div>
            <Button variant="secondary" onClick={saveApiKey} className="shrink-0 h-[46px]">
              Save Key
            </Button>
          </div>
        </div>
      </div>

      <SectionHeader title="Search Subtitles" />
      <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-sm font-bold text-[var(--theme-heading)] flex items-center gap-2"><Icon name="movie" size={16} /> Local Video File Path</label>
              <input
                type="text"
                value={videoPath}
                onChange={e => setVideoPath(e.target.value)}
                placeholder="e.g., C:\Movies\MyMovie.mkv"
                className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-3 text-[var(--theme-heading)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors"
              />
              <p className="text-xs text-[var(--theme-text)]">Paste the full path to your video file.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[var(--theme-heading)]">Language</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-3 text-[var(--theme-heading)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors"
              >
                {Object.keys(LANGUAGES).map(lang => (
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={lang} value={lang}>{lang}</option>
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
            className="w-full py-4 text-base font-medium shadow-md"
          >
            {isSearching ? "Calculating local video hash and searching" : "Search Subtitles"}
          </Button>
        </div>
      </div>

      {hasSearched && (
        <div className="space-y-4 mt-6">
          <SectionHeader title="Match Results" />

          {results.length === 0 ? (
            <div className="p-6 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl text-center text-[var(--theme-text)]">
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
                  <div key={idx} className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] hover:shadow-md transition-all duration-300 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-[var(--theme-heading)] truncate" title={file.file_name || "Unknown.srt"}>
                        {file.file_name || "Unknown.srt"}
                      </h4>
                      <p className="text-xs text-[var(--theme-text)]">
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
