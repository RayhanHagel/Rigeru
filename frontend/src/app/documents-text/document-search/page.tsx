"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/ui/Header";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";

interface SearchResult {
  title: string;
  path: string;
  snippet?: string;
}

interface IndexInfo {
  exists: boolean;
  doc_count: number;
  files: string[];
}

export default function DocumentSearchPage() {
  const [activeTab, setActiveTab] = useState("search");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [searchError, setSearchError] = useState("");

  // Indexing state
  const [targetDir, setTargetDir] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [indexStatusMsg, setIndexStatusMsg] = useState("");
  const [indexErrorMsg, setIndexErrorMsg] = useState("");
  const [indexInfo, setIndexInfo] = useState<IndexInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  // File explorer modal
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [openingFilePath, setOpeningFilePath] = useState<string | null>(null);

  // Fetch index info on mount
  useEffect(() => {
    fetchIndexInfo();
  }, []);

  const fetchIndexInfo = async () => {
    setIsLoadingInfo(true);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/search/info");
      if (res.ok) {
        const data = await res.json();
        setIndexInfo(data);
      }
    } catch (err: any) {
      console.error("Failed to load index info:", err);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError("");
    setHasSearched(false);

    try {
      const res = await fetch(`/api/files-documents/pdf-studio/search/query?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.detail || data.message || "Failed to search documents.");
        setSearchResults([]);
      } else {
        setSearchResults(data.results || []);
        setSearchMessage(data.message || `Found ${data.results?.length || 0} results.`);
        setHasSearched(true);
      }
    } catch (err: any) {
      setSearchError(err.message || "Network error while searching index.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBuildIndex = async () => {
    if (!targetDir.trim()) {
      setIndexErrorMsg("Please choose or enter a directory path to index.");
      return;
    }

    setIsBuilding(true);
    setIndexStatusMsg("");
    setIndexErrorMsg("");

    try {
      const res = await fetch("/api/files-documents/pdf-studio/search/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_dir: targetDir.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setIndexErrorMsg(data.detail || data.message || "Failed to index documents.");
      } else {
        setIndexStatusMsg(data.message || `Indexed ${data.indexed} documents (${data.skipped} unchanged).`);
        await fetchIndexInfo();
      }
    } catch (err: any) {
      setIndexErrorMsg(err.message || "Failed to connect to indexing service.");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleOpenFile = async (filePath: string) => {
    setOpeningFilePath(filePath);
    try {
      const res = await fetch("/api/files-documents/utils/open-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.detail || "Unable to open file on host system.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to invoke system file opener.");
    } finally {
      setOpeningFilePath(null);
    }
  };

  const handleDeleteIndex = async () => {
    if (!confirm("Are you sure you want to completely clear the document index?")) return;
    try {
      const res = await fetch("/api/files-documents/pdf-studio/search/index", { method: "DELETE" });
      if (res.ok) {
        setIndexStatusMsg("Search index cleared successfully.");
        setSearchResults([]);
        setHasSearched(false);
        await fetchIndexInfo();
      } else {
        const data = await res.json();
        setIndexErrorMsg(data.detail || "Failed to clear search index.");
      }
    } catch (err: any) {
      setIndexErrorMsg(err.message || "Error clearing index.");
    }
  };

  const tabs = [
    { id: "search", label: "Search Index", icon: "search" },
    { id: "manage", label: "Index Management", icon: "folder_zip" },
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col gap-6 font-sans custom-scrollbar">
      <Header
        title="Document Search"
        subtitle="Offline full-text indexing and instant search inside PDFs, Word documents, text, and Markdown files."
        actions={
          <ModernTabs
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            actionButton={
              indexInfo && indexInfo.exists ? (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] text-xs text-[var(--theme-text)]">
                  <Icon name="check_circle" size={14} className="text-emerald-400" />
                  <span>{indexInfo.doc_count} files in index</span>
                </div>
              ) : undefined
            }
          />
        }
      />

      <div className="flex-1 space-y-6">
        {/* SEARCH TAB */}
        {activeTab === "search" && (
          <ModernTabContent activeTab="search">
            <div className="space-y-6">
          <form
            onSubmit={handleSearch}
            className="bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md space-y-4"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider ml-1">
                Search Query
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter keywords, phrases, or names (e.g. invoice, contract, report)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border text-[var(--theme-text)] placeholder-[var(--theme-text)]/40 focus:outline-none transition-all duration-300 shadow-inner"
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--theme-heading)")}
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)")
                  }
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="shrink-0 whitespace-nowrap !w-auto px-3.5"
                  disabled={isSearching || !searchQuery.trim()}
                  icon={<Icon name={isSearching ? "progress_activity" : "search"} size={16} className={isSearching ? "animate-spin" : ""} />}
                >
                  {isSearching ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>

            {searchError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <Icon name="error" size={16} />
                <span>{searchError}</span>
              </div>
            )}
          </form>

          {/* Results section */}
          {hasSearched && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-semibold text-[var(--theme-text)]">{searchMessage}</span>
                <span className="text-xs text-[var(--theme-text)]/70">Top ranked BM25 matches</span>
              </div>

              {searchResults.length === 0 ? (
                <div className="bg-[var(--theme-ui-bg)] p-12 rounded-xl border border-[var(--theme-ui-border)] text-center backdrop-blur-md">
                  <Icon name="search_off" size={40} className="mx-auto text-[var(--theme-text)]/40 mb-3" />
                  <p className="text-[var(--theme-text)] font-medium">No matching documents found</p>
                  <p className="text-xs text-[var(--theme-text)]/60 mt-1">
                    Try checking spelling or index new folders in the Index Management tab.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="bg-[var(--theme-ui-bg)] p-5 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md hover:border-[var(--theme-heading)] hover:shadow-md transition-all duration-300 flex flex-col md:flex-row md:items-start justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon name="description" size={20} className="text-[var(--theme-heading)] shrink-0" />
                          <h4 className="font-semibold text-[var(--theme-heading)] truncate text-base">
                            {result.title}
                          </h4>
                        </div>

                        <p className="text-xs font-mono text-[var(--theme-text)]/70 truncate select-all" title={result.path}>
                          {result.path}
                        </p>

                        {result.snippet && (
                          <div
                            className="text-sm text-[var(--theme-text)] bg-[var(--theme-bg)] p-3 rounded-lg border border-[var(--theme-ui-border)] leading-relaxed [&_.doc-highlight]:bg-amber-400/25 [&_.doc-highlight]:text-amber-200 [&_.doc-highlight]:px-1 [&_.doc-highlight]:rounded"
                            dangerouslySetInnerHTML={{ __html: result.snippet }}
                          />
                        )}
                      </div>

                      <div className="shrink-0 flex items-center md:self-center">
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenFile(result.path)}
                          disabled={openingFilePath === result.path}
                          icon={<Icon name={openingFilePath === result.path ? "progress_activity" : "launch"} size={16} className={openingFilePath === result.path ? "animate-spin" : ""} />}
                        >
                          Open File
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ModernTabContent>
    )}

      {/* MANAGEMENT TAB */}
      {activeTab === "manage" && (
        <ModernTabContent activeTab="manage">
          <div className="space-y-6">
          <div className="bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md space-y-5">
            <div>
              <h3 className="text-base font-semibold text-[var(--theme-heading)]">Index Folder</h3>
              <p className="text-xs text-[var(--theme-text)] mt-1">
                Recursively scans and extracts full text from <span className="font-mono text-[var(--theme-heading)]">.pdf</span>, <span className="font-mono text-[var(--theme-heading)]">.docx</span>, <span className="font-mono text-[var(--theme-heading)]">.txt</span>, <span className="font-mono text-[var(--theme-heading)]">.md</span>, and <span className="font-mono text-[var(--theme-heading)]">.csv</span> files. Unmodified files are automatically skipped on updates.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider ml-1">
                Target Folder Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. C:\Users\Username\Documents"
                  value={targetDir}
                  onChange={(e) => setTargetDir(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border text-[var(--theme-text)] placeholder-[var(--theme-text)]/40 focus:outline-none transition-all duration-300 shadow-inner font-mono text-sm"
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--theme-heading)")}
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)")
                  }
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 whitespace-nowrap !w-auto px-3"
                  onClick={() => setIsExplorerOpen(true)}
                  icon={<Icon name="folder_open" size={16} />}
                >
                  Browse
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="shrink-0 whitespace-nowrap !w-auto px-3"
                  onClick={handleBuildIndex}
                  disabled={isBuilding || !targetDir.trim()}
                  icon={<Icon name={isBuilding ? "progress_activity" : "sync"} size={16} className={isBuilding ? "animate-spin" : ""} />}
                >
                  {isBuilding ? "Indexing..." : "Build Index"}
                </Button>
              </div>
            </div>

            {indexStatusMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
                <Icon name="check_circle" size={16} />
                <span>{indexStatusMsg}</span>
              </div>
            )}

            {indexErrorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <Icon name="error" size={16} />
                <span>{indexErrorMsg}</span>
              </div>
            )}
          </div>

          {/* Current Index Status */}
          <div className="bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--theme-heading)]">Current Index State</h3>
                <p className="text-xs text-[var(--theme-text)] mt-1">
                  Stored locally in offline Whoosh search index.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={fetchIndexInfo}
                  disabled={isLoadingInfo}
                  icon={<Icon name="refresh" size={16} className={isLoadingInfo ? "animate-spin" : ""} />}
                >
                  Refresh
                </Button>
                {indexInfo?.exists && (
                  <Button
                    variant="secondary"
                    onClick={handleDeleteIndex}
                    icon={<Icon name="delete" size={16} className="text-red-400" />}
                  >
                    Clear Index
                  </Button>
                )}
              </div>
            </div>

            <div className="h-px bg-[var(--theme-ui-border)]" />

            {indexInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-bg)]">
                    <span className="text-xs text-[var(--theme-text)]/70 uppercase">Index Status</span>
                    <p className="text-lg font-semibold text-[var(--theme-heading)] mt-1">
                      {indexInfo.exists ? "Active & Ready" : "No Index Created"}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-bg)]">
                    <span className="text-xs text-[var(--theme-text)]/70 uppercase">Total Indexed Documents</span>
                    <p className="text-lg font-semibold text-[var(--theme-heading)] mt-1">
                      {indexInfo.doc_count} files
                    </p>
                  </div>
                </div>

                {indexInfo.files && indexInfo.files.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider mb-2">
                      Indexed Files ({indexInfo.files.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-bg)] p-3 custom-scrollbar">
                      {indexInfo.files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-mono text-[var(--theme-text)] py-1 border-b border-[var(--theme-ui-border)]/40 last:border-0">
                          <span className="truncate pr-4" title={file}>{file}</span>
                          <button
                            onClick={() => handleOpenFile(file)}
                            className="text-[var(--theme-heading)] hover:underline shrink-0 flex items-center gap-1 font-sans font-medium"
                          >
                            <Icon name="launch" size={12} /> Open
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-[var(--theme-text)] py-4 text-center">Loading index information...</div>
            )}
          </div>
        </div>
      </ModernTabContent>
    )}
    </div>

      <FileExplorerModal
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        onSelect={(path) => {
          setTargetDir(path);
          setIsExplorerOpen(false);
        }}
        title="Select Folder to Index"
        selectionMode="folder"
      />
    </div>
  );
}
