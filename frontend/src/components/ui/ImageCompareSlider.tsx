"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from "@/lib/utils";


interface ImageCompareSliderProps {
  originalImage: string;
  processedImage: string | null;
  onProcessClick?: () => void;
  isProcessing?: boolean;
  processedLabel?: string;
  processButtonText?: string;
}

export function ImageCompareSlider({ 
  originalImage, 
  processedImage, 
  onProcessClick, 
  isProcessing = false,
  processedLabel = "Transparent",
  processButtonText = "Process Media"
}: ImageCompareSliderProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'compare' | 'pan'>('compare');
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  
  // Synchronous ref to prevent React batching/strict mode bugs during rapid wheel events
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });

  // Keep ref in sync so event handlers always see latest value
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    isPanningRef.current = isPanning;
  }, [isPanning]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (isDraggingRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        let pos = ((clientX - transformRef.current.x) / (rect.width * transformRef.current.scale)) * 100;
        setSliderPos(Math.max(0, Math.min(pos, 100)));
      } else if (isPanningRef.current) {
        const newX = panStartRef.current.panX + (e.clientX - panStartRef.current.x);
        const newY = panStartRef.current.panY + (e.clientY - panStartRef.current.y);
        transformRef.current.x = newX;
        transformRef.current.y = newY;
        setPan({ x: newX, y: newY });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current) return;
      if (isDraggingRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.touches[0].clientX - rect.left;
        let pos = ((clientX - transformRef.current.x) / (rect.width * transformRef.current.scale)) * 100;
        setSliderPos(Math.max(0, Math.min(pos, 100)));
      } else if (isPanningRef.current) {
        const newX = panStartRef.current.panX + (e.touches[0].clientX - panStartRef.current.x);
        const newY = panStartRef.current.panY + (e.touches[0].clientY - panStartRef.current.y);
        transformRef.current.x = newX;
        transformRef.current.y = newY;
        setPan({ x: newX, y: newY });
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const doZoom = useCallback((factor: number, originX?: number, originY?: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = originX !== undefined ? originX : rect.width / 2;
    const mouseY = originY !== undefined ? originY : rect.height / 2;

    const prevScale = transformRef.current.scale;
    const prevPanX = transformRef.current.x;
    const prevPanY = transformRef.current.y;
    
    const newScale = Math.max(1, Math.min(prevScale * factor, 10));
    if (newScale === prevScale) return;

    let newX = 0;
    let newY = 0;
    
    if (newScale !== 1) {
      const imageX = (mouseX - prevPanX) / prevScale;
      const imageY = (mouseY - prevPanY) / prevScale;
      newX = mouseX - imageX * newScale;
      newY = mouseY - imageY * newScale;
    }

    // Update synchronous ref instantly to prevent race conditions during rapid scrolls
    transformRef.current = { scale: newScale, x: newX, y: newY };
    
    // Trigger React re-render
    setScale(newScale);
    setPan({ x: newX, y: newY });
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault(); // Prevents page scrolling
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (e.deltaY < 0) {
      doZoom(1.1, mouseX, mouseY);
    } else {
      doZoom(1 / 1.1, mouseX, mouseY);
    }
  }, [doZoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Only intercept if we are not clicking a button
    if ((e.target as HTMLElement).closest('button')) return;
    
    if (mode === 'compare') {
      setIsDragging(true);
    } else {
      setIsPanning(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      panStartRef.current = { x: clientX, y: clientY, panX: pan.x, panY: pan.y };
    }
  };

  if (!processedImage) {
    return (
      <div className="relative w-full max-w-2xl mx-auto aspect-square bg-zinc-950/50 border border-white/10 rounded-xl overflow-hidden flex flex-col items-center justify-center p-4">
        <img src={originalImage} alt="" className="max-w-full max-h-full object-contain opacity-50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <button
            onClick={onProcessClick}
            disabled={isProcessing}
            className="px-6 py-3 text-white rounded-lg font-medium shadow-lg transition-all disabled:opacity-50"
            style={{ backgroundColor: "var(--theme-heading)" }}
          >
            {isProcessing ? "Processing" : processButtonText}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative w-full max-w-2xl mx-auto aspect-square bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZvAgf2hjgC/QYcAP3uCTZvAgf2hjgC/Q4WMATzB5HwAANVUD4nN3Z3oAAAAASUVORK5CYII=')] border border-white/10 rounded-xl overflow-hidden select-none ${mode === 'compare' ? 'cursor-ew-resize' : 'cursor-move'}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    >
      <div 
        className="w-full h-full relative"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0', transition: isDragging || isPanning ? 'none' : 'transform 0.2s ease-out' }}
      >
        {/* Background (Transparent processed image) */}
        <img 
          src={processedImage} 
          alt="Processed" 
          className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
        />
        
        {/* Foreground (Original image masked) */}
        <div 
          className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          {/* We need a solid background for the original image side to hide the transparent pattern */}
          <div className="absolute inset-0 bg-zinc-950">
              <img 
                src={originalImage} 
                alt="" 
                className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
              />
          </div>
        </div>

        {/* Slider Line (Inside the zoomed container) */}
        <div 
          className="absolute top-0 bottom-0 w-1 z-10 pointer-events-none"
          style={{ 
            left: `${sliderPos}%`, 
            backgroundColor: "var(--theme-heading)", 
            boxShadow: `0 0 10px var(--theme-heading)`,
            transform: `translateX(-50%) scaleX(${1 / scale})`
          }}
        >
          {/* Slider Handle */}
          <div 
            className="absolute top-1/2 left-1/2 w-8 h-8 -mt-4 -ml-4 rounded-full flex items-center justify-center shadow-lg border-2 border-white" 
            style={{ 
              backgroundColor: "var(--theme-heading)",
              transform: `scale(${1 / scale})` 
            }}
          >
            <div className="flex gap-1">
              <div className="w-0.5 h-3 bg-white/80 rounded-full"></div>
              <div className="w-0.5 h-3 bg-white/80 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-xs font-medium text-white/90 pointer-events-none">
        Original
      </div>
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-xs font-medium pointer-events-none" style={{ color: "var(--theme-heading)" }}>
        {processedLabel}
      </div>

      {/* Toolbar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-black/70 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
        <button 
          onClick={(e) => { e.stopPropagation(); setMode('compare'); }}
          className={`p-2 rounded-lg transition-colors ${mode === 'compare' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Compare Mode"
        >
          <Icon name="tune" size={18} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setMode('pan'); }}
          className={`p-2 rounded-lg transition-colors ${mode === 'pan' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Pan Mode"
        >
          <Icon name="open_with" size={18} />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1"></div>
        <button 
          onClick={(e) => { e.stopPropagation(); doZoom(1 / 1.2); }}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom Out"
        >
          <Icon name="zoom_out" size={18} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); doZoom(1.2); }}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom In"
        >
          <Icon name="zoom_in" size={18} />
        </button>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            transformRef.current = { scale: 1, x: 0, y: 0 };
            setScale(1); 
            setPan({x: 0, y: 0}); 
          }}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Fit Screen"
        >
          <Icon name="fullscreen" size={18} />
        </button>
      </div>
    </div>
  );
}
