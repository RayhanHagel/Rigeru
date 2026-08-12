"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/lib/utils";

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText?: string;
}

export function ImageZoomModal({ isOpen, onClose, imageUrl, altText = "Zoomed Image" }: ImageZoomModalProps) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newScale = scale + (e.deltaY > 0 ? -0.1 : 0.1);
    setScale(Math.min(Math.max(0.5, newScale), 5)); // Limit zoom between 0.5x and 5x
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-zinc-900/80 p-2 rounded-xl border border-white/10 backdrop-blur-md">
        <button 
          onClick={() => setScale(s => Math.max(0.5, s - 0.2))} 
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <Icon name="zoom_out" size={20} />
        </button>
        <div className="text-zinc-300 font-medium text-sm w-12 text-center">
          {Math.round(scale * 100)}%
        </div>
        <button 
          onClick={() => setScale(s => Math.min(5, s + 0.2))} 
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Zoom In"
        >
          <Icon name="zoom_in" size={20} />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button 
          onClick={resetZoom} 
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Reset View"
        >
          <Icon name="fullscreen" size={20} />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button 
          onClick={onClose} 
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Close"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      {/* Image Container */}
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-move"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt={altText}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          className="max-w-[90vw] max-h-[90vh] object-contain select-none"
        />
      </div>
    </div>,
    document.body
  );
}
