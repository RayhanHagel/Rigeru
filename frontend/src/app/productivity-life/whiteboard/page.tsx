"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";

import { Palette, Trash2, Download, Image as ImageIcon, FileText, Bot, Undo, Plus, ChevronLeft, ChevronRight, Settings, Maximize } from "lucide-react";
import { WhiteboardCanvas, Stroke } from "@/components/whiteboard/WhiteboardCanvas";

const PAGE_SIZES = {
  A4: { name: "A4", width: 794, height: 1123 },
  Letter: { name: "Letter", width: 816, height: 1056 },
  Square: { name: "Square", width: 800, height: 800 },
  Wide: { name: "Wide (16:9)", width: 1280, height: 720 },
};

export default function DigitalWhiteboardPage() {
  const [pages, setPages] = useState<Stroke[][]>([[]]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const [currentColor, setCurrentColor] = useState("#000000");
  const [currentSize, setCurrentSize] = useState(4);
  const [pageSize, setPageSize] = useState<keyof typeof PAGE_SIZES>("A4");
  const [scale, setScale] = useState(1);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState("");
  
  // Ref to hold the export functions from the active canvas
  const canvasExportRef = useRef<any>(null);

  const currentStrokes = pages[currentPageIndex];

  const handleStrokesChange = (newStrokes: Stroke[]) => {
    const newPages = [...pages];
    newPages[currentPageIndex] = newStrokes;
    setPages(newPages);
  };

  const handleUndo = () => {
    if (currentStrokes.length === 0) return;
    const newPages = [...pages];
    newPages[currentPageIndex] = currentStrokes.slice(0, -1);
    setPages(newPages);
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear this page?")) {
      const newPages = [...pages];
      newPages[currentPageIndex] = [];
      setPages(newPages);
    }
  };

  const addPage = () => {
    setPages([...pages, []]);
    setCurrentPageIndex(pages.length);
  };

  const deletePage = () => {
    if (pages.length === 1) {
      handleClear();
      return;
    }
    if (confirm("Are you sure you want to delete this page?")) {
      const newPages = pages.filter((_, i) => i !== currentPageIndex);
      setPages(newPages);
      setCurrentPageIndex(Math.min(currentPageIndex, newPages.length - 1));
    }
  };

  const exportCurrentPage = async (format: "png" | "jpg") => {
    if (!canvasExportRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await canvasExportRef.current.toDataURL(format === "png" ? "image/png" : "image/jpeg");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `whiteboard-page-${currentPageIndex + 1}.${format}`;
      a.click();
    } catch (e) {
      console.error(e);
      alert("Failed to export.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportDocument = async (format: "pdf" | "gif") => {
    setIsExporting(true);
    try {
      // For now, we only send the current page if gif, or we would need to generate data URLs for all pages.
      // To keep it simple, let's just generate data URLs for all pages by temporarily switching them?
      // No, that's complex in React. Let's send the strokes to the backend or just export the current page.
      // Since we are generating PDF in the backend, we need to send images.
      // Easiest is to just send the current page data URL to the backend for processing.
      
      const dataUrl = await canvasExportRef.current.toDataURL("image/png");
      
      const res = await fetch("/api/files-documents/whiteboard/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          images: [dataUrl],
          format,
          width: PAGE_SIZES[pageSize].width,
          height: PAGE_SIZES[pageSize].height
        })
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `whiteboard-document.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to export document.");
    } finally {
      setIsExporting(false);
    }
  };

  const transcribeNote = async () => {
    if (!canvasExportRef.current) return;
    setIsTranscribing(true);
    setTranscription("");
    try {
      const dataUrl = await canvasExportRef.current.toDataURL("image/png");
      const res = await fetch("/api/files-documents/whiteboard/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Transcription failed");
      }
      
      const data = await res.json();
      setTranscription(data.text);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to transcribe.");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Digital Whiteboard" subtitle="Pressure-sensitive drawing with export & AI transcription." />

      <div className="flex-1 w-full relative flex flex-col min-h-0 bg-zinc-900/20 rounded-xl border border-white/5 overflow-hidden shadow-inner">
        {/* Canvas Area */}
        <div className="flex-1 w-full flex justify-center overflow-auto p-4 md:p-12 relative z-10" id="canvas-container">
          <WhiteboardCanvas 
            strokes={currentStrokes}
            onStrokesChange={handleStrokesChange}
            currentColor={currentColor}
            currentSize={currentSize}
            width={PAGE_SIZES[pageSize].width}
            height={PAGE_SIZES[pageSize].height}
            scale={scale}
            onExportRef={(ref) => canvasExportRef.current = ref}
          />
        </div>
        
        {/* Floating Toolbar */}
        <div className="absolute top-4 left-4 flex flex-col gap-4 w-64 max-h-[calc(100%-80px)] overflow-y-auto scrollbar-none z-40 pointer-events-auto">
          <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 flex-1 shadow-xl transition-all hover:bg-zinc-900/90">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">Tools & Settings
            </h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {['#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#ffffff'].map(color => (
                    <button
                      key={color}
                      onClick={() => setCurrentColor(color)}
                      className={`w-6 h-6 rounded-full border-2 ${currentColor === color ? 'border-primary' : 'border-transparent shadow-sm'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input 
                    type="color" 
                    value={currentColor} 
                    onChange={e => setCurrentColor(e.target.value)}
                    className="w-6 h-6 p-0 border-0 rounded overflow-hidden cursor-pointer"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Brush Size: {currentSize}px</label>
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  value={currentSize}
                  onChange={e => setCurrentSize(parseInt(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Page Size</label>
                <select 
                  value={pageSize}
                  onChange={e => setPageSize(e.target.value as keyof typeof PAGE_SIZES)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-primary"
                >
                  {Object.keys(PAGE_SIZES).map(key => (
                    <option key={key} value={key}>{PAGE_SIZES[key as keyof typeof PAGE_SIZES].name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <Button variant="secondary" onClick={handleUndo} icon={<Undo size={16} />} className="flex-1">Undo</Button>
                <Button variant="secondary" onClick={handleClear} icon={<Trash2 size={16} />} className="flex-1 text-red-400 hover:text-red-300">Clear</Button>
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl transition-all hover:bg-zinc-900/90">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">Export Options
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => exportCurrentPage('png')} isLoading={isExporting} className="text-xs">PNG</Button>
              <Button variant="secondary" onClick={() => exportCurrentPage('jpg')} isLoading={isExporting} className="text-xs">JPG</Button>
              <Button variant="secondary" onClick={() => exportDocument('pdf')} isLoading={isExporting} className="text-xs">PDF</Button>
              <Button variant="secondary" onClick={() => exportDocument('gif')} isLoading={isExporting} className="text-xs">GIF</Button>
            </div>
          </div>
          
          <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 flex-1 shadow-xl transition-all hover:bg-zinc-900/90">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">AI Transcription
            </h3>
            <Button variant="primary" onClick={transcribeNote} isLoading={isTranscribing} className="w-full text-xs" icon={<FileText size={16} />}>
              Transcribe Handwriting
            </Button>
            
            {transcription && (
              <div className="mt-3 p-3 bg-zinc-950 border border-white/10 rounded-lg max-h-[150px] overflow-y-auto">
                <p className="text-xs text-zinc-400 mb-1">Result:</p>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">{transcription}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Page Controls - Floating at bottom */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-900/90 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 shadow-2xl overflow-x-auto max-w-[90%] z-30">
          {/* Zoom Controls */}
          <button 
            onClick={() => setScale(s => Math.max(0.2, s - 0.2))}
            className="p-1 text-zinc-400 hover:text-white transition-colors font-mono font-bold text-lg leading-none"
            title="Zoom Out"
          >
            -
          </button>
          <span className="text-sm font-medium text-zinc-300 min-w-[48px] text-center" title="Reset Zoom" onClick={() => setScale(1)} style={{cursor: 'pointer'}}>
            {Math.round(scale * 100)}%
          </span>
          <button 
            onClick={() => setScale(s => Math.min(5.0, s + 0.2))}
            className="p-1 text-zinc-400 hover:text-white transition-colors font-mono font-bold text-lg leading-none"
            title="Zoom In"
          >
            +
          </button>
          
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <button 
            onClick={() => {
              const container = document.getElementById("canvas-container");
              if (container) {
                // Remove padding from available height (48px top and bottom padding = 96px total)
                const availableHeight = container.clientHeight - 96; 
                const targetHeight = PAGE_SIZES[pageSize].height;
                setScale(Math.min(2, Math.max(0.1, availableHeight / targetHeight)));
              }
            }}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
            title="Fit to Height"
          >
            <Maximize size={18} />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <button 
            onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
            disabled={currentPageIndex === 0}
            className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium text-zinc-300 min-w-[60px] text-center">
            {currentPageIndex + 1} / {pages.length}
          </span>
          <button 
            onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
            disabled={currentPageIndex === pages.length - 1}
            className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          
          <div className="w-px h-4 bg-white/10 mx-2"></div>
          
          <button 
            onClick={addPage}
            className="p-1 text-zinc-400 hover:text-green-400 transition-colors"
            title="Add Page"
          >
            <Plus size={18} />
          </button>
          <button 
            onClick={deletePage}
            className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
            title="Delete Page"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
