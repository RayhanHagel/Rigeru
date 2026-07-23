import React from "react";
import Link from "next/link";
import { Film, FileText } from "lucide-react";

export default function SubtitlesMetadataPage() {
  const tools = [
    { href: "/subtitles-metadata/transcriber", name: "Transcriber", icon: <Film size={24} className="text-indigo-400" />, desc: "Transcribe media, identify speakers, and style subtitles." },
    { href: "/subtitles-metadata/subtitle-fetcher", name: "Subtitle Fetcher", icon: <FileText size={24} className="text-blue-400" />, desc: "Find exact subtitles for your local videos." },
    { href: "/subtitles-metadata/subtitle-merger", name: "Subtitle Merger", icon: <FileText size={24} className="text-emerald-400" />, desc: "Combine two .ass subtitle files seamlessly." },
    { href: "/subtitles-metadata/media-tags", name: "Media Tags Editor", icon: <FileText size={24} className="text-pink-400" />, desc: "Modify internal media tags (ID3/MP4) for audio and video files." },
    { href: "/subtitles-metadata/file-timestamps", name: "File Timestamps", icon: <FileText size={24} className="text-yellow-400" />, desc: "Forcefully rewrite OS-level file timestamps." },
    { href: "/subtitles-metadata/exif-remover", name: "EXIF Stripper", icon: <FileText size={24} className="text-orange-400" />, desc: "View and strip hidden EXIF metadata from images." }
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-5xl mx-auto overflow-y-auto">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Subtitles & Metadata</h1>
        <p className="text-zinc-400 text-sm font-medium">Tools for handling subtitles, audio transcription, and media tags.</p>
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
