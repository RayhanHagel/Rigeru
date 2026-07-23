"use client";

import React, { useState } from "react";
import { STContainer, STTabs, STHeader, STTitle } from "@/components/streamlit";
import { Button } from "@/components/ui/Button";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { FolderSearch, ArrowLeft, Minimize2, Eraser, Lock, Layers, Info, ImageDown, Search } from "lucide-react";

type ToolType = "compress" | "redact" | "security" | "operations" | "metadata" | "convert" | "search" | null;

export default function PDFStudioPage() {
  const [activeTool, setActiveTool] = useState<ToolType>(null);

  const tools = [
    { id: "compress" as ToolType, name: "Compress PDF", icon: <Minimize2 size={24} className="text-blue-400" />, desc: "Reduce file size while preserving quality." },
    { id: "redact" as ToolType, name: "Redact PDF", icon: <Eraser size={24} className="text-red-400" />, desc: "Permanently remove sensitive information." },
    { id: "security" as ToolType, name: "Security & Watermarks", icon: <Lock size={24} className="text-emerald-400" />, desc: "Add passwords and custom watermarks." },
    { id: "operations" as ToolType, name: "Page Operations", icon: <Layers size={24} className="text-purple-400" />, desc: "Merge, split, extract, and rearrange pages." },
    { id: "metadata" as ToolType, name: "Metadata", icon: <Info size={24} className="text-yellow-400" />, desc: "View and edit document metadata." },
    { id: "convert" as ToolType, name: "Convert & OCR", icon: <ImageDown size={24} className="text-cyan-400" />, desc: "Extract text and convert formats." },
    { id: "search" as ToolType, name: "Search PDF", icon: <Search size={24} className="text-pink-400" />, desc: "Advanced search within documents." }
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-5xl mx-auto overflow-y-auto">
      {activeTool === null ? (
        <>
          <div className="mb-8 flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              Document Studio
            </h1>
            <p className="text-zinc-400 text-sm font-medium">
              A unified suite for document processing, analysis, and modification. Select a tool below to get started.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map(tool => (
              <div 
                key={tool.id} 
                onClick={() => setActiveTool(tool.id)}
                className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 cursor-pointer hover:bg-zinc-800/50 hover:border-white/20 transition-all group"
              >
                <div className="bg-zinc-950 rounded-xl p-3 w-fit group-hover:scale-110 transition-transform">
                  {tool.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{tool.name}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-6 animate-fade-in">
          <Button 
            variant="ghost" 
            onClick={() => setActiveTool(null)}
            className="w-fit text-zinc-400 hover:text-white px-0"
          >
            <ArrowLeft size={16} className="mr-2" /> Back to Studio
          </Button>
          
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            {activeTool === "compress" && <CompressPDFTab />}
            {activeTool === "redact" && <RedactPDFTab />}
            {activeTool === "security" && <SecurityPDFTab />}
            {activeTool === "operations" && <OperationsPDFTab />}
            {activeTool === "metadata" && <MetadataPDFTab />}
            {activeTool === "convert" && <ConvertPDFTab />}
            {activeTool === "search" && <SearchPDFTab />}
          </div>
        </div>
      )}
    </div>
  );
}

function CompressPDFTab() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [metrics, setMetrics] = useState<{ orig: string, new: string, saved: string } | null>(null);

  const handleCompress = async () => {
    if (!file) {
      setErrorMsg("Please upload a PDF file.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setMetrics(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/compress", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Compression failed");
      }

      const origSize = Number(res.headers.get("X-Original-Size") || 0);
      const newSize = Number(res.headers.get("X-New-Size") || 0);
      const percent = Number(res.headers.get("X-Percent-Saved") || 0);

      if (percent === 0) {
        setErrorMsg("The PDF is already highly optimized. No further compression could be applied.");
        // Still provide download if they want it
      } else {
        setMetrics({
          orig: (origSize / 1024).toFixed(2) + " KB",
          new: (newSize / 1024).toFixed(2) + " KB",
          saved: percent.toFixed(1) + "%"
        });
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compressed_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <STHeader 
        title=":material/compress: Compress PDF" 
        subtitle="Reduce the file size of your PDF documents locally. The optimized file will be prepared for download." 
      />
      <STContainer border>
        <div className="mb-4">
          <input 
            type="file" 
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors"
          />
        </div>
        
        {file && (
          <div className="mb-4 text-sm text-zinc-300">
            <strong>Original Size:</strong> {(file.size / 1024).toFixed(2)} KB
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 mb-6">
            {errorMsg}
          </div>
        )}

        {metrics && (
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-zinc-900 border border-white/10">
            <div>
              <div className="text-sm text-zinc-400">Original Size</div>
              <div className="text-xl font-mono text-zinc-200">{metrics.orig}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">New Size</div>
              <div className="text-xl font-mono text-green-400">{metrics.new}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">Space Saved</div>
              <div className="text-xl font-mono text-purple-400">{metrics.saved}</div>
            </div>
          </div>
        )}

        <Button variant="primary" isLoading={loading} onClick={handleCompress} className="w-full">
          Optimize & Compress
        </Button>
      </STContainer>
    </div>
  );
}

function RedactPDFTab() {
  const [file, setFile] = useState<File | null>(null);
  const [words, setWords] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRedact = async () => {
    if (!file) {
      setErrorMsg("Please upload a PDF file.");
      return;
    }
    if (!words.trim()) {
      setErrorMsg("Please enter at least one word to redact.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("words", words);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/redact", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Redaction failed");
      }

      const count = Number(res.headers.get("X-Redaction-Count") || 0);

      if (count === 0) {
        setErrorMsg("No matches found. No redactions were made.");
        return;
      } else {
        setSuccessMsg(`Successfully made ${count} redaction(s)!`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redacted_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <STHeader 
        title=":material/ink_eraser: PDF Redactor" 
        subtitle="Permanently censor sensitive words or phrases from your PDF documents locally. The underlying text data is completely removed." 
      />
      <STContainer border>
        <div className="mb-6">
          <input 
            type="file" 
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors"
          />
        </div>

        {file && (
          <div className="mb-6">
            <STTitle>Words to Redact</STTitle>
            <textarea 
              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all h-24 mb-2"
              placeholder="e.g., John Doe, Password123, Confidential, Account Number"
              value={words}
              onChange={(e) => setWords(e.target.value)}
            />
            <p className="text-sm text-blue-400 bg-blue-500/10 p-2 rounded border border-blue-500/20">
              Note: This process is case-sensitive and requires exact matches.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 mb-6">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 mb-6">
            {successMsg}
          </div>
        )}

        <Button variant="primary" isLoading={loading} onClick={handleRedact} className="w-full">
          Redact Document
        </Button>
      </STContainer>
    </div>
  );
}

function SecurityPDFTab() {
  const [securityMode, setSecurityMode] = useState("Lock/Unlock PDF");
  
  // Password state
  const [pwFile, setPwFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [actionType, setActionType] = useState("lock");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwErrorMsg, setPwErrorMsg] = useState("");
  const [pwSuccessMsg, setPwSuccessMsg] = useState("");

  // Watermark state
  const [wmFile, setWmFile] = useState<File | null>(null);
  const [watermarkText, setWatermarkText] = useState("");
  const [opacity, setOpacity] = useState(0.3);
  const [wmLoading, setWmLoading] = useState(false);
  const [wmErrorMsg, setWmErrorMsg] = useState("");
  const [wmSuccessMsg, setWmSuccessMsg] = useState("");

  const handlePassword = async () => {
    if (!pwFile) {
      setPwErrorMsg("Please upload a PDF file.");
      return;
    }
    if (!password) {
      setPwErrorMsg("Please enter a password.");
      return;
    }

    setPwLoading(true);
    setPwErrorMsg("");
    setPwSuccessMsg("");

    const formData = new FormData();
    formData.append("file", pwFile);
    formData.append("password", password);
    formData.append("action", actionType);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/security/password", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Security operation failed");
      }

      setPwSuccessMsg(`Document successfully ${actionType === 'lock' ? 'secured' : 'unlocked'}!`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${actionType === 'lock' ? 'locked' : 'unlocked'}_${pwFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setPwErrorMsg(err.message);
      } else {
        setPwErrorMsg(String(err));
      }
    } finally {
      setPwLoading(false);
    }
  };

  const handleWatermark = async () => {
    if (!wmFile) {
      setWmErrorMsg("Please upload a PDF file.");
      return;
    }
    if (!watermarkText) {
      setWmErrorMsg("Please enter text for the watermark.");
      return;
    }

    setWmLoading(true);
    setWmErrorMsg("");
    setWmSuccessMsg("");

    const formData = new FormData();
    formData.append("file", wmFile);
    formData.append("text", watermarkText);
    formData.append("opacity", opacity.toString());

    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/security/watermark", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Watermark failed");
      }

      setWmSuccessMsg("Watermark applied successfully!");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watermarked_${wmFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setWmErrorMsg(err.message);
      } else {
        setWmErrorMsg(String(err));
      }
    } finally {
      setWmLoading(false);
    }
  };

  return (
    <div className="w-full">
      <STHeader 
        title=":material/lock: Security & Watermarks" 
        subtitle="Protect your documents with encryption, unlock secured files, or apply custom watermarks." 
      />
      
      <div className="flex gap-4 mb-6">
        {["Lock/Unlock PDF", "Add Watermark"].map((mode) => (
          <button
            key={mode}
            onClick={() => setSecurityMode(mode)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              securityMode === mode 
                ? "bg-white text-black" 
                : "bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <STContainer border>
        {securityMode === "Lock/Unlock PDF" ? (
          <div>
            <div className="flex gap-4 mb-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-200">
                <input type="radio" name="actionType" checked={actionType === "lock"} onChange={() => setActionType("lock")} />
                Lock (Add Password)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-200">
                <input type="radio" name="actionType" checked={actionType === "unlock"} onChange={() => setActionType("unlock")} />
                Unlock (Remove Password)
              </label>
            </div>
            
            <div className="mb-6">
              <input 
                type="file" 
                accept="application/pdf"
                onChange={(e) => setPwFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors"
              />
            </div>
            
            {pwFile && (
              <div className="mb-6">
                <input 
                  type="password"
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  placeholder="Enter Password (••••••••)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            
            {pwErrorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 mb-6">{pwErrorMsg}</div>}
            {pwSuccessMsg && <div className="p-4 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 mb-6">{pwSuccessMsg}</div>}
            
            <Button variant="primary" isLoading={pwLoading} onClick={handlePassword} className="w-full">
              {actionType === "lock" ? "Encrypt Document" : "Decrypt Document"}
            </Button>
          </div>
        ) : (
          <div>
            <STTitle>Apply Watermark</STTitle>
            <div className="mb-6">
              <input 
                type="file" 
                accept="application/pdf"
                onChange={(e) => setWmFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors"
              />
            </div>
            
            {wmFile && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Watermark Text</label>
                  <input 
                    type="text"
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                    placeholder="e.g., CONFIDENTIAL"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Opacity: {opacity}</label>
                  <input 
                    type="range"
                    min="0.1" max="1.0" step="0.1"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </>
            )}
            
            {wmErrorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 mb-6">{wmErrorMsg}</div>}
            {wmSuccessMsg && <div className="p-4 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 mb-6">{wmSuccessMsg}</div>}
            
            <Button variant="primary" isLoading={wmLoading} onClick={handleWatermark} className="w-full">
              Apply Watermark
            </Button>
          </div>
        )}
      </STContainer>
    </div>
  );
}

function OperationsPDFTab() {
  const [opsMode, setOpsMode] = useState("Merge PDFs");
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Split state
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  
  // Remove state
  const [removePages, setRemovePages] = useState("");
  
  // Resize state
  const [targetSize, setTargetSize] = useState("A4");

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const executeOp = async (endpoint: string, formData: FormData, successText: string, filenamePrefix: string) => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/files-documents/pdf-studio/ops/${endpoint}`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Operation failed");
      }

      const count = res.headers.get("X-Blank-Pages-Removed");
      if (count !== null) {
        if (Number(count) === 0) {
          setErrorMsg("No blank pages found.");
          setLoading(false);
          return;
        } else {
          setSuccessMsg(`Removed ${count} blank page(s)!`);
        }
      } else {
        setSuccessMsg(successText);
      }

      const blob = await res.blob();
      // Try to get original filename
      const origName = file ? file.name : (files.length > 0 ? "merged.pdf" : "document.pdf");
      const finalFilename = endpoint === 'merge' ? 'merged_document.pdf' : `${filenamePrefix}_${origName}`;
      
      downloadBlob(blob, finalFilename);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = () => {
    if (files.length < 2) {
      setErrorMsg("Please upload at least two PDF files to merge.");
      return;
    }
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    executeOp("merge", formData, "Successfully merged documents!", "merged");
  };

  const handleSplit = () => {
    if (!file) return setErrorMsg("Upload a PDF first.");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("start", startPage.toString());
    formData.append("end", endPage.toString());
    executeOp("split", formData, "Pages extracted!", "extracted");
  };

  const handleRemove = () => {
    if (!file) return setErrorMsg("Upload a PDF first.");
    if (!removePages.trim()) return setErrorMsg("Enter pages to remove.");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("pages", removePages);
    executeOp("remove", formData, "Pages removed!", "trimmed");
  };

  const handleClean = () => {
    if (!file) return setErrorMsg("Upload a PDF first.");
    const formData = new FormData();
    formData.append("file", file);
    executeOp("clean", formData, "Pages cleaned!", "cleaned");
  };

  const handleResize = () => {
    if (!file) return setErrorMsg("Upload a PDF first.");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("target", targetSize);
    executeOp("resize", formData, `Resized to ${targetSize}!`, "resized");
  };

  return (
    <div className="w-full">
      <STHeader 
        title=":material/layers: Page Operations" 
        subtitle="Reorganize, merge, split, and clean up the structural layout of your PDF documents." 
      />
      
      <div className="flex flex-wrap gap-2 mb-6">
        {["Merge PDFs", "Split / Extract", "Remove Pages", "Clean Blank Pages", "Resize Pages"].map((mode) => (
          <button
            key={mode}
            onClick={() => {
              setOpsMode(mode);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              opsMode === mode 
                ? "bg-white text-black" 
                : "bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <STContainer border>
        {opsMode === "Merge PDFs" && (
          <div>
            <STTitle>Upload PDFs to merge</STTitle>
            <p className="text-xs text-zinc-400 mb-4">Note: Files will be merged in the order they are selected.</p>
            <input 
              type="file" multiple accept="application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors mb-4"
            />
            {files.length > 0 && (
              <ul className="list-disc pl-5 mb-4 text-sm text-zinc-300">
                {files.map((f, i) => <li key={i}>{f.name}</li>)}
              </ul>
            )}
            <Button variant="primary" isLoading={loading} onClick={handleMerge} className="w-full">Merge PDFs</Button>
          </div>
        )}

        {opsMode !== "Merge PDFs" && (
          <div className="mb-6">
            <input 
              type="file" accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors"
            />
          </div>
        )}

        {opsMode === "Split / Extract" && file && (
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm text-zinc-400 mb-1">Start Page</label>
              <input type="number" min="1" value={startPage} onChange={e => setStartPage(Number(e.target.value))} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-zinc-400 mb-1">End Page</label>
              <input type="number" min="1" value={endPage} onChange={e => setEndPage(Number(e.target.value))} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
            </div>
          </div>
        )}
        {opsMode === "Split / Extract" && file && <Button variant="primary" isLoading={loading} onClick={handleSplit} className="w-full">Extract Pages</Button>}

        {opsMode === "Remove Pages" && file && (
          <div className="mb-6">
            <label className="block text-sm text-zinc-400 mb-1">Pages to remove (comma separated)</label>
            <input type="text" placeholder="e.g., 1, 3, 5" value={removePages} onChange={e => setRemovePages(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white mb-4" />
            <Button variant="primary" isLoading={loading} onClick={handleRemove} className="w-full">Delete Pages</Button>
          </div>
        )}

        {opsMode === "Clean Blank Pages" && file && (
          <Button variant="primary" isLoading={loading} onClick={handleClean} className="w-full">Scan and Clean</Button>
        )}

        {opsMode === "Resize Pages" && file && (
          <div className="mb-6">
            <label className="block text-sm text-zinc-400 mb-1">Target Dimensions</label>
            <select value={targetSize} onChange={e => setTargetSize(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white mb-4">
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
            <Button variant="primary" isLoading={loading} onClick={handleResize} className="w-full">Resize Document</Button>
          </div>
        )}

        {errorMsg && <div className="mt-4 p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30">{errorMsg}</div>}
        {successMsg && <div className="mt-4 p-4 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30">{successMsg}</div>}
      </STContainer>
    </div>
  );
}

function MetadataPDFTab() {
  const [mode, setMode] = useState("Edit Metadata");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Metadata fields
  const [metadata, setMetadata] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [keywords, setKeywords] = useState("");
  const [creator, setCreator] = useState("");
  const [producer, setProducer] = useState("");

  // Health report
  const [report, setReport] = useState<any>(null);

  const fetchMetadata = async (f: File) => {
    setLoading(true);
    setErrorMsg("");
    setMetadata(null);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/metadata/get", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Failed to read metadata");
      const data = await res.json();
      setMetadata(data);
      setTitle(data.title || "");
      setAuthor(data.author || "");
      setSubject(data.subject || "");
      setKeywords(data.keywords || "");
      setCreator(data.creator || "");
      setProducer(data.producer || "");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("author", author);
      formData.append("subject", subject);
      formData.append("keywords", keywords);
      formData.append("creator", creator);
      formData.append("producer", producer);

      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/metadata/update", {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("Failed to update metadata");
      setSuccessMsg("Metadata updated successfully!");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `updated_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCheck = async (f: File) => {
    setLoading(true);
    setErrorMsg("");
    setReport(null);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/metadata/health", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Health check failed");
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <STHeader 
        title=":material/info: Metadata & Authenticity" 
        subtitle="Inspect or modify hidden document properties, and verify file health and signatures." 
      />
      
      <div className="flex gap-4 mb-6">
        {["Edit Metadata", "Health & Authenticity Check"].map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setFile(null);
              setMetadata(null);
              setReport(null);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              mode === m 
                ? "bg-white text-black" 
                : "bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <STContainer border>
        <div className="mb-6">
          <input 
            type="file" accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              if (f) {
                if (mode === "Edit Metadata") fetchMetadata(f);
                else handleHealthCheck(f);
              }
            }}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors"
          />
        </div>

        {mode === "Edit Metadata" && metadata && (
          <div>
            <STTitle>Document Properties</STTitle>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Keywords</label>
                <input type="text" value={keywords} onChange={e => setKeywords(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Author</label>
                <input type="text" value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Creator Tool</label>
                <input type="text" value={creator} onChange={e => setCreator(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Producer</label>
                <input type="text" value={producer} onChange={e => setProducer(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-2 rounded text-white" />
              </div>
            </div>
            <p className="text-xs text-zinc-500 mb-6">Creation and Modification dates are preserved automatically.</p>
            <Button variant="primary" isLoading={loading} onClick={handleUpdate} className="w-full">Update Properties</Button>
          </div>
        )}

        {mode === "Health & Authenticity Check" && report && (
          <div>
            <STTitle>Diagnostic Report</STTitle>
            
            <div className="space-y-4 mb-6">
              {report.is_corrupt ? (
                <div className="p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30">
                  <strong>File Status:</strong> Corrupted or Invalid PDF Structure
                </div>
              ) : (
                <div className="p-4 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30">
                  <strong>File Status:</strong> Healthy
                </div>
              )}

              {report.needs_password ? (
                <div className="p-4 bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30">
                  <strong>Encryption:</strong> Document is locked with a password. Deep analysis restricted.
                </div>
              ) : (
                <div className="p-4 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
                  <strong>Encryption:</strong> Document is unlocked.
                </div>
              )}

              {report.has_digital_signature ? (
                <div className="p-4 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30">
                  <strong>Signatures:</strong> Digital Signature fields detected.
                </div>
              ) : (
                (!report.is_corrupt && !report.needs_password) && (
                  <div className="p-4 bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700">
                    <strong>Signatures:</strong> No digital signatures found.
                  </div>
                )
              )}
            </div>

            {(!report.is_corrupt && !report.needs_password) && (
              <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                <div>
                  <div className="text-sm text-zinc-400">Page Count</div>
                  <div className="text-2xl font-mono text-zinc-200">{report.page_count}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">PDF Version</div>
                  <div className="text-2xl font-mono text-zinc-200">v{report.pdf_version}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && !metadata && !report && <div className="text-center text-zinc-400 py-4">Processing...</div>}
        {errorMsg && <div className="mt-4 p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30">{errorMsg}</div>}
        {successMsg && <div className="mt-4 p-4 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30">{successMsg}</div>}
      </STContainer>
    </div>
  );
}

function ConvertPDFTab() {
  const [convertMode, setConvertMode] = useState("PDF to Images");
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dpi, setDpi] = useState(150);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handlePdfToImages = async () => {
    if (!file) return setErrorMsg("Please upload a PDF file.");
    setLoading(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dpi", dpi.toString());
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/convert/pdf-to-images", { method: "POST", body: formData });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Conversion failed"); }
      setSuccessMsg("Conversion complete! Downloading ZIP...");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `images_${file.name.replace('.pdf', '')}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) { setErrorMsg(err.message); }
    finally { setLoading(false); }
  };

  const handleImagesToPdf = async () => {
    if (files.length === 0) return setErrorMsg("Please upload at least one image.");
    setLoading(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/convert/images-to-pdf", { method: "POST", body: formData });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Conversion failed"); }
      setSuccessMsg("Conversion complete! Downloading PDF...");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "converted_images.pdf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) { setErrorMsg(err.message); }
    finally { setLoading(false); }
  };

  const handleOcr = async () => {
    if (!file) return setErrorMsg("Please upload a scanned PDF file.");
    setLoading(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/convert/ocr", { method: "POST", body: formData });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "OCR failed"); }
      setSuccessMsg("OCR complete! Downloading searchable PDF...");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `searchable_${file.name}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) { setErrorMsg(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="w-full">
      <STHeader
        title=":material/transform: Convert & OCR"
        subtitle="Convert PDF to Images, Images to PDF, and make scanned PDFs searchable with OCR."
      />
      <div className="flex gap-4 mb-6">
        {["PDF to Images", "Images to PDF", "OCR (Make Searchable)"].map((mode) => (
          <button
            key={mode}
            onClick={() => { setConvertMode(mode); setFile(null); setFiles([]); setErrorMsg(""); setSuccessMsg(""); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              convertMode === mode ? "bg-white text-black" : "bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
      <STContainer border>
        {convertMode === "PDF to Images" && (
          <div>
            <STTitle>Upload PDF</STTitle>
            <div className="mb-6">
              <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors" />
            </div>
            {file && (
              <div className="mb-6">
                <label className="block text-sm text-zinc-400 mb-2">DPI Resolution: {dpi}</label>
                <input type="range" min="72" max="300" step="1" value={dpi} onChange={(e) => setDpi(parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
              </div>
            )}
            <Button variant="primary" isLoading={loading} onClick={handlePdfToImages} className="w-full">Convert to Images (ZIP)</Button>
          </div>
        )}
        {convertMode === "Images to PDF" && (
          <div>
            <STTitle>Upload Images</STTitle>
            <div className="mb-6">
              <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors" />
            </div>
            {files.length > 0 && <p className="text-sm text-zinc-400 mb-4">{files.length} image(s) selected.</p>}
            <Button variant="primary" isLoading={loading} onClick={handleImagesToPdf} className="w-full">Merge into PDF</Button>
          </div>
        )}
        {convertMode === "OCR (Make Searchable)" && (
          <div>
            <STTitle>Upload Scanned PDF</STTitle>
            <div className="mb-6">
              <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors" />
            </div>
            <p className="text-sm text-blue-400 bg-blue-500/10 p-2 rounded border border-blue-500/20 mb-6">
              Requires system-level Tesseract OCR and Ghostscript to be installed.
            </p>
            <Button variant="primary" isLoading={loading} onClick={handleOcr} className="w-full">Run OCR</Button>
          </div>
        )}
        {errorMsg && <div className="mt-4 p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30">{errorMsg}</div>}
        {successMsg && <div className="mt-4 p-4 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30">{successMsg}</div>}
      </STContainer>
    </div>
  );
}

function SearchPDFTab() {
  const [targetDir, setTargetDir] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [indexInfo, setIndexInfo] = useState<any>(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);

  const fetchIndexInfo = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/search/info");
      if (res.ok) setIndexInfo(await res.json());
    } catch (e) { console.error(e); }
  };

  React.useEffect(() => { fetchIndexInfo(); }, []);

  const handleBuildIndex = async () => {
    if (!targetDir) return setErrorMsg("Please enter a target directory to index.");
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/search/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_dir: targetDir })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Build index failed.");
      }
      const data = await res.json();
      setSuccessMsg(data.message);
      fetchIndexInfo();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIndex = async () => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/search/index", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Delete failed.");
      }
      const data = await res.json();
      setSuccessMsg(data.message);
      setResults([]);
      fetchIndexInfo();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query) return setErrorMsg("Please enter a search query.");
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setResults([]);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/files-documents/pdf-studio/search/query?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Search failed.");
      }
      const data = await res.json();
      setSuccessMsg(data.message);
      setResults(data.results || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <STHeader 
        title=":material/search: PDF Search Engine" 
        subtitle="Index directories and perform fast, full-text searches across all your PDF documents." 
      />

      {/* Index Info Panel */}
      {indexInfo && indexInfo.exists && (
        <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-purple-400">Current Index</h3>
            <Button variant="secondary" onClick={handleDeleteIndex} isLoading={loading} className="text-xs px-3 py-1 h-auto text-red-400 border-red-500/30 hover:bg-red-500/10">
              Delete Index
            </Button>
          </div>
          <p className="text-sm text-zinc-300 mb-2">{indexInfo.doc_count} document(s) indexed</p>
          {indexInfo.files && indexInfo.files.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
              {indexInfo.files.map((file: string, i: number) => (
                <div key={i} className="flex justify-between items-center bg-zinc-900/50 p-2 rounded">
                  <p className="text-xs text-zinc-400 font-mono truncate mr-2" title={file}>{file}</p>
                  <Button 
                    variant="secondary" 
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const res = await fetch("http://127.0.0.1:8000/api/files-documents/pdf-studio/search/index/document", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ file_path: file })
                        });
                        if (!res.ok) throw new Error("Failed to delete document");
                        fetchIndexInfo();
                      } catch (e: any) {
                        setErrorMsg(e.message);
                      } finally {
                        setLoading(false);
                      }
                    }} 
                    className="text-[10px] px-2 py-1 h-auto text-red-400 border-red-500/30 hover:bg-red-500/10 flex-shrink-0"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <STContainer border>
        <STTitle>1. Build Index</STTitle>
        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Absolute path to directory (e.g. C:\Documents)" 
              value={targetDir} 
              onChange={(e) => setTargetDir(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 pr-12 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setIsExplorerOpen(true)}
              className="absolute inset-y-0 right-2 flex items-center p-1.5 my-auto h-fit text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Browse folder"
            >
              <FolderSearch size={18} />
            </button>
          </div>
          <Button variant="secondary" isLoading={loading} onClick={handleBuildIndex}>Build Index</Button>
        </div>
        
        <STTitle>2. Search Documents</STTitle>
        <div className="mb-6 flex gap-3">
          <input 
            type="text" 
            placeholder="Search query..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 bg-zinc-900 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
          />
          <Button variant="primary" isLoading={loading} onClick={handleSearch}>Search</Button>
        </div>

        {errorMsg && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 mb-6">{errorMsg}</div>}
        {successMsg && !results.length && <div className="p-4 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 mb-6">{successMsg}</div>}

        {results.length > 0 && (
          <div className="flex flex-col gap-4 mt-6">
            <h3 className="text-xl font-bold text-white mb-2">Search Results</h3>
            {results.map((hit, idx) => (
              <div key={idx} className="p-4 bg-zinc-900/50 border border-white/10 rounded-xl hover:border-purple-500/50 transition-colors">
                <div className="font-semibold text-purple-400 mb-1">{hit.title}</div>
                <div className="text-xs text-zinc-500 mb-3 break-all">{hit.path}</div>
                <div className="text-sm text-zinc-300 italic" dangerouslySetInnerHTML={{ __html: hit.snippet.replace(/\*\*:violet\[(.*?)]\*\*/g, '<span class="text-violet-400 font-bold">$1</span>') }} />
              </div>
            ))}
          </div>
        )}
      </STContainer>

      <FileExplorerModal 
        isOpen={isExplorerOpen} 
        onClose={() => setIsExplorerOpen(false)} 
        onSelect={(path) => setTargetDir(path)} 
        title="Select Directory to Index"
      />
    </div>
  );
}
