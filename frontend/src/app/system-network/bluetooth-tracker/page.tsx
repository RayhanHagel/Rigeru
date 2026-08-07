"use client";
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import { Network, Power, Settings2, RefreshCw, MapPin, Crosshair, Search, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/TextInput';
import toast from 'react-hot-toast';

// Dynamically import Map to prevent SSR issues with Leaflet
const MapComponent = dynamic(() => import('./Map'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900/50 rounded-xl border border-white/5">
      <RefreshCw className="animate-spin text-zinc-500" size={24} />
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Bluetooth Tracker</h1>
            <p className="text-zinc-400 text-sm font-medium">Track nearby Bluetooth devices and map their locations.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isRunning && (
            <span className="text-sm text-green-400 font-medium px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-500/20">
              Bluetooth tracker is ON
            </span>
          )}
          <Button 
            variant="secondary" 
            onClick={() => setShowLocationModal(true)}
            icon={<MapPin size={16} />}
          >
            Set Location
          </Button>
          <div className="flex gap-2 bg-black/20 p-1 rounded-xl">
            <Button 
              variant="primary" 
              onClick={startTracking}
              disabled={isRunning}
              className={isRunning ? "opacity-50" : ""}
              icon={<Power size={16} />}
            >
              Start
            </Button>
            <Button 
              variant="danger" 
              onClick={stopTracking}
              disabled={!isRunning}
              className={!isRunning ? "opacity-50" : ""}
              icon={<Power size={16} />}
            >
              Stop
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full flex-1 min-h-0">
        {/* Devices List Section */}
        <div className="w-full h-96 shrink-0 flex flex-col gap-4 overflow-hidden bg-zinc-950/50 rounded-xl border border-white/10 p-6 shadow-2xl">
          <div className="flex items-center justify-between px-2 shrink-0">
            <h3 className="text-sm font-medium text-zinc-400">Detected Devices ({devices.length})</h3>
            <div className="flex gap-1">
              <Button variant="ghost" className="!p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={clearHistory} title="Clear History">
                <Trash2 size={14} />
              </Button>
              <Button variant="ghost" className="!p-2" onClick={fetchData} title="Refresh">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
          
          <div className="shrink-0 px-1">
            <TextInput 
              value={deviceSearchQuery}
              onChange={(e) => setDeviceSearchQuery(e.target.value)}
              placeholder="Search by name or MAC..."
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
                  className={`p-4 rounded-xl border transition-all cursor-pointer hover:border-white/20 ${isActive ? 'bg-secondary/10 border-secondary/30' : 'bg-white/5 border-white/10'}`}
                  onClick={() => toggleDeviceHistory(device.mac)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-zinc-200 truncate pr-4" title={device.name}>{device.name}</h4>
                    <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-zinc-600'}`} title={isActive ? "Currently in range" : "Out of range"} />
                  </div>
                  <div className="text-xs text-zinc-500 font-mono mb-3">{device.mac}</div>
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-600">First seen:</span>
                      <span className="text-zinc-400">{new Date(device.first_seen * 1000).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Last seen:</span>
                      <span className="text-zinc-400">{new Date(device.last_seen * 1000).toLocaleString()}</span>
                    </div>
                    {device.last_lat && device.last_lon && (
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Location:</span>
                        <span className="text-zinc-400 font-mono text-[10px]">
                          {device.last_lat.toFixed(4)}, {device.last_lon.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {expandedDevice === device.mac && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h5 className="text-xs font-medium text-zinc-400 mb-2">Location History</h5>
                      {deviceHistory.length === 0 ? (
                        <div className="text-xs text-zinc-600">Loading history...</div>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                          {deviceHistory.map((h, i) => (
                            <div key={i} className="text-[10px] bg-black/20 p-2 rounded flex justify-between items-center">
                              <span className="text-zinc-300">{new Date(h.timestamp * 1000).toLocaleString()}</span>
                              <span className="text-zinc-500 font-mono">
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
              <div className="p-8 text-center border border-dashed border-white/10 rounded-xl text-zinc-500">
                No devices detected yet.
              </div>
            )}
            {devices.length > 0 && devices.filter(d => d.name?.toLowerCase().includes(deviceSearchQuery.toLowerCase()) || d.mac?.toLowerCase().includes(deviceSearchQuery.toLowerCase())).length === 0 && (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-xl text-zinc-500">
                No devices match your search.
              </div>
            )}
          </div>
        </div>

        {/* Map Section */}
        <div className="w-full min-h-[600px] flex-1 relative rounded-xl border border-white/10 bg-zinc-950/50 shadow-2xl flex flex-col overflow-hidden">
          {center[0] === 0 && center[1] === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-center p-6">
              <MapPin className="text-zinc-500 mb-4" size={48} />
              <h3 className="text-lg font-medium text-white mb-2">Location Unavailable</h3>
              <p className="text-zinc-400 text-sm max-w-md">
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
          <Card className="w-[800px] h-[calc(100vh-4rem)] p-6 flex flex-col animate-scale-in">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium text-white">Search Location</h3>
              <button 
                onClick={() => setShowLocationModal(false)}
                className="text-zinc-400 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <TextInput 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && searchLocation()}
                  placeholder="Enter city or address..."
                />
              </div>
              <Button variant="primary" onClick={searchLocation} disabled={searching} className="!px-4">
                {searching ? <RefreshCw className="animate-spin" size={20} /> : <Search size={20} />}
              </Button>
            </div>
            
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar mt-2 p-2 border border-white/5 bg-zinc-950/30 rounded-lg">
              {searchResults.length > 0 ? (
                searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectLocation(parseFloat(result.lat), parseFloat(result.lon))}
                    className="text-left p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 transition-colors text-sm text-zinc-300 shrink-0"
                  >
                    {result.display_name}
                  </button>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm h-full">
                  {searching ? "Searching..." : "No results yet. Enter a location above."}
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-4 pt-4 border-t border-white/5 shrink-0">
              <Button variant="ghost" className="flex-1" onClick={() => setShowLocationModal(false)}>Cancel</Button>
              <Button variant="secondary" className="flex-1" onClick={useBrowserLocation} icon={<Crosshair size={16} />}>Use Browser</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
