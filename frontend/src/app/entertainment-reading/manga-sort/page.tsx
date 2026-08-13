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
  rectSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Icon } from "@/lib/utils";

type MangaData = {
  main_url: string;
  chapters_amount: number;
  chapter_read?: number;
  status: string;
  type: string;
  rating: number;
  website: string;
  image: string;
  local_image?: string;
  chapter_downloaded: string[];
  chapters_url: string[];
};

type MangaCache = Record<string, MangaData>;

function SortableItem({ id, item }: { id: string, item: MangaData }) {
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

  const cleanTitle = id.replace(/^[^\w\s]+/, '').trim();
  const coverUrl = item.local_image ? `/static/${item.local_image.split('static/')[1]}` : item.image;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`bg-[var(--theme-ui-bg)] backdrop-blur-md border rounded-xl overflow-hidden flex flex-col transition-shadow ${isDragging ? 'border-[var(--theme-heading)] shadow-[0_0_15px_rgba(var(--theme-heading),0.4)] opacity-80' : 'border-[var(--theme-ui-border)] shadow-sm hover:shadow-md'}`}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="bg-[var(--theme-bg)] p-2 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-[var(--theme-ui-border)] group"
      >
        <span className="text-xs font-semibold text-[var(--theme-text)] truncate pr-2" title={cleanTitle}>{cleanTitle}</span>
        <Icon name="drag_handle" size={14} className="text-[var(--theme-text)] group-hover:text-[var(--theme-heading)]" />
      </div>
      
      <div className="p-3 flex gap-3 flex-1">
        <div className="w-16 h-24 shrink-0 rounded-md overflow-hidden bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] relative">
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img src={coverUrl} alt={cleanTitle} className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col justify-center">
           <div className="text-xs text-[var(--theme-text)] font-mono mb-1">{item.type}</div>
           <div className="text-sm font-bold text-[var(--theme-heading)] mb-1">
             â˜… {item.rating}
           </div>
           <div className="text-xs text-[var(--theme-heading)] bg-[var(--theme-heading)]/10 px-2 py-1 rounded-md w-fit">
             Ch. {item.chapter_read || 0} / {item.chapters_amount}
           </div>
        </div>
      </div>
    </div>
  );
}

export default function MangaSortPage() {
  const router = useRouter();
  const [items, setItems] = useState<string[]>([]);
  const [mangaCache, setMangaCache] = useState<MangaCache>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetch("/api/media-entertainment/manga-library")
      .then(res => res.json())
      .then((data: MangaCache) => {
        setMangaCache(data);
        setItems(Object.keys(data));
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/media-entertainment/manga-library/sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: items })
      });
      if (res.ok) {
        alert("Library order saved successfully!");
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

  if (isLoading) {
    return <div className="p-10 text-[var(--theme-heading)]">Loading library</div>;
  }

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar animate-slide-up flex flex-col font-sans">
      <Header 
        title="Sort Library"
        subtitle="Drag and drop manga cards to reorder your library."
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => router.push("/entertainment-reading/manga-library")} icon={<Icon name="arrow_back" size={16} />}>
              Back to Library
            </Button>
            <Button variant="primary" onClick={handleSave} isLoading={isSaving} icon={<Icon name="save" size={16} />}>
              Save Order
            </Button>
          </div>
        }
      />

      {items.length === 0 ? (
        <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-10 text-center">
          <p className="text-[var(--theme-text)]">Your library is empty. Add some manga first.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
              {items.map(id => (
                <SortableItem key={id} id={id} item={mangaCache[id]} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

