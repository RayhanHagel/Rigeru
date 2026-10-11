"use client";

import React, { useState } from "react";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import BatchFolderSelector from "@/components/ui/BatchFolderSelector";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { DirectMultiUploadBox } from "@/components/ui/DirectMultiUploadBox";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { ImageZoomModal } from "@/components/ui/ImageZoomModal";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Icon } from "@/lib/utils";

export default function ExposurePage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFileHash, setSelectedFileHash] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [isFolderExplorerOpen, setIsFolderExplorerOpen] = useState(false);
  const [inputMode, setInputMode] = useState("single");
  const [batchFiles, setBatchFiles] = useState<any[]>([]);

  // Exposure compensation value (-3.0 to +3.0 EV)
  const [exposureEv, setExposureEv] = useState<number>(0.0);

  // Results
  const [resultZipUrl, setResultZipUrl] = useState<string | null>(null);
  const [originalUrls, setOriginalUrls] = useState<string[]>([]);
  const [processedUrls, setProcessedUrls] = useState<string[]>([]);

  // Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const clearState = () => {
    setSelectedFileHash(null);
    setSelectedFileName("");
    setSelectedFolderPath("");
    setResultZipUrl(null);
    setOriginalUrls([]);
    setProcessedUrls([]);
  };

  const handleProcess = async () => {
    if (inputMode === "single" && !selectedFileHash) return;
    if (inputMode === "batch" && !selectedFolderPath && batchFiles.length === 0) return;

    setIsProcessing(true);
    try {
      let hashes: string[] = [];

      if (inputMode === "batch") {
        if (batchFiles.length > 0) {
          hashes = batchFiles.map((f) => f.hash_name);
        } else if (selectedFolderPath) {
          const formData = new FormData();
          formData.append("folder_path", selectedFolderPath);
          const res = await fetch("/api/system/upload/stage-folder", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Failed to stage folder");
          const data = await res.json();
          hashes = data.files.map((f: any) => f.hash_name);
        }
      } else if (inputMode === "single") {
        if (selectedFileHash) {
          hashes = [selectedFileHash];
        }
      }

      if (hashes.length === 0) throw new Error("No files to process");

      const token = localStorage.getItem("auth_token") || "";

      if (inputMode === "single") {
        const formData = new FormData();
        formData.append("file_hash", hashes[0]);
        formData.append("ev", exposureEv.toString());

        const res = await fetch("/api/exposure/process", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const text = await res.text();
          let msg = "Processing failed";
          try {
            msg = JSON.parse(text).detail || msg;
          } catch {}
          throw new Error(msg);
        }

        const data = await res.json();
        setProcessedUrls([data.image_url]);
        setOriginalUrls([`/uploads/${hashes[0]}`]);
        setResultZipUrl(null);
      } else {
        const batchData = new FormData();
        batchData.append("hashes", JSON.stringify(hashes));
        batchData.append("ev", exposureEv.toString());

        const res = await fetch("/api/exposure/process/batch", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: batchData,
        });

        if (!res.ok) {
          const text = await res.text();
          let msg = "Batch processing failed";
          try {
            msg = JSON.parse(text).detail || msg;
          } catch {}
          throw new Error(msg);
        }

        const data = await res.json();
        setResultZipUrl(data.zip_url);
        setProcessedUrls(data.processed_urls);
        setOriginalUrls(data.original_urls);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (resultZipUrl) {
      const a = document.createElement("a");
      a.href = `${resultZipUrl}`;
      a.download = resultZipUrl.split("/").pop() || "exposure_batch.zip";
      a.click();
    } else if (processedUrls.length === 1) {
      const a = document.createElement("a");
      a.href = `${processedUrls[0]}`;
      a.download = "exposure_result.jpg";
      a.click();
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar animate-slide-up flex flex-col font-sans">
      <Header
        title="Exposure"
        subtitle="Simulate camera exposure EV compensation and long exposure frame accumulation."
        actions={
          <ModernTabs
            tabs={[
              { id: "single", label: "Single File" },
              { id: "batch", label: "Batch Folder" },
            ]}
            activeTab={inputMode}
            setActiveTab={(tab) => {
              setInputMode(tab);
              clearState();
              setBatchFiles([]);
            }}
          />
        }
      />

      <div className="flex flex-col gap-8 w-full">
        {/* SECTION 1: INPUT */}
        <div className="flex flex-col gap-4">
          <SectionHeader title="Upload Media & Settings" />

          {/* Exposure slider parameter */}
          <div
            className="p-4 rounded-xl border flex flex-col gap-2"
            style={{
              backgroundColor: "var(--theme-ui-bg)",
              borderColor: "var(--theme-ui-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--theme-heading)]">
                Exposure Compensation (EV)
              </span>
              <span className="text-sm font-bold text-[var(--theme-text)]">
                {exposureEv > 0 ? `+${exposureEv.toFixed(1)}` : exposureEv.toFixed(1)} EV
              </span>
            </div>
            <input
              type="range"
              min="-3.0"
              max="3.0"
              step="0.1"
              value={exposureEv}
              onChange={(e) => setExposureEv(parseFloat(e.target.value))}
              className="accent-[var(--theme-heading)] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[var(--theme-text)] opacity-60">
              <span>-3.0 EV (Darker)</span>
              <span>0.0 EV (Original / Blend)</span>
              <span>+3.0 EV (Brighter)</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {inputMode === "single" ? (
              <ModernTabContent activeTab="single">
                <DirectUploadBox
                  accept="image/*, video/*"
                  label={selectedFolderPath ? "Folder selected (Clear to upload file)" : "Upload Photo or Video"}
                  onUploadComplete={(info) => {
                    setSelectedFileHash(info.hash_name);
                    setSelectedFileName(info.original_name);
                    setSelectedFolderPath("");
                  }}
                  onClear={clearState}
                  defaultFileName={selectedFileName}
                />
              </ModernTabContent>
            ) : (
              <ModernTabContent activeTab="batch">
                <div className="flex flex-col gap-2">
                  <DirectMultiUploadBox
                    accept="image/*, video/*"
                    label="Select Multiple Photos or Videos"
                    onUploadComplete={(files) => setBatchFiles(files)}
                    onClear={() => setBatchFiles([])}
                  />

                  <div className="flex items-center gap-4">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-xs text-[var(--theme-text)] font-normal uppercase">
                      OR ENTIRE FOLDER
                    </span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>

                  <BatchFolderSelector
                    selectedFolderPath={selectedFolderPath}
                    onSelectFolderClick={() => setIsFolderExplorerOpen(true)}
                  />
                </div>
              </ModernTabContent>
            )}
          </div>

          <Button
            variant="primary"
            className="w-full h-12 text-lg mt-2 border-none !shadow-none !ring-0 !outline-none transition-colors"
            onClick={handleProcess}
            disabled={
              (inputMode === "single" && !selectedFileHash) ||
              (inputMode === "batch" && !selectedFolderPath && batchFiles.length === 0) ||
              isProcessing
            }
            style={{
              backgroundColor: "var(--theme-heading)",
              color: "var(--theme-bg)",
              boxShadow: "none",
            }}
          >
            {isProcessing ? "Processing..." : "Process Exposure"}
          </Button>
        </div>

        {/* SECTION 2: OUTPUT */}
        <div className="flex flex-col gap-2 h-full mt-4">
          <SectionHeader title="Download Output" />

          <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
            {processedUrls.length === 0 ? (
              inputMode === "single" ? (
                <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                  <Icon name="exposure" size={48} className="opacity-30" />
                  <p>Processed exposure image will appear here.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                  <Icon name="folder_zip" size={48} className="opacity-30" />
                  <p>Processed batch will appear here.</p>
                </div>
              )
            ) : processedUrls.length === 1 ? (
              <div className="w-full h-full flex flex-col gap-4">
                <div
                  className="w-full flex-1 relative bg-[var(--theme-ui-bg)] rounded-lg overflow-hidden border border-[var(--theme-ui-border)] cursor-pointer group"
                  onClick={() => setPreviewImage(`${processedUrls[0]}`)}
                >
                  <img
                    src={`${processedUrls[0]}`}
                    alt="Exposure Result"
                    className="w-full h-full object-contain p-2"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-sm font-medium text-[var(--theme-heading)]">
                      Zoom Fullscreen
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-2">
                  {processedUrls.map((url, i) => (
                    <div
                      key={i}
                      className="aspect-square bg-[var(--theme-ui-bg)] rounded-xl border border-[var(--theme-ui-border)] overflow-hidden cursor-pointer hover:border-[var(--theme-heading)] transition-all group relative"
                      onClick={() => setPreviewImage(`${url}`)}
                    >
                      <img
                        src={`${url}`}
                        alt="Exposure item"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Icon name="visibility" size={24} className="text-white drop-shadow-md" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-[10px] text-white truncate">{url.split("/").pop()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            className="w-full mt-4 h-12 text-lg border-none !shadow-none !ring-0 !outline-none transition-colors"
            style={{
              backgroundColor: "var(--theme-heading)",
              color: "var(--theme-bg)",
              boxShadow: "none",
            }}
            onClick={handleDownload}
            disabled={processedUrls.length === 0}
            icon={<Icon name="download" size={16} />}
          >
            {resultZipUrl ? "Download ZIP" : "Download"}
          </Button>
        </div>
      </div>

      <FileExplorerModal
        isOpen={isFolderExplorerOpen}
        onClose={() => setIsFolderExplorerOpen(false)}
        onSelect={(path) => {
          setSelectedFolderPath(path);
          setSelectedFileHash(null);
          setSelectedFileName("");
          setIsFolderExplorerOpen(false);
        }}
        selectionMode="folder"
      />

      <ImageZoomModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage || ""}
      />
    </div>
  );
}
