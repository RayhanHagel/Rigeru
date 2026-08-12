"use client";
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/Button';

import toast from 'react-hot-toast';
import { Icon } from "@/lib/utils";

export default function LanRadarPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [statusRes, devicesRes] = await Promise.all([
        fetch('http://localhost:8000/api/system/lan/status'),
        fetch('http://localhost:8000/api/system/lan/devices')
      ]);
      
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIsRunning(statusData.is_running);
      }
      
      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        setDevices(devicesData.devices || []);
      }
    } catch (e) {
      console.error("Failed to fetch lan data:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const startTracking = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/lan/start', { method: 'POST' });
      if (res.ok) {
        toast.success("LAN Radar started");
        setIsRunning(true);
      }
    } catch (e) {
      toast.error("Failed to start radar");
    }
  };

  const stopTracking = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/lan/stop', { method: 'POST' });
      if (res.ok) {
        toast.success("LAN Radar stopped");
        setIsRunning(false);
      }
    } catch (e) {
      toast.error("Failed to stop radar");
    }
  };

  const clearDevices = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/lan/clear', { method: 'POST' });
      if (res.ok) {
        toast.success("Devices cleared");
        setDevices([]);
      }
    } catch (e) {
      toast.error("Failed to clear devices");
    }
  };

  const getDeviceIcon = (hostname: string) => {
    const hn = hostname.toLowerCase();
    if (hn.includes('phone') || hn.includes('iphone') || hn.includes('android')) return <Icon name="smartphone" className="text-secondary" size={24} />;
    if (hn.includes('tv') || hn.includes('chromecast') || hn.includes('roku')) return <Icon name="desktop_windows" className="text-primary" size={24} />;
    if (hn.includes('server') || hn.includes('nas')) return <Icon name="dns" className="text-green-400" size={24} />;
    return <Icon name="desktop_windows" className="text-zinc-400" size={24} />;
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Local Network Radar</h1>
            <p className="text-zinc-400 text-sm font-medium">Discover devices connected to your Wi-Fi or Ethernet network.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isRunning && (
            <span className="flex items-center gap-2 text-sm text-green-400 font-medium px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-500/20 relative overflow-hidden">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
              Radar is Scanning
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            </span>
          )}
          <div className="flex gap-2 bg-black/20 p-1 rounded-xl">
            <Button 
              variant="primary" 
              onClick={startTracking}
              disabled={isRunning}
              className={isRunning ? "opacity-50" : ""}
              icon={<Icon name="power_settings_new" size={16} />}
            >
              Scan
            </Button>
            <Button 
              variant="danger" 
              onClick={stopTracking}
              disabled={!isRunning}
              className={!isRunning ? "opacity-50" : ""}
              icon={<Icon name="power_settings_new" size={16} />}
            >
              Stop
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-6 flex flex-col bg-zinc-950/50 rounded-xl border border-white/10 shadow-2xl overflow-hidden relative">
        {/* Radar Animation Background Overlay */}
        {isRunning && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-green-500/30 rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-green-500/20 rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-green-500/10 rounded-full" />
            
            {/* Sweeping line */}
            <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] origin-top-left -mt-[400px] animate-[spin_4s_linear_infinite] bg-gradient-to-br from-green-500/40 via-green-500/5 to-transparent" />
          </div>
        )}

        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0 relative z-10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium text-zinc-200">Network Topology</h3>
            <span className="text-xs font-mono text-zinc-500 bg-black/40 px-2 py-1 rounded-md">{devices.length} devices found</span>
          </div>
          <Button variant="ghost" className="!p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={clearDevices} title="Clear Devices">
            <Icon name="delete" size={16} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar">
          {devices.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500">
              <Icon name="radio" size={48} className="mb-4 opacity-20" />
              <p>No devices detected. Click Scan to search your local network.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {devices.map((device, idx) => (
                <div key={device.mac + idx} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-4 hover:bg-white/10 transition-colors">
                  <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                    {getDeviceIcon(device.hostname)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-zinc-200 truncate" title={device.hostname !== "Unknown" ? device.hostname : "Unknown Device"}>
                      {device.hostname !== "Unknown" ? device.hostname : "Unknown Device"}
                    </h4>
                    <div className="text-xs font-mono text-zinc-400 mt-1">{device.ip}</div>
                    <div className="text-[10px] font-mono text-zinc-600 mt-0.5">{device.mac}</div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{device.type}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_#4ade80]" />
                        <span className="text-[10px] text-zinc-500">Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
