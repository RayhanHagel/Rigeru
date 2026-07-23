"use client";

import React, { useState, useRef, useEffect } from 'react';

interface ImageCompareSliderProps {
  originalImage: string;
  processedImage: string | null;
  onProcessClick: () => void;
  isProcessing: boolean;
  processedLabel?: string;
  processButtonText?: string;
}

export function ImageCompareSlider({ 
  originalImage, 
  processedImage, 
  onProcessClick, 
  isProcessing,
  processedLabel = "Transparent",
  processButtonText = "✨ Remove Background"
}: ImageCompareSliderProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Keep ref in sync so event handlers always see latest value
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !isDraggingRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setSliderPos(Math.max(0, Math.min((x / rect.width) * 100, 100)));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current || !isDraggingRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
      setSliderPos(Math.max(0, Math.min((x / rect.width) * 100, 100)));
    };

    const handleEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  if (!processedImage) {
    return (
      <div className="relative w-full max-w-2xl mx-auto aspect-square bg-zinc-950/50 border border-white/10 rounded-xl overflow-hidden flex flex-col items-center justify-center p-4">
        <img src={originalImage} alt="Original" className="max-w-full max-h-full object-contain opacity-50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <button
            onClick={onProcessClick}
            disabled={isProcessing}
            className="px-6 py-3 text-white rounded-lg font-medium shadow-lg transition-all disabled:opacity-50"
            style={{ backgroundColor: "var(--theme-heading)" }}
          >
            {isProcessing ? "Processing..." : processButtonText}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full max-w-2xl mx-auto aspect-square bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZvAgf2hjgC/QYcAP3uCTZvAgf2hjgC/Q4WMATzB5HwAANVUD4nN3Z3oAAAAASUVORK5CYII=')] border border-white/10 rounded-xl overflow-hidden cursor-ew-resize select-none"
      onMouseDown={() => setIsDragging(true)}
      onTouchStart={() => setIsDragging(true)}
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
              alt="Original" 
              className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
            />
        </div>
      </div>

      {/* Slider Line */}
      <div 
        className="absolute top-0 bottom-0 w-1 z-10 pointer-events-none transform -translate-x-1/2"
        style={{ left: `${sliderPos}%`, backgroundColor: "var(--theme-heading)", boxShadow: `0 0 10px var(--theme-heading)` }}
      >
        {/* Slider Handle */}
        <div className="absolute top-1/2 left-1/2 w-8 h-8 -mt-4 -ml-4 rounded-full flex items-center justify-center shadow-lg border-2 border-white" style={{ backgroundColor: "var(--theme-heading)" }}>
          <div className="flex gap-1">
            <div className="w-0.5 h-3 bg-white/80 rounded-full"></div>
            <div className="w-0.5 h-3 bg-white/80 rounded-full"></div>
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
    </div>
  );
}
