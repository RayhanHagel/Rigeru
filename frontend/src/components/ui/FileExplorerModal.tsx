"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from "@/lib/utils";


interface FileExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title?: string;
  selectionMode?: "file" | "folder";
}

interface FolderItem {
  name: string;
  path: string;
}

export function FileExplorerModal({ isOpen, onClose, onSelect, title = "Select Folder", selectionMode = "folder" }: FileExplorerModalProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FolderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchDirectory = async (path: string) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/files-documents/utils/explore-dir?path=${encodeURIComponent(path)}&include_files=${selectionMode === "file"}`);
      if (!res.ok) {
        throw new Error("Failed to load directory");
      }
      const data = await res.json();
      setCurrentPath(data.current_path);
      setParentPath(data.parent_path);
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (e: any) {
      setErrorMsg(e.message || "Error accessing directory");
    }
    setIsLoading(false);
  };

  // Fetch root when opened
  useEffect(() => {
    if (isOpen) {
      fetchDirectory("");
    }
  }, [isOpen]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-900/50">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold">
            <Icon name="folder_open" className="text-blue-400" size={20} />
            {title}
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Path Breadcrumb bar */}
        <div className="px-4 py-3 bg-zinc-900/80 border-b border-white/5 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <button 
            onClick={() => fetchDirectory("")}
            className="text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors flex items-center gap-1"
          >
            <Icon name="hard_drive" size={16} />
            Drives
          </button>
          
          {currentPath && (
            <>
              <Icon name="chevron_right" size={16} className="text-zinc-600 flex-shrink-0" />
              <div className="text-zinc-200 text-sm font-mono truncate" title={currentPath}>
                {currentPath}
              </div>
            </>
          )}
        </div>

        {/* Action Bar */}
        <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => fetchDirectory(parentPath)}
            disabled={!currentPath || isLoading}
            className="text-sm py-1 h-8 bg-zinc-800 hover:bg-zinc-700"
            icon={<Icon name="arrow_upward" size={16} />}
          >
            Go Up
          </Button>

          {errorMsg && (
            <span className="text-red-400 text-sm font-medium">{errorMsg}</span>
          )}
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-2 bg-black/40 min-h-[300px]">
          {isLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
              <Icon name="progress_activity" size={32} className="animate-spin text-blue-500" />
              <span>Loading folders</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">
              No accessible folders found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {folders.map((folder, i) => (
                <button
                  key={`folder-${i}`}
                  onClick={() => fetchDirectory(folder.path)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left group border border-transparent hover:border-white/5"
                >
                  {!currentPath ? (
                    <Icon name="hard_drive" size={24} className="text-zinc-400 group-hover:text-blue-400 transition-colors" />
                  ) : (
                    <Icon name="folder" size={24} className="text-blue-500/80 group-hover:text-blue-400 transition-colors" />
                  )}
                  <span className="text-zinc-300 group-hover:text-white font-medium truncate">
                    {folder.name}
                  </span>
                </button>
              ))}
              {selectionMode === "file" && files.map((file, i) => (
                <button
                  key={`file-${i}`}
                  onClick={() => {
                    onSelect(file.path);
                    onClose();
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left group border border-transparent hover:border-white/5"
                >
                  <Icon name="insert_drive_file" size={24} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                  <span className="text-zinc-300 group-hover:text-white font-medium truncate">
                    {file.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-zinc-900/50 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {selectionMode === "folder" && (
            <Button 
              variant="primary" 
              onClick={() => {
                if (currentPath) {
                  onSelect(currentPath);
                  onClose();
                } else {
                  setErrorMsg("Please select a valid folder first.");
                }
              }}
              disabled={!currentPath}
              className="bg-blue-600 hover:bg-blue-500 border-transparent"
            >
              Select Current Folder
            </Button>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
