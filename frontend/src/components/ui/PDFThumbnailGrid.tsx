"use client";

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Icon } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFThumbnailGridProps {
  url: string;
  mode: 'select' | 'sort' | 'draggable';
  selectedPages?: number[];
  onSelectionChange?: (selected: number[]) => void;
  pageOrder?: number[];
  onOrderChange?: (order: number[]) => void;
  className?: string;
}

export function PDFThumbnailGrid({ url, mode, selectedPages = [], onSelectionChange, pageOrder, onOrderChange, className = "" }: PDFThumbnailGridProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  
  // Local state for sortable order before it's passed up (if needed)
  const [items, setItems] = useState<number[]>([]);

  useEffect(() => {
    if (numPages && items.length === 0 && !pageOrder) {
      setItems(Array.from({ length: numPages }, (_, i) => i + 1));
    } else if (pageOrder && pageOrder.length > 0) {
      setItems(pageOrder);
    }
  }, [numPages, pageOrder]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    if (!pageOrder) {
      const initialItems = Array.from({ length: numPages }, (_, i) => i + 1);
      setItems(initialItems);
      if (onOrderChange) onOrderChange(initialItems);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      const newOrder = arrayMove(items, oldIndex, newIndex);
      setItems(newOrder);
      if (onOrderChange) onOrderChange(newOrder);
    }
  };

  const toggleSelection = (page: number) => {
    if (mode !== 'select') return;
    const newSel = selectedPages.includes(page) 
      ? selectedPages.filter(p => p !== page)
      : [...selectedPages, page].sort((a,b) => a-b);
    if (onSelectionChange) onSelectionChange(newSel);
  };

  return (
    <div className={`w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl overflow-hidden shadow-sm flex flex-col ${className}`}>
      <div className="p-2 border-b border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] flex justify-between items-center shrink-0">
        <span className="text-xs font-medium text-[var(--theme-text)]">
          {mode === 'sort' ? "Drag pages to reorder" : mode === 'draggable' ? "Drag pages into buckets" : "Click pages to select"}
        </span>
        {mode === 'select' && onSelectionChange && (
          <div className="flex gap-2">
            <button onClick={() => onSelectionChange(items)} className="text-xs text-[var(--theme-heading)] hover:underline">Select All</button>
            <button onClick={() => onSelectionChange([])} className="text-xs text-[var(--theme-text)] hover:underline">Clear</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[var(--theme-bg)] relative h-[300px]">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--theme-text)] gap-2 animate-pulse">
              <Icon name="description" size={24} className="opacity-50" />
              <span className="text-xs">Loading Document...</span>
            </div>
          }
        >
          {numPages && mode === 'sort' ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {items.map(pageNumber => (
                    <SortablePageCard key={pageNumber} id={pageNumber} pageNumber={pageNumber} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : numPages && mode === 'select' ? (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
               {items.map(pageNumber => (
                 <SelectablePageCard 
                   key={pageNumber} 
                   pageNumber={pageNumber} 
                   isSelected={selectedPages.includes(pageNumber)}
                   onClick={() => toggleSelection(pageNumber)}
                 />
               ))}
            </div>
          ) : numPages && mode === 'draggable' ? (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4 pb-20">
               {items.map(pageNumber => (
                 <DraggablePageCard key={pageNumber} pageNumber={pageNumber} />
               ))}
            </div>
          ) : null}
        </Document>
      </div>
    </div>
  );
}

function SortablePageCard({ id, pageNumber }: { id: number, pageNumber: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`relative flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing p-2 rounded-lg transition-colors ${isDragging ? 'bg-[var(--theme-heading)] shadow-xl ring-2 ring-[var(--theme-heading)]' : 'bg-[var(--theme-ui-bg)] hover:bg-[var(--theme-ui-border)] shadow-sm border border-[var(--theme-ui-border)]'}`}
    >
      <div className="w-full aspect-[1/1.4] bg-white rounded flex items-center justify-center overflow-hidden pointer-events-none ring-1 ring-black/10">
         <Page pageNumber={pageNumber} scale={0.3} renderTextLayer={false} renderAnnotationLayer={false} loading={<div className="animate-pulse bg-gray-200 w-full h-full" />} />
      </div>
      <span className={`text-xs font-mono font-medium ${isDragging ? 'text-[var(--theme-bg)]' : 'text-[var(--theme-text)]'}`}>
        Page {pageNumber}
      </span>
    </div>
  );
}

function SelectablePageCard({ pageNumber, isSelected, onClick }: { pageNumber: number, isSelected: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 cursor-pointer p-2 rounded-lg transition-all border ${isSelected ? 'bg-[var(--theme-heading)]/10 border-[var(--theme-heading)] shadow-md' : 'bg-[var(--theme-ui-bg)] border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)]/50 shadow-sm'}`}
    >
      <div className={`w-full aspect-[1/1.4] bg-white rounded flex items-center justify-center overflow-hidden pointer-events-none ring-1 transition-all ${isSelected ? 'ring-[var(--theme-heading)] ring-2' : 'ring-black/10'}`}>
         <Page pageNumber={pageNumber} scale={0.3} renderTextLayer={false} renderAnnotationLayer={false} loading={<div className="animate-pulse bg-gray-200 w-full h-full" />} />
      </div>
      <span className={`text-xs font-mono font-medium transition-colors ${isSelected ? 'text-[var(--theme-heading)]' : 'text-[var(--theme-text)]'}`}>
        Page {pageNumber}
      </span>
      {isSelected && (
        <div className="absolute top-3 right-3 bg-[var(--theme-heading)] text-[var(--theme-bg)] rounded-full p-0.5 shadow-sm">
          <Icon name="check" size={12} />
        </div>
      )}
    </div>
  );
}

function DraggablePageCard({ pageNumber }: { pageNumber: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ 
    id: `page-${pageNumber}`,
    data: { pageNumber }
  });
  
  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : 1,
  } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`relative flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing p-2 rounded-lg transition-colors ${isDragging ? 'bg-[var(--theme-heading)] shadow-xl ring-2 ring-[var(--theme-heading)] opacity-80' : 'bg-[var(--theme-ui-bg)] hover:bg-[var(--theme-ui-border)] shadow-sm border border-[var(--theme-ui-border)]'}`}
    >
      <div className="w-full aspect-[1/1.4] bg-white rounded flex items-center justify-center overflow-hidden pointer-events-none ring-1 ring-black/10">
         <Page pageNumber={pageNumber} scale={0.3} renderTextLayer={false} renderAnnotationLayer={false} loading={<div className="animate-pulse bg-gray-200 w-full h-full" />} />
      </div>
      <span className={`text-xs font-mono font-medium ${isDragging ? 'text-[var(--theme-bg)]' : 'text-[var(--theme-text)]'}`}>
        Page {pageNumber}
      </span>
    </div>
  );
}
