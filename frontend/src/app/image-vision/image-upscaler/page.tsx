"use client";

import React, { useState } from "react";
import { Image as ImageIcon, Download, Loader2, Folder, LayoutTemplate, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ImageCompareSlider } from "@/components/ui/ImageCompareSlider";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { DirectMultiUploadBox } from "@/components/ui/DirectMultiUploadBox";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { ImageZoomModal } from "@/components/ui/ImageZoomModal";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";

export default function ImageUpscalerPage() {
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
    if (!selectedFileHash && !selectedFolderPath && batchFiles.length === 0) return;

    setIsProcessing(true);
    try {
      let hashes: string[] = [];

      // 1. Stage folder or use single file hash
      if (batchFiles.length > 0) {
        hashes = batchFiles.map(f => f.hash_name);
      } else if (selectedFolderPath) {
        const formData = new FormData();
        formData.append("folder_path", selectedFolderPath);
        const res = await fetch("/api/system/upload/stage-folder", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Failed to stage folder");
        const data = await res.json();
        hashes = data.files.map((f: any) => f.hash_name);
      } else if (selectedFileHash) {
        hashes = [selectedFileHash];
      }

      if (hashes.length === 0) throw new Error("No files to process");

      // 2. Call batch endpoint
      const batchData = new FormData();
      batchData.append("hashes", JSON.stringify(hashes));

      const res = await fetch("/api/media-vision/upscale-image/batch", {
        method: "POST",
        body: batchData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Processing failed");
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
      a.download = "upscaled_image.png";
      a.click();
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AI Image Upscaler</h1>
          <p className="text-zinc-400 text-sm font-medium">Locally restore, enhance, and upscale low-resolution images using Deep Learning.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs
            tabs={[
              { id: "single", label: "Single File", icon: <FileIcon size={16} /> },
              { id: "batch", label: "Batch Folder", icon: <Folder size={16} /> }
            ]}
            activeTab={inputMode}
            setActiveTab={setInputMode}
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
                    accept="image/png, image/jpeg, image/webp"
                    label={selectedFolderPath ? "Folder selected (Clear to upload file)" : "Upload Image"}
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
                      accept="image/*"
                      label="Select Multiple Files"
                      onUploadComplete={(files) => setBatchFiles(files)}
                      onClear={() => setBatchFiles([])}
                    />

                    <div className="flex items-center gap-4">
                      <div className="h-px bg-white/10 flex-1" />
                      <span className="text-xs text-zinc-500 font-medium uppercase">OR ENTIRE FOLDER</span>
                      <div className="h-px bg-white/10 flex-1" />
                    </div>

                    <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                          <Folder size={20} />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium text-white truncate">
                            {selectedFolderPath || "No folder selected"}
                          </p>
                          <p className="text-xs text-zinc-500">Batch process multiple images</p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsFolderExplorerOpen(true)}
                      >
                        Select Folder
                      </Button>
                    </div>
                  </div>
                </ModernTabContent>
              )}
            </div>

            <Button
              variant="primary"
              className="w-full h-12 text-lg mt-2"
              onClick={handleProcess}
              disabled={(!selectedFileHash && !selectedFolderPath && batchFiles.length === 0) || isProcessing}
            >
              {isProcessing ? "Processing..." : "Process Images"}
            </Button>
          </div>
        </div>

        {/* SECTION 2: OUTPUT */}
        <div className="flex flex-col gap-2 mt-8 h-full">
            <SectionHeader title="Download Output" />

            <div className="flex-1 w-full bg-black/50 rounded-xl border border-white/5 relative overflow-hidden min-h-[400px] flex items-center justify-center p-4">
              {processedUrls.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-zinc-600 gap-3">
                  <ImageIcon size={48} className="opacity-30" />
                  <p>Processed images will appear here.</p>
                </div>
              ) : processedUrls.length === 1 ? (
                <div className="w-full h-full flex flex-col gap-4">
                  <ImageCompareSlider
                    originalImage={`http://127.0.0.1:8000${originalUrls[0]}`}
                    processedImage={`http://127.0.0.1:8000${processedUrls[0]}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-center"
                    onClick={() => setPreviewImage(`http://127.0.0.1:8000${processedUrls[0]}`)}
                  >
                    View Fullscreen
                  </Button>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-2">
                    {processedUrls.map((url, i) => (
                      <div
                        key={i}
                        className="aspect-square bg-zinc-950 rounded-lg border border-white/10 overflow-hidden relative group cursor-pointer"
                        onClick={() => setPreviewImage(`http://127.0.0.1:8000${url}`)}
                      >
                        <img
                          src={`http://127.0.0.1:8000${url}`}
                          className="w-full h-full object-contain p-2"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-sm font-medium text-white">Zoom</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button
                variant="primary"
                className="w-full mt-4 h-12 text-lg"
                onClick={handleDownload}
                disabled={processedUrls.length === 0}
                icon={<Download size={16} />}
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
