"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { TextInput } from "@/components/ui/TextInput";
import { Icon } from "@/lib/utils";

interface DownloadedImage {
  path: string;
  filename: string;
}

// ─── Image Preview Modal ──────────────────────────────────────────────────────

function ImagePreviewModal({
  images,
  initialIndex,
  onClose,
}: {
  images: DownloadedImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  const img = images[index];
  const token = typeof window !== "undefined" ? (localStorage.getItem("auth_token") || "") : "";
  const previewUrl = `/api/web-downloads/bulk-images/preview?path=${encodeURIComponent(img.path)}&token=${encodeURIComponent(token)}`;

  const prev = useCallback(() => { setIndex(i => Math.max(0, i - 1)); setZoom(1); }, []);
  const next = useCallback(() => { setIndex(i => Math.min(images.length - 1, i + 1)); setZoom(1); }, [images.length]);

  // Keyboard navigation and scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "+" || e.key === "=") setZoom(z => Math.min(z + 0.25, 4));
      if (e.key === "-") setZoom(z => Math.max(z - 0.25, 0.25));
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, prev, next]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm px-8 pb-8"
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-2xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]/90 backdrop-blur-md w-[88vw] h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top toolbar — always visible */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--theme-bg)]/40 border-b border-[var(--theme-ui-border)] flex-shrink-0 rounded-t-2xl">
          <span className="text-xs text-[var(--theme-text)] truncate max-w-[300px]" title={img.filename}>{img.filename}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom Out (-)"
            >
              <Icon name="zoom_out" size={16} />
            </button>
            <span className="text-xs text-[var(--theme-text)] w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(z + 0.25, 4))}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom In (+)"
            >
              <Icon name="zoom_in" size={16} />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="text-xs text-[var(--theme-text)] hover:text-[var(--theme-heading)] px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
            >
              Reset
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/30 text-white transition-colors ml-2">
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        {/* Image — min-h-0 is critical: without it, flex children ignore the parent height and overflow */}
        <div className="overflow-auto flex-1 min-h-0 flex items-center justify-center bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={img.filename}
            style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.15s ease" }}
            className="block max-w-full max-h-full object-contain"
          />
        </div>

        {/* Bottom navigation — always visible */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-4 py-3 border-t border-[var(--theme-ui-border)] bg-[var(--theme-bg)]/40 flex-shrink-0 rounded-b-2xl">
            <button
              onClick={prev}
              disabled={index === 0}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors"
            >
              <Icon name="chevron_left" size={20} />
            </button>
            <span className="text-sm text-[var(--theme-text)]">{index + 1} / {images.length}</span>
            <button
              onClick={next}
              disabled={index === images.length - 1}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors"
            >
              <Icon name="chevron_right" size={20} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Image Grid Item ──────────────────────────────────────────────────────────

function ImageGridItem({
  img,
  selectionMode,
  isSelected,
  onSelect,
  onClick,
}: {
  img: DownloadedImage;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
}) {
  const token = typeof window !== "undefined" ? (localStorage.getItem("auth_token") || "") : "";
  const previewUrl = `/api/web-downloads/bulk-images/preview?path=${encodeURIComponent(img.path)}&token=${encodeURIComponent(token)}`;
  const [failed, setFailed] = useState(false);

  const handleClick = () => {
    if (selectionMode) {
      onSelect();
    } else {
      onClick();
    }
  };

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border aspect-square flex items-center justify-center cursor-pointer transition-all duration-200
        ${isSelected
          ? "border-[var(--theme-heading)] ring-2 ring-[var(--theme-heading)]/50 scale-[0.97]"
          : "border-[var(--theme-ui-border)] bg-[var(--theme-bg)]/40 hover:border-[var(--theme-heading)]/50"
        }`}
      title={img.filename}
      onClick={handleClick}
    >
      {/* Selection checkbox overlay */}
      <div
        className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200
          ${selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-60"}
          ${isSelected ? "bg-[var(--theme-heading)] border-[var(--theme-heading)]" : "bg-black/50 border-white/50"}`}
        onClick={e => { e.stopPropagation(); onSelect(); }}
      >
        {isSelected && <Icon name="check_circle" size={12} className="text-black fill-black" />}
      </div>

      {failed ? (
        <div className="flex flex-col items-center gap-1 text-[var(--theme-text)] p-2 text-center">
          <Icon name="image" size={24} />
          <span className="text-xs truncate w-full">{img.filename}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={img.filename}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setFailed(true)}
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-2 py-1 truncate translate-y-full group-hover:translate-y-0 transition-transform duration-200">
        {img.filename}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ImageScraperPage() {
  const [keyword, setKeyword] = useState("");
  const [count, setCount] = useState<number>(10);
  const [outputDir, setOutputDir] = useState("");

  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSearxngUp, setIsSearxngUp] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSearxng = async () => {
      try {
        const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
        await fetch(`http://${host}:8080/`, { method: "HEAD", mode: "no-cors", cache: "no-store" });
        setIsSearxngUp(true);
      } catch (e) {
        setIsSearxngUp(false);
      }
    };
    checkSearxng();
    const interval = setInterval(checkSearxng, 5000);
    return () => clearInterval(interval);
  }, []);


  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState({ completed: 0, failed: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [downloadedImages, setDownloadedImages] = useState<DownloadedImage[]>([]);

  // Selection & Preview state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const startDownload = () => {
    if (!keyword) {
      setErrorMsg("Please enter a keyword to search.");
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setIsDownloading(true);
    setStatusMsg("Starting...");
    setProgress({ completed: 0, failed: 0, total: 0 });
    setDownloadedImages([]);
    setSelectedPaths(new Set());
    setSelectionMode(false);

    const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
    const token = localStorage.getItem("auth_token") || "";
    const qs = new URLSearchParams({
      q: keyword,
      count: count.toString(),
      dir: outputDir,
      token: token,
    });

    const eventSource = new EventSource(
      `http://${host}:8000/api/web-downloads/bulk-images/stream?${qs.toString()}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "status") {
          setStatusMsg(data.message);
        } else if (data.type === "progress") {
          setProgress({ completed: data.completed, failed: data.failed, total: data.total });
        } else if (data.type === "image") {
          const fullPath: string = data.path;
          const filename = fullPath.split(/[\\\/]/).pop() || fullPath;
          setDownloadedImages((prev) => [...prev, { path: fullPath, filename }]);
        } else if (data.type === "error") {
          setErrorMsg(data.message);
          setIsDownloading(false);
          eventSource.close();
        } else if (data.type === "done") {
          setSuccessMsg(data.message);
          setIsDownloading(false);
          setStatusMsg("");
          eventSource.close();
        }
      } catch (err) {
        console.error("Failed to parse SSE data", err);
      }
    };

    eventSource.onerror = () => {
      setErrorMsg("Connection lost or failed.");
      setIsDownloading(false);
      eventSource.close();
    };
  };

  const toggleSelect = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedPaths.size === 0) return;
    if (!confirm(`Permanently delete ${selectedPaths.size} image(s) from disk? This cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const res = await fetch(`http://${host}:8000/api/web-downloads/bulk-images/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: Array.from(selectedPaths) }),
      });
      if (res.ok) {
        const { deleted } = await res.json();
        const deletedSet = new Set(deleted as string[]);
        setDownloadedImages(prev => prev.filter(img => !deletedSet.has(img.path)));
        setSelectedPaths(new Set());
        if (deletedSet.size > 0) setSuccessMsg(`Deleted ${deletedSet.size} image(s) successfully.`);
      }
    } catch (e) {
      setErrorMsg("Failed to delete images.");
    } finally {
      setIsDeleting(false);
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedPaths(new Set());
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Image Scraper" subtitle="Search and bulk download images from SearxNG in parallel." />

      {isSearxngUp === false && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="gpp_maybe" className="text-red-400" size={24} />
            <div>
              <h3 className="text-red-200 font-bold">SearXNG is not running!</h3>
              <p className="text-red-300 text-sm">Image scraping requires the SearXNG docker container to be active.</p>
            </div>
          </div>
          <Button variant="danger" onClick={() => window.location.href = "/system-network/docker-manager"}>
            Open Docker Manager
          </Button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 mb-10 items-end">
        <div className="flex-1">
          <TextInput
            label="Search Keyword"
            placeholder="e.g., cyberpunk city, nature landscape..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            icon={<Icon name="search" size={18} />}
          />
        </div>
        <div className="w-full lg:w-48">
          <TextInput
            label="Image Count"
            type="number"
            placeholder="10"
            value={count.toString()}
            onChange={(e) => setCount(parseInt(e.target.value) || 10)}
          />
        </div>
        <div className="flex-1 flex items-end gap-3">
          <div className="flex-1">
            <TextInput
              label="Download Folder (Optional)"
              placeholder="Leave empty for default Downloads"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              icon={<Icon name="folder" size={18} />}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsExplorerOpen(true)}
            className="h-11 px-4 border border-[var(--theme-ui-border)]"
          >
            Browse
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Button
          variant="primary"
          onClick={startDownload}
          disabled={isDownloading}
          className="w-full h-14 text-lg font-semibold shadow-[0_0_15px_var(--theme-glow1)]"
        >
          {isDownloading ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-[var(--theme-ui-border)] border-t-[var(--theme-heading)] rounded-full animate-spin" />
              Downloading...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Icon name="download" size={20} />
              Start Bulk Download
            </span>
          )}
        </Button>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3 backdrop-blur-md">
            <Icon name="error" size={20} />
            <p className="text-sm font-medium flex-1">{errorMsg}</p>
            <button onClick={() => setErrorMsg("")} className="hover:text-red-300">
              <Icon name="close" size={18} />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-xl flex items-center gap-3 backdrop-blur-md">
            <Icon name="check_circle" size={20} />
            <p className="text-sm font-medium flex-1">{successMsg}</p>
            <button onClick={() => setSuccessMsg("")} className="hover:text-green-300">
              <Icon name="close" size={18} />
            </button>
          </div>
        )}

        {(statusMsg || progress.total > 0) && !errorMsg && !successMsg && (
          <div className="p-6 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl backdrop-blur-md space-y-4">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-[var(--theme-heading)]">{statusMsg || "Processing..."}</span>
              {progress.total > 0 && (
                <span className="text-[var(--theme-text)] bg-[var(--theme-bg)]/40 px-3 py-1 rounded-full border border-[var(--theme-ui-border)]">
                  {progress.completed + progress.failed} / {progress.total}
                </span>
              )}
            </div>

            {progress.total > 0 && (
              <>
                <div className="h-2 bg-[var(--theme-bg)] rounded-full overflow-hidden border border-[var(--theme-ui-border)]">
                  <div
                    className="h-full bg-[var(--theme-heading)] transition-all duration-300 relative"
                    style={{
                      width: `${((progress.completed + progress.failed) / progress.total) * 100}%`,
                    }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Icon name="check_circle" size={14} /> {progress.completed} Successful
                  </span>
                  {progress.failed > 0 && (
                    <span className="text-red-400 flex items-center gap-1">
                      <Icon name="error" size={14} /> {progress.failed} Failed / Corrupted
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Downloaded Images Grid */}
        {downloadedImages.length > 0 && (
          <div className="p-6 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl backdrop-blur-md">
            {/* Grid Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-base font-semibold text-[var(--theme-heading)] flex items-center gap-2">Downloaded Images
                <span className="ml-1 text-xs font-medium bg-[var(--theme-heading)]/20 text-[var(--theme-heading)] px-2 py-0.5 rounded-full">
                  {downloadedImages.length}
                </span>
              </h2>

              <div className="flex items-center gap-2">
                {selectionMode ? (
                  <>
                    <span className="text-xs text-[var(--theme-text)] bg-[var(--theme-bg)]/40 px-3 py-1 rounded-full border border-[var(--theme-ui-border)]">
                      {selectedPaths.size} selected
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedPaths(new Set(downloadedImages.map(img => img.path)))}
                      className="text-xs h-8 px-3"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleDeleteSelected}
                      disabled={selectedPaths.size === 0 || isDeleting}
                      icon={<Icon name="delete" size={14} />}
                      className="text-xs h-8 px-3 disabled:opacity-40"
                    >
                      {isDeleting ? "Deleting..." : `Delete (${selectedPaths.size})`}
                    </Button>
                    <button
                      onClick={exitSelectionMode}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--theme-text)] hover:text-[var(--theme-heading)] transition-colors"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="flex items-center gap-1.5 text-xs text-[var(--theme-text)] hover:text-[var(--theme-heading)] bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-[var(--theme-ui-border)] transition-colors"
                  >
                    <Icon name="ads_click" size={13} />
                    Select to Delete
                  </button>
                )}

                {progress.failed > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                    <Icon name="gpp_maybe" size={13} />
                    {progress.failed} corrupted image{progress.failed > 1 ? "s" : ""} skipped
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {downloadedImages.map((img, idx) => (
                  <ImageGridItem
                    key={img.path}
                    img={img}
                    selectionMode={selectionMode}
                    isSelected={selectedPaths.has(img.path)}
                    onSelect={() => toggleSelect(img.path)}
                    onClick={() => setPreviewIndex(idx)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <FileExplorerModal
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        onSelect={(path) => {
          setOutputDir(path);
          setIsExplorerOpen(false);
        }}
        title="Select Download Folder"
        selectionMode="folder"
      />

      {/* Image Preview Modal */}
      {previewIndex !== null && downloadedImages.length > 0 && (
        <ImagePreviewModal
          images={downloadedImages}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}
