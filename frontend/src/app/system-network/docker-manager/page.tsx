"use client";

import React, { useState, useEffect, useMemo } from "react";
import { HardDrive, Play, Square, RefreshCw, Power, Box, Activity, Network, ChevronDown, ChevronRight, X, Save, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PopupModal } from '@/components/ui/PopupModal';

type DockerContainer = {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: Record<string, any>;
  compose_project?: string;
};

type ProjectGroup = {
  isProject: boolean;
  name: string;
  containers: DockerContainer[];
  status: string;
};

export default function DockerManagerPage() {
  const [isRunning, setIsRunning] = useState<boolean | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedContainers, setExpandedContainers] = useState<Record<string, boolean>>({});
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectComposeContent, setProjectComposeContent] = useState<string>("");
  const [isComposeLoading, setIsComposeLoading] = useState(false);
  const [isSavingCompose, setIsSavingCompose] = useState(false);
  const [memLimitInput, setMemLimitInput] = useState("512m");
  const [composeUpProject, setComposeUpProject] = useState<string | null>(null);
  const [isComposingUp, setIsComposingUp] = useState(false);
  const [composeUpResult, setComposeUpResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const openProjectConfig = async (projectName: string) => {
    setSelectedProject(projectName);
    setIsComposeLoading(true);
    try {
      const res = await fetch(`/api/system/docker/project/${encodeURIComponent(projectName)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setProjectComposeContent(data.content);
    } catch (e: any) {
      alert("Error fetching project file: " + e.message);
      setSelectedProject(null);
    } finally {
      setIsComposeLoading(false);
    }
  };

  const saveProjectConfig = async () => {
    if (!selectedProject) return;
    setIsSavingCompose(true);
    const projectName = selectedProject;
    try {
      const res = await fetch(`/api/system/docker/project/${encodeURIComponent(projectName)}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: projectComposeContent })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setSelectedProject(null);
      // Show compose-up confirmation
      setComposeUpProject(projectName);
      setComposeUpResult(null);
    } catch (e: any) {
      alert("Error saving project file: " + e.message);
    } finally {
      setIsSavingCompose(false);
    }
  };

  const handleComposeUp = async () => {
    if (!composeUpProject) return;
    setIsComposingUp(true);
    setComposeUpResult(null);
    try {
      const res = await fetch(`/api/system/docker/project/${encodeURIComponent(composeUpProject)}/compose-up`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setComposeUpResult({ ok: true, msg: data.message || "docker compose up -d completed." });
    } catch (e: any) {
      setComposeUpResult({ ok: false, msg: e.message });
    } finally {
      setIsComposingUp(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    const confirmed = window.confirm(`Are you sure you want to delete the project '${selectedProject}', including ALL of its containers and volumes? This action is irreversible!`);
    if (!confirmed) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/system/docker/project/${encodeURIComponent(selectedProject)}/compose-down`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      alert(`Successfully deleted project '${selectedProject}'.`);
      setSelectedProject(null);
      await fetchStatusAndContainers();
    } catch (e: any) {
      alert("Error deleting project: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleAutoStart = (enable: boolean) => {
    let newContent = projectComposeContent;
    if (enable) {
      if (/restart:\s*.+/.test(newContent)) {
        newContent = newContent.replace(/restart:\s*.+/g, "restart: unless-stopped");
      } else {
        alert("No 'restart:' key found in the file to toggle. Please add it manually under each service.");
        return;
      }
    } else {
      if (/restart:\s*.+/.test(newContent)) {
        newContent = newContent.replace(/restart:\s*.+/g, 'restart: "no"');
      } else {
        alert("No 'restart:' key found in the file to toggle. Please add it manually under each service.");
        return;
      }
    }
    setProjectComposeContent(newContent);
  };

  const applyMemLimit = () => {
    let newContent = projectComposeContent;
    if (/mem_limit:\s*.+/.test(newContent)) {
      newContent = newContent.replace(/mem_limit:\s*.+/g, `mem_limit: ${memLimitInput}`);
    } else if (/memory:\s*.+/.test(newContent)) {
      newContent = newContent.replace(/memory:\s*.+/g, `memory: ${memLimitInput}`);
    } else {
      alert("No 'mem_limit:' or 'memory:' key found in the file to toggle. Please add 'mem_limit: 512m' under your services manually first.");
      return;
    }
    setProjectComposeContent(newContent);
  };

  const toggleContainer = (containerId: string) => {
    setExpandedContainers(prev => ({
      ...prev,
      [containerId]: !prev[containerId]
    }));
  };

  const fetchStatusAndContainers = async () => {
    setIsLoading(true);
    try {
      const statRes = await fetch("/api/system/docker/status");
      const statData = await statRes.json();
      setIsRunning(statData.running);
      setStatusMsg(statData.message);

      if (statData.running) {
        const contRes = await fetch("/api/system/docker/containers");
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
      const res = await fetch("/api/system/docker/start-daemon", { method: "POST" });
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
      const res = await fetch(`/api/system/docker/containers/${id}/${action}`, { method: "POST" });
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

  const handleGroupAction = async (group: ProjectGroup, action: string) => {
    setIsProcessing(true);
    try {
      await Promise.all(group.containers.map(c => 
        fetch(`/api/system/docker/containers/${c.id}/${action}`, { method: "POST" })
      ));
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

  const groupedContainers = useMemo(() => {
    const groups: Record<string, ProjectGroup> = {};
    
    containers.forEach(c => {
      if (c.compose_project) {
        if (!groups[c.compose_project]) {
          groups[c.compose_project] = {
            isProject: true,
            name: c.compose_project,
            containers: [],
            status: 'exited'
          };
        }
        groups[c.compose_project].containers.push(c);
      } else {
        groups[`standalone_${c.id}`] = {
          isProject: false,
          name: c.name,
          containers: [c],
          status: c.status
        };
      }
    });

    Object.values(groups).forEach(g => {
      if (g.isProject) {
        const isUp = g.containers.some(c => c.status.toLowerCase().includes("running"));
        g.status = isUp ? 'running' : 'exited';
      }
    });

    return Object.values(groups).sort((a, b) => {
        if (a.isProject && !b.isProject) return -1;
        if (!a.isProject && b.isProject) return 1;
        return a.name.localeCompare(b.name);
    });
  }, [containers]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedContainers;
    const q = searchQuery.toLowerCase();
    return groupedContainers.filter(g => 
      g.name.toLowerCase().includes(q) || 
      g.containers.some(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    );
  }, [groupedContainers, searchQuery]);

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Docker Manager</h1>
            <p className="text-zinc-400 text-sm font-medium">Control local Docker containers and view images.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={fetchStatusAndContainers} disabled={isLoading || isProcessing} icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-6 w-full">
        {/* Docker Daemon Status */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">Docker Daemon Status
          </h3>
          <div className="flex items-center justify-between p-4 bg-zinc-950 border border-white/5 rounded-xl">
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
        </div>

        {isRunning && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">Containers & Projects
            </h3>
            <div className="mb-2">
              <input 
                type="text" 
                placeholder="Search projects or containers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg py-2 px-4 text-white focus:outline-none focus:border-secondary"
              />
            </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-slide-up">
            {filteredGroups.map((group) => {
              const isGroupUp = group.status.toLowerCase().includes("running");
              
              return (
                <div key={group.name} className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col hover:border-secondary/30 transition-all">
                  <div className="flex justify-between items-start mb-6 pb-4 border-b border-white/5">
                    <div 
                      className={`flex items-center gap-3 ${group.isProject ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                      onClick={() => group.isProject && openProjectConfig(group.name)}
                    >
                      <div className={`p-2.5 rounded-xl ${isGroupUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        <Box size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg truncate max-w-[200px]" title={group.name}>{group.name}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] uppercase font-bold tracking-wider ${isGroupUp ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {group.isProject ? "Compose Project" : "Standalone"} - {group.status}
                        </span>
                      </div>
                    </div>
                    
                    {group.isProject && (
                      <div className="flex gap-2">
                        {isGroupUp ? (
                          <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); handleGroupAction(group, "stop"); }} disabled={isProcessing} icon={<Square size={14} />}>
                            Stop All
                          </Button>
                        ) : (
                          <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); handleGroupAction(group, "start"); }} disabled={isProcessing} icon={<Play size={14} />}>
                            Start All
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 flex-1">
                    {group.containers.map(c => {
                      const isUp = c.status.toLowerCase().includes("running");
                      const isExpanded = expandedContainers[c.id];
                      return (
                        <div key={c.id} className="bg-zinc-950/50 rounded-xl border border-white/5 overflow-hidden">
                          <div 
                            className="flex justify-between items-center p-3 cursor-pointer hover:bg-white/5 transition-colors"
                            onClick={() => toggleContainer(c.id)}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                              <div className="text-zinc-500">
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </div>
                              <div className="font-medium text-zinc-200 truncate" title={c.name}>{c.name}</div>
                            </div>
                            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${isUp ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                              {c.status}
                            </span>
                          </div>
                          
                          {isExpanded && (
                            <div className="p-4 pt-2 border-t border-white/5 flex flex-col gap-3">
                              <div className="flex items-start gap-2">
                                <Activity size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                                <div className="text-xs text-zinc-400 truncate" title={c.image}>{c.image}</div>
                              </div>
                              
                              <div className="flex items-start gap-2">
                                <Network size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                                <div className="text-xs text-zinc-400 break-words line-clamp-2">
                                  {formatPorts(c.ports)}
                                </div>
                              </div>
                              
                              <div className="flex gap-2 mt-2">
                                {isUp ? (
                                  <>
                                    <Button variant="secondary" className="flex-1 h-8 text-xs" onClick={() => handleContainerAction(c.id, "restart")} disabled={isProcessing} icon={<RefreshCw size={14} />}>Restart</Button>
                                    <Button variant="danger" className="flex-1 h-8 text-xs" onClick={() => handleContainerAction(c.id, "stop")} disabled={isProcessing} icon={<Square size={14} />}>Stop</Button>
                                  </>
                                ) : (
                                  <Button variant="primary" className="flex-1 h-8 text-xs" onClick={() => handleContainerAction(c.id, "start")} disabled={isProcessing} icon={<Play size={14} />}>Start</Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredGroups.length === 0 && !isLoading && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-white/10 rounded-2xl bg-zinc-950/50">
                <Box size={48} className="mb-4 opacity-50" />
                <p>No containers found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      <PopupModal isOpen={!!selectedProject} onClose={() => setSelectedProject(null)} title={`${selectedProject} Configuration`}>
        {selectedProject && (
          <div className="flex flex-col h-[70vh]">
            {isComposeLoading ? (
              <div className="flex-1 flex items-center justify-center min-h-[300px]">
                <RefreshCw className="animate-spin text-zinc-500" size={32} />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex gap-4 mb-4 bg-zinc-950/50 p-4 rounded-xl border border-white/5 shrink-0">
                  <div className="flex flex-col gap-3">
                     <div>
                       <div className="font-semibold text-white mb-1">Quick Actions</div>
                       <div className="text-sm text-zinc-400 mb-2">These actions will automatically update the text editor below.</div>
                     </div>
                     <div className="flex flex-wrap gap-4 items-center">
                       <div className="flex gap-2 items-center bg-black/20 p-2 rounded-lg border border-white/5">
                         <span className="text-sm text-zinc-300 font-medium whitespace-nowrap">Auto-Start:</span>
                         <Button variant="secondary" size="sm" onClick={() => toggleAutoStart(true)}>Enable</Button>
                         <Button variant="secondary" size="sm" onClick={() => toggleAutoStart(false)}>Disable</Button>
                       </div>
                       
                       <div className="flex gap-2 items-center bg-black/20 p-2 rounded-lg border border-white/5">
                         <span className="text-sm text-zinc-300 font-medium whitespace-nowrap">Memory Limit:</span>
                         <input 
                           type="text" 
                           value={memLimitInput}
                           onChange={(e) => setMemLimitInput(e.target.value)}
                           className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-sm text-white w-20 focus:outline-none focus:border-secondary"
                           placeholder="e.g. 512m"
                         />
                         <Button variant="secondary" size="sm" onClick={applyMemLimit}>Apply</Button>
                       </div>
                     </div>
                  </div>
                </div>
                
                <div className="flex-1 mb-4 overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] min-h-0">
                  <textarea 
                    value={projectComposeContent}
                    onChange={(e) => setProjectComposeContent(e.target.value)}
                    className="w-full h-full bg-transparent text-zinc-300 p-4 font-mono text-sm resize-none focus:outline-none custom-scrollbar"
                    spellCheck="false"
                  />
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-white/10 shrink-0">
                  <Button variant="danger" onClick={handleDeleteProject} disabled={isProcessing} icon={<Trash2 size={16} />}>
                    Delete Project (Down -v)
                  </Button>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => setSelectedProject(null)}>Cancel</Button>
                    <Button variant="primary" onClick={saveProjectConfig} disabled={isSavingCompose || isProcessing} icon={<Save size={16} />}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </PopupModal>

      {/* docker compose up -d --no-recreate confirmation dialog */}
      <PopupModal isOpen={!!composeUpProject} onClose={() => { setComposeUpProject(null); setComposeUpResult(null); }} title="Apply Changes?">
        {composeUpProject && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-secondary/20 text-secondary">
                <RefreshCw size={22} />
              </div>
              <div>
                <p className="text-sm text-zinc-400">{composeUpProject}</p>
              </div>
            </div>
            <p className="text-sm text-zinc-300">
              File saved. Do you want to run <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">docker compose up -d</code> to apply the changes?
            </p>

            {composeUpResult && (
              <div className={`rounded-xl p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto border ${
                composeUpResult.ok
                  ? 'bg-green-500/10 border-green-500/20 text-green-300'
                  : 'bg-red-500/10 border-red-500/20 text-red-300'
              }`}>
                {composeUpResult.msg}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-2">
              <Button variant="secondary" onClick={() => { setComposeUpProject(null); setComposeUpResult(null); }} disabled={isComposingUp}>
                {composeUpResult ? "Close" : "No, skip"}
              </Button>
              {!composeUpResult && (
                <Button variant="primary" onClick={handleComposeUp} disabled={isComposingUp} icon={<Play size={16} />}>
                  {isComposingUp ? "Running..." : "Yes, run it"}
                </Button>
              )}
            </div>
          </div>
        )}
      </PopupModal>
    </div>
  );
}

