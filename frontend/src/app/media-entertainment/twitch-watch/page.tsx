"use client";

import { useEffect, useState } from "react";
import { Tv, Settings, MonitorPlay, Plus, GripVertical, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function TwitchWatch() {
  const [mode, setMode] = useState<"config" | "watch">("watch");
  
  // Config state
  const [channels, setChannels] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState("");
  const [embedParent, setEmbedParent] = useState("localhost");
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [isSaving, setIsSaving] = useState(false);

  // Watch state
  const [liveChannels, setLiveChannels] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // DND state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const fetchConfig = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-entertainment/twitch-watch");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (e) {
      console.error("Failed to fetch config", e);
    }
  };

  const saveConfig = async (newChannels: string[]) => {
    setIsSaving(true);
    try {
      await fetch("http://127.0.0.1:8000/api/media-entertainment/twitch-watch/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: newChannels })
      });
      setChannels(newChannels);
    } catch (e) {
      console.error("Failed to save config", e);
    } finally {
      setIsSaving(false);
    }
  };

  const syncLiveStatus = async () => {
    if (channels.length === 0) {
      setHasStarted(true);
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-entertainment/twitch-watch/live-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels })
      });
      if (res.ok) {
        const data = await res.json();
        setLiveChannels(data.live_channels || []);
        if (data.live_channels.length > 0 && !data.live_channels.includes(selectedChannel)) {
          setSelectedChannel(data.live_channels[0]);
        }
      }
    } catch (e) {
      console.error("Failed to sync live status", e);
    } finally {
      setIsSyncing(false);
      setHasStarted(true);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (mode === "watch" && channels.length > 0 && !hasStarted) {
      syncLiveStatus();
    }
  }, [mode, channels, hasStarted]);

  useEffect(() => {
    if (mode === "watch" && hasStarted) {
      const interval = setInterval(() => {
        syncLiveStatus();
      }, refreshInterval * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [mode, hasStarted, refreshInterval, channels]);

  const handleAddChannel = async () => {
    const clean = newChannel.trim().toLowerCase();
    if (clean && !channels.includes(clean)) {
      const updated = [...channels, clean];
      await saveConfig(updated);
      setNewChannel("");
    }
  };

  const handleRemoveChannel = async (ch: string) => {
    const updated = channels.filter(c => c !== ch);
    await saveConfig(updated);
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    
    const items = [...channels];
    const draggedItem = items[draggedIdx];
    items.splice(draggedIdx, 1);
    items.splice(idx, 0, draggedItem);
    
    setChannels(items);
    setDraggedIdx(idx);
  };

  const handleDragEnd = async () => {
    setDraggedIdx(null);
    await saveConfig(channels);
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-purple-500/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
            <Tv size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Twitch Watch</h1>
            <p className="text-zinc-400 text-sm font-medium mt-1">Monitor streamers and watch live</p>
          </div>
        </div>
        
        <div className="flex bg-zinc-900 border border-white/10 rounded-lg p-1">
          <button 
            onClick={() => setMode("config")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === "config" ? "bg-purple-500 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <Settings size={16} /> Configuration
          </button>
          <button 
            onClick={() => {
              setMode("watch");
              if (!hasStarted) syncLiveStatus();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === "watch" ? "bg-purple-500 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <MonitorPlay size={16} /> Watch Stream
          </button>
        </div>
      </div>

      {mode === "config" && (
        <div className="max-w-3xl mx-auto space-y-8 animate-slide-up">
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-6">General Settings</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Auto-Refresh Interval (minutes)</label>
                <input 
                  type="number"
                  min="1"
                  max="15"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Embed Parent Domain</label>
                <input 
                  type="text"
                  value={embedParent}
                  onChange={(e) => setEmbedParent(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none"
                  placeholder="localhost"
                />
                <p className="text-xs text-zinc-500 mt-2">Change to your host IP if accessing from another device (e.g. 192.168.1.50)</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Manage Channels</h2>
              {isSaving && <span className="text-sm text-purple-400 animate-pulse">Saving...</span>}
            </div>
            
            <div className="flex gap-2 mb-8">
              <input 
                type="text"
                placeholder="Add new channel (e.g. shroud)"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()}
                className="flex-1 bg-zinc-950 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none"
              />
              <Button variant="primary" onClick={handleAddChannel} className="bg-purple-500 hover:bg-purple-600 h-[50px] px-6">
                <Plus size={20} /> Add
              </Button>
            </div>

            {channels.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-white/10 rounded-xl text-zinc-500">
                No channels tracked yet.
              </div>
            ) : (
              <div>
                <p className="text-sm text-zinc-400 mb-4">Drag and drop to reorder priority. Top = highest priority.</p>
                <div className="space-y-2">
                  {channels.map((ch, idx) => (
                    <div 
                      key={ch}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center justify-between p-3 rounded-xl border border-white/10 bg-zinc-950/50 group hover:border-purple-500/30 transition-all cursor-move ${draggedIdx === idx ? 'opacity-50 border-purple-500 border-dashed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical size={18} className="text-zinc-600 group-hover:text-purple-400" />
                        <span className="font-medium text-white">{ch}</span>
                      </div>
                      <button 
                        onClick={() => handleRemoveChannel(ch)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="danger" onClick={() => saveConfig([])}>
                    Clear All
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "watch" && (
        <div className="h-[calc(100vh-160px)] flex flex-col animate-slide-up">
          {!hasStarted && channels.length > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-purple-500/20 rounded-full mb-4">
                <MonitorPlay size={32} className="text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Booting up Twitch Watch...</h2>
              <p className="text-zinc-400">Checking live statuses.</p>
            </div>
          ) : channels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <p className="text-zinc-400 text-lg">Add Twitch channels in the Configuration tab to start monitoring.</p>
            </div>
          ) : liveChannels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-zinc-900/50 rounded-full mb-4">
                <Tv size={32} className="text-zinc-600" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No tracked channels are live</h2>
              <p className="text-zinc-400 max-w-md mx-auto">
                Monitoring: {channels.join(', ')}
              </p>
              <Button variant="secondary" onClick={syncLiveStatus} isLoading={isSyncing} className="mt-6" icon={isSyncing ? undefined : <RefreshCw size={16} />}>
                Force Sync
              </Button>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 bg-zinc-900/50 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="font-bold text-white">Live Now</span>
                  </div>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="bg-zinc-950 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-purple-500 outline-none w-[200px]"
                  >
                    {liveChannels.map(ch => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
                
                <Button variant="secondary" onClick={syncLiveStatus} isLoading={isSyncing} className="h-9" icon={isSyncing ? undefined : <RefreshCw size={14} />}>
                  Sync Status
                </Button>
              </div>

              {selectedChannel && (
                <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
                  <div className="flex-[3] bg-black rounded-xl overflow-hidden border border-white/10 min-h-[400px]">
                    <iframe
                      src={`https://player.twitch.tv/?channel=${selectedChannel}&parent=${embedParent}`}
                      height="100%"
                      width="100%"
                      allowFullScreen
                      className="border-none w-full h-full"
                    />
                  </div>
                  <div className="flex-[1] bg-black rounded-xl overflow-hidden border border-white/10 min-h-[400px] lg:min-h-0">
                    <iframe
                      src={`https://www.twitch.tv/embed/${selectedChannel}/chat?parent=${embedParent}`}
                      height="100%"
                      width="100%"
                      className="border-none w-full h-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
