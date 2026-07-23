import React from "react";
import Link from "next/link";
import { Tv, AudioLines, Globe, Activity, FileText } from "lucide-react";

export default function WebDownloadsPage() {
  const tools = [
    { href: "/web-downloads/youtube", name: "YouTube Downloader", icon: <Tv size={24} className="text-red-400" />, desc: "Download videos from YouTube." },
    { href: "/web-downloads/spotify", name: "Spotify Downloader", icon: <AudioLines size={24} className="text-green-400" />, desc: "Download tracks from Spotify." },
    { href: "/web-downloads/scraper", name: "Visual Web Scraper", icon: <Globe size={24} className="text-blue-400" />, desc: "Scrape content visually." },
    { href: "/web-downloads/price-monitor", name: "Price Drop Monitor", icon: <Activity size={24} className="text-yellow-400" />, desc: "Track item prices over time." },
    { href: "/web-downloads/currency-view", name: "Currency Converter", icon: <Activity size={24} className="text-emerald-400" />, desc: "Convert between currencies." },
    { href: "/web-downloads/youtube-rss", name: "YouTube RSS Feed", icon: <Tv size={24} className="text-purple-400" />, desc: "Track YouTube channels." },
    { href: "/web-downloads/rss", name: "RSS Feed Manager", icon: <FileText size={24} className="text-cyan-400" />, desc: "Read and manage RSS feeds." },
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-5xl mx-auto overflow-y-auto">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Web & Downloads</h1>
        <p className="text-zinc-400 text-sm font-medium">Tools for extracting data, monitoring feeds, and downloading web media.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map(tool => (
          <Link href={tool.href} key={tool.href} className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 hover:bg-zinc-800/50 hover:border-white/20 transition-all group">
            <div className="bg-zinc-950 rounded-xl p-3 w-fit group-hover:scale-110 transition-transform">
              {tool.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">{tool.name}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{tool.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
