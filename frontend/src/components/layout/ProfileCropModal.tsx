"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

interface ProfileCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

export function ProfileCropModal({ isOpen, imageSrc, onClose, onConfirm }: ProfileCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset positioning when modal opens with new image
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.5), 3));
  };

  const handleCropAndSave = () => {
    if (!imgRef.current) return;
    const canvas = document.createElement("canvas");
    const cropSize = 256;
    canvas.width = cropSize;
    canvas.height = cropSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // We render circle crop
    const img = imgRef.current;
    const displaySize = 256; // diameter of circle aperture in preview
    const scaleFactor = (img.naturalWidth / (img.width || 1)) / zoom;

    // Center offset relative to display circle center (128, 128)
    const centerX = img.naturalWidth / 2 - (offset.x * (img.naturalWidth / (img.width || 1))) / zoom;
    const centerY = img.naturalHeight / 2 - (offset.y * (img.naturalHeight / (img.height || 1))) / zoom;
    const cropRadius = (displaySize / 2) * scaleFactor;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      img,
      centerX - cropRadius,
      centerY - cropRadius,
      cropRadius * 2,
      cropRadius * 2,
      0,
      0,
      cropSize,
      cropSize
    );
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/png");
    onConfirm(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md rounded-2xl border p-6 flex flex-col items-center gap-5 shadow-2xl"
        style={{
          backgroundColor: "var(--theme-ui-bg)",
          borderColor: "var(--theme-ui-border)",
        }}
      >
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="account_circle" size={24} className="text-[var(--theme-heading)]" />
            <h3 className="text-lg font-bold text-[var(--theme-heading)]">Adjust Profile Picture</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--theme-text)] hover:text-white transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <p className="text-xs text-[var(--theme-text)] opacity-80 text-center">
          Drag to reposition and scroll or use the slider to zoom. The darkened outer area will be cropped away.
        </p>

        {/* Crop view container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="relative w-72 h-72 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border select-none flex items-center justify-center"
          style={{
            backgroundColor: "var(--theme-bg)",
            borderColor: "var(--theme-ui-border)",
          }}
        >
          {/* Draggable & Scalable image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop Preview"
            draggable={false}
            className="max-w-none pointer-events-none transition-transform duration-75 ease-out select-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              maxHeight: "260px",
            }}
          />

          {/* Darkened overlay with circular transparent window */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* The circular cutout ring with massive outer shadow to darken everything outside the circle */}
            <div
              className="w-56 h-56 rounded-full border-2 border-[var(--theme-heading)] shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
              style={{
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.68)",
              }}
            />
          </div>
        </div>

        {/* Zoom Slider */}
        <div className="w-full flex items-center gap-3 px-2">
          <Icon name="zoom_out" size={18} className="text-[var(--theme-text)]" />
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-[var(--theme-heading)] cursor-pointer"
          />
          <Icon name="zoom_in" size={18} className="text-[var(--theme-text)]" />
        </div>

        {/* Action buttons */}
        <div className="w-full flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="!w-auto px-4 py-2">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCropAndSave} className="!w-auto px-4 py-2">
            Set Profile Picture
          </Button>
        </div>
      </div>
    </div>
  );
}
