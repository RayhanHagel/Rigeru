"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@/lib/utils";

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
      const res = await fetch("/api/system/monitor/stats");
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
    <div className="animate-slide-up bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:border-[var(--theme-heading)] hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--theme-text)] font-medium">
          {icon}
          {title}
        </div>
        <div className={`text-2xl font-bold ${getMetricColor(percent)}`}>
          {percent.toFixed(1)}%
        </div>
      </div>
      <div className="w-full bg-[var(--theme-bg)] rounded-full h-3 overflow-hidden border border-[var(--theme-ui-border)]">
        <div 
          className={`h-full transition-all duration-500 ease-out ${getMetricBg(percent)}`} 
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-xs text-[var(--theme-text)] opacity-70 font-mono text-right">{text}</div>
    </div>
  );

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-[var(--theme-ui-border)] pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-[var(--theme-heading)] tracking-tight flex items-center gap-3">
              System & Network Monitor
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Live</span>
              </div>
            </h1>
            <p className="text-[var(--theme-text)] text-sm font-medium">Real-time telemetry and network diagnostics.</p>
            {error && <p className="text-red-400 text-xs">Error: {error}</p>}
          </div>
        </div>
      </div>

      {stats.hardware && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderMetric(<Icon name="memory" size={18} />, "CPU Load", stats.hardware.cpu_percent, "Overall CPU Utilization")}
          {renderMetric(<Icon name="layers" size={18} />, "Memory", stats.hardware.mem_percent, stats.hardware.mem_text)}
          {renderMetric(<Icon name="hard_drive" size={18} />, "Disk", stats.hardware.disk_percent, stats.hardware.disk_text)}
          {renderMetric(<Icon name="monitoring" size={18} />, "GPU Load", stats.hardware.gpu_percent, stats.hardware.gpu_text)}
        </div>
      )}

      <div className="flex flex-col gap-6 animate-slide-up w-full mt-6">
        <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
          <h3 className="text-lg font-bold text-[var(--theme-heading)] flex items-center gap-2">Top Processes (by Memory)
          </h3>
          <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] sticky top-0 border-b border-[var(--theme-ui-border)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">PID</th>
                  <th className="px-4 py-3 font-medium">RAM %</th>
                  <th className="px-4 py-3 font-medium">CPU %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-ui-border)]">
                {stats.processes.map((p, i) => (
                  <tr key={`${p.PID}-${i}`} className="hover:bg-[var(--theme-ui-bg)] transition-colors">
                    <td className="px-4 py-2 font-bold text-[var(--theme-heading)]">{p.Name}</td>
                    <td className="px-4 py-2 text-[var(--theme-text)] font-mono text-xs">{p.PID}</td>
                    <td className={`px-4 py-2 ${p['Memory (%)'] > 10 ? 'text-amber-400 font-bold' : 'text-[var(--theme-text)]'}`}>{p["Memory (%)"]}</td>
                    <td className={`px-4 py-2 ${p['CPU (%)'] > 10 ? 'text-amber-400 font-bold' : 'text-[var(--theme-text)]'}`}>{p["CPU (%)"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
          <h3 className="text-lg font-bold text-[var(--theme-heading)] flex items-center gap-2">Active Network Connections
          </h3>
          <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] sticky top-0 border-b border-[var(--theme-ui-border)]">
                <tr>
                  <th className="px-4 py-3 font-medium">App</th>
                  <th className="px-4 py-3 font-medium">Local Port</th>
                  <th className="px-4 py-3 font-medium">Remote Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-ui-border)]">
                {stats.network.map((c, i) => (
                  <tr key={`${c.pid}-${c.remote_port}-${i}`} className="hover:bg-[var(--theme-ui-bg)] transition-colors">
                    <td className="px-4 py-2 font-bold text-emerald-400">{c.app}</td>
                    <td className="px-4 py-2 text-[var(--theme-text)] font-mono text-xs">{c.local_port}</td>
                    <td className="px-4 py-2 text-[var(--theme-heading)] font-mono text-xs">{c.remote_ip}:{c.remote_port}</td>
                  </tr>
                ))}
                {stats.network.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[var(--theme-text)]">
                      Loading connections
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
