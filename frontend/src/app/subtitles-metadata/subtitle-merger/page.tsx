"use client";

import React, { useState } from "react";
import { FileText, Plus, CheckCircle2, Download } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { STColumns, STColumn } from "@/components/streamlit/STColumns";
import { Button } from "@/components/ui/Button";

export default function SubtitleMergerPage() {
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [overlayFile, setOverlayFile] = useState<File | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleBaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBaseFile(e.target.files[0]);
      setResultUrl(null);
      setMergeError("");
    }
  };

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setOverlayFile(e.target.files[0]);
      setResultUrl(null);
      setMergeError("");
    }
  };

  const runMerge = async () => {
    if (!baseFile || !overlayFile) {
      setMergeError("Please upload both `.ass` files.");
      return;
    }

    setIsMerging(true);
    setMergeError("");
    setResultUrl(null);

    const formData = new FormData();
    formData.append("base_file", baseFile);
    formData.append("overlay_file", overlayFile);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/subtitles/merger/merge", {
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
    a.download = `merged_${baseFile?.name || "subtitles"}.ass`;
    a.click();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="🎞️ ASS Subtitle Merger" />
        <p className="text-zinc-400 mt-2">
          Combine two `.ass` subtitle files together. Perfect for merging AI censor boxes with your existing translated subtitles. Automatically handles coordinate/resolution scaling.
        </p>
      </div>

      <STContainer title="Upload Subtitles" icon={<FileText className="text-indigo-400" size={20} />}>
        <div className="space-y-6">
          <STColumns>
            <STColumn width={1}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">1️⃣ Upload Base Subtitle (.ass)</label>
                <p className="text-xs text-zinc-500 mb-2">Your main text subtitle. Its resolution will be kept.</p>
                {!baseFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileText className="mb-2 text-zinc-500" size={28} />
                      <p className="mb-1 text-sm text-zinc-400"><span className="font-semibold text-zinc-200">Upload .ass file</span></p>
                    </div>
                    <input type="file" className="hidden" accept=".ass" onChange={handleBaseUpload} />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-zinc-950 p-4 border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-zinc-400" />
                      <span className="text-zinc-200 font-medium truncate max-w-[200px]">{baseFile.name}</span>
                    </div>
                    <label className="cursor-pointer text-sm font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg transition-colors">
                      Change
                      <input type="file" className="hidden" accept=".ass" onChange={handleBaseUpload} />
                    </label>
                  </div>
                )}
              </div>
            </STColumn>

            <STColumn width={1}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">2️⃣ Upload Overlay (.ass)</label>
                <p className="text-xs text-zinc-500 mb-2">The subtitle you want to paste on top (e.g. Censor Boxes).</p>
                {!overlayFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl cursor-pointer bg-zinc-900/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileText className="mb-2 text-zinc-500" size={28} />
                      <p className="mb-1 text-sm text-zinc-400"><span className="font-semibold text-zinc-200">Upload .ass file</span></p>
                    </div>
                    <input type="file" className="hidden" accept=".ass" onChange={handleOverlayUpload} />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-zinc-950 p-4 border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-zinc-400" />
                      <span className="text-zinc-200 font-medium truncate max-w-[200px]">{overlayFile.name}</span>
                    </div>
                    <label className="cursor-pointer text-sm font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg transition-colors">
                      Change
                      <input type="file" className="hidden" accept=".ass" onChange={handleOverlayUpload} />
                    </label>
                  </div>
                )}
              </div>
            </STColumn>
          </STColumns>

          {mergeError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {mergeError}
            </div>
          )}

          <Button 
            variant="primary" 
            onClick={runMerge} 
            disabled={!baseFile || !overlayFile || isMerging}
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
      </STContainer>
    </div>
  );
}
