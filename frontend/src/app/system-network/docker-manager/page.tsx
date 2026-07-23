"use client";

import React, { useState, useEffect } from "react";
import { HardDrive, Play, Square, RefreshCw, Power } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { Button } from "@/components/ui/Button";

type DockerContainer = {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: Record<string, any>;
};

export default function DockerManagerPage() {
  const [isRunning, setIsRunning] = useState<boolean | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchStatusAndContainers = async () => {
    setIsLoading(true);
    try {
      const statRes = await fetch("http://127.0.0.1:8000/api/system/docker/status");
      const statData = await statRes.json();
      setIsRunning(statData.running);
      setStatusMsg(statData.message);

      if (statData.running) {
        const contRes = await fetch("http://127.0.0.1:8000/api/system/docker/containers");
        const contData = await contRes.json();
        if (contRes.ok) {
          setContainers(contData.containers || []);
        }
      } else {
        setContainers([]);
      }
    } catch (e: any) {
      setIsRunning(false);
      setStatusMsg(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndContainers();
  }, []);

  const handleStartDaemon = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/docker/start-daemon", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setStatusMsg(data.message);
      // Wait a bit and try to fetch status again
      setTimeout(fetchStatusAndContainers, 5000);
    } catch (e: any) {
      setStatusMsg(`Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContainerAction = async (id: string, action: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/system/docker/containers/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      
      // Update the local state optimistically or re-fetch
      await fetchStatusAndContainers();
    } catch (e: any) {
      alert(`Action failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPorts = (ports: Record<string, any>) => {
    if (!ports || Object.keys(ports).length === 0) return "-";
    const mapped: string[] = [];
    for (const [containerPort, hostBindings] of Object.entries(ports)) {
      if (hostBindings && Array.isArray(hostBindings)) {
        hostBindings.forEach((binding: any) => {
          if (binding.HostPort) {
            mapped.push(`${binding.HostPort}->${containerPort}`);
          }
        });
      }
    }
    return mapped.length > 0 ? mapped.join(", ") : "-";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <STHeader title="🐳 Docker Manager" />
          <p className="text-zinc-400 mt-2">
            Control local Docker containers and view images.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchStatusAndContainers} disabled={isLoading || isProcessing} icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />}>
          Refresh
        </Button>
      </div>

      <STContainer title="Docker Daemon Status" icon={<HardDrive size={18} className="text-blue-400" />}>
        <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${isRunning ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'}`} />
            <div>
              <p className="font-semibold text-white">Docker is {isRunning ? "Running" : "Offline"}</p>
              <p className="text-sm text-zinc-400">{statusMsg}</p>
            </div>
          </div>
          
          {!isRunning && !isLoading && (
            <Button variant="primary" onClick={handleStartDaemon} disabled={isProcessing} icon={<Power size={16} />}>
              Launch Docker Daemon
            </Button>
          )}
        </div>
      </STContainer>

      {isRunning && (
        <STContainer title="Containers" icon={<HardDrive size={18} className="text-blue-400" />}>
          <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Image</th>
                  <th className="px-4 py-3 font-medium">Ports</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {containers.map((c) => {
                  const isUp = c.status.toLowerCase().includes("running");
                  return (
                    <tr key={c.id} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${isUp ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.image}</td>
                      <td className="px-4 py-3 text-zinc-500">{formatPorts(c.ports)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {isUp ? (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => handleContainerAction(c.id, "restart")} disabled={isProcessing} icon={<RefreshCw size={14} />}>
                                Restart
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => handleContainerAction(c.id, "stop")} disabled={isProcessing} icon={<Square size={14} />}>
                                Stop
                              </Button>
                            </>
                          ) : (
                            <Button variant="primary" size="sm" onClick={() => handleContainerAction(c.id, "start")} disabled={isProcessing} icon={<Play size={14} />}>
                              Start
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                
                {containers.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      No containers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </STContainer>
      )}
    </div>
  );
}
