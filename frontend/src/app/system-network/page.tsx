import React from "react";
import Link from "next/link";
import { Package, Terminal, Activity, Network, Settings, HardDrive, Zap } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";

export default function SystemNetworkPage() {
  const tools = [
    { href: "/system-network/package-manager", name: "Package Manager", icon: <Package size={24} className="text-blue-400" />, desc: "Universal package manager for Winget, Scoop, and Chocolatey." },
    { href: "/system-network/environment-variables", name: "Environment Variables", icon: <Terminal size={24} className="text-emerald-400" />, desc: "Manage Windows system and user environment variables." },
    { href: "/system-network/services", name: "Services", icon: <Settings size={24} className="text-amber-400" />, desc: "View and manage background Windows services." },
    { href: "/system-network/docker-manager", name: "Docker Manager", icon: <HardDrive size={24} className="text-sky-400" />, desc: "Control local Docker containers and images." },
    { href: "/system-network/system-monitor", name: "System Monitor", icon: <Activity size={24} className="text-red-400" />, desc: "Real-time CPU, RAM, Disk, and Network telemetry." },
    { href: "/system-network/ping-test", name: "Ping Test", icon: <Network size={24} className="text-indigo-400" />, desc: "Test network latency and connectivity." }
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="⚙️ System & Network" />
        <p className="text-zinc-400 mt-2">
          Administrative tools and system diagnostics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Link href={tool.href} key={tool.name} className="block group">
            <div className="bg-zinc-900/50 border border-white/10 hover:border-white/20 p-6 rounded-xl transition-all hover:bg-zinc-800/50 h-full">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-2 bg-black/20 rounded-lg shadow-inner group-hover:scale-110 transition-transform">
                  {tool.icon}
                </div>
                <h3 className="font-semibold text-zinc-100">{tool.name}</h3>
              </div>
              <p className="text-sm text-zinc-400">{tool.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
