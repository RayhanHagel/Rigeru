"use client";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { DirectUploadBox, directUploadFile } from "@/components/ui/DirectUploadBox";
import { DirectMultiUploadBox } from "@/components/ui/DirectMultiUploadBox";
import { PDFViewer } from "@/components/ui/PDFViewer";
import { PDFThumbnailGrid } from "@/components/ui/PDFThumbnailGrid";
import { Icon } from "@/lib/utils";
import { DndContext, useDroppable, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


type ToolType = "merge" | "split" | "compress" | "pdf-to-image" | "extract-images" | "web-to-pdf" | "remove-pages" | "rotate-pages" | "organize" | "crop" | "protect" | "unlock" | "redact" | "watermark" | "sign" | "metadata" | "resize" | "flatten" | "optimize" | "repair" | "search" | "compare" | null;

export default function PDFStudioPage() {
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState("document.pdf");
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [centerOverride, setCenterOverride] = useState<React.ReactNode | null>(null);

  const tools = [
    { id: "merge" as ToolType, name: "Merge PDF", icon: <Icon name="layers" size={24} className="text-[var(--theme-heading)]" />, desc: "Combine multiple PDFs into one unified document." },
    { id: "split" as ToolType, name: "Split PDF", icon: <Icon name="content_cut" size={24} className="text-[var(--theme-heading)]" />, desc: "Extract pages or split a PDF into multiple files." },
    { id: "compress" as ToolType, name: "Compress PDF", icon: <Icon name="fullscreen_exit" size={24} className="text-[var(--theme-heading)]" />, desc: "Reduce file size while preserving quality." },
    { id: "pdf-to-image" as ToolType, name: "PDF to Image", icon: <Icon name="photo_size_select_large" size={24} className="text-[var(--theme-heading)]" />, desc: "Convert PDF pages into high-quality images. (Downloads ZIP)" },
    { id: "extract-images" as ToolType, name: "Extract Images", icon: <Icon name="image" size={24} className="text-[var(--theme-heading)]" />, desc: "Extract all embedded images from your PDF. (Downloads ZIP)" },
    { id: "web-to-pdf" as ToolType, name: "Web to PDF", icon: <Icon name="language" size={24} className="text-[var(--theme-heading)]" />, desc: "Convert any public webpage into a PDF and replace current document." },
    
    { id: "remove-pages" as ToolType, name: "Remove Pages", icon: <Icon name="delete" size={24} className="text-[var(--theme-heading)]" />, desc: "Delete unwanted pages from a PDF." },
    { id: "rotate-pages" as ToolType, name: "Rotate Pages", icon: <Icon name="redo" size={24} className="text-[var(--theme-heading)]" />, desc: "Rotate specific or all pages in a PDF." },
    { id: "organize" as ToolType, name: "Organize PDF", icon: <Icon name="format_list_numbered" size={24} className="text-[var(--theme-heading)]" />, desc: "Rearrange the page order of your document." },
    { id: "crop" as ToolType, name: "Crop PDF", icon: <Icon name="crop" size={24} className="text-[var(--theme-heading)]" />, desc: "Crop margins from your PDF pages." },
    
    { id: "protect" as ToolType, name: "Protect PDF", icon: <Icon name="lock" size={24} className="text-[var(--theme-heading)]" />, desc: "Add a password to secure your document." },
    { id: "unlock" as ToolType, name: "Unlock PDF", icon: <Icon name="lock_open" size={24} className="text-[var(--theme-heading)]" />, desc: "Remove passwords and security restrictions." },
    { id: "redact" as ToolType, name: "Redact PDF", icon: <Icon name="ink_eraser" size={24} className="text-[var(--theme-heading)]" />, desc: "Permanently censor sensitive information." },
    { id: "watermark" as ToolType, name: "Add Watermark", icon: <Icon name="water_drop" size={24} className="text-[var(--theme-heading)]" />, desc: "Stamp an image or text over your PDF." },
    { id: "sign" as ToolType, name: "Sign PDF", icon: <Icon name="draw" size={24} className="text-[var(--theme-heading)]" />, desc: "Add a signature to your PDF document." },
    
    { id: "metadata" as ToolType, name: "Edit Metadata", icon: <Icon name="info" size={24} className="text-[var(--theme-heading)]" />, desc: "View and modify author, title, and PDF metadata." },
    { id: "resize" as ToolType, name: "Change Page Size", icon: <Icon name="fullscreen" size={24} className="text-[var(--theme-heading)]" />, desc: "Standardize your pages to A4 or Letter sizes." },
    
    { id: "flatten" as ToolType, name: "Flatten PDF", icon: <Icon name="layers" size={24} className="text-[var(--theme-heading)]" />, desc: "Flatten forms and annotations into the document." },
    { id: "optimize" as ToolType, name: "Optimize PDF", icon: <Icon name="bolt" size={24} className="text-[var(--theme-heading)]" />, desc: "Linearize and optimize for fast web viewing." },
    { id: "repair" as ToolType, name: "Repair PDF", icon: <Icon name="build" size={24} className="text-[var(--theme-heading)]" />, desc: "Fix and recover data from corrupted PDFs." }
  ];

  const handleInitialUpload = (info: { hash_name: string; original_name: string }) => {
    setCurrentHash(info.hash_name);
    setFileName(info.original_name);
  };

  const onUpdateDocument = async (blob: Blob) => {
    setIsUpdating(true);
    setErrorMsg("");
    try {
      const uploaded = await directUploadFile(blob, undefined, fileName, "application/pdf");
      setCurrentHash(uploaded.hash_name);
    } catch(e: any) {
      console.error("Failed to update preview", e);
      setErrorMsg(e.message || "Failed to update preview");
    } finally {
      setIsUpdating(false);
    }
  };

  function downloadBlob(blob: Blob, name: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  const handleDownloadFinal = async () => {
    if (!currentHash) return;
    try {
      const res = await fetch(`http://localhost:8000/uploads/${currentHash}`);
      const blob = await res.blob();
      downloadBlob(blob, `edited_${fileName}`);
    } catch (e) {
      console.error(e);
    }
  };

  const toolProps = { currentHash, fileName, onUpdateDocument, onExport: downloadBlob, setCenterOverride };

  return (
    <div className="w-full h-[calc(100vh)] flex flex-col font-sans relative z-10 overflow-hidden bg-[var(--theme-bg)]">
      {/* Top Header */}
      <div className="px-6 pt-6 shrink-0 z-20 bg-[var(--theme-bg)]">
        <Header 
          title={currentHash ? fileName : "PDF Studio"} 
          subtitle="Advanced tools for managing, editing, and modifying PDF documents."
          className="!mb-0"
          actions={
            <div className="flex items-center gap-4">
              {errorMsg && <span className="text-red-400 text-sm">{errorMsg}</span>}
              {currentHash && (
                <>
                  <Button variant="secondary" onClick={() => { setCurrentHash(null); setActiveTool(null); setFileName("document.pdf"); }} icon={<Icon name="close" size={18} />}>
                    Close
                  </Button>
                  <Button variant="primary" onClick={handleDownloadFinal} icon={<Icon name="download" size={18} />}>
                    Download Final
                  </Button>
                </>
              )}
            </div>
          }
        />
      </div>

      <div className="flex-1 flex overflow-hidden w-full relative min-h-0">
        {/* Left Toolbar */}
        <div className="w-20 shrink-0 border-r border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]/80 backdrop-blur-md flex flex-col items-center py-4 gap-2 overflow-y-auto overflow-x-hidden custom-scrollbar z-20">
          {tools.map(tool => (
            <button 
              key={tool.id} 
              onClick={() => setActiveTool(tool.id)}
              title={`${tool.name}\n${tool.desc}`}
              className={`p-3 rounded-xl transition-all flex items-center justify-center relative w-12 h-12 shrink-0 ${activeTool === tool.id ? 'bg-[var(--theme-heading)] shadow-md' : 'hover:bg-[var(--theme-ui-border)]'}`}
            >
              {React.cloneElement(tool.icon as React.ReactElement<any>, { 
                className: activeTool === tool.id ? "text-[var(--theme-bg)]" : "text-[var(--theme-heading)]" 
              })}
            </button>
          ))}
        </div>

        {/* Center Preview */}
        <div className="flex-1 min-w-0 min-h-0 bg-[var(--theme-bg)] relative w-full h-full p-6">
          {isUpdating && (
            <div className="absolute inset-0 bg-[var(--theme-bg)]/60 backdrop-blur-sm z-30 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 bg-[var(--theme-ui-bg)] p-8 rounded-2xl border border-[var(--theme-ui-border)] shadow-2xl">
                <Icon name="sync" className="animate-spin text-[var(--theme-heading)]" size={40} />
                <span className="text-[var(--theme-heading)] font-semibold text-lg">Applying Changes...</span>
              </div>
            </div>
          )}
          {currentHash ? (
            centerOverride ? (
              <div className="w-full h-full animate-fade-in">{centerOverride}</div>
            ) : (
              <PDFViewer url={`http://localhost:8000/uploads/${currentHash}`} />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto animate-slide-up">
              <Icon name="description" size={48} className="text-[var(--theme-ui-border)] mb-6" />
              <h2 className="text-2xl font-bold text-[var(--theme-heading)] mb-2">Welcome to PDF Studio</h2>
              <p className="text-[var(--theme-text)] text-center mb-10">Upload a PDF document to begin, or select a tool like "Web to PDF" from the sidebar to fetch one automatically.</p>
              <div className="w-full">
                <DirectUploadBox accept="application/pdf" label="Upload PDF Document" onUploadComplete={handleInitialUpload} />
              </div>
            </div>
          )}
        </div>

        {/* Right Config Panel */}
        {activeTool && (
          <div className="w-80 shrink-0 border-l border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]/95 backdrop-blur-md p-6 overflow-y-auto custom-scrollbar z-20 flex flex-col shadow-[-4px_0_24px_-10px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg text-[var(--theme-heading)]">{tools.find(t => t.id === activeTool)?.name}</h3>
              <button onClick={() => setActiveTool(null)} className="text-[var(--theme-text)] hover:text-[var(--theme-heading)] p-1">
                <Icon name="close" size={20} />
              </button>
            </div>
            
            <p className="text-sm text-[var(--theme-text)] mb-6 pb-6 border-b border-[var(--theme-ui-border)]">
              {tools.find(t => t.id === activeTool)?.desc}
            </p>

            <div className="flex-1">
              {activeTool === "merge" && <MergePDFTab {...toolProps} />}
              {activeTool === "split" && <SplitPDFTab {...toolProps} />}
              {activeTool === "compress" && <CompressPDFTab {...toolProps} />}
              {activeTool === "pdf-to-image" && <PDFToImageTab {...toolProps} />}
              {activeTool === "extract-images" && <ExtractImagesTab {...toolProps} />}
              {activeTool === "web-to-pdf" && <WebToPDFTab {...toolProps} />}
              
              {activeTool === "remove-pages" && <RemovePagesTab {...toolProps} />}
              {activeTool === "rotate-pages" && <RotatePDFTab {...toolProps} />}
              {activeTool === "organize" && <OrganizePDFTab {...toolProps} />}
              {activeTool === "crop" && <GenericActionParamTab endpoint="/api/files-documents/pdf-studio/ops/crop" paramName="margin" paramDefault="36" paramLabel="Margin to crop (points)" {...toolProps} />}
              
              {activeTool === "protect" && <GenericActionParamTab endpoint="/api/files-documents/pdf-studio/security/password" paramName="password" paramDefault="" paramLabel="Password" extraData={{action: 'lock'}} {...toolProps} />}
              {activeTool === "unlock" && <GenericActionParamTab endpoint="/api/files-documents/pdf-studio/security/password" paramName="password" paramDefault="" paramLabel="Password" extraData={{action: 'unlock'}} {...toolProps} />}
              {activeTool === "redact" && <GenericActionParamTab endpoint="/api/files-documents/pdf-studio/redact" paramName="words" paramDefault="Confidential" paramLabel="Words to redact (comma separated)" {...toolProps} />}
              {activeTool === "watermark" && <WatermarkPDFTab {...toolProps} />}
              {activeTool === "sign" && <SignPDFTab {...toolProps} />}
              
              {activeTool === "metadata" && <MetadataPDFTab {...toolProps} />}
              {activeTool === "resize" && <ResizePDFTab {...toolProps} />}
              
              {activeTool === "flatten" && <GenericActionTab endpoint="/api/files-documents/pdf-studio/advanced/flatten" {...toolProps} />}
              {activeTool === "optimize" && <GenericActionTab endpoint="/api/files-documents/pdf-studio/advanced/optimize" {...toolProps} />}
              {activeTool === "repair" && <GenericActionTab endpoint="/api/files-documents/pdf-studio/advanced/repair" {...toolProps} />}
              
              {activeTool === "search" && <div className="text-[var(--theme-text)] p-4 text-center">Not available in Editor View.</div>}
              {activeTool === "compare" && <div className="text-[var(--theme-text)] p-4 text-center">Not available in Editor View.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility Components

function GenericActionTab({ endpoint, currentHash, onUpdateDocument, onExport, isExport = false }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      if (isExport) {
         const filename = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "export.zip";
         onExport(blob, filename);
      } else {
         await onUpdateDocument(blob);
      }
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">
        {isExport ? "Export Output" : "Apply Changes"}
      </Button>
    </div>
  );
}

function GenericMultiActionTab({ endpoint, currentHash, onUpdateDocument }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [showModal, setShowModal] = useState(false);
  const [extraHashes, setExtraHashes] = useState<{hash_name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    if (extraHashes.length === 0) return setErrorMsg("Upload at least one more PDF to merge.");
    setShowModal(false);
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hashes", currentHash);
    extraHashes.forEach(h => formData.append("file_hashes", h.hash_name));
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
      setExtraHashes([]);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <Button variant="secondary" onClick={() => setShowModal(true)}>
         Add More Files
      </Button>
      {extraHashes.length > 0 && <span className="text-xs text-[var(--theme-text)]">{extraHashes.length} file(s) ready to merge.</span>}
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full" disabled={extraHashes.length === 0}>
        Merge Documents
      </Button>
      
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--theme-ui-bg)] p-6 rounded-2xl border border-[var(--theme-ui-border)] shadow-2xl w-full max-w-lg flex flex-col gap-4 animate-slide-up">
             <div className="flex justify-between items-center mb-2">
               <h3 className="text-[var(--theme-heading)] font-semibold text-lg">Upload Additional Files</h3>
               <button onClick={() => setShowModal(false)} className="text-[var(--theme-text)] hover:text-[var(--theme-heading)]"><Icon name="close" size={24}/></button>
             </div>
             <p className="text-sm text-[var(--theme-text)] mb-2">These files will be merged with your current document.</p>
             <DirectMultiUploadBox accept="application/pdf" label="Upload PDFs" onUploadComplete={(infos) => setExtraHashes(infos)} onClear={() => setExtraHashes([])} />
             <div className="mt-4 flex justify-end gap-3">
               <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
               <Button variant="primary" onClick={handleProcess} disabled={extraHashes.length === 0}>Merge Now</Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GenericActionParamTab({ endpoint, paramName, paramDefault, paramLabel, extraData = {}, currentHash, onUpdateDocument, onExport, isExport = false }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [param, setParam] = useState(paramDefault);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    formData.append(paramName, param);
    for (let k in extraData) formData.append(k, extraData[k]);
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      if (isExport) {
         const filename = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "export.zip";
         onExport(blob, filename);
      } else {
         await onUpdateDocument(blob);
      }
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">{paramLabel}</label>
        <input type="text" value={param} onChange={e => setParam(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2.5 rounded-lg text-[var(--theme-heading)] text-sm transition-colors" />
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2">
        {isExport ? "Export Output" : "Apply Changes"}
      </Button>
    </div>
  );
}

function WebToPDFTab({ currentHash, onUpdateDocument }: any) {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    if (!url) return setErrorMsg("Enter a URL.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("url", url);
    if (currentHash) formData.append("file_hash", currentHash);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/web-to-pdf", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {currentHash && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-200 mb-2">
           Info: The fetched PDF will be appended to your current document.
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">Target URL</label>
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2.5 rounded-lg text-[var(--theme-heading)] text-sm transition-colors" />
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2">{currentHash ? "Append Web PDF" : "Fetch Web PDF"}</Button>
    </div>
  );
}

function RotatePDFTab({ currentHash, onUpdateDocument }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [degrees, setDegrees] = useState(90);
  const [pages, setPages] = useState("all");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    formData.append("degrees", degrees.toString());
    formData.append("pages", pages);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/ops/rotate", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">Degrees</label>
        <select value={degrees} onChange={e => setDegrees(Number(e.target.value))} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2.5 rounded-lg text-[var(--theme-heading)] text-sm transition-colors">
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="90">90 (Clockwise)</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="180">180 (Upside Down)</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="270">270 (Counter Clockwise)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">Pages (e.g. 1,2 or all)</label>
        <input type="text" value={pages} onChange={e => setPages(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2.5 rounded-lg text-[var(--theme-heading)] text-sm transition-colors" />
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2">Apply Rotation</Button>
    </div>
  );
}

function SplitPDFTab({ currentHash, onExport, setCenterOverride }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [numBuckets, setNumBuckets] = useState(2);
  const [buckets, setBuckets] = useState<number[][]>([[], []]);

  useEffect(() => {
    setBuckets(Array.from({ length: numBuckets }, () => []));
  }, [numBuckets]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;
    const pageNum = active.data.current?.pageNumber;
    const bucketIndex = over.data.current?.bucketIndex;
    if (pageNum !== undefined && bucketIndex !== undefined) {
      setBuckets(prev => {
        const next = [...prev];
        next.forEach((b, i) => { next[i] = b.filter(p => p !== pageNum); });
        next[bucketIndex] = [...next[bucketIndex], pageNum].sort((a,b) => a-b);
        return next;
      });
    }
  };

  useEffect(() => {
    setCenterOverride(
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex h-full w-full gap-4 relative">
          <div className="flex-1 min-w-0">
             <PDFThumbnailGrid url={`http://localhost:8000/uploads/${currentHash}`} mode="draggable" />
          </div>
          <div className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
             <h3 className="text-sm font-semibold text-[var(--theme-heading)]">Split PDFs (Buckets)</h3>
             {buckets.map((bucketPages, idx) => (
                <BucketDroppable key={idx} index={idx} pages={bucketPages} />
             ))}
          </div>
        </div>
      </DndContext>
    );
    return () => setCenterOverride(null);
  }, [currentHash, setCenterOverride, buckets, numBuckets]);

  const handleProcess = async () => {
    const validBuckets = buckets.filter(b => b.length > 0);
    if (validBuckets.length === 0) return setErrorMsg("Assign at least one page to a bucket.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    formData.append("buckets_json", JSON.stringify(validBuckets));
    try {
      const res = await fetch("/api/files-documents/pdf-studio/ops/split", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "export.zip";
      onExport(blob, filename);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="p-3 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-lg text-xs text-[var(--theme-text)]">
        Drag pages into the buckets to split the document into multiple PDFs.
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">Number of PDFs</label>
        <input type="number" min="2" max="10" value={numBuckets} onChange={e => setNumBuckets(Number(e.target.value))} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2.5 rounded-lg text-[var(--theme-heading)] text-sm transition-colors" />
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2">Download Split PDFs (ZIP)</Button>
    </div>
  );
}

function BucketDroppable({ index, pages }: { index: number, pages: number[] }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `bucket-${index}`,
    data: { bucketIndex: index }
  });
  
  return (
    <div ref={setNodeRef} className={`p-4 rounded-xl border-2 transition-all min-h-[100px] flex flex-col gap-2 ${isOver ? 'border-[var(--theme-heading)] bg-[var(--theme-heading)]/10' : 'border-dashed border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]'}`}>
       <div className="font-semibold text-[var(--theme-heading)] text-sm">PDF {index + 1}</div>
       <div className="flex flex-wrap gap-1">
          {pages.length === 0 && <span className="text-xs text-[var(--theme-text)]">Drag pages here</span>}
          {pages.map(p => (
            <span key={p} className="text-[10px] bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)] px-1.5 py-0.5 rounded">
              Pg {p}
            </span>
          ))}
       </div>
    </div>
  );
}

function MergePDFTab({ currentHash, fileName, onUpdateDocument, setCenterOverride }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState<{id: string, hash_name: string, name: string}[]>([
    { id: currentHash, hash_name: currentHash, name: fileName || "Current Document" }
  ]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleUploadComplete = (infos: any[]) => {
    const newItems = infos.map((info, idx) => ({ id: info.hash_name + idx, hash_name: info.hash_name, name: info.original_name || `Uploaded PDF ${items.length + idx + 1}` }));
    setItems([...items, ...newItems]);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      setItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setCenterOverride(
      <div className="flex flex-col h-full items-center justify-center gap-6">
         <h2 className="text-xl font-semibold text-[var(--theme-heading)]">Merge PDF Order</h2>
         <p className="text-[var(--theme-text)] text-sm">Drag to reorder the documents.</p>
         <div className="w-full max-w-md bg-[var(--theme-ui-bg)] p-4 rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
                 <div className="flex flex-col gap-2">
                   {items.map((item, idx) => (
                     <SortableMergeCard key={item.id} id={item.id} name={item.name} index={idx} />
                   ))}
                 </div>
              </SortableContext>
            </DndContext>
         </div>
         <Button variant="secondary" onClick={() => setShowModal(true)}>Add More PDFs</Button>
      </div>
    );
    return () => setCenterOverride(null);
  }, [currentHash, setCenterOverride, items, showModal]);

  const handleProcess = async () => {
    if (items.length < 2) return setErrorMsg("Need at least 2 PDFs to merge.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    items.forEach(h => formData.append("file_hashes", h.hash_name));
    try {
      const res = await fetch("/api/files-documents/pdf-studio/ops/merge", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full" disabled={items.length < 2}>
        Apply Merge
      </Button>
      
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--theme-ui-bg)] p-6 rounded-2xl border border-[var(--theme-ui-border)] shadow-2xl w-full max-w-lg flex flex-col gap-4 animate-slide-up">
             <div className="flex justify-between items-center mb-2">
               <h3 className="text-[var(--theme-heading)] font-semibold text-lg">Upload Additional Files</h3>
               <button onClick={() => setShowModal(false)} className="text-[var(--theme-text)] hover:text-[var(--theme-heading)]"><Icon name="close" size={24}/></button>
             </div>
             <p className="text-sm text-[var(--theme-text)] mb-2">These files will be added to the merge list.</p>
             <DirectMultiUploadBox accept="application/pdf" label="Upload PDFs" onUploadComplete={handleUploadComplete} onClear={() => {}} />
             <div className="mt-4 flex justify-end gap-3">
               <Button variant="secondary" onClick={() => setShowModal(false)}>Done</Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableMergeCard({ id, name, index }: { id: string, name: string, index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`relative flex items-center gap-4 cursor-grab active:cursor-grabbing p-3 rounded-lg transition-colors ${isDragging ? 'bg-[var(--theme-heading)] text-[var(--theme-bg)] shadow-xl ring-2 ring-[var(--theme-heading)]' : 'bg-[var(--theme-bg)] text-[var(--theme-text)] hover:bg-[var(--theme-ui-border)] shadow-sm border border-[var(--theme-ui-border)]'}`}
    >
      <div className="font-mono text-xs w-6 h-6 rounded-full bg-black/10 flex items-center justify-center shrink-0">{index + 1}</div>
      <Icon name="description" size={20} />
      <span className="font-medium text-sm truncate flex-1">{name}</span>
      <Icon name="drag_indicator" size={16} className="opacity-50" />
    </div>
  );
}

function WatermarkPDFTab({ currentHash, onUpdateDocument }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState("0.3");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    formData.append("text", text);
    formData.append("opacity", opacity);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/security/watermark", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">Watermark Text</label>
        <input type="text" value={text} onChange={e => setText(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2.5 rounded-lg text-[var(--theme-heading)] text-sm transition-colors" />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">Opacity: {opacity}</label>
        <input type="range" min="0.1" max="1.0" step="0.1" value={opacity} onChange={e => setOpacity(e.target.value)} className="w-full accent-[var(--theme-heading)]" />
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2">Apply Watermark</Button>
    </div>
  );
}

function CompressPDFTab({ currentHash, onUpdateDocument }: any) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [metrics, setMetrics] = useState<any>(null);

  const handleProcess = async () => {
    setLoading(true); setErrorMsg(""); setMetrics(null);
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/compress", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const origSize = Number(res.headers.get("X-Original-Size") || 0);
      const newSize = Number(res.headers.get("X-New-Size") || 0);
      const percent = Number(res.headers.get("X-Percent-Saved") || 0);
      
      if (percent > 0) setMetrics({ orig: (origSize/1024).toFixed(2) + " KB", new: (newSize/1024).toFixed(2) + " KB", saved: percent.toFixed(1) + "%" });
      const blob = await res.blob();
      await onUpdateDocument(blob);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {metrics && (
        <div className="grid grid-cols-3 gap-2 p-4 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] shadow-inner">
          <div className="flex flex-col"><span className="text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text)]">Original</span><span className="text-sm text-[var(--theme-text)]">{metrics.orig}</span></div>
          <div className="flex flex-col"><span className="text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text)]">New</span><span className="text-sm text-green-400">{metrics.new}</span></div>
          <div className="flex flex-col"><span className="text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text)]">Saved</span><span className="text-sm font-semibold text-[var(--theme-heading)]">{metrics.saved}</span></div>
        </div>
      )}
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Compress Document</Button>
    </div>
  );
}

function MetadataPDFTab({ currentHash, onUpdateDocument }: any) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [metadata, setMetadata] = useState<any>({});
  const [isLoaded, setIsLoaded] = useState(false);

  React.useEffect(() => {
    const fetchMetadata = async () => {
      const formData = new FormData(); formData.append("file_hash", currentHash);
      try {
        const res = await fetch("/api/files-documents/pdf-studio/metadata/get", { method: "POST", body: formData });
        if (res.ok) {
           setMetadata(await res.json());
           setIsLoaded(true);
        }
      } catch (e) {}
    };
    fetchMetadata();
  }, [currentHash]);

  const handleProcess = async () => {
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    for (let k in metadata) formData.append(k, metadata[k] || "");
    try {
      const res = await fetch("/api/files-documents/pdf-studio/metadata/update", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {!isLoaded ? (
         <div className="flex items-center justify-center py-8">
           <Icon name="sync" size={24} className="animate-spin text-[var(--theme-text)]" />
         </div>
      ) : (
        <div className="flex flex-col gap-3">
          {["title", "author", "subject", "keywords", "creator", "producer"].map(field => (
            <div key={field}>
              <label className="block text-xs font-medium text-[var(--theme-text)] mb-1 capitalize">{field}</label>
              <input type="text" value={metadata[field] || ""} onChange={e => setMetadata({...metadata, [field]: e.target.value})} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2 rounded-lg text-[var(--theme-heading)] text-sm transition-colors" />
            </div>
          ))}
        </div>
      )}
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2" disabled={!isLoaded}>Update Metadata</Button>
    </div>
  );
}

function SignPDFTab({ currentHash, onUpdateDocument }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  
  const [x, setX] = useState("10");
  const [y, setY] = useState("10");
  const [w, setW] = useState("150");
  const [h, setH] = useState("50");

  const handleProcess = async () => {
    if (!signatureFile) return setErrorMsg("Upload a signature image first.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    formData.append("signature", signatureFile);
    formData.append("x", x);
    formData.append("y", y);
    formData.append("w", w);
    formData.append("h", h);
    
    try {
      const res = await fetch("/api/files-documents/pdf-studio/sign", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">Signature Image (PNG)</label>
        <input type="file" accept="image/png, image/jpeg" onChange={e => setSignatureFile(e.target.files?.[0] || null)} className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] p-2 rounded-lg text-sm text-[var(--theme-text)]" />
      </div>
      <div className="grid grid-cols-2 gap-2">
         <div>
           <label className="block text-[10px] uppercase font-bold text-[var(--theme-text)] mb-1">X Position (pt)</label>
           <input type="number" value={x} onChange={e => setX(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] p-2 rounded text-sm text-[var(--theme-heading)]" />
         </div>
         <div>
           <label className="block text-[10px] uppercase font-bold text-[var(--theme-text)] mb-1">Y Position (pt)</label>
           <input type="number" value={y} onChange={e => setY(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] p-2 rounded text-sm text-[var(--theme-heading)]" />
         </div>
         <div>
           <label className="block text-[10px] uppercase font-bold text-[var(--theme-text)] mb-1">Width (pt)</label>
           <input type="number" value={w} onChange={e => setW(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] p-2 rounded text-sm text-[var(--theme-heading)]" />
         </div>
         <div>
           <label className="block text-[10px] uppercase font-bold text-[var(--theme-text)] mb-1">Height (pt)</label>
           <input type="number" value={h} onChange={e => setH(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] p-2 rounded text-sm text-[var(--theme-heading)]" />
         </div>
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2" disabled={!signatureFile}>Apply Signature</Button>
    </div>
  );
}

function ResizePDFTab({ currentHash, onUpdateDocument }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [metadata, setMetadata] = useState<any>({});
  const [targetSize, setTargetSize] = useState("A4");
  
  const [customW, setCustomW] = useState("595");
  const [customH, setCustomH] = useState("842");
  
  const [isLoaded, setIsLoaded] = useState(false);

  React.useEffect(() => {
    const fetchMetadata = async () => {
      const formData = new FormData(); formData.append("file_hash", currentHash);
      try {
        const res = await fetch("/api/files-documents/pdf-studio/metadata/get", { method: "POST", body: formData });
        if (res.ok) {
           setMetadata(await res.json());
           setIsLoaded(true);
        }
      } catch (e) {}
    };
    fetchMetadata();
  }, [currentHash]);

  const handleProcess = async () => {
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    formData.append("target", targetSize === "Custom" ? `${customW}x${customH}` : targetSize);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/ops/resize", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {isLoaded && metadata.page_size && (
        <div className="p-3 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-lg text-xs text-[var(--theme-text)] flex items-center justify-between">
          <span>Current Page Size:</span>
          <span className="font-semibold text-[var(--theme-heading)]">{metadata.page_size} pt</span>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">Target Size</label>
        <select value={targetSize} onChange={e => setTargetSize(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2.5 rounded-lg text-[var(--theme-heading)] text-sm transition-colors mb-2">
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="A3">A3 (842 x 1191 pt)</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="A4">A4 (595 x 842 pt)</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="A5">A5 (420 x 595 pt)</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Letter">Letter (612 x 792 pt)</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Legal">Legal (612 x 1008 pt)</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Tabloid">Tabloid (792 x 1224 pt)</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Custom">Custom Size...</option>
        </select>
        
        {targetSize === "Custom" && (
           <div className="grid grid-cols-2 gap-2 mt-2">
             <div>
               <label className="block text-[10px] uppercase font-bold text-[var(--theme-text)] mb-1">Width (pt)</label>
               <input type="number" value={customW} onChange={e => setCustomW(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] p-2 rounded text-sm text-[var(--theme-heading)]" />
             </div>
             <div>
               <label className="block text-[10px] uppercase font-bold text-[var(--theme-text)] mb-1">Height (pt)</label>
               <input type="number" value={customH} onChange={e => setCustomH(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] p-2 rounded text-sm text-[var(--theme-heading)]" />
             </div>
           </div>
        )}
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2">Apply Resize</Button>
    </div>
  );
}

function OrganizePDFTab({ currentHash, onUpdateDocument, setCenterOverride }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [order, setOrder] = useState<number[]>([]);

  useEffect(() => {
    setCenterOverride(
      <PDFThumbnailGrid 
        url={`http://localhost:8000/uploads/${currentHash}`} 
        mode="sort" 
        onOrderChange={setOrder} 
      />
    );
    return () => setCenterOverride(null);
  }, [currentHash, setCenterOverride]);

  const handleProcess = async () => {
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    formData.append("order", order.join(","));
    try {
      const res = await fetch("/api/files-documents/pdf-studio/ops/organize", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="p-3 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-lg text-xs text-[var(--theme-text)]">
        Drag and drop the pages in the center preview to reorder them.
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2">Apply New Order</Button>
    </div>
  );
}

function RemovePagesTab({ currentHash, onUpdateDocument, setCenterOverride }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  useEffect(() => {
    setCenterOverride(
      <PDFThumbnailGrid 
        key={`remove-${selectedPages.join(",")}`}
        url={`http://localhost:8000/uploads/${currentHash}`} 
        mode="select" 
        selectedPages={selectedPages}
        onSelectionChange={setSelectedPages} 
      />
    );
    return () => setCenterOverride(null);
  }, [currentHash, setCenterOverride, selectedPages]);

  const handleProcess = async () => {
    if (selectedPages.length === 0) return setErrorMsg("Select at least one page to remove.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    formData.append("pages", selectedPages.join(","));
    try {
      const res = await fetch("/api/files-documents/pdf-studio/ops/remove", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      await onUpdateDocument(blob);
      setSelectedPages([]);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="p-3 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-lg text-xs text-[var(--theme-text)]">
        Click the pages in the center preview that you want to remove.
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2" disabled={selectedPages.length === 0}>Remove Selected Pages</Button>
    </div>
  );
}

function ExtractImagesTab({ currentHash, onExport, setCenterOverride }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  useEffect(() => {
    setCenterOverride(
      <PDFThumbnailGrid 
        key={`extract-${selectedPages.join(",")}`}
        url={`http://localhost:8000/uploads/${currentHash}`} 
        mode="select" 
        selectedPages={selectedPages}
        onSelectionChange={setSelectedPages} 
      />
    );
    return () => setCenterOverride(null);
  }, [currentHash, setCenterOverride, selectedPages]);

  const handleProcess = async () => {
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    if (selectedPages.length > 0) formData.append("pages", selectedPages.join(","));
    else formData.append("pages", "all");
    
    try {
      const res = await fetch("/api/files-documents/pdf-studio/images/extract", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "export.zip";
      onExport(blob, filename);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="p-3 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-lg text-xs text-[var(--theme-text)]">
        Select pages in the center preview to extract images from. Leave empty to extract from all pages.
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2">Extract Images</Button>
    </div>
  );
}

function PDFToImageTab({ currentHash, onExport, setCenterOverride }: any) {
  if (!currentHash) return <div className="text-[var(--theme-text)] text-sm p-4 text-center">Please upload or fetch a document first.</div>;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [dpi, setDpi] = useState("150");
  const [fmt, setFmt] = useState("png");

  useEffect(() => {
    setCenterOverride(
      <PDFThumbnailGrid 
        key={`pdf2img-${selectedPages.join(",")}`}
        url={`http://localhost:8000/uploads/${currentHash}`} 
        mode="select" 
        selectedPages={selectedPages}
        onSelectionChange={setSelectedPages} 
      />
    );
    return () => setCenterOverride(null);
  }, [currentHash, setCenterOverride, selectedPages]);

  const handleProcess = async () => {
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", currentHash);
    formData.append("dpi", dpi);
    formData.append("fmt", fmt);
    if (selectedPages.length > 0) formData.append("pages", selectedPages.join(","));
    else formData.append("pages", "all");
    
    try {
      const res = await fetch("/api/files-documents/pdf-studio/images/pdf-to-image", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "export.zip";
      onExport(blob, filename);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="p-3 bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-lg text-xs text-[var(--theme-text)]">
        Select pages to convert to images. Leave empty for all pages.
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">DPI Resolution</label>
        <input type="number" value={dpi} onChange={e => setDpi(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2.5 rounded-lg text-[var(--theme-heading)] text-sm transition-colors" />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--theme-text)] mb-2">Image Format</label>
        <select value={fmt} onChange={e => setFmt(e.target.value)} className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] focus:outline-none focus:border-[var(--theme-heading)] focus:ring-1 focus:ring-[var(--theme-heading)] p-2.5 rounded-lg text-[var(--theme-heading)] text-sm transition-colors">
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="png">PNG</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="jpeg">JPG</option>
          <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="webp">WEBP</option>
        </select>
      </div>
      {errorMsg && <div className="p-3 bg-[var(--theme-ui-bg)] border border-red-500/30 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full mt-2">Convert to Images</Button>
    </div>
  );
}
