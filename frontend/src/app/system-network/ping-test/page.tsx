"use client";

import React, { useState, useEffect } from "react";
import { Network, Activity, Settings, RefreshCw, Server, Terminal } from "lucide-react";
import { STHeader } from "@/components/streamlit/STHeader";
import { STContainer } from "@/components/streamlit/STContainer";
import { Button } from "@/components/ui/Button";

type DnsSpeed = {
  ipv4: number;
  ipv6: number;
};

export default function PingTestPage() {
  const [target, setTarget] = useState("google.com");
  const [count, setCount] = useState(4);
  const [ipv6, setIpv6] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingLog, setPingLog] = useState("");
  
  const [dnsSpeeds, setDnsSpeeds] = useState<Record<string, DnsSpeed>>({});
  const [isCheckingDns, setIsCheckingDns] = useState(false);
  const [dnsPresetsList, setDnsPresetsList] = useState<string[]>([]);
  const [selectedDnsPresets, setSelectedDnsPresets] = useState<string[]>([]);

  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [selectedIface, setSelectedIface] = useState("");
  const [dnsPreset, setDnsPreset] = useState("1.1.1.1,1.0.0.1");
  const [isSettingDns, setIsSettingDns] = useState(false);

  const fetchInterfaces = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/ping/interfaces");
      const data = await res.json();
      setInterfaces(data.interfaces || []);
      if (data.interfaces && data.interfaces.length > 0) {
        setSelectedIface(data.interfaces[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDnsPresets = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/ping/dns-presets");
      const data = await res.json();
      setDnsPresetsList(data.presets || []);
      setSelectedDnsPresets(data.presets || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInterfaces();
    fetchDnsPresets();
  }, []);

  const handlePing = async () => {
    setIsPinging(true);
    setPingLog(`Pinging ${target}...\n`);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/ping/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: target, count, ipv6 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setPingLog(data.message);
    } catch (e: any) {
      setPingLog(`Error: ${e.message}`);
    } finally {
      setIsPinging(false);
    }
  };

  const handleCheckDns = async () => {
    setIsCheckingDns(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/ping/dns-speeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset_names: selectedDnsPresets })
      });
      const data = await res.json();
      setDnsSpeeds(data.speeds || {});
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsCheckingDns(false);
    }
  };

  const handleSetDns = async () => {
    setIsSettingDns(true);
    try {
      const [primary, secondary] = dnsPreset.split(",");
      const res = await fetch("http://127.0.0.1:8000/api/system/ping/set-dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interface_name: selectedIface, primary: primary.trim(), secondary: secondary?.trim() || "" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      alert(data.message);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsSettingDns(false);
    }
  };

  const formatLatency = (ms: number) => {
    if (ms === Infinity) return <span className="text-red-400">Timeout</span>;
    const color = ms < 50 ? "text-emerald-400" : ms < 100 ? "text-amber-400" : "text-red-400";
    return <span className={color}>{ms.toFixed(1)} ms</span>;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <STHeader title="📡 Ping & DNS Test" />
        <p className="text-zinc-400 mt-2">
          Test network latency and configure DNS settings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <STContainer title="Standard Ping Test" icon={<Terminal size={18} className="text-blue-400" />}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Target Host / IP</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                  <select
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 max-w-[150px]"
                    onChange={e => {
                      if(e.target.value) setTarget(e.target.value);
                    }}
                    value=""
                  >
                    <option value="" disabled>Presets...</option>
                    <option value="google.com">Google</option>
                    <option value="cloudflare.com">Cloudflare</option>
                    <option value="github.com">GitHub</option>
                    <option value="1.1.1.1">1.1.1.1</option>
                    <option value="8.8.8.8">8.8.8.8</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Ping Count</label>
                  <input 
                    type="number" 
                    value={count}
                    onChange={e => setCount(parseInt(e.target.value) || 4)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-zinc-300 pb-3">
                    <input type="checkbox" checked={ipv6} onChange={e => setIpv6(e.target.checked)} className="rounded border-zinc-800 bg-zinc-900 text-blue-500" />
                    Use IPv6
                  </label>
                </div>
              </div>
              <Button variant="primary" onClick={handlePing} disabled={isPinging || !target} className="w-full">
                {isPinging ? <><RefreshCw size={16} className="mr-2 animate-spin" /> Pinging...</> : <><Activity size={16} className="mr-2" /> Start Ping</>}
              </Button>

              {pingLog && (
                <div className="mt-4 bg-black border border-zinc-800 rounded-lg p-4 max-h-60 overflow-y-auto font-mono text-xs text-zinc-300 whitespace-pre-wrap">
                  {pingLog}
                </div>
              )}
            </div>
          </STContainer>

          <STContainer title="DNS Settings Override (Windows)" icon={<Settings size={18} className="text-emerald-400" />}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Network Interface</label>
                <select 
                  value={selectedIface}
                  onChange={e => setSelectedIface(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                >
                  {interfaces.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">DNS Server</label>
                <select 
                  value={dnsPreset}
                  onChange={e => setDnsPreset(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="1.1.1.1,1.0.0.1">Cloudflare (1.1.1.1, 1.0.0.1)</option>
                  <option value="8.8.8.8,8.8.4.4">Google (8.8.8.8, 8.8.4.4)</option>
                  <option value="9.9.9.9,149.112.112.112">Quad9 (9.9.9.9, 149.112.112.112)</option>
                  <option value="208.67.222.222,208.67.220.220">OpenDNS (208.67.222.222, 208.67.220.220)</option>
                </select>
              </div>
              <Button variant="secondary" onClick={handleSetDns} disabled={isSettingDns || !selectedIface} className="w-full">
                Set DNS Server (Requires Admin)
              </Button>
            </div>
          </STContainer>
        </div>

        <div>
          <STContainer title="DNS Latency Benchmark" icon={<Server size={18} className="text-purple-400" />}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Select DNS Providers</label>
                <div className="flex flex-wrap gap-2">
                  {dnsPresetsList.map(preset => (
                    <label key={preset} className="flex items-center gap-2 text-sm text-zinc-300 bg-zinc-900/50 border border-zinc-800 px-3 py-1.5 rounded-full cursor-pointer hover:bg-zinc-800 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedDnsPresets.includes(preset)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDnsPresets([...selectedDnsPresets, preset]);
                          } else {
                            setSelectedDnsPresets(selectedDnsPresets.filter(p => p !== preset));
                          }
                        }}
                        className="rounded border-zinc-800 bg-zinc-900 text-purple-500 focus:ring-purple-500"
                      />
                      {preset}
                    </label>
                  ))}
                </div>
              </div>

              <Button variant="secondary" onClick={handleCheckDns} disabled={isCheckingDns || selectedDnsPresets.length === 0} className="w-full">
                {isCheckingDns ? <><RefreshCw size={16} className="mr-2 animate-spin" /> Benchmarking...</> : "Run Benchmark"}
              </Button>

              {Object.keys(dnsSpeeds).length > 0 && (
                <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden mt-4">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-900 text-zinc-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">Provider</th>
                        <th className="px-4 py-3 font-medium">IPv4 Latency</th>
                        <th className="px-4 py-3 font-medium">IPv6 Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {Object.entries(dnsSpeeds).map(([name, speeds], i) => (
                        <tr key={i} className="hover:bg-zinc-800/50">
                          <td className="px-4 py-3 font-medium text-white">{name}</td>
                          <td className="px-4 py-3">{formatLatency(speeds.ipv4)}</td>
                          <td className="px-4 py-3">{formatLatency(speeds.ipv6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </STContainer>
        </div>
      </div>
    </div>
  );
}
