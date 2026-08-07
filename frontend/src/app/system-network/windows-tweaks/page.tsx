"use client";

import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { Settings, MapPin, Eye, FileText, Zap, Activity, Shield, Copy, X, TerminalSquare, ShieldAlert, Globe, Mic, Moon, Keyboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { PopupModal } from '@/components/ui/PopupModal';

const ICON_MAP: Record<string, React.ReactNode> = {
  "MapPin": <MapPin size={24} />,
  "Eye": <Eye size={24} />,
  "FileText": <FileText size={24} />,
  "Zap": <Zap size={24} />,
  "Activity": <Activity size={24} />,
  "Shield": <Shield size={24} />,
  "Globe": <Globe size={24} />,
  "Mic": <Mic size={24} />,
  "Moon": <Moon size={24} />,
  "Keyboard": <Keyboard size={24} />
};

export default function WindowsTweaksPage() {
  const [tweaks, setTweaks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTweak, setSelectedTweak] = useState<any | null>(null);

  const fetchTweaks = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/tweaks');
      if (res.ok) {
        const data = await res.json();
        setTweaks(data.tweaks);
      }
    } catch (e) {
      toast.error("Failed to load tweaks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTweaks();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Script copied to clipboard!");
  };

  const getStatusBadge = (status: string) => {
    if (status === "enabled") return <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md">Enabled</span>;
    if (status === "disabled") return <span className="text-xs px-2 py-1 bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 rounded-md">Disabled</span>;
    return <span className="text-xs px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-md">Unknown</span>;
  };

  const categories = Array.from(new Set(tweaks.map(t => t.category)));

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Windows Tweaker</h1>
            <p className="text-zinc-400 text-sm font-medium">View your system's current hidden settings and generate PowerShell scripts to toggle them effortlessly.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={fetchTweaks} icon={<Settings size={16} />}>Refresh Status</Button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500">Loading registry state...</div>
      ) : (
        <div className="flex flex-col gap-8 mt-6">
          {categories.map(cat => (
            <div key={cat as string}>
              <h3 className="text-lg font-medium text-white mb-4 border-b border-white/10 pb-2">{cat as string}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tweaks.filter(t => t.category === cat).map(t => (
                  <div key={t.id} className="bg-zinc-950/50 border border-white/10 rounded-xl p-5 hover:bg-white/5 transition-colors cursor-pointer group flex flex-col h-full shadow-lg" onClick={() => setSelectedTweak(t)}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-3 bg-black/40 rounded-lg border border-white/5 text-secondary group-hover:scale-110 transition-transform shadow-md">
                        {ICON_MAP[t.icon] || <Settings size={24} />}
                      </div>
                      {getStatusBadge(t.status)}
                    </div>
                    <h4 className="text-white font-medium mb-2">{t.title}</h4>
                    <p className="text-sm text-zinc-400 flex-1 leading-relaxed">{t.description}</p>
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-secondary/70 font-medium group-hover:text-secondary transition-colors">Click to configure</span>
                      <TerminalSquare size={16} className="text-zinc-600 group-hover:text-secondary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <PopupModal isOpen={!!selectedTweak} onClose={() => setSelectedTweak(null)} title={selectedTweak ? selectedTweak.title : ''}>
        {selectedTweak && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-500">Current Status:</span>
              {getStatusBadge(selectedTweak.status)}
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-200/90 text-sm">
              <ShieldAlert size={20} className="shrink-0 text-orange-400" />
              <p>
                To apply these changes, you must run the PowerShell scripts below with Administrator privileges. 
                <br/><br/>
                <b>Instructions:</b> Search for "PowerShell" in your Start Menu, right-click it, and select "Run as administrator". Then copy and paste your desired script below.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-green-400">Enable Script</h4>
                <Button variant="secondary" onClick={() => copyToClipboard(selectedTweak.enable_script)} icon={<Copy size={14} />} className="!py-1.5 !px-3 !text-xs">
                  Copy
                </Button>
              </div>
              <div className="relative group">
                <pre className="bg-black border border-white/10 rounded-xl p-4 text-xs font-mono text-zinc-300 overflow-x-auto custom-scrollbar whitespace-pre-wrap group-hover:border-green-500/30 transition-colors">
                  {selectedTweak.enable_script}
                </pre>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-red-400">Disable Script</h4>
                <Button variant="secondary" onClick={() => copyToClipboard(selectedTweak.disable_script)} icon={<Copy size={14} />} className="!py-1.5 !px-3 !text-xs">
                  Copy
                </Button>
              </div>
              <div className="relative group">
                <pre className="bg-black border border-white/10 rounded-xl p-4 text-xs font-mono text-zinc-300 overflow-x-auto custom-scrollbar whitespace-pre-wrap group-hover:border-red-500/30 transition-colors">
                  {selectedTweak.disable_script}
                </pre>
              </div>
            </div>
          </div>
        )}
      </PopupModal>
    </div>
  );
}
