"use client";

import React, { useState, useEffect } from "react";
import { Activity, ShieldCheck, Search, Filter } from "lucide-react";

type PortInfo = {
  port: number;
  ip: string;
  status: string;
  type: string;
  pid: number | null;
  app: string;
};

export default function PortTestPage() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [filteredPorts, setFilteredPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPorts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system/ports");
      if (!res.ok) throw new Error("Failed to fetch port data");
      const data = await res.json();
      setPorts(data.ports || []);
      setFilteredPorts(data.ports || []);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
  }, []);

  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = ports.filter(
      (p) =>
        p.app.toLowerCase().includes(lowerQuery) ||
        p.port.toString().includes(lowerQuery) ||
        p.ip.toLowerCase().includes(lowerQuery)
    );
    setFilteredPorts(filtered);
  }, [searchQuery, ports]);

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Port Test & Scanner</h1>
            <p className="text-zinc-400 text-sm font-medium">Discover open ports and the applications using them.</p>
            {error && <p className="text-red-400 text-xs">Error: {error}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full flex-1">
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 shadow-xl">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">System Ports
          </h3>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 bg-zinc-950 border border-white/10 rounded-lg p-2 focus-within:border-primary/50 transition-colors">
            <Search size={18} className="text-zinc-500 ml-2" />
            <input
              type="text"
              placeholder="Search by port number or application name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-zinc-200 placeholder:text-zinc-600 w-full p-1"
            />
            <button 
              onClick={fetchPorts}
              disabled={loading}
              className="bg-white/5 hover:bg-white/10 text-zinc-300 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900 text-zinc-400 sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="px-4 py-3 font-medium">Port</th>
                  <th className="px-4 py-3 font-medium">Protocol</th>
                  <th className="px-4 py-3 font-medium">Local IP</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Application</th>
                  <th className="px-4 py-3 font-medium">PID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && ports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        Scanning ports
                      </div>
                    </td>
                  </tr>
                ) : filteredPorts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No matching ports found.
                    </td>
                  </tr>
                ) : (
                  filteredPorts.map((p, i) => (
                    <tr key={`${p.port}-${p.type}-${i}`} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-2 font-mono text-primary font-bold">{p.port}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${p.type === 'TCP' ? 'bg-secondary/10 text-secondary' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-zinc-400 font-mono text-xs">{p.ip || '*'}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs ${p.status === 'LISTEN' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className={`px-4 py-2 font-medium ${p.app === 'Unknown' || p.app.includes('Access Denied') ? 'text-amber-500/70' : 'text-zinc-200'}`}>
                        {p.app}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 font-mono text-xs">{p.pid || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
