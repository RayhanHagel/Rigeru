"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useEffect, useRef, useMemo } from "react";

import { Button } from "@/components/ui/Button";
import dynamic from 'next/dynamic';

import MarkdownViewer from '@/components/obsidian-builder/MarkdownViewer';
import { Icon } from "@/lib/utils";

const GraphView = dynamic(() => import('@/components/obsidian-builder/GraphView'), { ssr: false });

export default function ObsidianBuilderPage() {
  const [topic, setTopic] = useState("");
  const [vaultName, setVaultName] = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [maxDepth, setMaxDepth] = useState(3);
  
  const [isBuilding, setIsBuilding] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusLogs, setStatusLogs] = useState<string[]>([]);
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [graphSettings, setGraphSettings] = useState({
    textFadeThreshold: 1.5,
    nodeSize: 5.0,
    linkThickness: 1.5,
    centerForce: 0.05,
    repelForce: 300.0,
    linkForce: 1.0,
    linkDistance: 50.0,
    displayDepth: 5
  });
  
  const [vaults, setVaults] = useState<any[]>([]);
  const [searchVault, setSearchVault] = useState("");
  const [sortVault, setSortVault] = useState("date");
  
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchVaults = async () => {
    try {
      const token = localStorage.getItem("auth_token") || "";
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      const res = await fetch(`http://${host}:8000/api/files-documents/obsidian/vaults?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setVaults(data);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("auth_token") || "";
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      const res = await fetch(`http://${host}:8000/api/files-documents/obsidian/settings?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setGraphSettings(data);
      }
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    fetchVaults();
    fetchSettings();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const isSettingsInit = useRef(true);
  useEffect(() => {
    if (isSettingsInit.current) {
      isSettingsInit.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const token = localStorage.getItem("auth_token") || "";
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      fetch(`http://${host}:8000/api/files-documents/obsidian/settings?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graphSettings)
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [graphSettings]);

  const handleDeleteVault = async (vName: string) => {
    if (!confirm(`Are you sure you want to delete the vault "${vName}"?`)) return;
    try {
      const token = localStorage.getItem("auth_token") || "";
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      const res = await fetch(`http://${host}:8000/api/files-documents/obsidian/vaults/${encodeURIComponent(vName)}?token=${token}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchVaults();
      } else {
        alert("Failed to delete vault.");
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleDeleteTopic = async (vName: string, topic: string) => {
    if (!confirm(`Are you sure you want to remove the root topic "${topic}" and delete its markdown file?`)) return;
    try {
      const token = localStorage.getItem("auth_token") || "";
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      const res = await fetch(`http://${host}:8000/api/files-documents/obsidian/vaults/${encodeURIComponent(vName)}/topics/${encodeURIComponent(topic)}?token=${token}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchVaults();
        // If it's the currently loaded vault, reload the graph
        if (vaultName === vName) {
          loadVaultGraph(vName);
        }
      } else {
        alert("Failed to delete topic.");
      }
    } catch(e) {
      console.error(e);
    }
  };

  const loadVaultGraph = async (vName: string) => {
    try {
      setStatusMsg(`Loading graph for ${vName}...`);
      const token = localStorage.getItem("auth_token") || "";
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      const res = await fetch(`http://${host}:8000/api/files-documents/obsidian/vaults/${encodeURIComponent(vName)}/graph?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
        setStatusMsg(`Loaded ${data.nodes.length} nodes from ${vName}.`);
        setVaultName(vName);
        setTopic("");
      } else {
        alert("Failed to load vault graph.");
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleNodeClick = async (nodeId: string) => {
    setSelectedNode(nodeId);
    setIsLoadingMarkdown(true);
    
    try {
        const token = localStorage.getItem("auth_token") || "";
        const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
        const res = await fetch(`http://${host}:8000/api/files-documents/obsidian/vaults/${encodeURIComponent(vaultName)}/node/${encodeURIComponent(nodeId)}?token=${token}`);
        if (res.ok) {
            const data = await res.json();
            setMarkdownContent(data.content);
        } else {
            setMarkdownContent(`# Error\n\nFailed to load content for ${nodeId}`);
        }
    } catch(e) {
        setMarkdownContent(`# Error\n\nFailed to load content for ${nodeId}`);
    } finally {
        setIsLoadingMarkdown(false);
    }
  };

  const handleStart = () => {
    if (!topic || !vaultName) {
      alert("Please enter a topic and vault name.");
      return;
    }
    
    setIsBuilding(true);
    setStatusMsg("Initializing AI Agent");
    setStatusLogs(["Initializing AI Agent"]);
    setGraphData({ nodes: [], links: [] });
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem("auth_token") || "";
    const encodedTopic = encodeURIComponent(topic);
    const encodedVault = encodeURIComponent(vaultName);
    
    // Bypass Next.js proxy for SSE because it buffers the stream in dev mode
    const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    const backendUrl = `http://${host}:8000`;
    const sseUrl = `${backendUrl}/api/files-documents/obsidian/stream?topic=${encodedTopic}&vault=${encodedVault}&max_pages=${maxPages}&max_depth=${maxDepth}&token=${token}`;
    
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "error") {
          setStatusMsg(`Error: ${data.message}`);
          setStatusLogs(prev => [...prev, `Error: ${data.message}`]);
          setIsBuilding(false);
          es.close();
        } else if (data.type === "status") {
          setStatusMsg(data.message);
          setStatusLogs(prev => [...prev, data.message]);
        } else if (data.type === "node_added") {
          setGraphData((prev: any) => {
            const existingNodes = new Map(prev.nodes.map((n: any) => [n.id, n]));
            const newNodes = data.nodes.map((n: any) => {
              if (existingNodes.has(n.id)) {
                return { ...(existingNodes.get(n.id) || {}), ...n };
              }
              return n;
            });
            return {
              nodes: newNodes,
              links: data.links,
              completed_count: data.completed_count || prev.completed_count || 0
            };
          });
        } else if (data.type === "done") {
          setStatusMsg(data.message);
          setStatusLogs(prev => [...prev, data.message]);
          setIsBuilding(false);
          es.close();
        } else if (data.type === "usage") {
          const usageMsg = `Token Usage - Prompt: ${data.prompt_tokens} | Completion: ${data.completion_tokens}`;
          setStatusMsg(usageMsg);
          setStatusLogs(prev => [...prev, usageMsg]);
        }
      } catch (err) {
        console.error("Failed to parse SSE message", err);
      }
    };

    es.onerror = () => {
      setStatusMsg("Connection error or stream closed unexpectedly.");
      setStatusLogs(prev => [...prev, "Connection error or stream closed unexpectedly."]);
      setIsBuilding(false);
      es.close();
    };
  };

  const handleStop = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setStatusMsg("Generation stopped.");
      setStatusLogs(prev => [...prev, "Generation stopped."]);
      setIsBuilding(false);
      fetchVaults();
    }
  };

  const sortedVaults = vaults
    .filter(v => v.name.toLowerCase().includes(searchVault.toLowerCase()))
    .sort((a, b) => {
      if (sortVault === "a-z") return a.name.localeCompare(b.name);
      if (sortVault === "z-a") return b.name.localeCompare(a.name);
      return b.created_at - a.created_at; // Date desc
    });

  const filteredGraphData = useMemo(() => {
    const validNodes = graphData.nodes.filter((n: any) => (typeof n.group === 'number' ? n.group : 0) <= graphSettings.displayDepth);
    const validNodeIds = new Set(validNodes.map((n: any) => n.id));
    const validLinks = graphData.links.filter((l: any) => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      return validNodeIds.has(sId) && validNodeIds.has(tId);
    });
    return { nodes: validNodes, links: validLinks };
  }, [graphData, graphSettings.displayDepth]);

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="AI Obsidian Builder" subtitle="Autonomous agent that researches topics and builds a connected Markdown vault." />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 shadow-xl backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-zinc-200 mb-4 border-b border-white/5 pb-4">Agent Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Root Topic</label>
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Quantum Physics"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={isBuilding}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Vault Folder Name</label>
                <div className="relative">
                  <Icon name="folder" className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                  <input 
                    type="text" 
                    value={vaultName}
                    onChange={(e) => setVaultName(e.target.value)}
                    placeholder="e.g. Science_Vault"
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    disabled={isBuilding}
                  />
                </div>
              </div>

              {vaultName && vaults.find(v => v.name === vaultName)?.root_topics?.length > 0 && (
                <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                  <p className="text-xs text-zinc-500 mb-2">Existing Root Topics in {vaultName}:</p>
                  <div className="flex flex-wrap gap-2">
                    {vaults.find(v => v.name === vaultName).root_topics.map((t: string) => (
                      <div key={t} className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-md px-2 py-1 text-xs text-purple-200">
                        <button 
                          onClick={() => setTopic(t)}
                          className="hover:text-white truncate max-w-[120px] cursor-pointer"
                          title={`Select ${t}`}
                        >
                          {t}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setTopic(t); handleStart(); }}
                          className="text-emerald-400 hover:text-emerald-300 ml-1 p-0.5 rounded hover:bg-white/10"
                          title="Continue Expanding"
                        >
                          <Icon name="play_arrow" size={12} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteTopic(vaultName, t); }}
                          className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-white/10"
                          title="Remove Topic"
                        >
                          <Icon name="close" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Max Topics</label>
                  <input 
                    type="number" 
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value))}
                    min={1} max={50}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    disabled={isBuilding}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Max Depth</label>
                  <input 
                    type="number" 
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                    min={1} max={10}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    disabled={isBuilding}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              {!isBuilding ? (
                <Button onClick={handleStart} className="flex-1 flex items-center justify-center bg-primary hover:bg-purple-700 text-white border-0 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
                  <Icon name="play_arrow" size={18} className="mr-2" /> Start AI Agent
                </Button>
              ) : (
                <Button onClick={handleStop} variant="danger" className="flex-1 flex items-center justify-center">
                  Stop Agent
                </Button>
              )}
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 shadow-xl backdrop-blur-sm flex flex-col max-h-[300px]">
            <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Status Log</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
              {statusLogs.length === 0 ? (
                <div className="flex items-start gap-3">
                  <Icon name="search" className="text-zinc-500 mt-0.5 shrink-0" size={18} />
                  <p className="text-zinc-200 text-sm leading-relaxed">Ready to start building.</p>
                </div>
              ) : (
                statusLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    {idx === statusLogs.length - 1 && isBuilding ? (
                      <Icon name="progress_activity" className="animate-spin text-primary mt-0.5 shrink-0" size={14} />
                    ) : log.includes("Error") ? (
                      <Icon name="close" className="text-red-400 mt-0.5 shrink-0" size={14} />
                    ) : log.toLowerCase().includes("complete") || log.toLowerCase().includes("done") ? (
                      <Icon name="check_circle" className="text-emerald-400 mt-0.5 shrink-0" size={14} />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                    )}
                    <p className="text-zinc-300 text-xs font-mono break-all leading-relaxed">{log}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 shadow-xl backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-zinc-500 mb-1">Markdown Files</p>
                <p className="text-2xl font-bold text-zinc-200">{(graphData as any).completed_count || graphData.nodes.length}</p>
              </div>
              <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-zinc-500 mb-1">Connections</p>
                <p className="text-2xl font-bold text-primary">{graphData.links.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Knowledge Bases Box (Right Column) */}
        <div className="lg:col-span-8">
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 shadow-xl backdrop-blur-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
              <h3 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">Knowledge Bases
              </h3>
            </div>
            
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Icon name="search" className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search vaults..." 
                    value={searchVault}
                    onChange={e => setSearchVault(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <select 
                  value={sortVault} 
                  onChange={e => setSortVault(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-sm text-zinc-200 focus:outline-none"
                >
                  <option value="date">Newest</option>
                  <option value="a-z">A - Z</option>
                  <option value="z-a">Z - A</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 overflow-y-auto pr-1 custom-scrollbar flex-1 content-start">
                {sortedVaults.length === 0 && (
                  <p className="text-zinc-500 text-sm py-4 col-span-full">No vaults found.</p>
                )}
                {sortedVaults.map(v => (
                  <div 
                    key={v.name} 
                    onClick={() => loadVaultGraph(v.name)}
                    className="bg-black/30 border border-white/5 p-4 rounded-lg flex flex-col gap-3 group hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-md font-semibold text-zinc-200">{v.name}</p>
                        <p className="text-sm text-zinc-500">{v.file_count} markdown files</p>
                      </div>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setVaultName(v.name); setTopic(""); }}
                          title="Add new Root Topic"
                          className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-emerald-400"
                        >
                          <Icon name="add" size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteVault(v.name); }}
                          title="Delete Vault"
                          className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-red-400"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Map Visualization (Full width at bottom) */}
      <div className="mt-8 bg-zinc-900/50 border border-white/5 rounded-xl p-6 shadow-xl backdrop-blur-sm h-[700px] flex flex-col relative overflow-hidden">
        <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
          <h3 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">Knowledge Graph
          </h3>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-1.5 bg-black/40 hover:bg-black/60 border border-white/10 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            <Icon name="tune" size={16} /> Customize Graph
          </button>
        </div>
        
        {/* Settings Overlay */}
        {showSettings && (
          <div className="absolute top-16 right-6 z-20 w-80 bg-black/90 border border-white/10 rounded-xl p-5 shadow-2xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
              <h4 className="font-semibold text-zinc-200 flex items-center gap-2">Graph Physics & Style</h4>
              <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white"><Icon name="close" size={16} /></button>
            </div>
            
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
              {[
                { label: "Display Depth", key: "displayDepth", min: 0, max: 10, step: 1 },
                { label: "Text Fade Threshold", key: "textFadeThreshold", min: 0.5, max: 5.0, step: 0.1 },
                { label: "Node Size", key: "nodeSize", min: 1, max: 20, step: 0.5 },
                { label: "Link Thickness", key: "linkThickness", min: 0.5, max: 10, step: 0.1 },
                { label: "Center Force", key: "centerForce", min: 0.0, max: 1.0, step: 0.01 },
                { label: "Repel Force", key: "repelForce", min: 10, max: 1000, step: 10 },
                { label: "Link Force", key: "linkForce", min: 0.0, max: 2.0, step: 0.1 },
                { label: "Link Distance", key: "linkDistance", min: 10, max: 300, step: 5 },
              ].map(slider => (
                <div key={slider.key}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-zinc-400">{slider.label}</label>
                    <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">{(graphSettings as any)[slider.key]}</span>
                  </div>
                  <input 
                    type="range" 
                    min={slider.min} max={slider.max} step={slider.step}
                    value={(graphSettings as any)[slider.key]}
                    onChange={(e) => setGraphSettings({...graphSettings, [slider.key]: parseFloat(e.target.value)})}
                    className="w-full accent-purple-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-1 w-full relative h-full overflow-hidden">
          {/* File List Sidebar */}
          <div className="w-64 border-r border-white/5 bg-black/20 overflow-y-auto flex flex-col p-2 gap-1 custom-scrollbar shrink-0">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2 pt-2">Markdown Files</h4>
            {filteredGraphData.nodes.map((n: any) => (
              <button
                key={n.id}
                onClick={() => handleNodeClick(n.id)}
                className="text-left text-sm text-zinc-300 hover:text-primary hover:bg-white/5 px-2 py-1.5 rounded transition-colors truncate shrink-0"
                title={n.id}
              >
                {n.id}.md
              </button>
            ))}
            {filteredGraphData.nodes.length === 0 && (
              <p className="text-xs text-zinc-600 px-2">No files yet.</p>
            )}
          </div>
          
          <div className="flex-1 relative">
            {graphData.nodes.length > 0 ? (
              <GraphView graphData={filteredGraphData} settings={graphSettings} onNodeClick={handleNodeClick} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 space-y-3">
                <Icon name="hub" size={48} className="opacity-20" />
                <p className="text-sm">The knowledge graph will appear here.</p>
              </div>
            )}
            
            {selectedNode && (
              <MarkdownViewer 
                content={markdownContent}
                title={selectedNode}
                isLoading={isLoadingMarkdown}
                onClose={() => setSelectedNode(null)}
                onInternalLinkClick={(target) => handleNodeClick(target)}
              />
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
