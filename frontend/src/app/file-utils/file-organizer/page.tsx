"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { FileExplorerModal } from '@/components/ui/FileExplorerModal';
import {
  FolderOpen,
  Search,
  SkipForward,
  Trash2,
  FolderOutput,
  Undo2,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FolderSearch
} from 'lucide-react';

export default function FileOrganizerPage() {
  const [sourcePath, setSourcePath] = useState('');
  const [destPath, setDestPath] = useState('');
  const [filesList, setFilesList] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState({ text: 'Ready to scan.', type: 'info' });
  const [isLoading, setIsLoading] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  
  // File Explorer Modal State
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [explorerTarget, setExplorerTarget] = useState<'source' | 'dest' | null>(null);

  useEffect(() => {
    // Client-side initialization if needed
  }, []);

  const openExplorer = (target: 'source' | 'dest') => {
    setExplorerTarget(target);
    setIsExplorerOpen(true);
  };

  const handleExplorerSelect = (path: string) => {
    if (explorerTarget === 'source') {
      setSourcePath(path);
    } else if (explorerTarget === 'dest') {
      setDestPath(path);
    }
  };

  const handleScan = async () => {
    if (!sourcePath) {
      setStatusMsg({ text: 'Please provide a source directory.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/files-documents/file-organizer/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: sourcePath })
      });
      const data = await res.json();

      if (res.ok) {
        setFilesList(data.files || []);
        setCurrentIdx(0);
        setHistory([]);
        setRenameVal('');
        setStatusMsg({ text: `Found ${data.files.length} files ready to organize.`, type: 'success' });
      } else {
        setStatusMsg({ text: data.detail || 'Scan failed', type: 'error' });
      }
    } catch (e: any) {
      setStatusMsg({ text: e.message || 'Network error', type: 'error' });
    }
    setIsLoading(false);
  };

  const currentFile = filesList[currentIdx];
  const separator = sourcePath.includes('\\') ? '\\' : '/';
  const srcFilePath = currentFile ? `${sourcePath}${sourcePath.endsWith(separator) ? '' : separator}${currentFile}` : '';

  const handleNextFile = (msg: string, recordHistory?: any, isError = false) => {
    if (recordHistory) {
      setHistory(prev => [...prev, recordHistory]);
    }
    setCurrentIdx(prev => prev + 1);
    setRenameVal('');
    setStatusMsg({ text: msg, type: isError ? 'error' : 'success' });
  };

  const handleOpen = async () => {
    try {
      await fetch('/api/files-documents/file-organizer/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: srcFilePath })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSkip = () => {
    handleNextFile(`Skipped: ${currentFile}`, {
      action: 'skip',
      orig_file: currentFile,
      dest_file: currentFile,
      target: null
    });
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/files-documents/file-organizer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          src_file_path: srcFilePath,
          current_file: currentFile
        })
      });
      const data = await res.json();
      if (res.ok) {
        handleNextFile(`Trashed: ${currentFile}`, {
          action: 'delete',
          orig_file: currentFile,
          dest_file: null,
          target: null
        });
      } else {
        setStatusMsg({ text: data.detail || 'Delete Error', type: 'error' });
      }
    } catch (e: any) {
      setStatusMsg({ text: e.message || 'Network error', type: 'error' });
    }
    setIsLoading(false);
  };

  const handleMove = async () => {
    if (!destPath) {
      setStatusMsg({ text: 'Please provide a destination directory.', type: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/files-documents/file-organizer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: renameVal ? 'rename' : 'move',
          src_file_path: srcFilePath,
          current_file: currentFile,
          dest_dir: destPath,
          rename_val: renameVal
        })
      });
      const data = await res.json();
      if (res.ok) {
        const msg = data.action_type === 'rename'
          ? `Renamed & moved: ${currentFile} → ${data.final_name}`
          : `Moved: ${currentFile}`;
        handleNextFile(msg, {
          action: data.action_type,
          orig_file: currentFile,
          dest_file: data.final_name,
          target: ''
        });
      } else {
        setStatusMsg({ text: data.detail || 'Move Error', type: 'error' });
      }
    } catch (e: any) {
      setStatusMsg({ text: e.message || 'Network error', type: 'error' });
    }
    setIsLoading(false);
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];

    setIsLoading(true);
    try {
      const res = await fetch('/api/files-documents/file-organizer/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          last_action: lastAction,
          source_path: sourcePath,
          dest_path: destPath
        })
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(prev => prev.slice(0, -1));
        setCurrentIdx(prev => prev - 1);
        setStatusMsg({ text: data.message || `Undid action for ${lastAction.orig_file}`, type: 'success' });
      } else {
        setStatusMsg({ text: data.detail || 'Undo Error', type: 'error' });
      }
    } catch (e: any) {
      setStatusMsg({ text: e.message || 'Network error', type: 'error' });
    }
    setIsLoading(false);
  };

  const isFinished = currentIdx >= filesList.length && filesList.length > 0;

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Rapid File Organizer" subtitle="Browse your folders, scan, then Open, Move, Rename, Skip, Delete, or Undo." />
      <div className="flex flex-col gap-6 w-full">

        {/* Status Banner */}
        {statusMsg.text !== 'Ready to scan.' && (
          <div className={`p-4 rounded-xl flex items-center gap-3 transition-colors ${statusMsg.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
              statusMsg.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                'bg-secondary/10 border border-secondary/20 text-secondary'
            }`}>
            {statusMsg.type === 'error' ? <AlertCircle size={20} /> :
              statusMsg.type === 'success' ? <CheckCircle2 size={20} /> :
                <FolderOpen size={20} />}
            <span className="font-medium">{statusMsg.text}</span>
          </div>
        )}

        {/* Config Area */}
        <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 ml-1">Source Directory (To Scan)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                  placeholder="e.g. C:\Users\Username\Downloads"
                />
                <button
                  type="button"
                  onClick={() => openExplorer('source')}
                  className="absolute inset-y-0 right-2 flex items-center p-1.5 my-auto h-fit text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Browse folder"
                >
                  <FolderSearch size={18} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 ml-1">Destination Root Directory</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <FolderOutput size={18} />
                </div>
                <input
                  type="text"
                  value={destPath}
                  onChange={(e) => setDestPath(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                  placeholder="e.g. C:\Users\Username\Documents\Organized"
                />
                <button
                  type="button"
                  onClick={() => openExplorer('dest')}
                  className="absolute inset-y-0 right-2 flex items-center p-1.5 my-auto h-fit text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Browse folder"
                >
                  <FolderSearch size={18} />
                </button>
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={handleScan}
            disabled={isLoading}
            className="w-full py-6 text-lg font-medium"
          >
            {isLoading ? "Scanning" : "Scan Folder"}
          </Button>
        </div>

        {/* Interactive Sorting Area */}
        {filesList.length > 0 && !isFinished && (
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-xl animate-slide-up flex flex-col gap-8 w-full">

            {/* Preview */}
            <div className="w-full flex flex-col items-center justify-center bg-black/40 rounded-xl p-4 border border-white/5 min-h-[300px] overflow-hidden">
              {currentFile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files-documents/file-organizer/preview?path=${encodeURIComponent(srcFilePath)}`}
                  alt="Preview"
                  className="max-w-full max-h-[500px] object-contain rounded-lg shadow-2xl"
                  onError={(e) => {
                    // If image fails to load, replace with an icon
                    (e.target as any).style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('flex', 'flex-col', 'items-center', 'justify-center');
                    // Create fallback visual safely using DOM API to prevent XSS warnings
                    const container = document.createElement('div');
                    container.className = 'text-zinc-600 flex flex-col items-center gap-4';
                    container.innerHTML = `
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span class="text-sm font-medium">No Visual Preview</span>
                    `;
                    e.currentTarget.parentElement?.appendChild(container);
                  }}
                />
              )}
            </div>

            {/* Controls */}
            <div className="w-full flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center gap-2 text-zinc-400 font-medium mb-1 uppercase tracking-wider text-sm">
                  File {currentIdx + 1} of {filesList.length}
                </div>
                <h2 className="text-2xl font-bold text-white break-all bg-zinc-950 p-4 rounded-xl border border-white/5 shadow-inner">
                  {currentFile}
                </h2>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">Quick Actions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button variant="secondary" onClick={handleOpen} className="flex-1 whitespace-nowrap">
                    <ExternalLink size={16} className="mr-2" /> Open
                  </Button>
                  <Button variant="secondary" onClick={handleSkip} className="flex-1 whitespace-nowrap">
                    <SkipForward size={16} className="mr-2" /> Skip
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="flex-1 whitespace-nowrap bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 border-red-500/30"
                  >
                    <Trash2 size={16} className="mr-2" /> Trash
                  </Button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">Move & Rename
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    placeholder="New name (blank to keep)"
                  />
                  <Button
                    variant="primary"
                    onClick={handleMove}
                    disabled={isLoading}
                    className="whitespace-nowrap bg-green-500 hover:bg-green-600 text-white border-green-400/50"
                  >
                    <FolderOutput size={18} className="mr-2" /> Move
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isFinished && (
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-12 shadow-xl flex flex-col items-center justify-center text-center animate-slide-up">
            <CheckCircle2 size={64} className="text-green-500 mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">All Caught Up!</h2>
            <p className="text-zinc-400 text-lg mb-8">You have successfully processed all files in this folder.</p>
            <Button
              variant="primary"
              onClick={() => {
                setFilesList([]);
                setCurrentIdx(0);
                setHistory([]);
                setStatusMsg({ text: 'Ready to scan.', type: 'info' });
              }}
              className="px-8 py-3 text-lg"
            >
              <RotateCcw size={20} className="mr-2" /> Start Over
            </Button>
          </div>
        )}

        {/* Undo Section */}
        {history.length > 0 && (
          <div className="flex justify-end animate-slide-up pb-8">
            <Button
              variant="secondary"
              onClick={handleUndo}
              disabled={isLoading}
              className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/20"
            >
              <Undo2 size={16} className="mr-2" /> Undo Last Action
            </Button>
          </div>
        )}
      </div>

      <FileExplorerModal 
        isOpen={isExplorerOpen} 
        onClose={() => setIsExplorerOpen(false)} 
        onSelect={handleExplorerSelect} 
        title={explorerTarget === 'source' ? "Select Source Directory" : "Select Destination Directory"}
      />
    </div>
  );
}
