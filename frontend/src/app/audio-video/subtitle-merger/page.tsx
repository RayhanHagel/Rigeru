"use client";

import React, { useState } from "react";

import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { Icon } from "@/lib/utils";

export default function SubtitleMergerPage() {
  const [baseFileHash, setBaseFileHash] = useState<string | null>(null);
  const [baseFileName, setBaseFileName] = useState("");
  const [overlayFileHash, setOverlayFileHash] = useState<string | null>(null);
  const [overlayFileName, setOverlayFileName] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const runMerge = async () => {
    if (!baseFileHash || !overlayFileHash) {
      setMergeError("Please upload both `.ass` files.");
      return;
    }

    setIsMerging(true);
    setMergeError("");
    setResultUrl(null);

    const formData = new FormData();
    formData.append("base_file_hash", baseFileHash);
    formData.append("overlay_file_hash", overlayFileHash);

    try {
      const res = await fetch("/api/subtitles/merger/merge", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.detail || "Failed to merge subtitles");
      }

      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setMergeError(err.message);
    } finally {
      setIsMerging(false);
    }
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `merged_${baseFileName || "subtitles"}.ass`;
    a.click();
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="ASS Subtitle Merger" subtitle="Combine two .ass subtitle files together. Automatically handles coordinate scaling." />

      <SectionHeader title="Upload Subtitles" />
      <div className="flex flex-col gap-6 mt-4">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="w-full">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--theme-heading)]">Upload Base Subtitle (.ass)</label>
                <p className="text-xs text-[var(--theme-text)] mb-2">Your main text subtitle. Its resolution will be kept.</p>
                {!baseFileHash ? (
                  <>
                    <DirectUploadBox 
                      accept=".ass"
                      label="Upload Base Subtitle"
                      onUploadComplete={(info) => {
                        setBaseFileHash(info.hash_name);
                        setBaseFileName(info.original_name);
                        setResultUrl(null);
                        setMergeError("");
                      }}
                      onClear={() => {
                        setBaseFileHash(null);
                        setBaseFileName("");
                      }}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-between bg-[var(--theme-bg)] p-4 border border-[var(--theme-ui-border)] rounded-xl">
                    <div className="flex items-center gap-3">
                      <Icon name="description" size={20} className="text-[var(--theme-text)]" />
                      <span className="text-[var(--theme-text)] font-bold truncate max-w-[200px]">{baseFileName}</span>
                    </div>
                    <button
                      className="cursor-pointer text-sm font-medium text-[var(--theme-heading)] hover:text-opacity-80 bg-[var(--theme-heading)]/10 px-3 py-1.5 rounded-lg transition-colors"
                      onClick={() => {
                        setBaseFileHash(null);
                        setBaseFileName("");
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--theme-heading)]">Upload Overlay (.ass)</label>
                <p className="text-xs text-[var(--theme-text)] mb-2">The subtitle you want to paste on top (e.g. Censor Boxes).</p>
                {!overlayFileHash ? (
                  <>
                    <DirectUploadBox 
                      accept=".ass"
                      label="Upload Overlay"
                      onUploadComplete={(info) => {
                        setOverlayFileHash(info.hash_name);
                        setOverlayFileName(info.original_name);
                        setResultUrl(null);
                        setMergeError("");
                      }}
                      onClear={() => {
                        setOverlayFileHash(null);
                        setOverlayFileName("");
                      }}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-between bg-[var(--theme-bg)] p-4 border border-[var(--theme-ui-border)] rounded-xl">
                    <div className="flex items-center gap-3">
                      <Icon name="description" size={20} className="text-[var(--theme-text)]" />
                      <span className="text-[var(--theme-text)] font-bold truncate max-w-[200px]">{overlayFileName}</span>
                    </div>
                    <button
                      className="cursor-pointer text-sm font-medium text-[var(--theme-heading)] hover:text-opacity-80 bg-[var(--theme-heading)]/10 px-3 py-1.5 rounded-lg transition-colors"
                      onClick={() => {
                        setOverlayFileHash(null);
                        setOverlayFileName("");
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {mergeError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {mergeError}
            </div>
          )}

          <Button 
            variant="primary" 
            onClick={runMerge} 
            disabled={!baseFileHash || !overlayFileHash || isMerging}
            className="w-full py-4 text-base font-medium transition-shadow"
          >
            {isMerging ? "Calculating coordinate scaling and merging files..." : "Merge Subtitles"}
          </Button>

          {resultUrl && (
            <div className="p-6 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl space-y-4 animate-in slide-in-from-bottom-4 text-center">
              <div className="flex items-center justify-center gap-2 text-[var(--theme-heading)] font-medium text-lg">
                <Icon name="check_circle" size={24} />
                Successfully merged subtitles!
              </div>
              <Button onClick={downloadResult} variant="secondary" className="w-full bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] hover:bg-[var(--theme-bg)]">
                Download Merged Subtitle
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
