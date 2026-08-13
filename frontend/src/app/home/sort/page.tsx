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

import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

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
      className={`bg-[var(--theme-ui-bg)] border rounded-xl overflow-hidden flex items-stretch transition-shadow mb-3 ${isDragging ? 'border-[var(--theme-heading)] shadow-[0_0_15px_rgba(168,85,247,0.4)] opacity-80' : 'border-[var(--theme-ui-border)] shadow-md'}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="bg-[var(--theme-ui-bg)] p-3 flex flex-col justify-center cursor-grab active:cursor-grabbing border-r border-[var(--theme-ui-border)] group w-12 items-center shrink-0"
      >
        <Icon name="drag_indicator" size={20} className="text-[var(--theme-text)] group-hover:text-[var(--theme-heading)]" />
      </div>

      <div className="p-4 flex flex-1 flex-col justify-center overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-[var(--theme-text)]">Card {parseInt(id) + 1}</span>
        </div>
        <div className="text-sm text-[var(--theme-text)] font-mono bg-[var(--theme-bg)] p-2 rounded border border-[var(--theme-ui-border)] w-full">
          {item.map((w, i) => (
            <div key={i} className="mb-1 last:mb-0 border-b border-[var(--theme-ui-border)] pb-1 last:border-0 last:pb-0 truncate flex gap-2 items-center">
              <span className="text-[9px] font-bold bg-[var(--theme-heading)]/10 text-[var(--theme-heading)] border border-[var(--theme-heading)]/20 px-1 py-0.5 rounded tracking-widest uppercase">{w.widget}</span>
              <span>{w.input.substring(0, 40).replace(/\n/g, " ") || "Empty"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 flex items-center justify-center border-l border-[var(--theme-ui-border)] bg-[var(--theme-bg)] shrink-0 gap-1">
        <Button variant="secondary" onClick={() => onEdit(id)} className="p-2 h-auto text-[var(--theme-text)] hover:text-[var(--theme-heading)]">
          <Icon name="edit" size={18} />
        </Button>
        <Button variant="secondary" onClick={() => onDelete(id)} className="p-2 h-auto text-[var(--theme-text)] hover:text-red-400">
          <Icon name="delete" size={18} />
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
    const token = localStorage.getItem("auth_token");
    fetch("/api/dashboard", {
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      }
    })
      .then(res => res.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          setCache(data as QuickCard[]);
          setItems((data as QuickCard[]).map((_, i) => String(i)));
        } else {
          console.error("Dashboard API returned non-array:", data);
        }
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
      const res = await fetch("/api/home/quick-cache/sort", {
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
      await fetch("/api/home/quick-cache/sort", {
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
    return <div className="p-10 text-white">Loading dashboard cache</div>;
  }

  return (
    <div className="w-full h-full flex flex-col p-6 lg:p-10 animate-slide-up overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-[var(--theme-ui-border)] pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--theme-heading)] tracking-tight">Sort Quick Navigation</h1>
            <p className="text-[var(--theme-text)] text-sm">Drag and drop to reorder dashboard cards, or delete them.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => router.push("/")} icon={<Icon name="arrow_back" size={16} />}>
            Back to Dashboard
          </Button>
          <Button variant="secondary" onClick={() => {
            setEditingCardId(null);
            setStagedWidgets([]);
            setShowAddPanel(!showAddPanel);
          }} icon={<Icon name="add" size={16} />}>
            Add Card
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave} 
            isLoading={isSaving} 
            icon={<Icon name="save" size={16} />}
            className="border-none !shadow-none !ring-0 !outline-none transition-colors"
            style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
          >
            Save Order
          </Button>
        </div>
      </div>

      {showAddPanel && (
        <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] backdrop-blur-md rounded-xl p-6 mb-8 animate-slide-up shadow-sm w-full h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[var(--theme-heading)] flex items-center gap-2">{editingCardId !== null ? `Editing Card ${parseInt(editingCardId) + 1}` : "New Card Builder"}
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
            <div className="mb-6 p-4 bg-[var(--theme-bg)] rounded-lg border border-[var(--theme-ui-border)]">
              <h3 className="text-sm font-medium text-[var(--theme-text)] mb-3">Staged Widgets ({stagedWidgets.length})</h3>
              <div className="space-y-2">
                {stagedWidgets.map((w, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[var(--theme-ui-bg)] p-2 rounded border border-[var(--theme-ui-border)]">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <span className="text-[10px] font-mono bg-[var(--theme-heading)]/10 text-[var(--theme-heading)] border border-[var(--theme-heading)]/20 px-2 py-0.5 rounded tracking-widest shrink-0">{w.widget.toUpperCase()}</span>
                      <span className="text-sm text-[var(--theme-text)] truncate max-w-sm">{w.input}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button onClick={() => handleMoveWidget(idx, 'up')} disabled={idx === 0} className={`p-1 rounded ${idx === 0 ? 'text-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
                        <Icon name="expand_less" size={16} />
                      </button>
                      <button onClick={() => handleMoveWidget(idx, 'down')} disabled={idx === stagedWidgets.length - 1} className={`p-1 rounded ${idx === stagedWidgets.length - 1 ? 'text-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
                        <Icon name="expand_more" size={16} />
                      </button>
                      <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1"></div>
                      <button onClick={() => setStagedWidgets(stagedWidgets.filter((_, i) => i !== idx))} className="p-1 text-zinc-500 hover:text-red-400 rounded hover:bg-red-500/10">
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                variant="primary" 
                onClick={handleSaveCard} 
                className="mt-4 w-full border-none !shadow-none !ring-0 !outline-none transition-colors"
                style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
                icon={<Icon name="save" size={16} />}
              >
                {editingCardId !== null ? "Update Card in Dashboard" : "Save Card to Dashboard"}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Widget Type</label>
              <select
                value={newWidgetType}
                onChange={(e) => setNewWidgetType(e.target.value)}
                className="w-full rounded-lg p-3 outline-none transition-colors"
                style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-heading)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              >
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="link button">Link Button</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="image">Image</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="clickable image">Clickable Image</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="text">Text</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="caption">Caption</option>
                <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="internal page">Internal Page</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Content</label>
              <div className="flex gap-2 flex-col sm:flex-row">
                {newWidgetType === 'link button' && (
                  <>
                    <input 
                      type="text" value={newWidgetInput1} onChange={(e) => setNewWidgetInput1(e.target.value)} placeholder="Label (Optional)" 
                      className="flex-1 rounded-lg p-3 outline-none font-mono text-sm transition-colors border" 
                      style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-text)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    />
                    <input 
                      type="text" value={newWidgetInput2} onChange={(e) => setNewWidgetInput2(e.target.value)} placeholder="URL" 
                      className="flex-1 rounded-lg p-3 outline-none font-mono text-sm transition-colors border" 
                      style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-text)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddWidget(); }} 
                    />
                  </>
                )}
                {newWidgetType === 'clickable image' && (
                  <>
                    <input 
                      type="text" value={newWidgetInput1} onChange={(e) => setNewWidgetInput1(e.target.value)} placeholder="Image URL" 
                      className="flex-1 rounded-lg p-3 outline-none font-mono text-sm transition-colors border" 
                      style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-text)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    />
                    <input 
                      type="text" value={newWidgetInput2} onChange={(e) => setNewWidgetInput2(e.target.value)} placeholder="Destination URL (Optional)" 
                      className="flex-1 rounded-lg p-3 outline-none font-mono text-sm transition-colors border" 
                      style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-text)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddWidget(); }} 
                    />
                  </>
                )}
                {(newWidgetType === 'text' || newWidgetType === 'caption' || newWidgetType === 'image') && (
                  <input 
                    type="text" value={newWidgetInput1} onChange={(e) => setNewWidgetInput1(e.target.value)} placeholder="Content" 
                    className="flex-1 rounded-lg p-3 outline-none font-mono text-sm transition-colors border" 
                    style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-text)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddWidget(); }} 
                  />
                )}
                {newWidgetType === 'internal page' && (
                  <select 
                    value={newWidgetInput1} onChange={(e) => setNewWidgetInput1(e.target.value)} 
                    className="flex-1 rounded-lg p-3 outline-none font-mono text-sm transition-colors border"
                    style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-text)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                  >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="">Select a page...</option>

                    <optgroup label="Files & Documents">
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/productivity-life/cv-builder">CV Builder</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/documents-text/excel-cleaner">Excel Cleaner</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/productivity-life/expense-tracker">Expense Tracker</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/file-utils/everything-search">Everything Search</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/file-utils/file-organizer">File Organizer</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/file-utils/hash-integrity">Hash Integrity</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/file-utils/link-cleaner">Link Cleaner</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/documents-text/math-latex">Math LaTeX</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/documents-text/pdf-studio">PDF Studio</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/productivity-life/korean-study">Korean Study SRS</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/productivity-life/whiteboard">Digital Whiteboard</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/productivity-life/qr-code">QR Code Tools</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/documents-text/chart-maker">Chart Maker</option>
                    </optgroup>

                    <optgroup label="Media & Entertainment">
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/entertainment-reading/malsync">MAL Sync</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/entertainment-reading/manga-library">Manga Library</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/entertainment-reading/manga-read">Manga Read</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/entertainment-reading/manga-search">Manga Search</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/entertainment-reading/manga-sort">Manga Sort</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/entertainment-reading/spotify-scrobbler">Spotify Scrobbler</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/entertainment-reading/twitch-watch">Twitch Watch</option>
                    </optgroup>

                    <optgroup label="Artificial Intelligence">
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/data-science/quickmachine">Visual ML Builder</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/data-science/obsidian-builder">Obsidian AI Builder</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/data-science/llm-chat">LLM Chat Bot</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/data-science/translation">Local Translation</option>
                    </optgroup>

                    <optgroup label="Image & Vision">
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/background-remover">Background Remover</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/code-to-image">Code to Image</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/color-picker">Color Picker</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/audio-video/media-compressor">Compressor</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/depth-estimation">Depth Estimation</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/face-blur">Face Blur</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/image-upscaler">Image Upscaler</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/audio-video/media-compressor">Media Compressor</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/object-detect">Object Detect</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/vision-censor">Vision Censor</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/audio-video/voice-clone">Voice Cloning TTS</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/pinhole-photography">Pinhole Photography</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/image-vision/fisheye">Fisheye Effect</option>
                    </optgroup>

                    <optgroup label="Settings">
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/settings/model-settings">Model Settings</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/settings/configurations">Configurations</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/settings/api-endpoints">API Endpoints</option>
                    </optgroup>

                    <optgroup label="Subtitles & Metadata">
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/file-utils/exif-remover">EXIF Remover</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/file-utils/file-timestamps">File Timestamps</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/file-utils/media-tags">Media Tags</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/audio-video/subtitle-fetcher">Subtitle Fetcher</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/audio-video/subtitle-merger">Subtitle Merger</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/audio-video/transcriber">Transcriber</option>
                    </optgroup>

                    <optgroup label="System & Network">
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/docker-manager">Docker Manager</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/environment-variables">Environment Variables</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/package-manager">Package Manager</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/ping-test">Ping Test</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/services">Services</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/system-monitor">System Monitor</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/bluetooth-tracker">Bluetooth Tracker</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/wifi-mapper">Wi-Fi Mapper</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/lan-radar">Local Network Radar</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/windows-tweaks">Windows Tweaks</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/system-network/client-details">Web Client Details</option>
                    </optgroup>

                    <optgroup label="Web & Downloads">
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/productivity-life/currency-view">Currency View</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/productivity-life/price-monitor">Price Monitor</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/web-downloaders/rss">RSS Reader</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/web-downloaders/scraper">Visual Scraper</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/web-downloaders/image-scraper">Image Scraper</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/web-downloaders/sitemap">Sitemap Generator</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/web-downloaders/spotify">Spotify Download</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/web-downloaders/youtube">YouTube Download</option>
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="/web-downloaders/youtube-rss">YouTube RSS</option>
                    </optgroup>
                  </select>
                )}
                <Button variant="secondary" onClick={handleAddWidget} icon={<Icon name="add_circle" size={16} />} disabled={!newWidgetInput1.trim() && !newWidgetInput2.trim()} className="mt-2 sm:mt-0">
                  Stage Widget
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-10 text-center">
          <p className="text-[var(--theme-text)]">Your dashboard is empty. Add cards from the Dashboard first.</p>
        </div>
      ) : (
        <div className=" w-full h-full">
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
