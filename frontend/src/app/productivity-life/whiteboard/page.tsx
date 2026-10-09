"use client";
import { Header } from "@/components/ui/Header";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { WhiteboardCanvas, Stroke } from "@/components/whiteboard/WhiteboardCanvas";
import { Icon } from "@/lib/utils";

const PAGE_PRESETS = {
  A2: { name: "A2", cmX: 42.0, cmY: 59.4 },
  A3: { name: "A3", cmX: 29.7, cmY: 42.0 },
  A4: { name: "A4", cmX: 21.0, cmY: 29.7 },
  Letter: { name: "Letter", cmX: 21.59, cmY: 27.94 },
  Square: { name: "Square", cmX: 21.0, cmY: 21.0 },
  Wide: { name: "Wide (16:9)", cmX: 33.87, cmY: 19.05 },
  Custom: { name: "Custom", cmX: 21.0, cmY: 29.7 },
};

const COLORS = ['#000000', '#475569', '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'];

export interface PageData {
  id: string; width: number; height: number; strokes: Stroke[]; redoStack: Stroke[];
}

// 100% Solid Opaque Draggable Panel
const DraggablePanel = ({ 
  id, defaultPos, title, icon, children, isCollapsed, onToggleCollapse 
}: { 
  id: string, defaultPos: {x: number, y: number}, title: string, icon: string, children: React.ReactNode, isCollapsed: boolean, onToggleCollapse: () => void 
}) => {
  const [pos, setPos] = useState(defaultPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0, hasDragged: false });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleMove = (e: MouseEvent) => {
          if (!isDragging || !panelRef.current) return;
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.hasDragged = true;
          
          let newX = dragRef.current.initX + dx;
          let newY = dragRef.current.initY + dy;

          const maxX = window.innerWidth - panelRef.current.offsetWidth;
          const maxY = window.innerHeight - 40;
          newX = Math.max(0, Math.min(newX, maxX));
          newY = Math.max(0, Math.min(newY, maxY));

          setPos({ x: newX, y: newY });
      };
      const handleUp = () => setIsDragging(false);
      if (isDragging) {
          window.addEventListener("mousemove", handleMove);
          window.addEventListener("mouseup", handleUp);
      }
      return () => {
          window.removeEventListener("mousemove", handleMove);
          window.removeEventListener("mouseup", handleUp);
      };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
     dragRef.current = { startX: e.clientX, startY: e.clientY, initX: pos.x, initY: pos.y, hasDragged: false };
     setIsDragging(true);
  };
  const handleClick = () => { if (!dragRef.current.hasDragged) onToggleCollapse(); };

  return (
      <div ref={panelRef} style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 50 }} className="flex flex-col shadow-2xl rounded-xl bg-[var(--theme-ui-bg)] border-2 border-[var(--theme-ui-border)] w-80 max-h-[85vh] overflow-hidden transition-shadow text-[var(--theme-heading)]" draggable={false} onDragStart={e => e.preventDefault()}>
          <div className="flex items-center bg-[var(--theme-bg)] px-3 py-2 cursor-move border-b border-[var(--theme-ui-border)] select-none hover:bg-[color-mix(in_srgb,var(--theme-heading)_10%,transparent)] transition-colors"
               onMouseDown={handleMouseDown} onClick={handleClick} draggable={false}>
               <Icon name="drag_indicator" size={16} className="opacity-50 mr-1 pointer-events-none" />
               <Icon name={icon} size={16} className="mr-2 text-primary pointer-events-none" />
               <span className="text-xs font-bold flex-1 tracking-wide mr-4 pointer-events-none">{title}</span>
               <Icon name={isCollapsed ? "expand_more" : "expand_less"} size={16} className="opacity-70 pointer-events-none" />
          </div>
          {!isCollapsed && <div className="p-4 overflow-y-auto scrollbar-none flex flex-col gap-3 custom-scrollbar">{children}</div>}
      </div>
  );
};

export default function DigitalWhiteboardPage() {
  const defaultDpi = 96;
  const initWidth = Math.round(PAGE_PRESETS.A4.cmX * (defaultDpi / 2.54));
  const initHeight = Math.round(PAGE_PRESETS.A4.cmY * (defaultDpi / 2.54));

  const [pages, setPages] = useState<PageData[]>([{
    id: "page-1", width: initWidth, height: initHeight, strokes: [], redoStack: []
  }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const [activeTool, setActiveTool] = useState<"brush" | "eraser" | "text" | "shape" | "lasso" | "bucket" | "picker" | "pan">("brush");
  const [brushType, setBrushType] = useState<"solid" | "marker" | "art" | "bristle" | "calligraphic" | "pattern" | "scatter" | "halftone" | "watercolor" | "chalk" | "ink">("solid");
  const [shapeType, setShapeType] = useState<"line" | "rect" | "circle" | "diamond" | "star" | "polygon">("rect");
  const [shapeFillType, setShapeFillType] = useState<"outline" | "fill" | "both">("outline");
  const [currentColor, setCurrentColor] = useState("#000000"); 
  const [fillColor, setFillColor] = useState("#3B82F6"); 
  const [opacity, setOpacity] = useState(100);
  const [currentSize, setCurrentSize] = useState(6);
  const [eraserSize, setEraserSize] = useState(30);
  const [fillTolerance, setFillTolerance] = useState(60);
  
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [selectedStrokeIndex, setSelectedStrokeIndex] = useState<number | null>(null);

  const [pagePreset, setPagePreset] = useState<keyof typeof PAGE_PRESETS>("A4");
  const [customCmX, setCustomCmX] = useState<number>(PAGE_PRESETS.A4.cmX);
  const [customCmY, setCustomCmY] = useState<number>(PAGE_PRESETS.A4.cmY);
  const [dpi, setDpi] = useState<number>(defaultDpi);
  
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{x: number, y: number} | null>(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [gifFps, setGifFps] = useState(30);
  const [gifStep, setGifStep] = useState(2);
  
  // ALL collapsed by default so they stack cleanly
  const [panels, setPanels] = useState({ tools: true, format: true, export: true, ai: true, controls: true });
  const canvasExportRef = useRef<any>(null);

  const currentPage = pages[currentPageIndex];
  const currentStrokes = currentPage.strokes;

  const fitToScreen = () => {
     const c = document.getElementById("viewport-container");
     if (c && c.clientWidth > 100 && c.clientHeight > 100) {
        const padding = 40; 
        const availableW = c.clientWidth - padding * 2;
        const availableH = c.clientHeight - padding * 2;
        
        const scaleX = availableW / currentPage.width;
        const scaleY = availableH / currentPage.height;
        const newScale = Math.min(5.0, Math.max(0.05, Math.min(scaleX, scaleY)));
        
        setScale(newScale);
        setPanOffset({
            x: (c.clientWidth - currentPage.width * newScale) / 2,
            y: (c.clientHeight - currentPage.height * newScale) / 2
        });
     } else {
        setTimeout(fitToScreen, 150);
     }
  };

  useEffect(() => { fitToScreen(); }, []);

  const handlePanStart = (e: React.PointerEvent) => {
      panDragRef.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePanMove = (e: React.PointerEvent) => {
      if (panDragRef.current) {
          const dx = e.clientX - panDragRef.current.x;
          const dy = e.clientY - panDragRef.current.y;
          setPanOffset(p => ({ x: p.x + dx, y: p.y + dy }));
          panDragRef.current = { x: e.clientX, y: e.clientY };
      }
  };
  const handlePanEnd = (e: React.PointerEvent) => {
      panDragRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleZoom = (delta: number) => {
      const c = document.getElementById("viewport-container");
      if (!c) return;

      const currentPercent = scale * 100;
      let nextPercent = currentPercent + delta;
      nextPercent = Math.round(nextPercent / 5) * 5; 
      const newScale = Math.min(5.0, Math.max(0.05, nextPercent / 100));
      if (newScale === scale) return;

      const rect = c.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const canvasCx = (cx - panOffset.x) / scale;
      const canvasCy = (cy - panOffset.y) / scale;

      setPanOffset({
         x: cx - canvasCx * newScale,
         y: cy - canvasCy * newScale
      });
      setScale(newScale);
  };

  const updateSelectedStroke = (updates: Partial<Stroke>) => {
    if (selectedStrokeIndex === null) return;
    const newPages = [...pages];
    const updatedStrokes = [...newPages[currentPageIndex].strokes];
    updatedStrokes[selectedStrokeIndex] = { ...updatedStrokes[selectedStrokeIndex], ...updates };
    newPages[currentPageIndex].strokes = updatedStrokes;
    setPages(newPages);
  };

  const handleStrokesChange = (newStrokes: Stroke[]) => {
    const newPages = [...pages];
    newPages[currentPageIndex] = { ...newPages[currentPageIndex], strokes: newStrokes, redoStack: [] };
    setPages(newPages);
  };

  const handleUndo = () => {
    if (currentStrokes.length === 0) return;
    const newPages = [...pages];
    const page = newPages[currentPageIndex];
    const newStrokes = [...page.strokes];
    const popped = newStrokes.pop()!;
    newPages[currentPageIndex] = { ...page, strokes: newStrokes, redoStack: [...page.redoStack, popped] };
    setPages(newPages);
    setSelectedStrokeIndex(null);
  };

  const handleRedo = () => {
    const page = pages[currentPageIndex];
    if (page.redoStack.length === 0) return;
    const newPages = [...pages];
    const newRedoStack = [...page.redoStack];
    const popped = newRedoStack.pop()!;
    newPages[currentPageIndex] = { ...page, strokes: [...page.strokes, popped], redoStack: newRedoStack };
    setPages(newPages);
    setSelectedStrokeIndex(null);
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear this page?")) {
      const newPages = [...pages];
      newPages[currentPageIndex] = { ...newPages[currentPageIndex], strokes: [], redoStack: [] };
      setPages(newPages);
      setSelectedStrokeIndex(null);
    }
  };

  const addPage = () => {
    setPages([...pages, { id: `page-${Date.now()}`, width: currentPage.width, height: currentPage.height, strokes: [], redoStack: [] }]);
    setCurrentPageIndex(pages.length);
    setSelectedStrokeIndex(null);
  };

  const deletePage = () => {
    if (pages.length === 1) return handleClear();
    if (confirm("Are you sure you want to delete this page?")) {
      const newPages = pages.filter((_, i) => i !== currentPageIndex);
      setPages(newPages);
      setCurrentPageIndex(Math.min(currentPageIndex, newPages.length - 1));
      setSelectedStrokeIndex(null);
    }
  };

  const applyDimensionsWithScaling = (newXCm: number, newYCm: number, newDpi: number) => {
    const pxX = Math.round(newXCm * (newDpi / 2.54));
    const pxY = Math.round(newYCm * (newDpi / 2.54));
    const newPages = [...pages];
    const page = newPages[currentPageIndex];
    const scaleX = pxX / page.width;
    const scaleY = pxY / page.height;

    const scaledStrokes = page.strokes.map(stroke => ({
      ...stroke,
      size: stroke.size * Math.min(scaleX, scaleY),
      points: stroke.points.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }))
    }));

    newPages[currentPageIndex] = { ...page, width: pxX, height: pxY, strokes: scaledStrokes };
    setPages(newPages);
  };

  const handlePresetChange = (preset: keyof typeof PAGE_PRESETS) => {
    setPagePreset(preset);
    if (preset !== "Custom") {
      const targetX = PAGE_PRESETS[preset].cmX;
      const targetY = PAGE_PRESETS[preset].cmY;
      setCustomCmX(targetX);
      setCustomCmY(targetY);
      applyDimensionsWithScaling(targetX, targetY, dpi);
    }
  };

  const applyCustomFormat = () => applyDimensionsWithScaling(customCmX, customCmY, dpi);

  const rotateCurrentPage = () => {
    const newX = customCmY; const newY = customCmX;
    setCustomCmX(newX); setCustomCmY(newY);
    const page = pages[currentPageIndex];
    const rotatedStrokes = page.strokes.map(stroke => ({
       ...stroke, points: stroke.points.map(p => ({ x: page.height - p.y, y: p.x }))
    }));
    const newPages = [...pages];
    newPages[currentPageIndex] = { ...page, width: page.height, height: page.width, strokes: rotatedStrokes };
    setPages(newPages);
  };

  const setOrientation = (type: "portrait" | "landscape") => {
    const max = Math.max(customCmX, customCmY); const min = Math.min(customCmX, customCmY);
    const newX = type === "landscape" ? max : min; const newY = type === "landscape" ? min : max;
    if (customCmX !== newX || customCmY !== newY) rotateCurrentPage();
  };

  useEffect(() => {
    if (selectedStrokeIndex !== null && currentStrokes[selectedStrokeIndex]) {
      const selected = currentStrokes[selectedStrokeIndex];
      if (selected.tool === "text") {
        setActiveTool("text"); setCurrentColor(selected.color); setCurrentSize(selected.size); setOpacity(selected.opacity * 100);
        setFontFamily(selected.fontFamily || "sans-serif"); setLetterSpacing(selected.letterSpacing || 0);
      } else if (selected.tool === "shape" || selected.tool === "lasso") {
        setActiveTool(selected.tool); setCurrentColor(selected.color); setFillColor(selected.fillColor || "#000000");
        if (selected.shapeType) setShapeType(selected.shapeType);
        if (selected.shapeFillType) setShapeFillType(selected.shapeFillType);
      }
    }
  }, [selectedStrokeIndex, currentStrokes]);

  const exportCurrentPage = async (format: "png" | "jpg") => {
    if (!canvasExportRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await canvasExportRef.current.toDataURL(format === "png" ? "image/png" : "image/jpeg");
      const a = document.createElement("a"); a.href = dataUrl; a.download = `whiteboard-page-${currentPageIndex + 1}.${format}`; a.click();
    } catch (e) { alert("Failed to export."); } finally { setIsExporting(false); }
  };

  const exportDocument = async (format: "pdf" | "gif") => {
    setIsExporting(true);
    try {
      let images: string[] = [];
      if (format === "gif" && canvasExportRef.current?.generateGifFrames) {
        images = await canvasExportRef.current.generateGifFrames(gifStep, gifFps);
      } else {
        images = [canvasExportRef.current.toDataURL("image/png")];
      }
      const frameDelay = Math.round(1000 / gifFps);
      const res = await fetch("/api/files-documents/whiteboard/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, format, width: currentPage.width, height: currentPage.height, fps: gifFps, frameDelay, step: gifStep })
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `whiteboard-document.${format}`; a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { alert("Failed to export document."); } finally { setIsExporting(false); }
  };

  const transcribeNote = async () => {
    if (!canvasExportRef.current) return;
    setIsTranscribing(true); setTranscription("");
    try {
      const dataUrl = await canvasExportRef.current.toDataURL("image/png");
      const res = await fetch("/api/files-documents/whiteboard/transcribe", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl })
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Transcription failed");
      setTranscription((await res.json()).text);
    } catch (e: any) { alert(e.message || "Failed to transcribe."); } finally { setIsTranscribing(false); }
  };

  const togglePanel = (p: keyof typeof panels) => setPanels(prev => ({ ...prev, [p]: !prev[p] }));

  return (
    // Replaced min-h-screen with flex-1 bounding root logic, preventing all document scrollbars.
    <div className="w-full h-full min-h-[100dvh] relative z-10 flex flex-col font-sans bg-[var(--theme-bg)] text-[var(--theme-text)] select-none overflow-hidden">
      <div className="px-6 py-4 z-20"><Header title="Digital Whiteboard" subtitle="Advanced Illustrator brushes & tools." /></div>

      {/* The absolute inset-0 forces this container to never exceed viewport sizes */}
      <div className="flex-1 w-full relative z-10 bg-[var(--theme-bg)]">
        <div className="absolute inset-0 overflow-hidden" id="viewport-container">
            
            {/* The Invisible Overlay captures global pointer drags when Pan is active */}
            {activeTool === 'pan' && (
                <div className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
                    onPointerDown={handlePanStart} onPointerMove={handlePanMove} onPointerUp={handlePanEnd} />
            )}
            
            {/* The translated camera holding the drawing space */}
            <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)`, position: 'absolute', top: 0, left: 0 }}>
                <div className="shadow-2xl bg-white relative border border-[var(--theme-ui-border)]" style={{ width: currentPage.width * scale, height: currentPage.height * scale }}>
                  <WhiteboardCanvas 
                    strokes={currentStrokes} onStrokesChange={handleStrokesChange} activeTool={activeTool} brushType={brushType}
                    shapeType={shapeType} shapeFillType={shapeFillType} opacity={opacity / 100} currentColor={currentColor} fillColor={fillColor}
                    currentSize={currentSize} eraserSize={eraserSize} fillTolerance={fillTolerance} fontFamily={fontFamily} letterSpacing={letterSpacing}
                    width={currentPage.width} height={currentPage.height} scale={scale} selectedStrokeIndex={selectedStrokeIndex}
                    onSelectStroke={setSelectedStrokeIndex} onColorPicked={(hex, isFill) => isFill ? setFillColor(hex) : setCurrentColor(hex)} onExportRef={ref => canvasExportRef.current = ref}
                  />
                </div>
            </div>
        </div>
      </div>

      {/* Menus vertically stacked dynamically on Mount */}
      <DraggablePanel id="tools" defaultPos={{ x: 20, y: 80 }} title="Tools & Shapes" icon="build" isCollapsed={panels.tools} onToggleCollapse={() => togglePanel('tools')}>
        <div className="grid grid-cols-4 gap-1">
            {(['brush', 'eraser', 'text', 'shape', 'lasso', 'bucket', 'picker', 'pan'] as const).map(tool => (
            <Button key={tool} size="sm" variant={activeTool === tool ? "primary" : "secondary"}
                onClick={() => { setActiveTool(tool); if(tool !== 'text' && tool !== 'shape' && tool !== 'lasso') setSelectedStrokeIndex(null); }}
                className={`text-[10px] capitalize !px-1 ${activeTool === tool ? 'shadow-inner' : ''}`} title={tool}>
                {tool === "shape" ? <Icon name="category" size={16}/> : tool === "lasso" ? <Icon name="gesture" size={16}/> :
                 tool === "bucket" ? <Icon name="format_color_fill" size={16}/> : tool === "picker" ? <Icon name="colorize" size={16}/> :
                 tool === "pan" ? <Icon name="pan_tool" size={16}/> : tool}
            </Button>
            ))}
        </div>

        {activeTool === 'shape' && (
            <div className="flex gap-2">
                <div className="flex-1">
                <label className="block text-[10px] font-bold opacity-70 mb-1">Shape</label>
                <select value={shapeType} onChange={e => { setShapeType(e.target.value as any); updateSelectedStroke({ shapeType: e.target.value as any }); }} className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded p-1.5 text-xs outline-none">
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="line">Line</option><option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="rect">Rectangle</option><option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="circle">Circle</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="diamond">Diamond</option><option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="star">Star</option><option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="polygon">Polygon</option>
                </select>
                </div>
                {shapeType !== 'line' && (
                    <div className="flex-1">
                    <label className="block text-[10px] font-bold opacity-70 mb-1">Fill Setting</label>
                    <select value={shapeFillType} onChange={e => { setShapeFillType(e.target.value as any); updateSelectedStroke({ shapeFillType: e.target.value as any }); }} className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded p-1.5 text-xs outline-none">
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="outline">Outline</option><option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="fill">Fill</option><option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="both">Both</option>
                    </select>
                    </div>
                )}
            </div>
        )}

        {activeTool === 'lasso' && (
            <div>
                <label className="block text-[10px] font-bold opacity-70 mb-1">Lasso Fill Type</label>
                <select value={shapeFillType} onChange={e => { setShapeFillType(e.target.value as any); updateSelectedStroke({ shapeFillType: e.target.value as any }); }} className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded p-1.5 text-xs outline-none">
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="outline">Outline</option><option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="fill">Fill</option><option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="both">Both</option>
                </select>
            </div>
        )}

        {activeTool === 'bucket' && (
            <div>
                <label className="block text-[10px] font-bold opacity-70 mb-1">Fill Tolerance: {fillTolerance}</label>
                <input type="range" min="0" max="255" value={fillTolerance} onChange={e => setFillTolerance(Number(e.target.value))} className="w-full accent-blue-500 mt-1" />
            </div>
        )}

        {activeTool === 'picker' && (
            <div className="text-[10px] italic opacity-70 p-2 bg-[var(--theme-bg)] rounded border border-[var(--theme-ui-border)] text-center">
                Select color under cursor.<br/>
                <b>Left Click:</b> Outline Color <br/>
                <b>Right Click:</b> Fill Color
            </div>
        )}

        {(activeTool === 'brush' || activeTool === 'shape' || activeTool === 'lasso') && (
            <div className="flex gap-3">
                <div className="flex-1">
                <label className="block text-[10px] font-bold opacity-70 mb-1">Brush Style</label>
                <select value={brushType} onChange={e => { setBrushType(e.target.value as any); updateSelectedStroke({ brushType: e.target.value as any }); }} className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded p-1.5 text-xs outline-none">
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="solid">Pencil (Solid)</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="marker">Marker</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="ink">Ink Sketch Pen</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="calligraphic">Calligraphic</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="bristle">Bristle</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="scatter">Scatter</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="halftone">Halftone</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="watercolor">Watercolor</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="chalk">Chalk</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="pattern">Pattern</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="art">Art Brush</option>
                </select>
                </div>
                <div className="flex-1">
                <label className="block text-[10px] font-bold opacity-70 mb-1">Opacity: {opacity}%</label>
                <input type="range" min="1" max="100" value={opacity} onChange={e => { setOpacity(parseInt(e.target.value)); updateSelectedStroke({ opacity: parseInt(e.target.value) / 100 }); }} className="w-full accent-blue-500 mt-1" />
                </div>
            </div>
        )}

        {activeTool !== 'eraser' && activeTool !== 'pan' && activeTool !== 'picker' && (
            <div className="flex gap-2">
                <div className="flex-1">
                <label className="block text-[10px] font-bold opacity-70 mb-1">{(activeTool === 'shape' || activeTool === 'lasso') ? 'Outline Color' : 'Color'}</label>
                <div className="grid grid-cols-6 gap-1">
                    {COLORS.map(color => (
                      <button key={color} onClick={() => { setCurrentColor(color); updateSelectedStroke({ color }); }} className={`w-5 h-5 rounded-full border border-black/20 dark:border-white/20 ${currentColor === color ? 'ring-2 ring-primary scale-110' : 'shadow-sm hover:scale-110'}`} style={{ backgroundColor: color }} />
                    ))}
                    <label className="cursor-pointer w-5 h-5 rounded-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-heading)] flex items-center justify-center relative overflow-hidden hover:opacity-80" title="Custom Color">
                    <Icon name="palette" size={12} /><input type="color" value={currentColor} onChange={e => { setCurrentColor(e.target.value); updateSelectedStroke({ color: e.target.value }); }} className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                    </label>
                </div>
                </div>
                {((activeTool === 'shape' || activeTool === 'lasso') && shapeFillType !== 'outline' && shapeType !== 'line' || activeTool === 'bucket') && (
                <div className="flex-1">
                    <label className="block text-[10px] font-bold opacity-70 mb-1">Fill Color</label>
                    <div className="grid grid-cols-6 gap-1">
                    {COLORS.map(color => (
                        <button key={color} onClick={() => { setFillColor(color); updateSelectedStroke({ fillColor: color }); }} className={`w-5 h-5 rounded-full border border-black/20 dark:border-white/20 ${fillColor === color ? 'ring-2 ring-primary scale-110' : 'shadow-sm hover:scale-110'}`} style={{ backgroundColor: color }} />
                    ))}
                    <label className="cursor-pointer w-5 h-5 rounded-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-heading)] flex items-center justify-center relative overflow-hidden hover:opacity-80" title="Custom Fill">
                        <Icon name="format_color_fill" size={12} /><input type="color" value={fillColor} onChange={e => { setFillColor(e.target.value); updateSelectedStroke({ fillColor: e.target.value }); }} className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                    </label>
                    </div>
                </div>
                )}
            </div>
        )}

        {activeTool !== 'pan' && activeTool !== 'picker' && activeTool !== 'bucket' && (
            <div>
                {activeTool === 'eraser' ? (
                <><label className="block text-[10px] font-bold opacity-70 mb-1">Eraser Size: {eraserSize}px</label><input type="range" min="10" max="100" value={eraserSize} onChange={e => setEraserSize(parseInt(e.target.value))} className="w-full accent-red-500" /></>
                ) : (
                <><label className="block text-[10px] font-bold opacity-70 mb-1">{activeTool === 'text' ? 'Font Size' : 'Stroke Size'}: {currentSize}px</label><input type="range" min="1" max="120" value={currentSize} onChange={e => { setCurrentSize(parseInt(e.target.value)); updateSelectedStroke({ size: parseInt(e.target.value) }); }} className="w-full accent-blue-500" /></>
                )}
            </div>
        )}
        <div className="flex gap-2 pt-2 border-t border-[var(--theme-ui-border)]">
            <Button variant="secondary" onClick={handleUndo} disabled={currentStrokes.length === 0} icon={<Icon name="undo" size={16} />} className="flex-1 text-[10px]">Undo</Button>
            <Button variant="secondary" onClick={handleRedo} disabled={currentPage.redoStack.length === 0} icon={<Icon name="redo" size={16} />} className="flex-1 text-[10px]">Redo</Button>
            <Button variant="secondary" onClick={handleClear} icon={<Icon name="delete" size={16} />} className="flex-1 text-[10px] text-red-500">Clear</Button>
        </div>
      </DraggablePanel>

      <DraggablePanel id="format" defaultPos={{ x: 20, y: 130 }} title="Page Format" icon="crop" isCollapsed={panels.format} onToggleCollapse={() => togglePanel('format')}>
          <div className="flex gap-1 items-center mb-2">
            <select value={pagePreset} onChange={e => handlePresetChange(e.target.value as any)} className="flex-1 bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded p-1.5 text-xs outline-none">
              {Object.keys(PAGE_PRESETS).map(key => (<option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={key} value={key}>{PAGE_PRESETS[key as keyof typeof PAGE_PRESETS].name}</option>))}
            </select>
            <button onClick={rotateCurrentPage} className="p-1 hover:bg-[color-mix(in_srgb,var(--theme-heading)_10%,transparent)] rounded transition-colors" title="Rotate"><Icon name="rotate_right" size={16} /></button>
            <button onClick={() => setOrientation("landscape")} className="p-1 hover:bg-[color-mix(in_srgb,var(--theme-heading)_10%,transparent)] rounded transition-colors" title="Landscape"><Icon name="crop_landscape" size={16} /></button>
            <button onClick={() => setOrientation("portrait")} className="p-1 hover:bg-[color-mix(in_srgb,var(--theme-heading)_10%,transparent)] rounded transition-colors" title="Portrait"><Icon name="crop_portrait" size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
             <div><label className="text-[10px] opacity-70">W (cm)</label><input type="number" step="0.1" value={customCmX} onChange={e=>setCustomCmX(Number(e.target.value))} className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded p-1.5 text-xs"/></div>
             <div><label className="text-[10px] opacity-70">H (cm)</label><input type="number" step="0.1" value={customCmY} onChange={e=>setCustomCmY(Number(e.target.value))} className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded p-1.5 text-xs"/></div>
             <div><label className="text-[10px] opacity-70">DPI</label><input type="number" value={dpi} onChange={e=>setDpi(Number(e.target.value))} className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded p-1.5 text-xs"/></div>
             <Button size="sm" onClick={applyCustomFormat} className="col-span-3 text-[10px]">Apply Dimensions</Button>
          </div>
          <div className="text-[10px] font-mono text-center opacity-50 mt-2">{currentPage.width} x {currentPage.height} px</div>
      </DraggablePanel>

      <DraggablePanel id="export" defaultPos={{ x: 20, y: 180 }} title="Export" icon="download" isCollapsed={panels.export} onToggleCollapse={() => togglePanel('export')}>
          <div className="flex gap-2">
             <div className="flex-1"><label className="block text-[10px] font-bold opacity-70 mb-1">GIF FPS: {gifFps}</label><input type="range" min="5" max="60" value={gifFps} onChange={e => setGifFps(parseInt(e.target.value))} className="w-full accent-blue-500"/></div>
             <div className="flex-1"><label className="block text-[10px] font-bold opacity-70 mb-1">GIF Step: {gifStep}</label><input type="range" min="1" max="10" value={gifStep} onChange={e => setGifStep(parseInt(e.target.value))} className="w-full accent-blue-500"/></div>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-1">
            <Button variant="secondary" onClick={() => exportCurrentPage('png')} isLoading={isExporting} className="text-[10px] !px-1">PNG</Button>
            <Button variant="secondary" onClick={() => exportCurrentPage('jpg')} isLoading={isExporting} className="text-[10px] !px-1">JPG</Button>
            <Button variant="secondary" onClick={() => exportDocument('pdf')} isLoading={isExporting} className="text-[10px] !px-1">PDF</Button>
            <Button variant="secondary" onClick={() => exportDocument('gif')} isLoading={isExporting} className="text-[10px] !px-1 text-primary">GIF</Button>
          </div>
      </DraggablePanel>

      <DraggablePanel id="ai" defaultPos={{ x: 20, y: 230 }} title="AI Transcription" icon="auto_awesome" isCollapsed={panels.ai} onToggleCollapse={() => togglePanel('ai')}>
          <div>
            <Button variant="primary" onClick={transcribeNote} isLoading={isTranscribing} className="w-full text-xs" icon={<Icon name="description" size={16} />}>Transcribe Handwriting</Button>
            {transcription && <div className="mt-2 p-2 bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">{transcription}</div>}
          </div>
      </DraggablePanel>

      <DraggablePanel id="controls" defaultPos={{ x: 20, y: 280 }} title="Viewport Controls" icon="visibility" isCollapsed={panels.controls} onToggleCollapse={() => togglePanel('controls')}>
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <Button size="sm" variant="secondary" onClick={() => handleZoom(-10)} className="font-mono text-lg !px-3 flex-1">-</Button>
                <span className="text-sm font-bold w-16 text-center cursor-pointer flex-1" onClick={() => setScale(1)}>{Math.round(scale * 100)}%</span>
                <Button size="sm" variant="secondary" onClick={() => handleZoom(10)} className="font-mono text-lg !px-3 flex-1">+</Button>
                <div className="w-px h-6 bg-[var(--theme-ui-border)] mx-1"></div>
                <Button size="sm" variant="secondary" onClick={fitToScreen} className="text-xs font-bold flex-1">Fit</Button>
            </div>
            <div className="flex items-center justify-between gap-1 border-t border-[var(--theme-ui-border)] pt-3">
                <Button size="sm" variant="secondary" onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))} disabled={currentPageIndex === 0} className="!bg-transparent hover:!bg-[color-mix(in_srgb,var(--theme-heading)_10%,transparent)] !border-0 flex-1 px-1">
                   <Icon name="chevron_left" size={20} className={currentPageIndex === 0 ? "opacity-30" : ""} />
                </Button>
                <span className="text-xs font-bold text-center w-12">{currentPageIndex + 1}/{pages.length}</span>
                <Button size="sm" variant="secondary" onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))} disabled={currentPageIndex === pages.length - 1} className="!bg-transparent hover:!bg-[color-mix(in_srgb,var(--theme-heading)_10%,transparent)] !border-0 flex-1 px-1">
                   <Icon name="chevron_right" size={20} className={currentPageIndex === pages.length - 1 ? "opacity-30" : ""} />
                </Button>
                <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1"></div>
                <Button size="sm" variant="secondary" onClick={addPage} className="text-[10px] text-green-500 font-bold px-2">Add</Button>
                <Button size="sm" variant="secondary" onClick={deletePage} className="text-[10px] text-red-500 font-bold px-2">Del</Button>
            </div>
        </div>
      </DraggablePanel>
    </div>
  );
}