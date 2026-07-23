"use client";

import React, { useState, useEffect } from "react";
import { Activity, Cpu, HardDrive, Network, Layers, Thermometer } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";

type HardwareStats = {
  cpu_percent: number;
  mem_percent: number;
  mem_text: string;
  disk_percent: number;
  disk_text: string;
  gpu_percent: number;
  gpu_text: string;
};

type Process = {
  PID: number;
  Name: string;
  "CPU (%)": number;
  "Memory (%)": number;
};

type Connection = {
  app: string;
  pid: number;
  local_port: number;
  remote_ip: string;
  remote_port: number;
};

export default function SystemMonitorPage() {
  const [stats, setStats] = useState<{
    hardware: HardwareStats | null;
    processes: Process[];
    network: Connection[];
  }>({ hardware: null, processes: [], network: [] });
  
  const [error, setError] = useState("");

  const fetchStats = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/monitor/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2500); // Poll every 2.5s
    return () => clearInterval(interval);
  }, []);

  const getMetricColor = (percent: number) => {
    if (percent < 50) return "text-emerald-400";
    if (percent < 85) return "text-amber-400";
    return "text-red-400";
  };

  const getMetricBg = (percent: number) => {
    if (percent < 50) return "bg-emerald-500";
    if (percent < 85) return "bg-amber-500";
    return "bg-red-500";
  };

  const renderMetric = (icon: React.ReactNode, title: string, percent: number, text: string) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-400 font-medium">
          {icon}
          {title}
        </div>
        <div className={`text-2xl font-bold ${getMetricColor(percent)}`}>
          {percent.toFixed(1)}%
        </div>
      </div>
      <div className="w-full bg-black rounded-full h-3 overflow-hidden border border-white/5">
        <div 
          className={`h-full transition-all duration-500 ease-out ${getMetricBg(percent)}`} 
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-xs text-zinc-500 font-mono text-right">{text}</div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="📈 System & Network Monitor" />
        <p className="text-zinc-400 mt-2 flex items-center gap-2">
          Real-time telemetry and network diagnostics.
          <span className="relative flex h-3 w-3 ml-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-emerald-400">Live</span>
        </p>
        {error && <p className="text-red-400 text-sm mt-2">Error: {error}</p>}
      </div>

      {stats.hardware && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderMetric(<Cpu size={18} />, "CPU Load", stats.hardware.cpu_percent, "Overall CPU Utilization")}
          {renderMetric(<Layers size={18} />, "Memory", stats.hardware.mem_percent, stats.hardware.mem_text)}
          {renderMetric(<HardDrive size={18} />, "Disk", stats.hardware.disk_percent, stats.hardware.disk_text)}
          {renderMetric(<Activity size={18} />, "GPU Load", stats.hardware.gpu_percent, stats.hardware.gpu_text)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <STContainer title="Top Processes (by Memory)" icon={<Layers size={18} className="text-blue-400" />}>
          <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900 text-zinc-400 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">PID</th>
                  <th className="px-4 py-3 font-medium">RAM %</th>
                  <th className="px-4 py-3 font-medium">CPU %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.processes.map((p, i) => (
                  <tr key={`${p.PID}-${i}`} className="hover:bg-zinc-800/50">
                    <td className="px-4 py-2 font-medium text-white">{p.Name}</td>
                    <td className="px-4 py-2 text-zinc-400 font-mono text-xs">{p.PID}</td>
                    <td className={`px-4 py-2 ${p['Memory (%)'] > 10 ? 'text-amber-400' : 'text-zinc-300'}`}>{p["Memory (%)"]}</td>
                    <td className={`px-4 py-2 ${p['CPU (%)'] > 10 ? 'text-amber-400' : 'text-zinc-300'}`}>{p["CPU (%)"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </STContainer>
        
        <STContainer title="Active Network Connections" icon={<Network size={18} className="text-purple-400" />}>
          <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900 text-zinc-400 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">App</th>
                  <th className="px-4 py-3 font-medium">Local Port</th>
                  <th className="px-4 py-3 font-medium">Remote Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.network.map((c, i) => (
                  <tr key={`${c.pid}-${c.remote_port}-${i}`} className="hover:bg-zinc-800/50">
                    <td className="px-4 py-2 font-medium text-emerald-400">{c.app}</td>
                    <td className="px-4 py-2 text-zinc-400 font-mono text-xs">{c.local_port}</td>
                    <td className="px-4 py-2 text-purple-400 font-mono text-xs">{c.remote_ip}:{c.remote_port}</td>
                  </tr>
                ))}
                {stats.network.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                      Loading connections...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </STContainer>
      </div>
    </div>
  );
}
