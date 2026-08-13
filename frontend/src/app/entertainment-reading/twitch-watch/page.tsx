"use client";
import { Header } from "@/components/ui/Header";

import React, { useEffect, useState, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Icon } from "@/lib/utils";

interface StreamlinkStatus {
    installed: boolean;
    version: string | null;
    error: string | null;
}

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

  // Streamlink state
  const [streamlinkStatus, setStreamlinkStatus] = useState<StreamlinkStatus | null>(null);
  const [isInstallingStreamlink, setIsInstallingStreamlink] = useState(false);
  const [isLaunchingStreamlink, setIsLaunchingStreamlink] = useState(false);

  // DND state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const fetchConfig = async () => {
    try {
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      const res = await fetch(`http://${host}:8000/api/media-entertainment/twitch-watch`);
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (e) {
      console.error("Failed to load config", e);
    }
  };

  const saveConfig = async (newChannels: string[]) => {
    setIsSaving(true);
    try {
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      await fetch(`http://${host}:8000/api/media-entertainment/twitch-watch/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: newChannels })
      });
    } catch (e) {
      console.error("Failed to save config", e);
    } finally {
      setIsSaving(false);
    }
  };

  const syncLiveStatus = async () => {
    if (channels.length === 0) return;
    setIsSyncing(true);
    try {
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      const res = await fetch(`http://${host}:8000/api/media-entertainment/twitch-watch/live-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels })
      });
      if (res.ok) {
        const data = await res.json();
        setLiveChannels(data.live_channels || []);
        
        // Auto select highest priority live channel if nothing selected
        if (!selectedChannel && data.live_channels.length > 0) {
            setSelectedChannel(data.live_channels[0]);
        } else if (selectedChannel && !data.live_channels.includes(selectedChannel)) {
            // currently selected channel went offline
            setSelectedChannel(data.live_channels.length > 0 ? data.live_channels[0] : "");
        }
      }
    } catch (e) {
      console.error("Failed to sync live status", e);
    } finally {
      setIsSyncing(false);
      setHasStarted(true);
    }
  };

  const checkStreamlinkStatus = async () => {
    try {
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      const res = await fetch(`http://${host}:8000/api/media-entertainment/twitch-watch/streamlink/status`);
      if (res.ok) {
        const data = await res.json();
        setStreamlinkStatus(data);
      }
    } catch (e) {
      console.error("Failed to check streamlink status", e);
    }
  };

  const installStreamlink = async () => {
    setIsInstallingStreamlink(true);
    try {
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      await fetch(`http://${host}:8000/api/media-entertainment/twitch-watch/streamlink/install`, { method: "POST" });
      await checkStreamlinkStatus();
    } catch (e) {
      console.error("Failed to install streamlink", e);
    } finally {
      setIsInstallingStreamlink(false);
    }
  };

  const launchStreamlink = async () => {
    if (!selectedChannel) return;
    setIsLaunchingStreamlink(true);
    try {
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      await fetch(`http://${host}:8000/api/media-entertainment/twitch-watch/streamlink/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: selectedChannel })
      });
    } catch (e) {
      console.error("Failed to launch streamlink", e);
    } finally {
      setIsLaunchingStreamlink(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    checkStreamlinkStatus();
  }, []);

  // Polling for live status
  useEffect(() => {
    if (mode === "watch" && channels.length > 0) {
      if (!hasStarted) syncLiveStatus();
      
      const interval = setInterval(syncLiveStatus, refreshInterval * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [mode, channels, refreshInterval]);

  const handleAddChannel = async () => {
    if (!newChannel.trim()) return;
    const cleanChannel = newChannel.trim().toLowerCase();
    if (channels.includes(cleanChannel)) return;
    
    const newChannels = [...channels, cleanChannel];
    setChannels(newChannels);
    setNewChannel("");
    await saveConfig(newChannels);
  };

  const handleRemoveChannel = async (channel: string) => {
    const newChannels = channels.filter(c => c !== channel);
    setChannels(newChannels);
    await saveConfig(newChannels);
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    
    const newChannels = [...channels];
    const draggedItem = newChannels[draggedIdx];
    
    newChannels.splice(draggedIdx, 1);
    newChannels.splice(idx, 0, draggedItem);
    
    setChannels(newChannels);
    setDraggedIdx(idx);
  };

  const handleDragEnd = async () => {
    setDraggedIdx(null);
    await saveConfig(channels);
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header 
        title="Twitch Watch" 
        subtitle="Monitor streamers and watch live" 
        actions={
          <ModernTabs 
            tabs={[
              { id: "config", label: "Configuration", icon: <Icon name="settings" size={18} /> },
              { id: "watch", label: "Watch Stream", icon: <Icon name="tv" size={18} /> }
            ]}
            activeTab={mode}
            setActiveTab={(id) => {
              setMode(id as "config" | "watch");
              if (id === "watch" && !hasStarted) syncLiveStatus();
            }}
          />
        }
      />

      <ModernTabContent activeTab={mode} className="flex-1 min-h-0 flex flex-col w-full">
        {mode === "config" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6 backdrop-blur-md shadow-sm space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Icon name="settings" size={20} className="text-[var(--theme-text)]" /> General Settings
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--theme-text)]">Auto-Refresh Interval (minutes)</label>
                <input 
                  type="number" 
                  min="1"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="w-full rounded-xl p-3 outline-none transition-all border"
                  style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--theme-text)]">Embed Parent Domain</label>
                <input 
                  type="text" 
                  value={embedParent}
                  onChange={(e) => setEmbedParent(e.target.value)}
                  className="w-full rounded-xl p-3 outline-none transition-all border"
                  style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                  placeholder="localhost"
                />
                <p className="text-[11px] text-[var(--theme-text)] opacity-80">Change to your host IP if accessing from another device (e.g. 192.168.1.50)</p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl p-6 backdrop-blur-md shadow-sm flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Icon name="tv" size={20} className="text-[var(--theme-heading)]" /> Manage Channels
              </h2>
              {isSaving && <span className="text-xs text-[var(--theme-heading)] animate-pulse bg-[var(--theme-heading)]/10 px-2 py-1 rounded-md">Saving...</span>}
            </div>
            
            <div className="flex gap-2 mb-6 shrink-0">
              <input 
                type="text"
                placeholder="Add new channel (e.g. shroud)"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()}
                className="flex-1 rounded-xl p-3 outline-none transition-all border"
                style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
              />
              <Button variant="primary" onClick={handleAddChannel} className="h-[50px] px-6 rounded-xl">
                <Icon name="add" size={20} /> Add
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0 space-y-2">
              {channels.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-[var(--theme-ui-border)] rounded-xl text-[var(--theme-text)] bg-[var(--theme-bg)]">
                  No channels tracked yet. Add one above.
                </div>
              ) : (
                <div className="space-y-2 pb-4">
                  <p className="text-[11px] font-medium text-[var(--theme-text)] opacity-80 uppercase tracking-wider mb-3">Drag to reorder priority (Top = highest)</p>
                  {channels.map((channel, idx) => (
                    <div 
                      key={channel}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${draggedIdx === idx ? 'bg-[var(--theme-heading)]/10 border-[var(--theme-heading)]/40 opacity-50' : 'bg-[var(--theme-bg)] border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)]/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon name="drag_indicator" size={16} className="text-[var(--theme-text)] cursor-grab active:cursor-grabbing" />
                        <span className="font-medium">{channel}</span>
                      </div>
                      <button onClick={() => handleRemoveChannel(channel)} className="p-2 text-[var(--theme-text)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {mode === "watch" && (
          <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          
          {/* Sidebar */}
          <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] shadow-sm rounded-2xl overflow-hidden flex flex-col max-h-[400px] lg:max-h-full">
              <div className="p-4 border-b border-[var(--theme-ui-border)] bg-[var(--theme-bg)] flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Live Channels
                </h3>
                <button 
                  onClick={syncLiveStatus} 
                  disabled={isSyncing}
                  className={`text-[var(--theme-text)] hover:text-[var(--theme-heading)] transition-colors p-1.5 rounded-md hover:bg-white/5 ${isSyncing ? 'animate-spin opacity-50' : ''}`}
                >
                  <Icon name="refresh" size={14} />
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 custom-scrollbar p-2">
                {channels.length === 0 ? (
                  <div className="text-center p-4 text-xs text-[var(--theme-text)]">No channels configured.</div>
                ) : isSyncing && liveChannels.length === 0 ? (
                  <div className="text-center p-4 text-xs text-[var(--theme-text)] flex items-center justify-center gap-2">
                    <Icon name="refresh" size={12} className="animate-spin" /> Checking status...
                  </div>
                ) : liveChannels.length === 0 ? (
                  <div className="text-center p-4 text-xs text-[var(--theme-text)]">None of your tracked channels are live.</div>
                ) : (
                  <div className="space-y-1">
                    {channels.filter(c => liveChannels.includes(c)).map(channel => (
                      <button
                        key={channel}
                        onClick={() => setSelectedChannel(channel)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${selectedChannel === channel ? 'bg-[var(--theme-heading)]/10 text-[var(--theme-heading)] font-bold border border-[var(--theme-heading)]/30' : 'text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-white/5 border border-transparent'}`}
                      >
                        <img 
                          src={`https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-320x180.jpg`} 
                          alt={channel}
                          className="w-12 h-8 object-cover rounded-md bg-[var(--theme-bg)] border border-[var(--theme-ui-border)]"
                          onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjMTgxODE4Ij48cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIvPjwvc3ZnPg=='; }}
                        />
                        <span className="truncate">{channel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] shadow-sm rounded-2xl p-4 flex flex-col gap-3">
              <h3 className="font-semibold text-sm">
                Open in Streamlink
              </h3>
              
              {!streamlinkStatus ? (
                <div className="text-xs text-[var(--theme-text)] flex items-center gap-2"><Icon name="refresh" size={12} className="animate-spin" /> Checking streamlink...</div>
              ) : !streamlinkStatus.installed ? (
                <div className="space-y-2">
                  <div className="text-[11px] text-red-400 bg-red-400/10 p-2 rounded-lg border border-red-400/20 flex items-start gap-2">
                    <Icon name="error" size={14} className="shrink-0 mt-0.5" />
                    <span>Streamlink is not installed or not in PATH. Required to open streams externally.</span>
                  </div>
                  <Button 
                    variant="primary" 
                    className="w-full text-xs py-2 h-auto"
                    onClick={installStreamlink}
                    disabled={isInstallingStreamlink}
                  >
                    {isInstallingStreamlink ? "Installing..." : "Install Streamlink via pip"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] text-green-400 flex items-center gap-1.5 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> Streamlink {streamlinkStatus.version} ready
                  </div>
                  <Button 
                    variant="secondary" 
                    className="w-full h-10"
                    onClick={launchStreamlink}
                    disabled={!selectedChannel || isLaunchingStreamlink}
                  >
                    {isLaunchingStreamlink ? "Launching..." : "Launch External Player"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Player Area */}
          <div className="flex-1 w-full lg:w-auto bg-[var(--theme-bg)] rounded-2xl border border-[var(--theme-ui-border)] overflow-hidden relative shadow-md aspect-video">
            {!selectedChannel ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--theme-text)] gap-4">
                <Icon name="tv" size={48} className="opacity-20" />
                <p>Select a live channel from the sidebar to start watching</p>
              </div>
            ) : (
              <iframe
                src={`https://player.twitch.tv/?channel=${selectedChannel}&parent=${embedParent}`}
                height="100%"
                width="100%"
                allowFullScreen={true}
                className="flex-1 w-full h-full border-0"
              />
            )}
          </div>
          
        </div>
        )}
      </ModernTabContent>
    </div>
  );
}
