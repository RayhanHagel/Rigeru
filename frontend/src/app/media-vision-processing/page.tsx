import React from "react";
import Link from "next/link";
import { Palette, Film, Crosshair, CheckSquare } from "lucide-react";

export default function MediaVisionPage() {
  const tools = [
    { href: "/media-vision-processing/translation", name: "Local Translation", icon: <Palette size={24} className="text-orange-400" />, desc: "Offline NLP translation using T5." },
    { href: "/media-vision/background-remover", name: "Background Remover", icon: <Palette size={24} className="text-purple-400" />, desc: "Remove backgrounds from images instantly." },
    { href: "/media-vision-processing/image-upscaler", name: "Image Upscaler", icon: <Palette size={24} className="text-blue-400" />, desc: "Upscale images using AI models." },
    { href: "/media-vision-processing/media-compressor", name: "Media Compressor", icon: <Film size={24} className="text-emerald-400" />, desc: "Compress videos and images efficiently." },
    { href: "/media-vision-processing/color-picker", name: "Color Picker", icon: <Palette size={24} className="text-yellow-400" />, desc: "Pick colors from images." },
    { href: "/media-vision-processing/code-to-image", name: "Code to Image", icon: <Palette size={24} className="text-cyan-400" />, desc: "Generate beautiful images of source code." },
    { href: "/media-vision-processing/object-detect", name: "Object Detection", icon: <Crosshair size={24} className="text-red-400" />, desc: "Run fast local YOLO object detection." },
    { href: "/media-vision-processing/face-blur", name: "Face Blur", icon: <CheckSquare size={24} className="text-indigo-400" />, desc: "Detect and selectively blur faces." },
    { href: "/media-vision-processing/depth-estimation", name: "Depth Estimation", icon: <Palette size={24} className="text-pink-400" />, desc: "Generate depth maps from images and videos." },
    { href: "/media-vision-processing/vision-censor", name: "AI De-Nudifier", icon: <CheckSquare size={24} className="text-rose-400" />, desc: "AI-powered NSFW content blocker." },
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-5xl mx-auto overflow-y-auto">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Media & Vision Processing</h1>
        <p className="text-zinc-400 text-sm font-medium">Tools for processing, editing, and extracting insights from images and videos.</p>
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
