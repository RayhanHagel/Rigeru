"use client";

import React, { useRef, useState, useCallback } from "react";
import getStroke from "perfect-freehand";

type Point = [number, number, number];

export interface Stroke {
  points: Point[];
  color: string;
  size: number;
}

export interface WhiteboardCanvasProps {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  currentColor: string;
  currentSize: number;
  width: number;
  height: number;
  scale?: number;
  onExportRef?: (ref: any) => void;
}

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  strokes,
  onStrokesChange,
  currentColor,
  currentSize,
  width,
  height,
  scale = 1,
  onExportRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const isDrawing = useRef(false);

  // Expose export function
  React.useEffect(() => {
    if (onExportRef && containerRef.current) {
      onExportRef({
        toDataURL: (type = "image/png") => {
          // Render SVG to Canvas to get DataURL
          const svgElement = containerRef.current?.querySelector("svg");
          if (!svgElement) return null;
          
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          
          // Fill background white
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);

          const xml = new XMLSerializer().serializeToString(svgElement);
          const svg64 = btoa(unescape(encodeURIComponent(xml)));
          const b64Start = "data:image/svg+xml;base64,";
          const image64 = b64Start + svg64;

          return new Promise<string>((resolve) => {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL(type));
            };
            img.src = image64;
          });
        }
      });
    }
  }, [onExportRef, width, height]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    
    isDrawing.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    const x = (e.clientX - rect.left) / scaleX;
    const y = (e.clientY - rect.top) / scaleY;
    
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
    
    setCurrentStroke([[x, y, pressure]]);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [width, height]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    const x = (e.clientX - rect.left) / scaleX;
    const y = (e.clientY - rect.top) / scaleY;
    
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
    
    setCurrentStroke((prev) => [...prev, [x, y, pressure]]);
  }, [width, height]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    if (currentStroke.length > 0) {
      onStrokesChange([
        ...strokes,
        { points: currentStroke, color: currentColor, size: currentSize }
      ]);
      setCurrentStroke([]);
    }
  }, [currentStroke, strokes, currentColor, currentSize, onStrokesChange]);

  const renderStroke = (strokePoints: Point[], color: string, size: number) => {
    const strokeOutline = getStroke(strokePoints, {
      size: size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: false, // We use real pressure from PointerEvent
    });
    
    const pathData = getSvgPathFromStroke(strokeOutline);
    return <path d={pathData} fill={color} />;
  };

  return (
    <div 
      ref={containerRef}
      className="relative touch-none overflow-hidden bg-white shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-lg shrink-0 origin-top-left transition-transform duration-200"
      style={{ width, height, cursor: "crosshair", transform: `scale(${scale})` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none" 
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {strokes.map((stroke, i) => (
          <g key={i}>
            {renderStroke(stroke.points, stroke.color, stroke.size)}
          </g>
        ))}
        
        {currentStroke.length > 0 && (
          <g>
            {renderStroke(currentStroke, currentColor, currentSize)}
          </g>
        )}
      </svg>
    </div>
  );
};
