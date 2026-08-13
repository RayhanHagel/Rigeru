"use client";

import React, { useState, useEffect } from "react";

import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";
import { Header } from "@/components/ui/Header";

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
  const [activeTab, setActiveTab] = useState("startup");

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
      const res = await fetch("/api/system/services/list");
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
      await fetch("/api/system/services/refresh", { method: "POST" });
      await fetchServices();
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const renderServiceTable = (services: ServiceInfo[]) => {
    const sorted = getSortedServices(services);
    return (
      <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl overflow-hidden max-h-[600px] overflow-y-auto mt-4 custom-scrollbar">
        <table className="w-full text-sm text-left">
          <thead className="bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] sticky top-0 shadow-sm z-10 border-b border-[var(--theme-ui-border)]">
            <tr>
              {["Display Name", "Service Name", "Status", "Start Type", "Purpose (Description)"].map((col) => (
                <th 
                  key={col}
                  className="px-4 py-3 font-medium cursor-pointer hover:text-[var(--theme-heading)] transition-colors select-none"
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
          <tbody className="divide-y divide-[var(--theme-ui-border)]">
            {sorted.map((s, i) => {
            const isRunning = s.Status.toLowerCase() === 'running';
            return (
              <tr key={i} className="hover:bg-[var(--theme-ui-bg)] transition-colors">
                <td className="px-4 py-3 font-bold text-[var(--theme-heading)]">{s["Display Name"]}</td>
                <td className="px-4 py-3 text-[var(--theme-text)] font-mono text-xs">{s["Service Name"]}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${isRunning ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-[var(--theme-ui-bg)] text-[var(--theme-text)] border border-[var(--theme-ui-border)]'}`}>
                    {s.Status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--theme-text)]">{s["Start Type"]}</td>
                <td className="px-4 py-3 text-[var(--theme-text)] opacity-70 text-xs truncate max-w-xs" title={s["Purpose (Description)"]}>{s["Purpose (Description)"]}</td>
              </tr>
            );
          })}
            {sorted.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--theme-text)]">
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
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <Header title="Services & Startup" subtitle="View background Windows services and applications that start with your PC." />
        <div className="flex items-center bg-[var(--theme-ui-bg)] p-1.5 rounded-xl border border-[var(--theme-ui-border)] backdrop-blur-md shadow-sm shrink-0 mb-6">
          <Button variant="secondary" onClick={handleRefresh} disabled={isLoading} icon={<Icon name="refresh" size={16} className={isLoading ? 'animate-spin' : ''} />}>
            Refresh Lists
          </Button>
          <div className="w-px h-6 bg-[var(--theme-ui-border)] mx-2" />
          <ModernTabs 
            activeTab={activeTab}
            setActiveTab={setActiveTab as (id: string) => void}
            tabs={[
              { id: "startup", label: "Startup Apps" },
              { id: "non-ms", label: "3rd Party Services" },
              { id: "ms", label: "Windows Services" }
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 animate-slide-up w-full flex-1">
        <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-2xl p-6 flex flex-col gap-4 shadow-sm flex-1">
          <ModernTabContent activeTab={activeTab}>
            {activeTab === 'startup' && (
              <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl overflow-hidden max-h-[600px] overflow-y-auto mt-4 custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] sticky top-0 shadow-sm z-10 border-b border-[var(--theme-ui-border)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Path</th>
                      <th className="px-4 py-3 font-medium">Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-ui-border)]">
                    {startup.map((s, i) => (
                      <tr key={i} className="hover:bg-[var(--theme-ui-bg)] transition-colors">
                        <td className="px-4 py-3 font-bold text-[var(--theme-heading)]">{s.Name}</td>
                        <td className="px-4 py-3 text-[var(--theme-text)] font-mono text-xs max-w-sm truncate" title={s.Path}>{s.Path}</td>
                        <td className="px-4 py-3 text-[var(--theme-text)] text-xs">{s.Scope}</td>
                      </tr>
                    ))}
                    {startup.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-[var(--theme-text)]">
                          No startup apps found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {activeTab === 'non-ms' && (
              <div>
                {renderServiceTable(nonMsServices)}
              </div>
            )}

            {activeTab === 'ms' && (
              <div>
                {renderServiceTable(msServices)}
              </div>
            )}
          </ModernTabContent>
        </div>
      </div>
    </div>
  );
}
