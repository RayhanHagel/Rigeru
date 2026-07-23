"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Save, ArrowLeft, Home, Trash2, Plus, LayoutDashboard, PlusCircle, Link2, ImageIcon, FileText, MousePointer2, Pencil, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";

type WidgetItem = {
  widget: string;
  input: string;
};

type QuickCard = WidgetItem[];

function SortableItem({ id, item, onDelete, onEdit }: { id: string, item: QuickCard, onDelete: (id: string) => void, onEdit: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };


  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`bg-zinc-900/80 border rounded-xl overflow-hidden flex items-stretch transition-shadow mb-3 ${isDragging ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] opacity-80' : 'border-white/5 shadow-md'}`}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="bg-zinc-950 p-3 flex flex-col justify-center cursor-grab active:cursor-grabbing border-r border-white/5 group w-12 items-center shrink-0"
      >
        <GripVertical size={20} className="text-zinc-600 group-hover:text-purple-400" />
      </div>
      
      <div className="p-4 flex flex-1 flex-col justify-center overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-zinc-500">Card {parseInt(id) + 1}</span>
        </div>
        <div className="text-sm text-zinc-300 font-mono bg-zinc-950 p-2 rounded border border-white/5 w-full">
          {item.map((w, i) => (
            <div key={i} className="mb-1 last:mb-0 border-b border-white/5 pb-1 last:border-0 last:pb-0 truncate flex gap-2 items-center">
              <span className="text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1 py-0.5 rounded tracking-widest uppercase">{w.widget}</span>
              <span>{w.input.substring(0, 40).replace(/\n/g, " ") || "Empty"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 flex items-center justify-center border-l border-white/5 bg-zinc-950/50 shrink-0 gap-1">
        <Button variant="secondary" onClick={() => onEdit(id)} className="p-2 h-auto text-zinc-500 hover:text-blue-400">
          <Pencil size={18} />
        </Button>
        <Button variant="secondary" onClick={() => onDelete(id)} className="p-2 h-auto text-zinc-500 hover:text-red-400">
          <Trash2 size={18} />
        </Button>
      </div>
    </div>
  );
}

export default function HomeSortPage() {
  const router = useRouter();
  const [items, setItems] = useState<string[]>([]);
  const [cache, setCache] = useState<QuickCard[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [stagedWidgets, setStagedWidgets] = useState<WidgetItem[]>([]);
  const [newWidgetType, setNewWidgetType] = useState("link button");
  const [newWidgetInput1, setNewWidgetInput1] = useState("");
  const [newWidgetInput2, setNewWidgetInput2] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/dashboard")
      .then(res => res.json())
      .then((data: QuickCard[]) => {
        setCache(data);
        setItems(data.map((_, i) => String(i)));
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDelete = (id: string) => {
    const newItems = items.filter(i => i !== id);
    setItems(newItems);
  };

  const handleEdit = (id: string) => {
    setEditingCardId(id);
    const cardData = cache[parseInt(id)];
    setStagedWidgets([...cardData]);
    setShowAddPanel(true);
    // Scroll to top where builder is
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Reconstruct the array based on the current items order
      const newCache = items.map(id => cache[parseInt(id)]);
      const res = await fetch("http://127.0.0.1:8000/api/home/quick-cache/sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newCache })
      });
      if (res.ok) {
        alert("Dashboard order saved successfully!");
        setCache(newCache);
        setItems(newCache.map((_, i) => String(i))); // Reset IDs to 0,1,2...
      } else {
        alert("Failed to save order.");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving order.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWidget = () => {
    let finalInput = "";
    if (newWidgetType === 'link button') {
      if (!newWidgetInput1 && !newWidgetInput2) return;
      finalInput = newWidgetInput2 ? `${newWidgetInput1} | ${newWidgetInput2}` : newWidgetInput1;
    } else if (newWidgetType === 'clickable image') {
      if (!newWidgetInput1) return;
      finalInput = newWidgetInput2 ? `${newWidgetInput1} | ${newWidgetInput2}` : newWidgetInput1;
    } else if (newWidgetType === 'internal page') {
      if (!newWidgetInput1) return;
      finalInput = newWidgetInput1;
    } else {
      if (!newWidgetInput1.trim()) return;
      finalInput = newWidgetInput1;
    }
    
    setStagedWidgets([...stagedWidgets, { widget: newWidgetType, input: finalInput }]);
    setNewWidgetInput1("");
    setNewWidgetInput2("");
  };

  const handleSaveCard = async () => {
    if (stagedWidgets.length === 0) return;
    
    let newCache = [...cache];
    let newItems = [...items];

    if (editingCardId !== null) {
      // Update existing
      newCache[parseInt(editingCardId)] = [...stagedWidgets];
    } else {
      // Append new
      const newCard = [...stagedWidgets];
      newCache = [...cache, newCard];
      const newId = String(newCache.length - 1);
      newItems = [...items, newId];
    }
    
    setCache(newCache);
    setItems(newItems);
    
    // Auto-save to backend
    try {
      const reconstructedCache = newItems.map(id => newCache[parseInt(id)]);
      await fetch("http://127.0.0.1:8000/api/home/quick-cache/sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: reconstructedCache })
      });
    } catch (e) {
      console.error(e);
    }
    
    // Reset builder
    setStagedWidgets([]);
    setShowAddPanel(false);
    setEditingCardId(null);
  };

  const handleMoveWidget = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === stagedWidgets.length - 1)
    ) return;
    
    const newWidgets = [...stagedWidgets];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    [newWidgets[index], newWidgets[targetIndex]] = [newWidgets[targetIndex], newWidgets[index]];
    setStagedWidgets(newWidgets);
  };

  if (isLoading) {
    return <div className="p-10 text-white">Loading dashboard cache...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col p-6 lg:p-10 animate-fade-in overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 text-purple-500 rounded-xl">
            <Home size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Sort Quick Navigation</h1>
            <p className="text-zinc-400 text-sm mt-1">Drag and drop to reorder dashboard cards, or delete them.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => router.push("/")} icon={<ArrowLeft size={16} />}>
            Back to Dashboard
          </Button>
          <Button variant="secondary" onClick={() => {
            setEditingCardId(null);
            setStagedWidgets([]);
            setShowAddPanel(!showAddPanel);
          }} icon={<Plus size={16} />}>
            Add Card
          </Button>
          <Button variant="primary" onClick={handleSave} isLoading={isSaving} icon={<Save size={16} />}>
            Save Order
          </Button>
        </div>
      </div>

      {showAddPanel && (
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 mb-8 animate-fade-in max-w-4xl shadow-xl shadow-black/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <LayoutDashboard size={18} className="text-purple-400" /> 
              {editingCardId !== null ? `Editing Card ${parseInt(editingCardId) + 1}` : "New Card Builder"}
            </h2>
            {editingCardId !== null && (
              <Button variant="secondary" onClick={() => {
                setEditingCardId(null);
                setStagedWidgets([]);
                setShowAddPanel(false);
              }} className="text-xs py-1">
                Cancel Edit
              </Button>
            )}
          </div>
          
          {stagedWidgets.length > 0 && (
            <div className="mb-6 p-4 bg-zinc-950 rounded-lg border border-white/5">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Staged Widgets ({stagedWidgets.length})</h3>
              <div className="space-y-2">
                {stagedWidgets.map((w, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-900 p-2 rounded border border-white/5">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded tracking-widest shrink-0">{w.widget.toUpperCase()}</span>
                      <span className="text-sm text-zinc-300 truncate max-w-sm">{w.input}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button onClick={() => handleMoveWidget(idx, 'up')} disabled={idx === 0} className={`p-1 rounded ${idx === 0 ? 'text-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
                        <ChevronUp size={16} />
                      </button>
                      <button onClick={() => handleMoveWidget(idx, 'down')} disabled={idx === stagedWidgets.length - 1} className={`p-1 rounded ${idx === stagedWidgets.length - 1 ? 'text-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
                        <ChevronDown size={16} />
                      </button>
                      <div className="w-px h-4 bg-white/10 mx-1"></div>
                      <button onClick={() => setStagedWidgets(stagedWidgets.filter((_, i) => i !== idx))} className="p-1 text-zinc-500 hover:text-red-400 rounded hover:bg-red-500/10">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="primary" onClick={handleSaveCard} className="mt-4 w-full" icon={<Save size={16} />}>
                {editingCardId !== null ? "Update Card in Dashboard" : "Save Card to Dashboard"}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Widget Type</label>
              <select 
                value={newWidgetType}
                onChange={(e) => setNewWidgetType(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
              >
                <option value="link button">Link Button</option>
                <option value="image">Image</option>
                <option value="clickable image">Clickable Image</option>
                <option value="text">Text</option>
                <option value="caption">Caption</option>
                <option value="internal page">Internal Page</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-2">Content</label>
              <div className="flex gap-2 flex-col sm:flex-row">
                {newWidgetType === 'link button' && (
                  <>
                    <input type="text" value={newWidgetInput1} onChange={(e) => setNewWidgetInput1(e.target.value)} placeholder="Label (Optional)" className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none font-mono text-sm" />
                    <input type="text" value={newWidgetInput2} onChange={(e) => setNewWidgetInput2(e.target.value)} placeholder="URL" className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none font-mono text-sm" onKeyDown={(e) => { if (e.key === 'Enter') handleAddWidget(); }} />
                  </>
                )}
                {newWidgetType === 'clickable image' && (
                  <>
                    <input type="text" value={newWidgetInput1} onChange={(e) => setNewWidgetInput1(e.target.value)} placeholder="Image URL" className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none font-mono text-sm" />
                    <input type="text" value={newWidgetInput2} onChange={(e) => setNewWidgetInput2(e.target.value)} placeholder="Destination URL (Optional)" className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none font-mono text-sm" onKeyDown={(e) => { if (e.key === 'Enter') handleAddWidget(); }} />
                  </>
                )}
                {(newWidgetType === 'text' || newWidgetType === 'caption' || newWidgetType === 'image') && (
                  <input type="text" value={newWidgetInput1} onChange={(e) => setNewWidgetInput1(e.target.value)} placeholder="Content" className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none font-mono text-sm" onKeyDown={(e) => { if (e.key === 'Enter') handleAddWidget(); }} />
                )}
                {newWidgetType === 'internal page' && (
                  <select value={newWidgetInput1} onChange={(e) => setNewWidgetInput1(e.target.value)} className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none font-mono text-sm">
                    <option value="">Select a page...</option>
                    
                    <optgroup label="Files & Documents">
                      <option value="/files-documents/cv-builder">CV Builder</option>
                      <option value="/files-documents/excel-cleaner">Excel Cleaner</option>
                      <option value="/files-documents/expense-tracker">Expense Tracker</option>
                      <option value="/files-documents/file-organizer">File Organizer</option>
                      <option value="/files-documents/hash-integrity">Hash Integrity</option>
                      <option value="/files-documents/link-cleaner">Link Cleaner</option>
                      <option value="/files-documents/math-latex">Math LaTeX</option>
                      <option value="/files-documents/pdf-studio">PDF Studio</option>
                    </optgroup>
                    
                    <optgroup label="Media & Entertainment">
                      <option value="/media-entertainment/malsync">MAL Sync</option>
                      <option value="/media-entertainment/manga-library">Manga Library</option>
                      <option value="/media-entertainment/manga-read">Manga Read</option>
                      <option value="/media-entertainment/manga-search">Manga Search</option>
                      <option value="/media-entertainment/manga-sort">Manga Sort</option>
                      <option value="/media-entertainment/spotify-scrobbler">Spotify Scrobbler</option>
                      <option value="/media-entertainment/twitch-watch">Twitch Watch</option>
                    </optgroup>
                    
                    <optgroup label="Media & Vision Processing">
                      <option value="/media-vision/background-remover">Background Remover</option>
                      <option value="/media-vision-processing/code-to-image">Code to Image</option>
                      <option value="/media-vision-processing/color-picker">Color Picker</option>
                      <option value="/media-vision/compressor">Compressor</option>
                      <option value="/media-vision-processing/depth-estimation">Depth Estimation</option>
                      <option value="/media-vision-processing/face-blur">Face Blur</option>
                      <option value="/media-vision-processing/image-upscaler">Image Upscaler</option>
                      <option value="/media-vision-processing/media-compressor">Media Compressor</option>
                      <option value="/media-vision-processing/object-detect">Object Detect</option>
                      <option value="/media-vision-processing/translation">Translation</option>
                      <option value="/media-vision-processing/vision-censor">Vision Censor</option>
                    </optgroup>
                    
                    <optgroup label="Settings">
                      <option value="/settings/model-settings">Model Settings</option>
                    </optgroup>
                    
                    <optgroup label="Subtitles & Metadata">
                      <option value="/subtitles-metadata/exif-remover">EXIF Remover</option>
                      <option value="/subtitles-metadata/file-timestamps">File Timestamps</option>
                      <option value="/subtitles-metadata/media-tags">Media Tags</option>
                      <option value="/subtitles-metadata/subtitle-fetcher">Subtitle Fetcher</option>
                      <option value="/subtitles-metadata/subtitle-merger">Subtitle Merger</option>
                      <option value="/subtitles-metadata/transcriber">Transcriber</option>
                    </optgroup>
                    
                    <optgroup label="System & Network">
                      <option value="/system-network/docker-manager">Docker Manager</option>
                      <option value="/system-network/environment-variables">Environment Variables</option>
                      <option value="/system-network/package-manager">Package Manager</option>
                      <option value="/system-network/ping-test">Ping Test</option>
                      <option value="/system-network/services">Services</option>
                      <option value="/system-network/system-monitor">System Monitor</option>
                    </optgroup>
                    
                    <optgroup label="Web & Downloads">
                      <option value="/web-downloads/currency-view">Currency View</option>
                      <option value="/web-downloads/price-monitor">Price Monitor</option>
                      <option value="/web-downloads/rss">RSS Reader</option>
                      <option value="/web-downloads/scraper">Visual Scraper</option>
                      <option value="/web-downloads/spotify">Spotify Download</option>
                      <option value="/web-downloads/youtube">YouTube Download</option>
                      <option value="/web-downloads/youtube-rss">YouTube RSS</option>
                    </optgroup>
                  </select>
                )}
                <Button variant="secondary" onClick={handleAddWidget} icon={<PlusCircle size={16} />} disabled={!newWidgetInput1.trim() && !newWidgetInput2.trim()} className="mt-2 sm:mt-0">
                  Stage Widget
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-10 text-center">
          <p className="text-zinc-400">Your dashboard is empty. Add cards from the Dashboard first.</p>
        </div>
      ) : (
        <div className="max-w-4xl">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col pb-20">
                {items.map(id => (
                  <SortableItem key={id} id={id} item={cache[parseInt(id)]} onDelete={handleDelete} onEdit={handleEdit} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
