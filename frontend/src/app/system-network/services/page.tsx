"use client";

import React, { useState, useEffect } from "react";
import { Settings, RefreshCw, Server, Zap, ShieldAlert } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STTabs } from "@/components/streamlit/STTabs";
import { Button } from "@/components/ui/Button";

type ServiceInfo = {
  "Service Name": string;
  "Display Name": string;
  Status: string;
  "Start Type": string;
  Dependencies: string;
  Path: string;
  "Purpose (Description)": string;
};

type StartupInfo = {
  Name: string;
  Path: string;
  Scope: string;
};

export default function ServicesPage() {
  const [startup, setStartup] = useState<StartupInfo[]>([]);
  const [msServices, setMsServices] = useState<ServiceInfo[]>([]);
  const [nonMsServices, setNonMsServices] = useState<ServiceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  type SortColumn = "Display Name" | "Service Name" | "Status" | "Start Type" | "Purpose (Description)";
  const [sortColumn, setSortColumn] = useState<SortColumn>("Status");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const getSortedServices = (services: ServiceInfo[]) => {
    return [...services].sort((a, b) => {
      let valA = a[sortColumn] || "";
      let valB = b[sortColumn] || "";
      
      // If sorting by Status, running comes first when asc
      if (sortColumn === "Status") {
        const isRunningA = valA.toLowerCase() === "running";
        const isRunningB = valB.toLowerCase() === "running";
        if (isRunningA && !isRunningB) return sortDirection === "asc" ? -1 : 1;
        if (!isRunningA && isRunningB) return sortDirection === "asc" ? 1 : -1;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  };

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/services/list");
      const data = await res.json();
      setStartup(data.startup || []);
      setMsServices(data.ms || []);
      setNonMsServices(data.non_ms || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await fetch("http://127.0.0.1:8000/api/system/services/refresh", { method: "POST" });
      await fetchServices();
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const renderServiceTable = (services: ServiceInfo[]) => {
    const sorted = getSortedServices(services);
    return (
      <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden max-h-[600px] overflow-y-auto mt-4">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-900 text-zinc-400 sticky top-0 shadow-sm z-10">
            <tr>
              {["Display Name", "Service Name", "Status", "Start Type", "Purpose (Description)"].map((col) => (
                <th 
                  key={col}
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort(col as SortColumn)}
                >
                  <div className="flex items-center gap-1">
                    {col === "Purpose (Description)" ? "Description" : col}
                    {sortColumn === col && (
                      <span className="text-xs">{sortDirection === "asc" ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((s, i) => {
            const isRunning = s.Status.toLowerCase() === 'running';
            return (
              <tr key={i} className="hover:bg-zinc-800/50">
                <td className="px-4 py-3 font-medium text-white">{s["Display Name"]}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{s["Service Name"]}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${isRunning ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'}`}>
                    {s.Status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-300">{s["Start Type"]}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs truncate max-w-xs" title={s["Purpose (Description)"]}>{s["Purpose (Description)"]}</td>
              </tr>
            );
          })}
            {sorted.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No services found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <STHeader title="⚙️ Services & Startup" />
          <p className="text-zinc-400 mt-2">
            View background Windows services and applications that start with your PC.
          </p>
        </div>
        <Button variant="secondary" onClick={handleRefresh} disabled={isLoading} icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />}>
          Refresh Lists
        </Button>
      </div>

      <STTabs tabs={[`:material/bolt: Startup Apps (${startup.length})`, `:material/dns: Non-MS Services (${nonMsServices.length})`, `:material/shield: MS Services (${msServices.length})`]}>
        <div>
          <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden mt-4">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {startup.map((s, i) => (
                  <tr key={i} className="hover:bg-zinc-800/50">
                    <td className="px-4 py-3 font-medium text-white">{s.Name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${s.Scope === 'System' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                        {s.Scope}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{s.Path}</td>
                  </tr>
                ))}
                {startup.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                      No startup apps found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          {renderServiceTable(nonMsServices)}
        </div>
        <div>
          {renderServiceTable(msServices)}
        </div>
      </STTabs>
    </div>
  );
}
