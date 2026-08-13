"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

type PathEntry = {
  type: string;
  path: string;
  app: string;
};

export default function EnvironmentVariablesPage() {
  const [paths, setPaths] = useState<PathEntry[]>([]);
  const [sysRaw, setSysRaw] = useState("");
  const [userRaw, setUserRaw] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchPaths = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/system/env/path");
      const data = await res.json();
      setPaths(data.paths || []);
      setSysRaw(data.sys_raw || "");
      setUserRaw(data.user_raw || "");
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaths();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/system/env/refresh", { method: "POST" });
      await fetchPaths();
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    window.location.href = "/api/system/env/export";
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header 
        title="Windows PATH Visualizer" 
        subtitle="Analyze and export your System and User PATH environment variables." 
        actions={
          <div className="flex items-center bg-[var(--theme-ui-bg)] p-1.5 rounded-xl border border-[var(--theme-ui-border)] backdrop-blur-md shadow-sm">
            <Button variant="secondary" onClick={handleRefresh} disabled={isLoading} icon={<Icon name="refresh" size={16} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </Button>
            <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1" />
            <Button variant="primary" onClick={handleExport} disabled={isLoading} icon={<Icon name="download" size={16} />}>
              Export Backup
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6 w-full flex-1">
        <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="text-lg font-bold text-[var(--theme-heading)] flex items-center gap-2">Parsed PATH Entries
          </h3>
        <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl overflow-hidden max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] sticky top-0 border-b border-[var(--theme-ui-border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Directory Path</th>
                <th className="px-4 py-3 font-medium">Detected Application</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-ui-border)]">
              {paths.map((p, i) => (
                <tr key={i} className="hover:bg-[var(--theme-ui-bg)] transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${p.type === 'System' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary/10 text-secondary border border-secondary/20'}`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--theme-text)] font-mono text-xs break-all">{p.path}</td>
                  <td className="px-4 py-3 text-[var(--theme-heading)]" dangerouslySetInnerHTML={{ __html: p.app.replace(':material/warning:', '⚠️').replace(':material/inventory_2:', '📦').replace(':material/window:', '🪟').replace(':material/terminal:', '💻').replace(':material/code:', '👨‍💻').replace(':material/fork_right:', '🔀').replace(':material/settings:', '⚙️').replace(':material/folder:', '📁') }} />
                </tr>
              ))}
              {paths.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[var(--theme-text)]">
                    No PATH entries found.
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
