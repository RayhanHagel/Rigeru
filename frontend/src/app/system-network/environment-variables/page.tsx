"use client";

import React, { useState, useEffect } from "react";
import { Terminal, Download, RefreshCw, Layers } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { Button } from "@/components/ui/Button";

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
      const res = await fetch("http://127.0.0.1:8000/api/system/env/path");
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
      await fetch("http://127.0.0.1:8000/api/system/env/refresh", { method: "POST" });
      await fetchPaths();
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    window.location.href = "http://127.0.0.1:8000/api/system/env/export";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <STHeader title="🖥️ Windows PATH Visualizer" />
          <p className="text-zinc-400 mt-2">
            Analyze and export your System and User PATH environment variables.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleRefresh} disabled={isLoading} icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />}>
            Force Refresh
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={isLoading} icon={<Download size={16} />}>
            Export Backup
          </Button>
        </div>
      </div>

      <STContainer title="Parsed PATH Entries" icon={<Layers size={18} className="text-emerald-400" />}>
        <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900 text-zinc-400 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Directory Path</th>
                <th className="px-4 py-3 font-medium">Detected Application</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paths.map((p, i) => (
                <tr key={i} className="hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${p.type === 'System' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 font-mono text-xs break-all">{p.path}</td>
                  <td className="px-4 py-3 text-zinc-400" dangerouslySetInnerHTML={{ __html: p.app.replace(':material/warning:', '⚠️').replace(':material/inventory_2:', '📦').replace(':material/window:', '🪟').replace(':material/terminal:', '💻').replace(':material/code:', '👨‍💻').replace(':material/fork_right:', '🔀').replace(':material/settings:', '⚙️').replace(':material/folder:', '📁') }} />
                </tr>
              ))}
              {paths.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                    No PATH entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </STContainer>

    </div>
  );
}
