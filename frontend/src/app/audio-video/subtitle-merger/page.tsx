"use client";

import React, { useState } from "react";
import { FileText, Plus, CheckCircle2, Download } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { Container } from "@/components/ui/Container";
import { Columns, Column } from "@/components/ui/Columns";
import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";

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

      <Container title="Upload Subtitles" icon={<FileText className="text-secondary" size={20} />}>
        <div className="space-y-6">
          <div className="flex flex-col gap-6">
            <div className="w-full">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">1️⃣ Upload Base Subtitle (.ass)</label>
                <p className="text-xs text-zinc-500 mb-2">Your main text subtitle. Its resolution will be kept.</p>
                {!baseFileHash ? (
                  <div className="flex flex-col items-center justify-center w-full h-32 rounded-xl bg-zinc-900/50 transition-colors">
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
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-zinc-950 p-4 border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-zinc-400" />
                      <span className="text-zinc-200 font-medium truncate max-w-[200px]">{baseFileName}</span>
                    </div>
                    <button
                      className="cursor-pointer text-sm font-medium text-secondary hover:text-indigo-300 bg-secondary/10 px-3 py-1.5 rounded-lg transition-colors"
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
                <label className="text-sm font-medium text-zinc-300">2️⃣ Upload Overlay (.ass)</label>
                <p className="text-xs text-zinc-500 mb-2">The subtitle you want to paste on top (e.g. Censor Boxes).</p>
                {!overlayFileHash ? (
                  <div className="flex flex-col items-center justify-center w-full h-32 rounded-xl bg-zinc-900/50 transition-colors">
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
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-zinc-950 p-4 border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-zinc-400" />
                      <span className="text-zinc-200 font-medium truncate max-w-[200px]">{overlayFileName}</span>
                    </div>
                    <button
                      className="cursor-pointer text-sm font-medium text-secondary hover:text-indigo-300 bg-secondary/10 px-3 py-1.5 rounded-lg transition-colors"
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
            className="w-full py-4 text-base font-medium shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-shadow"
          >
            {isMerging ? "Calculating coordinate scaling and merging files..." : "🔄 Merge Subtitles"}
          </Button>

          {resultUrl && (
            <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-xl space-y-4 animate-in slide-in-from-bottom-4 text-center">
              <div className="flex items-center justify-center gap-2 text-green-400 font-medium text-lg">
                <CheckCircle2 size={24} />
                Successfully merged subtitles!
              </div>
              <Button onClick={downloadResult} variant="secondary" className="w-full bg-zinc-800 hover:bg-zinc-700">
                <Download size={18} className="mr-2" />
                Download Merged Subtitle
              </Button>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
