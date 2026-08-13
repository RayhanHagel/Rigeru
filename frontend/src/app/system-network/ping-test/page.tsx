"use client";

import React, { useState, useEffect } from "react";

import { Header } from "@/components/ui/Header";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

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
      const res = await fetch("/api/system/ping/interfaces");
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
      const res = await fetch("/api/system/ping/dns-presets");
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
      const res = await fetch("/api/system/ping/run", {
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
      const res = await fetch("/api/system/ping/dns-speeds", {
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
      const res = await fetch("/api/system/ping/set-dns", {
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
    if (ms === Infinity || ms === -1) return <span className="animate-slide-up text-red-400">Timeout</span>;
    const color = ms < 50 ? "text-emerald-400" : ms < 100 ? "text-amber-400" : "text-red-400";
    return <span className={color}>{ms.toFixed(1)} ms</span>;
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Ping & DNS Test" subtitle="Test network latency and configure DNS settings." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
        <div className="space-y-6">
          <Container title="Standard Ping Test" icon={<Icon name="terminal" size={18} className="text-secondary" />}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-1">Target Host / IP</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    className="flex-1 rounded-lg p-2.5 text-[var(--theme-heading)] outline-none transition-all border"
                    style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                  />
                  <select
                    className="rounded-lg p-2.5 text-[var(--theme-heading)] outline-none transition-all border max-w-[150px]"
                    style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    onChange={e => {
                      if(e.target.value) setTarget(e.target.value);
                    }}
                    value=""
                  >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="" disabled>Presets...</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="google.com">Google</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="cloudflare.com">Cloudflare</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="github.com">GitHub</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="1.1.1.1">1.1.1.1</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="8.8.8.8">8.8.8.8</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[var(--theme-text)] mb-1">Ping Count</label>
                  <input 
                    type="number" 
                    value={count}
                    onChange={e => setCount(parseInt(e.target.value) || 4)}
                    className="w-full rounded-lg p-2.5 text-[var(--theme-heading)] outline-none transition-all border"
                    style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-[var(--theme-text)] pb-3">
                    <input type="checkbox" checked={ipv6} onChange={e => setIpv6(e.target.checked)} className="rounded accent-[var(--theme-heading)] w-4 h-4" />
                    Use IPv6
                  </label>
                </div>
              </div>
              <Button variant="primary" onClick={handlePing} disabled={isPinging || !target} className="w-full">
                {isPinging ? <><Icon name="refresh" size={16} className="mr-2 animate-spin" /> Pinging</> : <><Icon name="monitoring" size={16} className="mr-2" /> Start Ping</>}
              </Button>

              {pingLog && (
                <div className="mt-4 bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-4 max-h-60 overflow-y-auto font-mono text-xs text-[var(--theme-text)] whitespace-pre-wrap custom-scrollbar">
                  {pingLog}
                </div>
              )}
            </div>
          </Container>

          <Container title="DNS Settings Override (Windows)" icon={<Icon name="settings" size={18} className="text-emerald-400" />}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-1">Network Interface</label>
                <select 
                  value={selectedIface}
                  onChange={e => setSelectedIface(e.target.value)}
                  className="w-full rounded-lg p-2.5 text-[var(--theme-heading)] outline-none transition-all border"
                  style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                >
                  {interfaces.map(i => <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-1">DNS Server</label>
                <select 
                  value={dnsPreset}
                  onChange={e => setDnsPreset(e.target.value)}
                  className="w-full rounded-lg p-2.5 text-[var(--theme-heading)] outline-none transition-all border"
                  style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                >
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="1.1.1.1,1.0.0.1">Cloudflare (1.1.1.1, 1.0.0.1)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="8.8.8.8,8.8.4.4">Google (8.8.8.8, 8.8.4.4)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="9.9.9.9,149.112.112.112">Quad9 (9.9.9.9, 149.112.112.112)</option>
                  <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="208.67.222.222,208.67.220.220">OpenDNS (208.67.222.222, 208.67.220.220)</option>
                </select>
              </div>
              <Button variant="secondary" onClick={handleSetDns} disabled={isSettingDns || !selectedIface} className="w-full">
                Set DNS Server (Requires Admin)
              </Button>
            </div>
          </Container>
        </div>

        <div>
          <Container title="DNS Latency Benchmark" icon={<Icon name="dns" size={18} className="text-primary" />}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Select DNS Providers</label>
                <div className="flex flex-wrap gap-2">
                  {dnsPresetsList.map(preset => (
                    <label key={preset} className="flex items-center gap-2 text-sm text-[var(--theme-heading)] bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] px-3 py-1.5 rounded-full cursor-pointer hover:border-[var(--theme-heading)] transition-all duration-300">
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
                        className="rounded accent-[var(--theme-heading)] w-4 h-4 focus:ring-[var(--theme-heading)]"
                      />
                      {preset}
                    </label>
                  ))}
                </div>
              </div>

              <Button variant="secondary" onClick={handleCheckDns} disabled={isCheckingDns || selectedDnsPresets.length === 0} className="w-full">
                {isCheckingDns ? <><Icon name="refresh" size={16} className="mr-2 animate-spin" /> Benchmarking</> : "Run Benchmark"}
              </Button>

              {Object.keys(dnsSpeeds).length > 0 && (
                <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl overflow-hidden mt-4 custom-scrollbar">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] border-b border-[var(--theme-ui-border)]">
                      <tr>
                        <th className="px-4 py-3 font-medium">Provider</th>
                        <th className="px-4 py-3 font-medium">IPv4 Latency</th>
                        <th className="px-4 py-3 font-medium">IPv6 Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--theme-ui-border)]">
                      {Object.entries(dnsSpeeds).map(([name, speeds], i) => (
                        <tr key={i} className="hover:bg-[var(--theme-ui-bg)] transition-colors">
                          <td className="px-4 py-3 font-medium text-[var(--theme-heading)]">{name}</td>
                          <td className="px-4 py-3">{formatLatency(speeds.ipv4)}</td>
                          <td className="px-4 py-3">{formatLatency(speeds.ipv6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Container>
        </div>
      </div>
    </div>
  );
}
