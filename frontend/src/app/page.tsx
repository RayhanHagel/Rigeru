"use client";

import React, { useEffect, useState } from "react";
import { Header } from '@/components/ui/Header';
import { Link2, Image as ImageIcon, FileText, MousePointer2, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface WidgetData {  widget: string;
  input: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [cards, setCards] = useState<WidgetData[][]>([]);
  const [loading, setLoading] = useState(true);
  const [isManageMode, setIsManageMode] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/dashboard");
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
          className="flex items-center gap-3 w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all duration-300 group"
        >
          <div className="p-2 rounded-lg bg-primary/20 text-primary group-hover:bg-primary/40 transition-colors">
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
          return `${url.replace('/app/static', '/static')}`;
        }
        return url;
      };
      
      const imgUrl = resolveImageUrl(rawImgUrl);
      const destUrl = parts.length > 1 ? parts[1].trim() : "";
      
      const imgElement = (
        <div key={index} className="relative w-full h-40 rounded-xl overflow-hidden border border-white/10 group-hover:border-primary/50 transition-all duration-300">
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
          className="flex items-center gap-3 w-full p-4 rounded-xl bg-secondary/10 border border-secondary/20 hover:bg-secondary/20 hover:border-secondary transition-all duration-300 group"
        >
          <div className="p-2 rounded-lg bg-secondary/20 text-secondary group-hover:bg-secondary/40 transition-colors">
            <MousePointer2 size={18} />
          </div>
          <span className="text-zinc-200 font-medium">{input}</span>
        </button>
      );
    }

    return null;
  };

  return (
    <div className="w-full h-full relative font-sans selection:bg-primary/30">
      <div className="w-full px-6 py-12 lg:px-8 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <Header title="Dashboard" subtitle="Welcome back" />
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsManageMode(!isManageMode)} 
            className="flex items-center gap-2 rounded-xl h-9 text-xs font-medium bg-zinc-900 border border-white/10 hover:bg-zinc-800"
          >
            <Settings2 size={14} />
            Manage Shortcuts
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 backdrop-blur-sm">
            <p className="text-zinc-500 text-lg">No cards configured yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-slide-up">
            {cards.map((cardData, cardIdx) => (
              <Card key={cardIdx} className="flex flex-col gap-3 !p-4">
                {cardData.map((item, itemIdx) => renderWidget(item, itemIdx))}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

