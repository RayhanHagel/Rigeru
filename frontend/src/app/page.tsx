"use client";

import { useEffect, useState } from "react";
import { Link2, Image as ImageIcon, FileText, MousePointer2, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface WidgetData {
  widget: string;
  input: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [cards, setCards] = useState<WidgetData[][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          setCards(data);
        }
      } catch (e) {
        console.error("Failed to fetch dashboard data:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const renderWidget = (item: WidgetData, index: number) => {
    const { widget, input } = item;

    if (widget === "link button") {
      const parts = input.split(" | ");
      const label = parts[0];
      const url = parts.length > 1 ? parts[1] : parts[0];
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300 group"
        >
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/40 transition-colors">
            <Link2 size={18} />
          </div>
          <span className="text-zinc-200 font-medium">{label}</span>
        </a>
      );
    }

    if (widget === "image" || widget === "clickable image") {
      const parts = input.split(" | ");
      const rawImgUrl = parts[0].trim();
      
      const resolveImageUrl = (url?: string) => {
        if (!url) return "";
        if (url.startsWith('/app/static/')) {
          return `http://127.0.0.1:8000${url.replace('/app/static', '/static')}`;
        }
        return url;
      };
      
      const imgUrl = resolveImageUrl(rawImgUrl);
      const destUrl = parts.length > 1 ? parts[1].trim() : "";
      
      const imgElement = (
        <div key={index} className="relative w-full h-40 rounded-xl overflow-hidden border border-white/10 group-hover:border-purple-500/50 transition-all duration-300">
          <img src={imgUrl} alt="Widget" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
        </div>
      );

      if (destUrl) {
        return (
          <a key={index} href={destUrl} target="_blank" rel="noopener noreferrer" className="block group">
            {imgElement}
          </a>
        );
      }
      return imgElement;
    }

    if (widget === "text" || widget === "caption") {
      return (
        <div key={index} className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="mt-1 text-zinc-400">
            {widget === "caption" ? <FileText size={16} /> : <FileText size={18} />}
          </div>
          <p className={widget === "caption" ? "text-sm text-zinc-400" : "text-base text-zinc-200 leading-relaxed"}>
            {input}
          </p>
        </div>
      );
    }

    if (widget === "internal page") {
      return (
        <button
          key={index}
          onClick={() => router.push(input)}
          className="flex items-center gap-3 w-full p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-400 transition-all duration-300 group"
        >
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/40 transition-colors">
            <MousePointer2 size={18} />
          </div>
          <span className="text-zinc-200 font-medium">{input}</span>
        </button>
      );
    }

    return null;
  };

  return (
    <div className="w-full h-full relative font-sans selection:bg-purple-500/30">
      <div className="max-w-7xl mx-auto px-6 py-12 lg:px-8 relative z-10">
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-500 mb-2 animate-fade-in">
              Dashboard
            </h1>
            <p className="text-base text-zinc-400 font-medium">
              Welcome back to your unified workspace.
            </p>
          </div>
          <Button 
            variant="secondary" 
            onClick={() => router.push("/home/sort")}
            icon={<Settings2 size={16} />}
          >
            Manage Shortcuts
          </Button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 backdrop-blur-sm">
            <p className="text-zinc-500 text-lg">No cards configured yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-slide-up">
            {cards.map((cardData, cardIdx) => (
              <div 
                key={cardIdx} 
                className="flex flex-col gap-3 p-5 rounded-3xl bg-zinc-900/40 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 hover:bg-zinc-900/60 hover:border-white/20 transition-all duration-500"
              >
                {cardData.map((item, itemIdx) => renderWidget(item, itemIdx))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
