"use client";

import React, { useState } from "react";

import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import BatchFolderSelector from "@/components/ui/BatchFolderSelector";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { DirectMultiUploadBox } from "@/components/ui/DirectMultiUploadBox";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { ImageZoomModal } from "@/components/ui/ImageZoomModal";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Icon } from "@/lib/utils";

export default function PinholePhotographyPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFileHash, setSelectedFileHash] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [isFolderExplorerOpen, setIsFolderExplorerOpen] = useState(false);
  const [inputMode, setInputMode] = useState("single");
  const [batchFiles, setBatchFiles] = useState<any[]>([]);

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

      // 1. Stage folder or use single file hash
      if (inputMode === "batch") {
        if (batchFiles.length > 0) {
          hashes = batchFiles.map(f => f.hash_name);
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

      // 2. Call batch endpoint
      const batchData = new FormData();
      batchData.append("hashes", JSON.stringify(hashes));

      // Direct call to backend — bypasses Next.js proxy to avoid timeout on long ops
      const token = localStorage.getItem("auth_token") || "";
      const baseUrl = window.location.protocol + "//" + window.location.hostname + ":8000";

      const res = await fetch(`${baseUrl}/api/pinhole/process/batch`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: batchData,
      });

      if (!res.ok) {
        let errorMsg = "Processing failed";
        const text = await res.text();
        try {
          const err = JSON.parse(text);
          errorMsg = err.detail || errorMsg;
        } catch {
          errorMsg = text || `Server error (${res.status})`;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setResultZipUrl(data.zip_url);
      setProcessedUrls(data.processed_urls);
      setOriginalUrls(data.original_urls);
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
      a.href = `http://127.0.0.1:8000${resultZipUrl}`;
      a.download = resultZipUrl.split('/').pop() || "processed_images.zip";
      a.click();
    } else if (processedUrls.length === 1) {
      const a = document.createElement("a");
      a.href = `http://127.0.0.1:8000${processedUrls[0]}`;
      a.download = "pinhole_photo.png";
      a.click();
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-[var(--theme-ui-border)] pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-[var(--theme-heading)] tracking-tight">Pinhole Photography</h1>
          <p className="text-[var(--theme-text)] text-sm font-medium">Turn a video into a single long-exposure photograph.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs
            tabs={[
              { id: "single", label: "Single File", icon: <Icon name="insert_drive_file" size={16} /> },
              { id: "batch", label: "Batch Folder", icon: <Icon name="folder" size={16} /> }
            ]}
            activeTab={inputMode}
            setActiveTab={(tab) => {
              setInputMode(tab);
              clearState();
              setBatchFiles([]);
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-8 w-full">
        {/* SECTION 1: INPUT */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <SectionHeader title="Upload media" />

            <div className="flex flex-col gap-2">
              {inputMode === "single" ? (
                <ModernTabContent activeTab="single">
                  <DirectUploadBox
                    accept="video/mp4, video/webm, video/ogg, video/quicktime"
                    label={selectedFolderPath ? "Folder selected (Clear to upload file)" : "Upload Video"}
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
                      accept="video/*"
                      label="Select Multiple Files"
                      onUploadComplete={(files) => setBatchFiles(files)}
                      onClear={() => setBatchFiles([])}
                    />

                    <div className="flex items-center gap-4">
                      <div className="h-px bg-white/10 flex-1" />
                      <span className="text-xs text-[var(--theme-text)] font-normal uppercase">OR ENTIRE FOLDER</span>
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

            <Button variant="primary"
              className="w-full h-12 text-lg mt-2 border-none !shadow-none !ring-0 !outline-none transition-colors"
              onClick={handleProcess}
              disabled={(inputMode === "single" && !selectedFileHash) || (inputMode === "batch" && !selectedFolderPath && batchFiles.length === 0) || isProcessing}
             style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}>
              {isProcessing ? "Processing..." : "Process Videos"}
            </Button>
          </div>
        </div>

        {/* SECTION 2: OUTPUT */}
        <div className="flex flex-col gap-2 h-full mt-8">
            <SectionHeader title="Download Output" />

            <div className="flex-1 w-full bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
              {processedUrls.length === 0 ? (
                inputMode === "single" ? (
                  <div className="flex flex-col items-center justify-center text-[var(--theme-text)] gap-3">
                    <Icon name="image" size={48} className="opacity-30" />
                    <p>Processed images will appear here.</p>
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
                    onClick={() => setPreviewImage(`http://127.0.0.1:8000${processedUrls[0]}`)}
                  >
                    <img
                      src={`http://127.0.0.1:8000${processedUrls[0]}`}
                      className="w-full h-full object-contain p-2"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-sm font-medium text-[var(--theme-heading)]">Zoom Fullscreen</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-2">
                    {processedUrls.map((url, i) => (
                      <div
                        key={i}
                        className="aspect-square bg-[var(--theme-ui-bg)] rounded-xl border border-[var(--theme-ui-border)] overflow-hidden cursor-pointer hover:border-[var(--theme-heading)] transition-all group relative"
                        onClick={() => setPreviewImage(`http://127.0.0.1:8000${url}`)}
                      >
                        <img
                          src={`http://127.0.0.1:8000${url}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Icon name="visibility" size={24} className="text-white drop-shadow-md" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                          <p className="text-[10px] text-white truncate">{url.split('/').pop()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button variant="primary"
                className="w-full mt-4 h-12 text-lg border-none !shadow-none !ring-0 !outline-none transition-colors"
                style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
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
