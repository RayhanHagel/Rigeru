"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@/lib/utils";
import { Header } from "@/components/ui/Header";

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
      <Header 
        title="Port Test & Scanner"
        subtitle="Discover open ports and the applications using them."
        actions={
          error ? <p className="text-red-400 text-xs">Error: {error}</p> : undefined
        }
      />

      <div className="flex flex-col gap-6 w-full flex-1">
        <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="text-lg font-bold text-[var(--theme-heading)] flex items-center gap-2">System Ports
          </h3>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-2 focus-within:border-[var(--theme-heading)] transition-colors">
            <Icon name="search" size={18} className="text-[var(--theme-text)] ml-2" />
            <input
              type="text"
              placeholder="Search by port number or application name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-[var(--theme-heading)] placeholder:text-[var(--theme-text)] placeholder:opacity-50 w-full p-1"
            />
            <button 
              onClick={fetchPorts}
              disabled={loading}
              className="bg-[var(--theme-ui-bg)] hover:bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-heading)] px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Icon name="refresh" size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl overflow-hidden max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] sticky top-0 z-10 shadow-sm border-b border-[var(--theme-ui-border)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Port</th>
                  <th className="px-4 py-3 font-medium">Protocol</th>
                  <th className="px-4 py-3 font-medium">Local IP</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Application</th>
                  <th className="px-4 py-3 font-medium">PID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-ui-border)]">
                {loading && ports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[var(--theme-text)]">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-6 h-6 border-2 border-[var(--theme-heading)] border-t-transparent rounded-full animate-spin" />
                        Scanning ports
                      </div>
                    </td>
                  </tr>
                ) : filteredPorts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--theme-text)]">
                      No matching ports found.
                    </td>
                  </tr>
                ) : (
                  filteredPorts.map((p, i) => (
                    <tr key={`${p.port}-${p.type}-${i}`} className="hover:bg-[var(--theme-ui-bg)] transition-colors">
                      <td className="px-4 py-2 font-mono text-[var(--theme-heading)] font-bold">{p.port}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${p.type === 'TCP' ? 'bg-secondary/10 text-secondary' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[var(--theme-text)] font-mono text-xs">{p.ip || '*'}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs ${p.status === 'LISTEN' ? 'text-emerald-400' : 'text-[var(--theme-text)]'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className={`px-4 py-2 font-medium ${p.app === 'Unknown' || p.app.includes('Access Denied') ? 'text-amber-500/70' : 'text-[var(--theme-heading)]'}`}>
                        {p.app}
                      </td>
                      <td className="px-4 py-2 text-[var(--theme-text)] font-mono text-xs">{p.pid || '-'}</td>
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
