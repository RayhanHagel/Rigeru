"use client";
import { Header } from "@/components/ui/Header";
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { DirectMultiUploadBox } from "@/components/ui/DirectMultiUploadBox";
import { ArrowLeft, Minimize2, Eraser, Lock, Layers, Info, ImageDown, Search, GitCompare, Scissors, Image, Globe, Trash2, RotateCw, ListOrdered, Crop, Unlock, Droplets, PenTool, Maximize, Zap, Wrench } from "lucide-react";

type ToolType = "merge" | "split" | "compress" | "pdf-to-image" | "extract-images" | "web-to-pdf" | "remove-pages" | "rotate-pages" | "organize" | "crop" | "protect" | "unlock" | "redact" | "watermark" | "sign" | "metadata" | "resize" | "flatten" | "optimize" | "repair" | "search" | "compare" | null;

export default function PDFStudioPage() {
  const [activeTool, setActiveTool] = useState<ToolType>(null);

  const tools = [
    { id: "merge" as ToolType, name: "Merge PDF", icon: <Layers size={24} className="text-secondary" />, desc: "Combine multiple PDFs into one unified document." },
    { id: "split" as ToolType, name: "Split PDF", icon: <Scissors size={24} className="text-primary" />, desc: "Extract pages or split a PDF into multiple files." },
    { id: "compress" as ToolType, name: "Compress PDF", icon: <Minimize2 size={24} className="text-green-400" />, desc: "Reduce file size while preserving quality." },
    { id: "pdf-to-image" as ToolType, name: "PDF to Image", icon: <ImageDown size={24} className="text-yellow-400" />, desc: "Convert PDF pages into high-quality images." },
    { id: "extract-images" as ToolType, name: "Extract Images", icon: <Image size={24} className="text-cyan-400" />, desc: "Extract all embedded images from your PDF." },
    { id: "web-to-pdf" as ToolType, name: "Web to PDF", icon: <Globe size={24} className="text-secondary" />, desc: "Convert any public webpage into a PDF." },
    
    { id: "remove-pages" as ToolType, name: "Remove Pages", icon: <Trash2 size={24} className="text-red-400" />, desc: "Delete unwanted pages from a PDF." },
    { id: "rotate-pages" as ToolType, name: "Rotate Pages", icon: <RotateCw size={24} className="text-orange-400" />, desc: "Rotate specific or all pages in a PDF." },
    { id: "organize" as ToolType, name: "Organize PDF", icon: <ListOrdered size={24} className="text-emerald-400" />, desc: "Rearrange the page order of your document." },
    { id: "crop" as ToolType, name: "Crop PDF", icon: <Crop size={24} className="text-pink-400" />, desc: "Crop margins from your PDF pages." },
    
    { id: "protect" as ToolType, name: "Protect PDF", icon: <Lock size={24} className="text-red-500" />, desc: "Add a password to secure your document." },
    { id: "unlock" as ToolType, name: "Unlock PDF", icon: <Unlock size={24} className="text-green-500" />, desc: "Remove passwords and security restrictions." },
    { id: "redact" as ToolType, name: "Redact PDF", icon: <Eraser size={24} className="text-zinc-400" />, desc: "Permanently censor sensitive information." },
    { id: "watermark" as ToolType, name: "Add Watermark", icon: <Droplets size={24} className="text-secondary" />, desc: "Stamp an image or text over your PDF." },
    { id: "sign" as ToolType, name: "Sign PDF", icon: <PenTool size={24} className="text-primary" />, desc: "Add a signature to your PDF document." },
    
    { id: "metadata" as ToolType, name: "Edit Metadata", icon: <Info size={24} className="text-yellow-500" />, desc: "View and modify author, title, and PDF metadata." },
    { id: "resize" as ToolType, name: "Change Page Size", icon: <Maximize size={24} className="text-cyan-500" />, desc: "Standardize your pages to A4 or Letter sizes." },
    
    { id: "flatten" as ToolType, name: "Flatten PDF", icon: <Layers size={24} className="text-orange-500" />, desc: "Flatten forms and annotations into the document." },
    { id: "optimize" as ToolType, name: "Optimize PDF", icon: <Zap size={24} className="text-emerald-500" />, desc: "Linearize and optimize for fast web viewing." },
    { id: "repair" as ToolType, name: "Repair PDF", icon: <Wrench size={24} className="text-gray-400" />, desc: "Fix and recover data from corrupted PDFs." },
    
    { id: "search" as ToolType, name: "Search PDF", icon: <Search size={24} className="text-blue-300" />, desc: "Advanced full-text search across documents." },
    { id: "compare" as ToolType, name: "Compare PDFs", icon: <GitCompare size={24} className="text-purple-300" />, desc: "Find visual and textual differences between files." }
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      {activeTool === null ? (
        <>
          <Header title="PDF Studio" subtitle="A unified suite for document processing, analysis, and modification. Select a tool below to get started." />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {tools.map(tool => (
              <div 
                key={tool.id} 
                onClick={() => setActiveTool(tool.id)}
                className="bg-zinc-900/50 border border-white/10 rounded-2xl p-5 backdrop-blur-sm flex flex-col gap-4 cursor-pointer hover:bg-zinc-800/80 hover:border-white/30 transition-all hover:-translate-y-1 group"
              >
                <div className="bg-zinc-950/80 border border-white/5 rounded-xl p-3 w-fit group-hover:scale-110 transition-transform shadow-inner">
                  {tool.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">{tool.name}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-6 animate-slide-up w-full w-full h-full">
          <Button 
            variant="ghost" 
            onClick={() => setActiveTool(null)}
            className="w-fit text-zinc-400 hover:text-white px-0"
          >
            <ArrowLeft size={16} className="mr-2" /> Back to Studio
          </Button>
          
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            {activeTool === "merge" && <GenericMultiUploadTab title="Merge PDF" endpoint="/api/files-documents/pdf-studio/ops/merge" resultName="merged.pdf" />}
            {activeTool === "split" && <SplitPDFTab />}
            {activeTool === "compress" && <CompressPDFTab />}
            {activeTool === "pdf-to-image" && <GenericUploadParamTab title="PDF to Image" endpoint="/api/files-documents/pdf-studio/images/pdf-to-image" paramName="dpi" paramDefault="150" paramLabel="DPI Resolution" />}
            {activeTool === "extract-images" && <GenericUploadTab title="Extract Images" endpoint="/api/files-documents/pdf-studio/images/extract" resultName="images.zip" />}
            {activeTool === "web-to-pdf" && <WebToPDFTab />}
            
            {activeTool === "remove-pages" && <GenericUploadParamTab title="Remove Pages" endpoint="/api/files-documents/pdf-studio/ops/remove" paramName="pages" paramDefault="1, 3" paramLabel="Pages to Remove (comma separated)" />}
            {activeTool === "rotate-pages" && <RotatePDFTab />}
            {activeTool === "organize" && <GenericUploadParamTab title="Organize PDF" endpoint="/api/files-documents/pdf-studio/ops/organize" paramName="order" paramDefault="1, 2, 3" paramLabel="New Page Order (comma separated)" />}
            {activeTool === "crop" && <GenericUploadParamTab title="Crop PDF" endpoint="/api/files-documents/pdf-studio/ops/crop" paramName="margin" paramDefault="36" paramLabel="Margin to crop (points)" />}
            
            {activeTool === "protect" && <GenericUploadParamTab title="Protect PDF" endpoint="/api/files-documents/pdf-studio/security/password" paramName="password" paramDefault="" paramLabel="Password" extraData={{action: 'lock'}} />}
            {activeTool === "unlock" && <GenericUploadParamTab title="Unlock PDF" endpoint="/api/files-documents/pdf-studio/security/password" paramName="password" paramDefault="" paramLabel="Password" extraData={{action: 'unlock'}} />}
            {activeTool === "redact" && <GenericUploadParamTab title="Redact PDF" endpoint="/api/files-documents/pdf-studio/redact" paramName="words" paramDefault="Confidential" paramLabel="Words to redact (comma separated)" />}
            {activeTool === "watermark" && <WatermarkPDFTab />}
            {activeTool === "sign" && <GenericUploadParamTab title="Sign PDF" endpoint="/api/files-documents/pdf-studio/sign" paramName="signature_text" paramDefault="John Doe" paramLabel="Signature Text" />}
            
            {activeTool === "metadata" && <MetadataPDFTab />}
            {activeTool === "resize" && <GenericUploadParamTab title="Resize PDF" endpoint="/api/files-documents/pdf-studio/ops/resize" paramName="target" paramDefault="A4" paramLabel="Target Size (A4 or Letter)" />}
            
            {activeTool === "flatten" && <GenericUploadTab title="Flatten PDF" endpoint="/api/files-documents/pdf-studio/advanced/flatten" resultName="flattened.pdf" />}
            {activeTool === "optimize" && <GenericUploadTab title="Optimize PDF" endpoint="/api/files-documents/pdf-studio/advanced/optimize" resultName="optimized.pdf" />}
            {activeTool === "repair" && <GenericUploadTab title="Repair PDF" endpoint="/api/files-documents/pdf-studio/advanced/repair" resultName="repaired.pdf" />}
            
            {activeTool === "search" && <div className="text-zinc-400 p-4">Search PDF implementation is complex and available via global search indexing.</div>}
            {activeTool === "compare" && <div className="text-zinc-400 p-4">PDF Compare requires side-by-side view. Not fully mocked in this iteration.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// Utility Components

function GenericUploadTab({ title, endpoint, resultName }: { title: string, endpoint: string, resultName: string }) {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    if (!fileHash) return setErrorMsg("Upload a PDF first.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      downloadBlob(blob, resultName);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="mb-4">
        <DirectUploadBox accept="application/pdf" label="Upload PDF" onUploadComplete={(info) => setFileHash(info.hash_name)} onClear={() => setFileHash(null)} />
      </div>
      {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg mb-4">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Process Document</Button>
    </div>
  );
}

function GenericMultiUploadTab({ title, endpoint, resultName }: { title: string, endpoint: string, resultName: string }) {
  const [hashes, setHashes] = useState<{hash_name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    if (hashes.length < 2) return setErrorMsg("Upload at least two PDFs.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    hashes.forEach(h => formData.append("file_hashes", h.hash_name));
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      downloadBlob(blob, resultName);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="mb-4">
        <DirectMultiUploadBox accept="application/pdf" label="Upload PDFs" onUploadComplete={(infos) => setHashes(infos)} onClear={() => setHashes([])} />
      </div>
      {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg mb-4">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Process Documents</Button>
    </div>
  );
}

function GenericUploadParamTab({ title, endpoint, paramName, paramDefault, paramLabel, extraData = {} }: any) {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [param, setParam] = useState(paramDefault);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    if (!fileHash) return setErrorMsg("Upload a PDF first.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    formData.append(paramName, param);
    for (let k in extraData) formData.append(k, extraData[k]);
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "processed.pdf";
      downloadBlob(blob, filename);
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="mb-4">
        <DirectUploadBox accept="application/pdf" label="Upload PDF" onUploadComplete={(info) => setFileHash(info.hash_name)} onClear={() => setFileHash(null)} />
      </div>
      <div className="mb-4">
        <label className="block text-sm text-zinc-400 mb-1">{paramLabel}</label>
        <input type="text" value={param} onChange={e => setParam(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
      </div>
      {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg mb-4">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Process Document</Button>
    </div>
  );
}

function WebToPDFTab() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    if (!url) return setErrorMsg("Enter a URL.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("url", url);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/web-to-pdf", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      downloadBlob(blob, "webpage.pdf");
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">Web to PDF</h3>
      <div className="mb-4">
        <label className="block text-sm text-zinc-400 mb-1">URL</label>
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
      </div>
      {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg mb-4">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Convert to PDF</Button>
    </div>
  );
}

function RotatePDFTab() {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [degrees, setDegrees] = useState(90);
  const [pages, setPages] = useState("all");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    if (!fileHash) return setErrorMsg("Upload a PDF first.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    formData.append("degrees", degrees.toString());
    formData.append("pages", pages);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/ops/rotate", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      downloadBlob(blob, "rotated.pdf");
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">Rotate Pages</h3>
      <div className="mb-4">
        <DirectUploadBox accept="application/pdf" label="Upload PDF" onUploadComplete={(info) => setFileHash(info.hash_name)} onClear={() => setFileHash(null)} />
      </div>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">Degrees</label>
          <select value={degrees} onChange={e => setDegrees(Number(e.target.value))} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white">
            <option value="90">90 (Clockwise)</option>
            <option value="180">180 (Upside Down)</option>
            <option value="270">270 (Counter Clockwise)</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">Pages (e.g. 1,2 or all)</label>
          <input type="text" value={pages} onChange={e => setPages(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
        </div>
      </div>
      {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg mb-4">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Rotate Document</Button>
    </div>
  );
}

function SplitPDFTab() {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    if (!fileHash) return setErrorMsg("Upload a PDF first.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    formData.append("start", startPage.toString());
    formData.append("end", endPage.toString());
    try {
      const res = await fetch("/api/files-documents/pdf-studio/ops/split", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      downloadBlob(blob, "split.pdf");
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">Split / Extract PDF</h3>
      <div className="mb-4">
        <DirectUploadBox accept="application/pdf" label="Upload PDF" onUploadComplete={(info) => setFileHash(info.hash_name)} onClear={() => setFileHash(null)} />
      </div>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">Start Page</label>
          <input type="number" min="1" value={startPage} onChange={e => setStartPage(Number(e.target.value))} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">End Page</label>
          <input type="number" min="1" value={endPage} onChange={e => setEndPage(Number(e.target.value))} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
        </div>
      </div>
      {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg mb-4">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Extract Pages</Button>
    </div>
  );
}

function WatermarkPDFTab() {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState("0.3");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcess = async () => {
    if (!fileHash) return setErrorMsg("Upload a PDF first.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    formData.append("text", text);
    formData.append("opacity", opacity);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/security/watermark", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      downloadBlob(blob, "watermarked.pdf");
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">Add Watermark</h3>
      <div className="mb-4">
        <DirectUploadBox accept="application/pdf" label="Upload PDF" onUploadComplete={(info) => setFileHash(info.hash_name)} onClear={() => setFileHash(null)} />
      </div>
      <div className="mb-4">
        <label className="block text-sm text-zinc-400 mb-1">Watermark Text</label>
        <input type="text" value={text} onChange={e => setText(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
      </div>
      <div className="mb-4">
        <label className="block text-sm text-zinc-400 mb-1">Opacity: {opacity}</label>
        <input type="range" min="0.1" max="1.0" step="0.1" value={opacity} onChange={e => setOpacity(e.target.value)} className="w-full bg-zinc-900" />
      </div>
      {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg mb-4">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Add Watermark</Button>
    </div>
  );
}

function CompressPDFTab() {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [metrics, setMetrics] = useState<any>(null);

  const handleProcess = async () => {
    if (!fileHash) return setErrorMsg("Upload a PDF first.");
    setLoading(true); setErrorMsg(""); setMetrics(null);
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/compress", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const origSize = Number(res.headers.get("X-Original-Size") || 0);
      const newSize = Number(res.headers.get("X-New-Size") || 0);
      const percent = Number(res.headers.get("X-Percent-Saved") || 0);
      
      if (percent > 0) setMetrics({ orig: (origSize/1024).toFixed(2) + " KB", new: (newSize/1024).toFixed(2) + " KB", saved: percent.toFixed(1) + "%" });
      const blob = await res.blob();
      downloadBlob(blob, "compressed.pdf");
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">Compress PDF</h3>
      <div className="mb-4">
        <DirectUploadBox accept="application/pdf" label="Upload PDF" onUploadComplete={(info) => setFileHash(info.hash_name)} onClear={() => setFileHash(null)} />
      </div>
      {metrics && (
        <div className="grid grid-cols-3 gap-4 mb-4 p-4 rounded-xl bg-zinc-900 border border-white/10">
          <div><div className="text-sm text-zinc-400">Original</div><div className="text-xl text-zinc-200">{metrics.orig}</div></div>
          <div><div className="text-sm text-zinc-400">New</div><div className="text-xl text-green-400">{metrics.new}</div></div>
          <div><div className="text-sm text-zinc-400">Saved</div><div className="text-xl text-primary">{metrics.saved}</div></div>
        </div>
      )}
      {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg mb-4">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Compress Document</Button>
    </div>
  );
}

function MetadataPDFTab() {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [metadata, setMetadata] = useState<any>({});

  const handleLoad = async (hash: string) => {
    setFileHash(hash);
    const formData = new FormData(); formData.append("file_hash", hash);
    try {
      const res = await fetch("/api/files-documents/pdf-studio/metadata/get", { method: "POST", body: formData });
      if (res.ok) setMetadata(await res.json());
    } catch (e) {}
  };

  const handleProcess = async () => {
    if (!fileHash) return setErrorMsg("Upload a PDF first.");
    setLoading(true); setErrorMsg("");
    const formData = new FormData();
    formData.append("file_hash", fileHash);
    for (let k in metadata) formData.append(k, metadata[k] || "");
    try {
      const res = await fetch("/api/files-documents/pdf-studio/metadata/update", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const blob = await res.blob();
      downloadBlob(blob, "metadata_updated.pdf");
    } catch (e: any) { setErrorMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">Edit Metadata</h3>
      <div className="mb-4">
        <DirectUploadBox accept="application/pdf" label="Upload PDF" onUploadComplete={(info) => handleLoad(info.hash_name)} onClear={() => setFileHash(null)} />
      </div>
      {fileHash && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {["title", "author", "subject", "keywords", "creator", "producer"].map(field => (
            <div key={field}>
              <label className="block text-sm text-zinc-400 mb-1 capitalize">{field}</label>
              <input type="text" value={metadata[field] || ""} onChange={e => setMetadata({...metadata, [field]: e.target.value})} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
            </div>
          ))}
        </div>
      )}
      {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg mb-4">{errorMsg}</div>}
      <Button variant="primary" isLoading={loading} onClick={handleProcess} className="w-full">Update Metadata</Button>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
