"use client";

import React, { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { FileExplorerModal } from "@/components/ui/FileExplorerModal";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { Icon } from "@/lib/utils";

interface VerificationResults {
  ok: string[];
  modified: string[];
  missing: string[];
  new: string[];
}

interface SnapshotMeta {
  filename: string;
  timestamp: string;
  root_dir: string;
  size_bytes: number;
}

export default function HashIntegrityPage() {
  const [activeTab, setActiveTab] = useState<"snapshot" | "verify">("snapshot");
  
  // Modal State
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [activeDirField, setActiveDirField] = useState<"snap" | "verify" | null>(null);

  // Snapshot State
  const [snapTargetDir, setSnapTargetDir] = useState<string>("C:\\Users\\");
  const [isSnapping, setIsSnapping] = useState(false);
  const [snapError, setSnapError] = useState("");
  const [pastSnapshots, setPastSnapshots] = useState<SnapshotMeta[]>([]);
  
  // Verify State
  const [verifyTargetDir, setVerifyTargetDir] = useState<string>("C:\\Users\\");
  const [snapshotFileInfo, setSnapshotFileInfo] = useState<{ hash_name: string; original_name: string; file_type: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [results, setResults] = useState<VerificationResults | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSnapshots = async () => {
    try {
      const res = await fetch("/api/files-documents/hash-integrity/snapshots");
      if (res.ok) {
        const data = await res.json();
        setPastSnapshots(data.snapshots);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSnapshot = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      const res = await fetch(`/api/files-documents/hash-integrity/snapshots/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchSnapshots();
      } else {
        const errorData = await res.json();
        alert(`Failed to delete: ${errorData.detail}`);
      }
    } catch (err: any) {
      alert(`Error deleting snapshot: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [activeTab]); // Refetch when switching tabs just in case

  const handleCreateSnapshot = async () => {
    if (!snapTargetDir) {
      setSnapError("Target directory is required.");
      return;
    }
    
    setIsSnapping(true);
    setSnapError("");
    
    try {
      const formData = new FormData();
      formData.append("target_dir", snapTargetDir);
      
      const res = await fetch("/api/files-documents/hash-integrity/snapshot", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to create snapshot");
      }
      
      // Handle file download response
      const blob = await res.blob();
      const filename = res.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || "snapshot.json";
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Refresh list
      fetchSnapshots();
      
    } catch (err: any) {
      setSnapError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSnapping(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyTargetDir) {
      setVerifyError("Target directory is required.");
      return;
    }
    if (!snapshotFileInfo) {
      setVerifyError("Snapshot JSON file is required.");
      return;
    }
    
    setIsVerifying(true);
    setVerifyError("");
    setResults(null);
    
    try {
      const formData = new FormData();
      formData.append("target_dir", verifyTargetDir);
      formData.append("file_hash", snapshotFileInfo.hash_name);
      
      const res = await fetch("/api/files-documents/hash-integrity/verify", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Failed to verify integrity");
      }
      
      setResults(data);
    } catch (err: any) {
      setVerifyError(err.message || "An unexpected error occurred.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openExplorer = (field: "snap" | "verify") => {
    setActiveDirField(field);
    setIsExplorerOpen(true);
  };

  const handleSelectFolder = (path: string) => {
    if (activeDirField === "snap") {
      setSnapTargetDir(path);
    } else if (activeDirField === "verify") {
      setVerifyTargetDir(path);
    }
    setIsExplorerOpen(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <FileExplorerModal 
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        onSelect={handleSelectFolder}
        title="Select Folder"
      />
      
      <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
          <div className="flex items-center gap-0">
            
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">File Integrity Checker</h1>
              <p className="text-zinc-400 text-sm font-medium">Take a digital fingerprint of your folders and verify them later to detect corruption or tampering.</p>
            </div>
          </div>
          <ModernTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab as (id: string) => void}
            tabs={[
              { id: "snapshot", label: "Create Baseline Snapshot" },
              { id: "verify", label: "Verify Integrity" }
            ]}
          />
        </div>

        <div className="flex flex-col gap-6 w-full">
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">

          <div className="w-full">
            <ModernTabContent activeTab={activeTab}>
                      {activeTab === "snapshot" ? (
                                    <div className="flex flex-col gap-8 animate-slide-up w-full">
                                      {/* Create Form */}
                                      <div className="flex flex-col gap-6 w-full">
                                        <div className="flex flex-col gap-2">
                                          <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                                            Folder to Fingerprint (Absolute Path)
                                          </label>
                                          <div className="flex gap-2">
                                            <input
                                              type="text"
                                              value={snapTargetDir}
                                              onChange={(e) => setSnapTargetDir(e.target.value)}
                                              placeholder="e.g. C:\Users\Username\Documents"
                                              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-secondary transition-colors"
                                            />
                                            <Button variant="secondary" onClick={() => openExplorer("snap")} className="px-4 shrink-0">
                                              <Icon name="folder_open" size={18} />
                                            </Button>
                                          </div>
                                          <p className="text-xs text-zinc-500">
                                            This will scan every file in the selected directory and generate a JSON file of SHA-256 hashes.
                                          </p>
                                        </div>

                                        {snapError && (
                                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                            <Icon name="gpp_maybe" className="text-red-400 shrink-0 mt-0.5" size={16} />
                                            <p className="text-sm text-red-400">{snapError}</p>
                                          </div>
                                        )}

                                        <Button
                                          variant="primary"
                                          className="w-full py-6"
                                          onClick={handleCreateSnapshot}
                                          disabled={isSnapping}
                                        >
                                          {isSnapping ? "Calculating hashes... (may take a while)" : (
                                            <span className="flex items-center gap-2">
                                              <Icon name="archive" size={18} />
                                              Generate Fingerprint
                                            </span>
                                          )}
                                        </Button>
                                      </div>
                                      
                                      {/* Saved Snapshots */}
                                      <div className="w-full pt-6 flex flex-col">
                                        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">Past Snapshots
                                        </h3>
                                        
                                        <div className="flex-1 bg-zinc-950 border border-white/10 rounded-xl overflow-hidden flex flex-col">
                                          {pastSnapshots.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-50">
                                              <Icon name="archive" size={24} className="text-zinc-500 mb-2" />
                                              <p className="text-sm text-zinc-400">No past snapshots found.</p>
                                            </div>
                                          ) : (
                                            <div className="overflow-y-auto max-h-[300px]">
                                              {pastSnapshots.map((snap, idx) => (
                                                <div 
                                                  key={idx} 
                                                  className={`p-3 flex items-center justify-between gap-2 group ${idx !== pastSnapshots.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/5 transition-colors`}
                                                >
                                                  <div className="flex flex-col gap-1 overflow-hidden">
                                                    <p className="text-xs font-semibold text-white truncate" title={snap.root_dir}>{snap.root_dir}</p>
                                                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                                                      <span className="flex items-center gap-1 font-mono">
                                                        <Icon name="schedule" size={12} />
                                                        {new Date(snap.timestamp).toLocaleString()}
                                                      </span>
                                                      <span>{formatBytes(snap.size_bytes)}</span>
                                                    </div>
                                                  </div>
                                                  
                                                  <button
                                                    onClick={() => handleDeleteSnapshot(snap.filename)}
                                                    className="p-2 bg-red-500/10 text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20 shrink-0"
                                                    title="Delete snapshot"
                                                  >
                                                    <Icon name="delete" size={16} />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-6 animate-slide-up w-full mx-auto">
                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                                          Target Folder (To Verify)
                                        </label>
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            value={verifyTargetDir}
                                            onChange={(e) => setVerifyTargetDir(e.target.value)}
                                            placeholder="e.g. C:\Users\Username\Documents"
                                            className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-secondary transition-colors"
                                          />
                                          <Button variant="secondary" onClick={() => openExplorer("verify")} className="px-4 shrink-0">
                                            <Icon name="folder_open" size={18} />
                                          </Button>
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                                          Upload Snapshot JSON
                                        </label>
                                        <DirectUploadBox
                                          accept=".json"
                                          label="Upload Snapshot JSON"
                                          onUploadComplete={(info) => setSnapshotFileInfo(info)}
                                          onClear={() => setSnapshotFileInfo(null)}
                                          defaultFileName={snapshotFileInfo?.original_name}
                                        />
                                      </div>

                                      {verifyError && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                          <Icon name="gpp_maybe" className="text-red-400 shrink-0 mt-0.5" size={16} />
                                          <p className="text-sm text-red-400">{verifyError}</p>
                                        </div>
                                      )}

                                      <Button
                                        variant="primary"
                                        className="w-full"
                                        onClick={handleVerify}
                                        disabled={!snapshotFileInfo || !verifyTargetDir || isVerifying}
                                      >
                                        {isVerifying ? "Verifying hashes" : (
                                          <span className="flex items-center gap-2">
                                            <Icon name="document_scanner" size={18} />
                                            Run Integrity Scan
                                          </span>
                                        )}
                                      </Button>
                                      
                                      {results && (
                                        <div className="mt-4 flex flex-col gap-4 animate-slide-up">
                                          <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
                                            Scan Results
                                          </h3>
                                          
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-zinc-950 border border-emerald-500/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                              <Icon name="check_circle" className="text-emerald-400 mb-2" size={24} />
                                              <p className="text-3xl font-bold text-emerald-400">{results.ok.length}</p>
                                              <p className="text-xs text-zinc-400 uppercase tracking-wider">Verified OK</p>
                                            </div>
                                            
                                            <div className="bg-zinc-950 border border-amber-500/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                              <Icon name="warning" className="text-amber-400 mb-2" size={24} />
                                              <p className="text-3xl font-bold text-amber-400">{results.modified.length}</p>
                                              <p className="text-xs text-zinc-400 uppercase tracking-wider">Modified</p>
                                            </div>
                                            
                                            <div className="bg-zinc-950 border border-red-500/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                              <Icon name="help_center" className="text-red-400 mb-2" size={24} />
                                              <p className="text-3xl font-bold text-red-400">{results.missing.length}</p>
                                              <p className="text-xs text-zinc-400 uppercase tracking-wider">Missing</p>
                                            </div>
                                            
                                            <div className="bg-zinc-950 border border-secondary/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                              <Icon name="add_circle" className="text-secondary mb-2" size={24} />
                                              <p className="text-3xl font-bold text-secondary">{results.new.length}</p>
                                              <p className="text-xs text-zinc-400 uppercase tracking-wider">New Files</p>
                                            </div>
                                          </div>
                                          
                                          {/* Detailed lists for modified/missing/new */}
                                          {(results.modified.length > 0 || results.missing.length > 0 || results.new.length > 0) && (
                                            <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 max-h-96 overflow-y-auto">
                                              {results.modified.length > 0 && (
                                                <div className="mb-4">
                                                  <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">Modified Files
                                                  </h4>
                                                  <ul className="text-xs text-zinc-400 space-y-1 font-mono">
                                                    {results.modified.map(p => <li key={p}>{p}</li>)}
                                                  </ul>
                                                </div>
                                              )}
                                              
                                              {results.missing.length > 0 && (
                                                <div className="mb-4">
                                                  <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">Missing Files
                                                  </h4>
                                                  <ul className="text-xs text-zinc-400 space-y-1 font-mono">
                                                    {results.missing.map(p => <li key={p}>{p}</li>)}
                                                  </ul>
                                                </div>
                                              )}
                                              
                                              {results.new.length > 0 && (
                                                <div>
                                                  <h4 className="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">New Files (Not in snapshot)
                                                  </h4>
                                                  <ul className="text-xs text-zinc-400 space-y-1 font-mono">
                                                    {results.new.map(p => <li key={p}>{p}</li>)}
                                                  </ul>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                      </ModernTabContent>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
