"use client";

import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Icon } from '@/lib/utils';
import { Button } from './Button';

// Next.js standard worker configuration for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
}

export function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  
  // Panning state
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 5.0));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
  const handleResetZoom = () => setScale(1.0);

  // Mouse drag to pan
  const onMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };

  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5; 
    const walkY = (y - startY) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walkX;
    containerRef.current.scrollTop = scrollTop - walkY;
  };

  return (
    <div className="flex flex-col w-full h-full bg-[var(--theme-bg)] rounded-xl border border-[var(--theme-ui-border)] overflow-hidden relative shadow-sm">
      
      {/* Zoom Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[var(--theme-ui-bg)]/90 backdrop-blur-md px-4 py-2 rounded-full border border-[var(--theme-ui-border)] shadow-lg">
        <Button variant="secondary" onClick={handleZoomOut} className="!p-1.5 !rounded-full text-[var(--theme-heading)]" title="Zoom Out">
          <Icon name="zoom_out" size={20} />
        </Button>
        <span className="text-xs font-mono text-[var(--theme-text)] min-w-[3rem] text-center select-none">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="secondary" onClick={handleZoomIn} className="!p-1.5 !rounded-full text-[var(--theme-heading)]" title="Zoom In">
          <Icon name="zoom_in" size={20} />
        </Button>
        <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1" />
        <Button variant="secondary" onClick={handleResetZoom} className="!p-1.5 !rounded-full text-[var(--theme-heading)]" title="Fit to Screen">
          <Icon name="fit_screen" size={20} />
        </Button>
      </div>

      {/* PDF Container */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-auto w-full h-full p-8 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
      >
        <div className="flex flex-col items-center gap-6 pb-20 min-h-max transition-transform duration-100 origin-top">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center p-20 text-[var(--theme-text)] gap-4 animate-pulse h-full">
                <Icon name="description" size={32} className="text-[var(--theme-heading)] opacity-50" />
                <span className="text-sm">Loading PDF...</span>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center p-20 text-red-400 gap-4">
                <Icon name="error" size={32} />
                <span className="text-sm">Failed to load PDF</span>
              </div>
            }
          >
            {numPages && Array.from(new Array(numPages), (el, index) => (
              <div key={`page_${index + 1}`} className="mb-6 ring-1 ring-black/10 shadow-lg bg-white overflow-hidden rounded-sm transition-shadow hover:shadow-xl select-none pointer-events-none">
                <Page 
                  pageNumber={index + 1} 
                  scale={scale} 
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={<div className="h-[800px] w-[600px] bg-white animate-pulse" />}
                />
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
}
