"use client";
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';


import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/TextInput';
import toast from 'react-hot-toast';

// Dynamically import Map to prevent SSR issues with Leaflet
import { Icon } from "@/lib/utils";
const MapComponent = dynamic(() => import('./Map'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900/50 rounded-xl border border-white/5">
      <Icon name="refresh" className="animate-spin text-zinc-500" size={24} />
    </div>
  )
});

interface Device {
  mac: string;
  name: string;
  first_seen: number;
  last_seen: number;
  last_lat: number | null;
  last_lon: number | null;
}

export default function BluetoothTrackerPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastLocation, setLastLocation] = useState<{lat: number | null, lon: number | null}>({ lat: null, lon: null });
  const [loading, setLoading] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState("");
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [deviceHistory, setDeviceHistory] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [statusRes, devicesRes] = await Promise.all([
        fetch('http://localhost:8000/api/system/bluetooth/status'),
        fetch('http://localhost:8000/api/system/bluetooth/devices')
      ]);
      
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIsRunning(statusData.is_running);
        if (statusData.last_location?.lat) {
          setLastLocation(statusData.last_location);
        }
      }
      
      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        setDevices(devicesData.devices || []);
      }
    } catch (e) {
      console.error("Failed to fetch bluetooth data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 5 seconds if running
    const interval = setInterval(() => {
      if (isRunning) fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const startTracking = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/bluetooth/start', { method: 'POST' });
      if (res.ok) {
        setIsRunning(true);
        toast.success("Tracking Started");
      }
    } catch (e) {
      toast.error("Failed to start tracking");
    }
  };

  const stopTracking = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/bluetooth/stop', { method: 'POST' });
      if (res.ok) {
        setIsRunning(false);
        toast.success("Tracking Stopped");
      }
    } catch (e) {
      toast.error("Failed to stop tracking");
    }
  };

  const clearHistory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/bluetooth/clear', { method: 'POST' });
      if (res.ok) {
        setDevices([]);
        toast.success("History Cleared");
      }
    } catch (e) {
      toast.error("Failed to clear history");
    }
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`http://localhost:8000/api/system/bluetooth/search-location?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
      if (data.length === 0) {
        toast.error("No places found");
      }
    } catch (e) {
      toast.error("Failed to search location");
    } finally {
      setSearching(false);
    }
  };

  const toggleDeviceHistory = async (mac: string) => {
    if (expandedDevice === mac) {
      setExpandedDevice(null);
      return;
    }
    setExpandedDevice(mac);
    setDeviceHistory([]);
    try {
      const res = await fetch(`http://localhost:8000/api/system/bluetooth/history/${mac}`);
      if (res.ok) {
        const data = await res.json();
        setDeviceHistory(data.history || []);
      }
    } catch (e) {
      toast.error("Failed to fetch history");
    }
  };

  const selectLocation = async (lat: number, lon: number) => {
    try {
      const res = await fetch('http://localhost:8000/api/system/bluetooth/set-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon })
      });
      if (res.ok) {
        toast.success("Location updated");
        setShowLocationModal(false);
        fetchData();
      } else {
        toast.error("Failed to update location");
      }
    } catch (e) {
      toast.error("Failed to update location");
    }
  };

  const useBrowserLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          selectLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => toast.error("Browser location failed: " + error.message)
      );
    } else {
      toast.error("Browser location not supported");
    }
  };


  // Default center if no location known
  const center: [number, number] = lastLocation.lat && lastLocation.lon 
    ? [lastLocation.lat, lastLocation.lon] 
    : [0, 0];

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header 
        title="Bluetooth Tracker"
        subtitle="Track nearby Bluetooth devices and map their locations."
        actions={
          <div className="flex items-center bg-[var(--theme-ui-bg)] p-1.5 rounded-xl border border-[var(--theme-ui-border)] backdrop-blur-md shadow-sm">
            {isRunning && (
              <span className="text-sm font-medium px-3 text-green-400">
                Bluetooth tracker is ON
              </span>
            )}
            <Button 
              variant="secondary" 
              onClick={() => setShowLocationModal(true)}
              icon={<Icon name="location_on" size={16} />}
              className="text-sm"
            >
              Set Location
            </Button>
            <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1" />
            <Button 
              variant="primary" 
              onClick={startTracking}
              disabled={isRunning}
              className={isRunning ? "opacity-50 text-sm" : "text-sm"}
              icon={<Icon name="power_settings_new" size={16} />}
            >
              Start
            </Button>
            <div className="w-px h-4 bg-[var(--theme-ui-border)] mx-1" />
            <Button 
              variant="danger" 
              onClick={stopTracking}
              disabled={!isRunning}
              className={!isRunning ? "opacity-50 text-sm" : "text-sm"}
              icon={<Icon name="power_settings_new" size={16} />}
            >
              Stop
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6 w-full flex-1 min-h-0">
        {/* Devices List Section */}
        <div className="w-full h-96 shrink-0 flex flex-col gap-4 overflow-hidden bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] p-6 shadow-sm">
          <div className="flex items-center justify-between px-2 shrink-0">
            <h3 className="text-sm font-medium text-[var(--theme-text)]">Detected Devices ({devices.length})</h3>
            <div className="flex gap-2">
              <Button variant="secondary" className="text-red-400 hover:text-red-300" onClick={clearHistory} title="Clear History" icon={<Icon name="delete" size={14} />}>
                Clear
              </Button>
              <Button variant="secondary" onClick={fetchData} title="Refresh" icon={<Icon name="refresh" size={14} className={loading ? "animate-spin" : ""} />}>
                Refresh
              </Button>
            </div>
          </div>
          
          <div className="shrink-0 px-1 relative">
            <Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--theme-text)]" />
            <input 
              value={deviceSearchQuery}
              onChange={(e) => setDeviceSearchQuery(e.target.value)}
              placeholder="Search by name or MAC..."
              className="w-full rounded-xl pl-10 pr-4 py-3 outline-none transition-all border"
              style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)", color: "var(--theme-heading)" }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4">
            {devices
              .filter(d => 
                d.name?.toLowerCase().includes(deviceSearchQuery.toLowerCase()) || 
                d.mac?.toLowerCase().includes(deviceSearchQuery.toLowerCase())
              )
              .map((device) => {
              const isActive = (Date.now() / 1000) - device.last_seen < 30; // Seen in last 30s
              return (
                <div 
                  key={device.mac} 
                  className={`p-4 rounded-xl border transition-all cursor-pointer hover:border-[var(--theme-heading)] hover:shadow-md ${isActive ? 'bg-[var(--theme-bg)] border-[var(--theme-heading)]/50' : 'bg-[var(--theme-bg)] border-[var(--theme-ui-border)]'}`}
                  onClick={() => toggleDeviceHistory(device.mac)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-[var(--theme-heading)] truncate pr-4" title={device.name}>{device.name}</h4>
                    <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${isActive ? 'bg-[var(--theme-heading)] shadow-[0_0_8px_var(--theme-heading)]' : 'bg-[var(--theme-ui-border)]'}`} title={isActive ? "Currently in range" : "Out of range"} />
                  </div>
                  <div className="text-xs text-[var(--theme-text)] font-mono mb-3">{device.mac}</div>
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--theme-text)]">First seen:</span>
                      <span className="text-[var(--theme-heading)]">{new Date(device.first_seen * 1000).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--theme-text)]">Last seen:</span>
                      <span className="text-[var(--theme-heading)]">{new Date(device.last_seen * 1000).toLocaleString()}</span>
                    </div>
                    {device.last_lat && device.last_lon && (
                      <div className="flex justify-between">
                        <span className="text-[var(--theme-text)]">Location:</span>
                        <span className="text-[var(--theme-heading)] font-mono text-[10px]">
                          {device.last_lat.toFixed(4)}, {device.last_lon.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {expandedDevice === device.mac && (
                    <div className="mt-4 pt-4 border-t border-[var(--theme-ui-border)]">
                      <h5 className="text-xs font-medium text-[var(--theme-text)] mb-2">Location History</h5>
                      {deviceHistory.length === 0 ? (
                        <div className="text-xs text-[var(--theme-text)]">Loading history...</div>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                          {deviceHistory.map((h, i) => (
                            <div key={i} className="text-[10px] bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] p-2 rounded-lg flex justify-between items-center">
                              <span className="text-[var(--theme-text)]">{new Date(h.timestamp * 1000).toLocaleString()}</span>
                              <span className="text-[var(--theme-heading)] font-mono">
                                {h.lat !== null && h.lon !== null ? `${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}` : 'Unknown'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {devices.length === 0 && !loading && (
              <div className="p-8 text-center border border-dashed border-[var(--theme-ui-border)] rounded-xl text-[var(--theme-text)]">
                No devices detected yet.
              </div>
            )}
            {devices.length > 0 && devices.filter(d => d.name?.toLowerCase().includes(deviceSearchQuery.toLowerCase()) || d.mac?.toLowerCase().includes(deviceSearchQuery.toLowerCase())).length === 0 && (
              <div className="p-8 text-center border border-dashed border-[var(--theme-ui-border)] rounded-xl text-[var(--theme-text)]">
                No devices match your search.
              </div>
            )}
          </div>
        </div>

        {/* Map Section */}
        <div className="w-full min-h-[600px] flex-1 relative rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-bg)] shadow-sm flex flex-col overflow-hidden">
          {center[0] === 0 && center[1] === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--theme-bg)]/80 backdrop-blur-sm text-center p-6">
              <Icon name="location_on" className="text-[var(--theme-text)] mb-4" size={48} />
              <h3 className="text-lg font-medium text-[var(--theme-heading)] mb-2">Location Unavailable</h3>
              <p className="text-[var(--theme-text)] text-sm max-w-md">
                We haven't detected your location yet. Set a custom location to see the map.
              </p>
            </div>
          )}
          <MapComponent devices={devices} center={center} />
        </div>
      </div>

      {/* Manual Location Modal */}
      {showLocationModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-[800px] h-[calc(100vh-4rem)] p-6 flex flex-col animate-scale-in bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[var(--theme-heading)]">Search Location</h3>
              <button 
                onClick={() => setShowLocationModal(false)}
                className="text-[var(--theme-text)] hover:text-[var(--theme-heading)] transition-colors p-1"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <input 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && searchLocation()}
                  placeholder="Enter city or address..."
                  className="w-full rounded-xl pl-4 pr-4 py-3 outline-none transition-all border text-[var(--theme-heading)]"
                  style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                />
              </div>
              <Button variant="primary" onClick={searchLocation} disabled={searching} className="!px-6">
                {searching ? <Icon name="refresh" className="animate-spin" size={20} /> : <Icon name="search" size={20} />}
              </Button>
            </div>
            
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar p-3 border border-[var(--theme-ui-border)] bg-[var(--theme-bg)] rounded-xl">
              {searchResults.length > 0 ? (
                searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectLocation(parseFloat(result.lat), parseFloat(result.lon))}
                    className="text-left p-3 rounded-lg bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] transition-colors text-sm text-[var(--theme-text)] hover:text-[var(--theme-heading)] shrink-0"
                  >
                    {result.display_name}
                  </button>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-[var(--theme-text)] text-sm h-full">
                  {searching ? "Searching..." : "No results yet. Enter a location above."}
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6 pt-6 border-t border-[var(--theme-ui-border)] shrink-0">
              <Button variant="secondary" className="flex-1" onClick={() => setShowLocationModal(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={useBrowserLocation} icon={<Icon name="my_location" size={16} />}>Use Browser Location</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
