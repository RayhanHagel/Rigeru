"use client";
import React, { useEffect, useRef, useState } from "react";

export interface Point { x: number; y: number; }

export interface Stroke {
  tool: "brush" | "eraser" | "text" | "shape" | "lasso" | "image";
  shapeType?: "line" | "rect" | "circle" | "diamond" | "star" | "polygon";
  shapeFillType?: "outline" | "fill" | "both";
  points: Point[];
  color: string;
  fillColor?: string;
  size: number;
  opacity: number;
  brushType: "solid" | "marker" | "art" | "bristle" | "calligraphic" | "pattern" | "scatter" | "halftone" | "watercolor" | "chalk" | "ink";
  text?: string;
  fontFamily?: string;
  letterSpacing?: number;
  sprayDots?: Point[];
  imageDataUrl?: string; 
}

export interface WhiteboardCanvasProps {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  activeTool?: "brush" | "eraser" | "text" | "shape" | "lasso" | "bucket" | "picker" | "pan";
  brushType?: "solid" | "marker" | "art" | "bristle" | "calligraphic" | "pattern" | "scatter" | "halftone" | "watercolor" | "chalk" | "ink";
  shapeType?: "line" | "rect" | "circle" | "diamond" | "star" | "polygon";
  shapeFillType?: "outline" | "fill" | "both";
  opacity?: number;
  currentColor?: string;
  fillColor?: string;
  currentSize?: number;
  eraserSize?: number;
  fillTolerance?: number;
  fontFamily?: string;
  letterSpacing?: number;
  width: number;
  height: number;
  scale?: number;
  selectedStrokeIndex?: number | null;
  onSelectStroke?: (index: number | null) => void;
  onColorPicked?: (hex: string, isRightClick: boolean) => void;
  onExportRef?: (ref: any) => void;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  strokes,
  onStrokesChange,
  activeTool = "brush",
  brushType = "solid",
  shapeType = "line",
  shapeFillType = "outline",
  opacity = 1, 
  currentColor = "#000000",
  fillColor = "#ffffff",
  currentSize = 4,
  eraserSize = 20,
  fillTolerance = 32,
  fontFamily = "Inter",
  letterSpacing = 0, 
  width,
  height,
  scale = 1,
  selectedStrokeIndex = null,
  onSelectStroke = () => {},
  onColorPicked,
  onExportRef = () => {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>(strokes);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  
  const [editingText, setEditingText] = useState<{ index?: number; x: number; y: number; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [imageCache, setImageCache] = useState<Record<string, HTMLImageElement>>({});
  
  const [pickerPreview, setPickerPreview] = useState<{ x: number, y: number, hex: string } | null>(null);

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  useEffect(() => {
     strokes.forEach(s => {
        if (s.tool === 'image' && s.imageDataUrl && !imageCache[s.imageDataUrl]) {
           const img = new Image();
           img.src = s.imageDataUrl;
           img.onload = () => setImageCache(prev => ({...prev, [s.imageDataUrl!]: img}));
        }
     });
  }, [strokes, imageCache]);

  const hexToRgb = (hex: string) => {
    const bigint = parseInt(hex.replace("#", ""), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255, 255];
  };

  const unpackUint32 = (c: number) => [c & 0xFF, (c >> 8) & 0xFF, (c >> 16) & 0xFF, c >>> 24];
  
  const colorMatch = (c1: number, r2: number, g2: number, b2: number, a2: number, tol: number) => {
      const [r1, g1, b1, a1] = unpackUint32(c1);
      return Math.abs(r1 - r2) <= tol && Math.abs(g1 - g2) <= tol && Math.abs(b1 - b2) <= tol && Math.abs(a1 - a2) <= tol;
  };

  const performFloodFill = (startX: number, startY: number, fillHex: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = new Uint32Array(imgData.data.buffer);
    const [tr, tg, tb, ta] = hexToRgb(fillHex);
    const targetColor = (ta << 24) | (tb << 16) | (tg << 8) | tr;
    
    const startPos = startY * width + startX;
    const startColor = data[startPos];
    const [sr, sg, sb, sa] = unpackUint32(startColor);
    
    if (Math.abs(sr - tr) < 5 && Math.abs(sg - tg) < 5 && Math.abs(sb - tb) < 5) return;
    
    const queue = new Int32Array(width * height);
    let head = 0; let tail = 0;
    
    queue[tail++] = startPos;
    data[startPos] = targetColor; 
    
    while (head < tail) {
      const pos = queue[head++];
      const x = pos % width;
      const y = Math.floor(pos / width);

      if (y > 0 && colorMatch(data[pos - width], sr, sg, sb, sa, fillTolerance)) { data[pos - width] = targetColor; queue[tail++] = pos - width; }
      if (y < height - 1 && colorMatch(data[pos + width], sr, sg, sb, sa, fillTolerance)) { data[pos + width] = targetColor; queue[tail++] = pos + width; }
      if (x > 0 && colorMatch(data[pos - 1], sr, sg, sb, sa, fillTolerance)) { data[pos - 1] = targetColor; queue[tail++] = pos - 1; }
      if (x < width - 1 && colorMatch(data[pos + 1], sr, sg, sb, sa, fillTolerance)) { data[pos + 1] = targetColor; queue[tail++] = pos + 1; }
    }
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width; tempCanvas.height = height;
    tempCanvas.getContext('2d')?.putImageData(imgData, 0, 0);
    const dataUrl = tempCanvas.toDataURL();
    
    const img = new Image();
    img.onload = () => {
       onStrokesChange([...strokes, { tool: "image", points: [{x:0, y:0}], color: fillHex, size: 1, opacity: 1, brushType: "solid", imageDataUrl: dataUrl }]);
    };
    img.src = dataUrl;
  };

  const pseudoRandom = (seed: number) => {
     const x = Math.sin(seed) * 10000;
     return x - Math.floor(x);
  };

  const getShapePath = (stroke: Stroke, startX: number, startY: number, w: number, h: number): Point[] => {
      const pts: Point[] = [];
      const add = (x: number, y: number) => pts.push({x, y});
      
      if (stroke.tool === 'lasso') {
          stroke.points.forEach(p => add(p.x, p.y));
          if(stroke.points.length>0) add(stroke.points[0].x, stroke.points[0].y);
      } else if (stroke.tool === 'shape') {
          switch (stroke.shapeType) {
              case 'line': add(startX, startY); add(startX+w, startY+h); break;
              case 'rect':
                  add(startX, startY); add(startX+w, startY); add(startX+w, startY+h); add(startX, startY+h); add(startX, startY); break;
              case 'circle':
                  const cx = startX + w/2; const cy = startY + h/2;
                  const rX = Math.abs(w)/2; const rY = Math.abs(h)/2;
                  for(let i=0; i<=32; i++) add(cx + rX * Math.cos((2 * Math.PI / 32) * i), cy + rY * Math.sin((2 * Math.PI / 32) * i));
                  break;
              case 'diamond':
                  add(startX+w/2, startY); add(startX+w, startY+h/2); add(startX+w/2, startY+h); add(startX, startY+h/2); add(startX+w/2, startY); break;
              case 'star':
                  const scx = startX + w/2; const scy = startY + h/2;
                  const spikes = 5; const outerR = Math.min(Math.abs(w), Math.abs(h)) / 2; const innerR = outerR / 2;
                  let rot = Math.PI / 2 * 3; const stepStar = Math.PI / spikes;
                  for (let i = 0; i <= spikes; i++) {
                      add(scx + Math.cos(rot) * outerR, scy + Math.sin(rot) * outerR); rot += stepStar;
                      if(i < spikes) add(scx + Math.cos(rot) * innerR, scy + Math.sin(rot) * innerR); rot += stepStar;
                  }
                  add(scx, scy - outerR);
                  break;
              case 'polygon': 
                  const pcx = startX + w/2; const pcy = startY + h/2; const pR = Math.min(Math.abs(w), Math.abs(h)) / 2;
                  for (let i = 0; i <= 6; i++) add(pcx + pR * Math.cos((2 * Math.PI / 6) * i), pcy + pR * Math.sin((2 * Math.PI / 6) * i));
                  break;
          }
      } else if (stroke.tool === 'brush') {
          stroke.points.forEach(p => add(p.x, p.y));
      }
      return pts;
  };

  const drawOutline = (ctx: CanvasRenderingContext2D, stroke: Stroke, pathPoints: Point[]) => {
      if (pathPoints.length === 0) return;
      const { brushType, size, color, opacity } = stroke;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      if (brushType === "solid" || brushType === "marker") {
          if (brushType === "marker") {
              ctx.globalCompositeOperation = "multiply";
              ctx.globalAlpha = opacity * 0.6;
          }
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
          pathPoints.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
      }
      else if (brushType === "pattern") {
          ctx.lineWidth = size;
          ctx.setLineDash([size, size * 1.5]);
          ctx.beginPath();
          ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
          pathPoints.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
          ctx.setLineDash([]);
      }
      else if (brushType === "bristle") {
          ctx.lineWidth = Math.max(1, size / 4);
          ctx.globalAlpha = opacity * 0.4;
          const offsets = [-size/2, -size/4, 0, size/4, size/2];
          offsets.forEach(offset => {
              ctx.beginPath();
              ctx.moveTo(pathPoints[0].x + offset, pathPoints[0].y + offset);
              pathPoints.forEach(p => ctx.lineTo(p.x + offset, p.y + offset));
              ctx.stroke();
          });
      }
      else {
          ctx.lineWidth = 0;
          
          const densePoints: Point[] = [];
          const stepSize = Math.max(1, size / 4); 
          densePoints.push(pathPoints[0]);
          for (let i = 1; i < pathPoints.length; i++) {
              const p1 = pathPoints[i-1];
              const p2 = pathPoints[i];
              const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
              const steps = Math.floor(dist / stepSize);
              for (let j = 1; j <= steps; j++) {
                  densePoints.push({ x: p1.x + (p2.x - p1.x) * (j / steps), y: p1.y + (p2.y - p1.y) * (j / steps) });
              }
              if (steps === 0) densePoints.push(p2);
          }

          const totalPoints = densePoints.length;
          
          if (brushType === "halftone") {
              const gridSize = Math.max(4, size / 1.5);
              ctx.fillStyle = color;
              const drawnDots = new Set();
              densePoints.forEach((pt) => {
                  const gx = Math.round(pt.x / gridSize) * gridSize;
                  const gy = Math.round(pt.y / gridSize) * gridSize;
                  const key = `${gx},${gy}`;
                  if (!drawnDots.has(key)) {
                      drawnDots.add(key);
                      ctx.beginPath();
                      ctx.arc(gx, gy, size / 3, 0, Math.PI * 2);
                      ctx.fill();
                  }
              });
              return;
          }

          densePoints.forEach((pt, i) => {
              const x = pt.x; const y = pt.y;
              if (brushType === "calligraphic") {
                  ctx.beginPath();
                  ctx.ellipse(x, y, size, size / 3, Math.PI / 4, 0, Math.PI * 2);
                  ctx.fill();
              } else if (brushType === "scatter") {
                  const r1 = pseudoRandom(x + y * 1000);
                  const r2 = pseudoRandom(x * 1000 + y);
                  if (r1 > 0.5) {
                      ctx.beginPath();
                      ctx.arc(x + (r1-0.75)*size*2, y + (r2-0.75)*size*2, size/4, 0, Math.PI*2);
                      ctx.fill();
                  }
              } else if (brushType === "art") {
                  const edgeTicks = 20;
                  let taper = 1;
                  if (i < edgeTicks) taper = (i / edgeTicks);
                  else if (totalPoints - i < edgeTicks) taper = ((totalPoints - i) / edgeTicks);
                  ctx.beginPath();
                  ctx.arc(x, y, (size / 2) * taper + 0.5, 0, Math.PI * 2);
                  ctx.fill();
              } else if (brushType === "watercolor") {
                  ctx.globalAlpha = opacity * 0.1; 
                  const r = size/2 + Math.sin(i*0.1)*size/4;
                  ctx.beginPath();
                  ctx.arc(x, y, r, 0, Math.PI*2);
                  ctx.fill();
              } else if (brushType === "chalk") {
                  ctx.globalAlpha = opacity * 0.8;
                  for(let k=0; k<3; k++) {
                      const r = pseudoRandom(x * 100 + y + k);
                      const theta = pseudoRandom(y * 100 + x + k) * Math.PI * 2;
                      const rad = r * size / 2;
                      ctx.fillRect(x + Math.cos(theta)*rad, y + Math.sin(theta)*rad, 1.5, 1.5);
                  }
              } else if (brushType === "ink") {
                  const taper = Math.min(1, i / 10, (totalPoints - i) / 10);
                  const noise = pseudoRandom(i) * 0.2 + 0.9;
                  ctx.beginPath();
                  ctx.arc(x, y, (size / 2) * taper * noise, 0, Math.PI*2);
                  ctx.fill();
              }
          });
      }
  };

  const drawStrokeCore = (ctx: CanvasRenderingContext2D, stroke: Stroke, index?: number) => {
    if (stroke.tool === 'image' && stroke.imageDataUrl) {
       const img = imageCache[stroke.imageDataUrl];
       if (img) {
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = stroke.opacity;
          ctx.drawImage(img, 0, 0, width, height);
       }
       return;
    }

    if (stroke.points.length === 0) return;

    ctx.globalAlpha = stroke.opacity;
    
    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)"; 
      ctx.globalAlpha = 1; 
      ctx.lineWidth = stroke.size;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      return;
    }

    ctx.globalCompositeOperation = "source-over";
    const startX = stroke.points[0].x; const startY = stroke.points[0].y;
    const endX = stroke.points[stroke.points.length - 1].x; const endY = stroke.points[stroke.points.length - 1].y;
    const w = endX - startX; const h = endY - startY;

    if (stroke.tool === 'text') {
        if (stroke.text && index !== editingText?.index) {
          ctx.font = `${stroke.size * 3}px ${stroke.fontFamily || "sans-serif"}`;
          (ctx as any).letterSpacing = `${stroke.letterSpacing || 0}px`; 
          ctx.fillStyle = stroke.color;
          ctx.textBaseline = "top";
          const lines = stroke.text.split('\n');
          const lineHeight = stroke.size * 3.5;
          lines.forEach((line, i) => ctx.fillText(line, startX, startY + (i * lineHeight)));
          
          if (index === selectedStrokeIndex) {
             const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
             ctx.strokeStyle = "#3B82F6"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
             ctx.strokeRect(startX - 5, startY - 5, maxWidth + 10, (lines.length * lineHeight) + 10);
             ctx.setLineDash([]);
          }
          (ctx as any).letterSpacing = "0px";
        }
        return;
    }

    const pathPoints = getShapePath(stroke, startX, startY, w, h);
    
    // Fill Pass
    if ((stroke.tool === 'shape' || stroke.tool === 'lasso') && stroke.shapeFillType !== 'outline' && pathPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
        pathPoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = stroke.fillColor || stroke.color;
        ctx.fill();
    }

    // Outline Pass
    if (stroke.tool === 'brush' || ((stroke.tool === 'shape' || stroke.tool === 'lasso') && stroke.shapeFillType !== 'fill')) {
        drawOutline(ctx, stroke, pathPoints);
    }
  };

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      onExportRef({
        toDataURL: (type: string, quality?: number) => canvas.toDataURL(type, quality),
        generateGifFrames: async (step: number, fps: number): Promise<string[]> => {
          const currentStrokes = strokesRef.current;
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = width; tempCanvas.height = height;
          const ctx = tempCanvas.getContext("2d");
          if (!ctx) return [canvas.toDataURL("image/png")];
          const frames: string[] = [];
          
          const drawState = (strokeLimit: number, pointLimit: number) => {
            ctx.clearRect(0, 0, width, height); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
            for (let i = 0; i <= strokeLimit; i++) {
              const s = currentStrokes[i];
              if (!s) continue;
              if (i === strokeLimit && pointLimit < s.points.length && (s.tool === 'brush' || s.tool === 'eraser' || s.tool === 'lasso')) {
                drawStrokeCore(ctx, { ...s, points: s.points.slice(0, pointLimit) }, i);
              } else { drawStrokeCore(ctx, s, i); }
            }
            frames.push(tempCanvas.toDataURL("image/jpeg", 0.75)); 
          };
          
          drawState(-1, 0);
          for (let i = 0; i < currentStrokes.length; i++) {
             const stroke = currentStrokes[i];
             if (stroke.tool === "text" || stroke.tool === "shape" || stroke.tool === "image") {
                 drawState(i, stroke.points.length);
             } else {
                 const pts = stroke.points.length;
                 for (let p = step; p < pts; p += step) drawState(i, p);
                 if (pts % step !== 0) drawState(i, pts);
             }
             await new Promise(resolve => setTimeout(resolve, 0));
          }
          if (frames.length > 0) {
            const lastFrame = frames[frames.length - 1];
            for (let i = 0; i < fps; i++) frames.push(lastFrame);
          }
          return frames;
        }
      });
    }
  }, [onExportRef, width, height, imageCache]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
    strokes.forEach((stroke, i) => drawStrokeCore(ctx, stroke, i));
    if (currentStroke) drawStrokeCore(ctx, currentStroke);
  }, [strokes, currentStroke, width, height, selectedStrokeIndex, editingText, imageCache]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const hitTestText = (point: Point) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return null;
    for (let i = strokes.length - 1; i >= 0; i--) {
       const s = strokes[i];
       if (s.tool === "text" && s.text && s.points.length > 0) {
          ctx.font = `${s.size * 3}px ${s.fontFamily || "sans-serif"}`;
          (ctx as any).letterSpacing = `${s.letterSpacing || 0}px`;
          const lines = s.text.split('\n');
          const w = Math.max(...lines.map(l => ctx.measureText(l).width));
          const h = lines.length * (s.size * 3.5);
          if (point.x >= s.points[0].x && point.x <= s.points[0].x + w && point.y >= s.points[0].y && point.y <= s.points[0].y + h) {
             return i;
          }
       }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingText) { handleTextComplete(editingText.text); return; }
    const point = getCoordinates(e);

    if (activeTool === "pan") { return; } 

    if (activeTool === "picker") {
       if (onColorPicked) {
          const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
          if (ctx) {
             const pixel = ctx.getImageData(point.x, point.y, 1, 1).data;
             const hex = "#" + ("000000" + ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]).toString(16)).slice(-6);
             const isRightClick = e.button === 2 || e.buttons === 2;
             onColorPicked(hex, isRightClick);
          }
       }
       return;
    }
    
    if (activeTool === "bucket") { performFloodFill(Math.floor(point.x), Math.floor(point.y), currentColor); return; }

    if (activeTool === "text") {
       const hitIndex = hitTestText(point);
       if (hitIndex !== null) {
          onSelectStroke(hitIndex); setIsDragging(true);
          setDragOffset({ x: point.x - strokes[hitIndex].points[0].x, y: point.y - strokes[hitIndex].points[0].y });
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
       } else setEditingText({ x: point.x, y: point.y, text: "" });
       return;
    }

    setIsDrawing(true);
    setCurrentStroke({
      tool: activeTool as "brush" | "eraser" | "shape" | "lasso", points: [point], color: currentColor, fillColor,
      size: activeTool === 'eraser' ? eraserSize : currentSize, opacity, brushType, shapeType, shapeFillType
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingText) return; 
    if (activeTool === "pan") return; 

    const point = getCoordinates(e);

    if (activeTool === "picker") {
       const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
       if (ctx) {
           const pixel = ctx.getImageData(point.x, point.y, 1, 1).data;
           const hex = "#" + ("000000" + ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]).toString(16)).slice(-6);
           setPickerPreview({ x: e.clientX, y: e.clientY, hex });
       }
       return;
    } else {
       if (pickerPreview) setPickerPreview(null);
    }

    if (isDragging && selectedStrokeIndex !== null && dragOffset) {
       const newStrokes = [...strokes];
       newStrokes[selectedStrokeIndex].points[0] = { x: point.x - dragOffset.x, y: point.y - dragOffset.y };
       onStrokesChange(newStrokes); return;
    }

    if (!isDrawing || !currentStroke) return;
    setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, point] });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (activeTool === "pan") return;
    if (isDragging) { setIsDragging(false); return; }
    if (!isDrawing || !currentStroke) return;
    
    setIsDrawing(false);
    onStrokesChange([...strokes, currentStroke]);
    setCurrentStroke(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === "text" && selectedStrokeIndex !== null) {
       const stroke = strokes[selectedStrokeIndex];
       if (stroke.tool === "text") setEditingText({ index: selectedStrokeIndex, x: stroke.points[0].x, y: stroke.points[0].y, text: stroke.text || "" });
    }
  };

  const handleTextComplete = (finalText: string) => {
    if (!editingText) return;
    if (finalText.trim()) {
      if (editingText.index !== undefined) {
         const newStrokes = [...strokes];
         newStrokes[editingText.index].text = finalText; onStrokesChange(newStrokes);
      } else {
         onStrokesChange([...strokes, {
           tool: "text", points: [{ x: editingText.x, y: editingText.y }], color: currentColor, 
           size: currentSize, opacity, brushType, text: finalText, fontFamily, letterSpacing
         }]);
      }
    } else if (editingText.index !== undefined) {
       onStrokesChange(strokes.filter((_, i) => i !== editingText.index)); onSelectStroke(null);
    }
    setEditingText(null);
  };

  return (
    <div style={{ position: 'relative', width: width * scale, height: height * scale, flexShrink: 0 }}>
      <div className="relative origin-top-left"
        style={{ width, height, transform: `scale(${scale})`, position: 'absolute', top: 0, left: 0, touchAction: "none" }}>
        
        <canvas
          ref={canvasRef} width={width} height={height}
          onContextMenu={(e) => e.preventDefault()} 
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onDoubleClick={handleDoubleClick}
          onPointerLeave={() => { if (pickerPreview) setPickerPreview(null); }}
          className={`w-full h-full bg-white ${
              activeTool === 'text' ? 'cursor-text' : activeTool === 'eraser' ? 'cursor-cell' : 
              activeTool === 'bucket' ? 'cursor-copy' : activeTool === 'picker' ? 'cursor-crosshair' : 'cursor-crosshair'
          }`}
        />

        {editingText && (
          <textarea
            autoFocus value={editingText.text}
            onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
            onBlur={(e) => handleTextComplete(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleTextComplete(editingText.text); }}
            style={{
              position: 'absolute', left: `${editingText.x}px`, top: `${editingText.y}px`,
              fontSize: `${(editingText.index !== undefined ? strokes[editingText.index].size : currentSize) * 3}px`,
              fontFamily: editingText.index !== undefined ? strokes[editingText.index].fontFamily : fontFamily,
              letterSpacing: `${editingText.index !== undefined ? strokes[editingText.index].letterSpacing : letterSpacing}px`,
              color: editingText.index !== undefined ? strokes[editingText.index].color : currentColor,
              background: 'transparent', border: '2px dashed #3B82F6', outline: 'none', whiteSpace: 'pre-wrap',
              minWidth: '200px', height: `${Math.max(2, editingText.text.split('\n').length) * (editingText.index !== undefined ? strokes[editingText.index].size : currentSize) * 3.5}px`,
              lineHeight: 1.1, padding: 0, margin: 0, overflow: 'hidden', resize: 'both', cursor: 'text', zIndex: 50
            }}
          />
        )}
      </div>

      {pickerPreview && activeTool === 'picker' && (
        <div style={{ position: 'fixed', left: pickerPreview.x + 15, top: pickerPreview.y + 15, zIndex: 100 }}
             className="flex items-center gap-2 bg-[var(--theme-ui-bg)] shadow-xl border border-[var(--theme-ui-border)] p-2 rounded-lg pointer-events-none">
             <div className="w-5 h-5 rounded-full border border-black/20 dark:border-white/20" style={{ backgroundColor: pickerPreview.hex }} />
             <span className="text-[10px] font-mono font-bold text-[var(--theme-text)] uppercase">{pickerPreview.hex}</span>
        </div>
      )}
    </div>
  );
};