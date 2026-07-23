import React from "react";
import Link from "next/link";
import { BookOpen, MonitorPlay, AudioLines, Library } from "lucide-react";

export default function MediaEntertainmentPage() {
  const tools = [
    { href: "/media-entertainment/manga-library", name: "Manga Library", icon: <BookOpen size={24} className="text-purple-400" />, desc: "Read and manage manga." },
    { href: "/media-entertainment/twitch-watch", name: "Twitch Watch", icon: <MonitorPlay size={24} className="text-indigo-400" />, desc: "Watch Twitch streams ad-free." },
    { href: "/media-entertainment/spotify-scrobbler", name: "Spotify Scrobbler", icon: <AudioLines size={24} className="text-green-400" />, desc: "Track your listening history." },
    { href: "/media-entertainment/malsync", name: "MAL Local Tracker", icon: <Library size={24} className="text-blue-400" />, desc: "Sync anime watch history." },
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-5xl mx-auto overflow-y-auto">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Media & Entertainment</h1>
        <p className="text-zinc-400 text-sm font-medium">Tools for media consumption, tracking, and local streaming.</p>
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
