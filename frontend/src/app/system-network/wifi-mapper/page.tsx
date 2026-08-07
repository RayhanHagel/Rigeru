"use client";
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { Wifi, Power, MapPin, Search, X, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { PopupModal } from '@/components/ui/PopupModal';

const MapComponent = dynamic(() => import('./Map'), { ssr: false });

export default function WifiMapperPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [networks, setNetworks] = useState<any[]>([]);
  const [lastLocation, setLastLocation] = useState<{lat: number | null, lon: number | null}>({lat: null, lon: null});
  
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [networkSearchQuery, setNetworkSearchQuery] = useState("");
  const [expandedNetwork, setExpandedNetwork] = useState<string | null>(null);
  const [networkHistory, setNetworkHistory] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [statusRes, networksRes] = await Promise.all([
        fetch('http://localhost:8000/api/system/wifi/status'),
        fetch('http://localhost:8000/api/system/wifi/networks')
      ]);
      
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIsRunning(statusData.is_running);
        if (statusData.last_location) {
          setLastLocation(statusData.last_location);
        }
      }
      
      if (networksRes.ok) {
        const networksData = await networksRes.json();
        setNetworks(networksData.networks || []);
      }
    } catch (e) {
      console.error("Failed to fetch wifi data:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const startTracking = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/wifi/start', { method: 'POST' });
      if (res.ok) {
        toast.success("Wi-Fi tracking started");
        setIsRunning(true);
      }
    } catch (e) {
      toast.error("Failed to start tracking");
    }
  };

  const stopTracking = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/wifi/stop', { method: 'POST' });
      if (res.ok) {
        toast.success("Wi-Fi tracking stopped");
        setIsRunning(false);
      }
    } catch (e) {
      toast.error("Failed to stop tracking");
    }
  };

  const clearHistory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/system/wifi/clear', { method: 'POST' });
      if (res.ok) {
        toast.success("History cleared");
        setNetworks([]);
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

  const toggleNetworkHistory = async (bssid: string) => {
    if (expandedNetwork === bssid) {
      setExpandedNetwork(null);
      return;
    }
    setExpandedNetwork(bssid);
    setNetworkHistory([]);
    try {
      const res = await fetch(`http://localhost:8000/api/system/wifi/history/${bssid}`);
      if (res.ok) {
        const data = await res.json();
        setNetworkHistory(data.history || []);
      }
    } catch (e) {
      toast.error("Failed to fetch history");
    }
  };

  const selectLocation = async (lat: number, lon: number) => {
    try {
      const res = await fetch('http://localhost:8000/api/system/wifi/set-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon })
      });
      if (res.ok) {
        toast.success("Location updated");
        setShowLocationModal(false);
        setLastLocation({ lat, lon });
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
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              Wi-Fi Network Mapper
            </h1>
            <p className="text-zinc-400 text-sm font-medium">Scan and map nearby Wi-Fi networks (Wardriving).</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isRunning && (
            <span className="text-sm text-green-400 font-medium px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-500/20">
              Wi-Fi tracker is ON
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

      <div className="flex-1 min-h-0 flex flex-col gap-6 w-full">
        {/* Map Section */}
        <div className="w-full h-[500px] relative rounded-xl border border-white/10 bg-zinc-950/50 shadow-2xl flex flex-col overflow-hidden shrink-0">
          {center[0] === 0 && center[1] === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-center p-6">
              <MapPin className="text-zinc-500 mb-4" size={48} />
              <h3 className="text-lg font-medium text-white mb-2">Location Unavailable</h3>
              <p className="text-zinc-400 text-sm max-w-md">
                We haven't detected your location yet. Set a custom location to see the map.
              </p>
            </div>
          )}
          <MapComponent networks={networks} center={center} />
        </div>

        {/* Networks List Section */}
        <div className="w-full flex-1 flex flex-col gap-4 overflow-hidden bg-zinc-950/50 rounded-xl border border-white/10 p-6 shadow-2xl min-h-[400px]">
          <div className="flex items-center justify-between px-2 shrink-0">
            <h3 className="text-sm font-medium text-zinc-400">Detected Networks ({networks.length})</h3>
            <div className="flex gap-1">
              <Button variant="ghost" className="!p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={clearHistory} title="Clear History">
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
          
          <div className="relative px-2 shrink-0">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Search SSID or BSSID..." 
              value={networkSearchQuery}
              onChange={(e) => setNetworkSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-secondary/50 transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4 pb-4">
            {networks.length === 0 ? (
              <div className="text-center text-zinc-500 text-sm py-8">
                No networks detected yet.
              </div>
            ) : (
              networks
                .filter(n => n.ssid.toLowerCase().includes(networkSearchQuery.toLowerCase()) || n.bssid.toLowerCase().includes(networkSearchQuery.toLowerCase()))
                .map((net) => {
                const isActive = (Date.now() / 1000) - net.last_seen < 60; // Seen in last 60s
                return (
                  <div 
                    key={net.bssid} 
                    className={`p-4 rounded-xl border transition-all cursor-pointer hover:border-white/20 ${isActive ? 'bg-secondary/10 border-secondary/30' : 'bg-white/5 border-white/10'}`}
                    onClick={() => toggleNetworkHistory(net.bssid)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-zinc-200 truncate pr-4" title={net.ssid}>{net.ssid}</h4>
                      <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-zinc-600'}`} title={isActive ? "Currently in range" : "Out of range"} />
                    </div>
                    <div className="text-xs text-zinc-500 font-mono mb-3">{net.bssid}</div>
                    <div className="flex flex-col gap-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Signal:</span>
                        <span className="text-zinc-400">{net.signal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Security:</span>
                        <span className="text-zinc-400">{net.security}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Last seen:</span>
                        <span className="text-zinc-400">{new Date(net.last_seen * 1000).toLocaleTimeString()}</span>
                      </div>
                      {net.last_lat && net.last_lon && (
                        <div className="flex justify-between">
                          <span className="text-zinc-600">Location:</span>
                          <span className="text-zinc-400 font-mono text-[10px]">
                            {net.last_lat.toFixed(4)}, {net.last_lon.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {expandedNetwork === net.bssid && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <h5 className="text-xs font-medium text-zinc-400 mb-2">Location History</h5>
                        {networkHistory.length === 0 ? (
                          <div className="text-xs text-zinc-600">Loading history...</div>
                        ) : (
                          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {networkHistory.map((h, i) => (
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
              })
            )}
          </div>
        </div>
      </div>

      <PopupModal isOpen={showLocationModal} onClose={() => setShowLocationModal(false)} title="Set Scanner Location">
        <div className="flex flex-col gap-6 h-[70vh]">
          <div className="flex gap-4 shrink-0">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input 
                type="text" 
                placeholder="Search for a place (e.g. Times Square, New York)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-secondary/50 transition-colors"
              />
            </div>
            <Button variant="primary" onClick={searchLocation} disabled={searching}>
              {searching ? "Searching..." : "Search"}
            </Button>
            <Button variant="secondary" onClick={useBrowserLocation} title="Use my current location">
              <MapPin size={16} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {searchResults.map((res: any, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 cursor-pointer transition-colors"
                onClick={() => selectLocation(parseFloat(res.lat), parseFloat(res.lon))}
              >
                <div className="text-sm text-white font-medium mb-1">{res.display_name}</div>
                <div className="text-xs text-zinc-500 font-mono">
                  Lat: {parseFloat(res.lat).toFixed(6)}, Lon: {parseFloat(res.lon).toFixed(6)}
                </div>
              </div>
            ))}
            {searchResults.length === 0 && !searching && (
              <div className="text-center text-zinc-500 text-sm mt-8">
                Search for a location to see results here.
              </div>
            )}
          </div>
        </div>
      </PopupModal>
    </div>
  );
}
