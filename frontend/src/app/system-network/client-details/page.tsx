"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useEffect } from "react";
import { Monitor, Globe, Cpu, Server, Activity, ArrowRight, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ClientData {
  ip: string;
  userAgent: string;
  browser: string;
  os: string;
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  pixelRatio: number;
  hardwareConcurrency: number;
  deviceMemory: number | string;
  language: string;
  platform: string;
  connection: string;
  webglVendor: string;
  webglRenderer: string;
  cookiesEnabled: boolean;
  doNotTrack: string | null;
  timezone: string;
}

export default function ClientDetailsPage() {
  const [data, setData] = useState<Partial<ClientData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const json = await res.json();
        return json.ip;
      } catch (e) {
        return "Unknown";
      }
    };

    const getWebGLInfo = () => {
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl) {
          const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
          if (ext) {
            return {
              vendor: (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_VENDOR_WEBGL),
              renderer: (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL),
            };
          }
        }
      } catch (e) {}
      return { vendor: "Unknown", renderer: "Unknown" };
    };

    const gatherData = async () => {
      const ip = await fetchIp();
      const webgl = getWebGLInfo();
      
      const nav = window.navigator as any;
      
      setData({
        ip,
        userAgent: navigator.userAgent,
        browser: getBrowserInfo(navigator.userAgent),
        os: getOSInfo(navigator.userAgent),
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        colorDepth: window.screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: nav.deviceMemory || "Unknown",
        language: navigator.language,
        platform: navigator.platform,
        connection: nav.connection ? nav.connection.effectiveType : "Unknown",
        webglVendor: webgl.vendor,
        webglRenderer: webgl.renderer,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack || "Unspecified",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setLoading(false);
    };

    gatherData();
  }, []);

  const getBrowserInfo = (ua: string) => {
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("SamsungBrowser")) return "Samsung Browser";
    if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
    if (ua.includes("Trident")) return "Internet Explorer";
    if (ua.includes("Edge") || ua.includes("Edg/")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    return "Unknown Browser";
  };

  const getOSInfo = (ua: string) => {
    if (ua.includes("Win")) return "Windows";
    if (ua.includes("Mac")) return "MacOS";
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("like Mac")) return "iOS";
    return "Unknown OS";
  };

  const renderSection = (title: string, icon: React.ReactNode, items: {label: string, value: any}[]) => (
    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 shadow-lg">
      <h3 className="font-semibold text-lg text-zinc-100 flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
        {icon} {title}
      </h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 group">
            <span className="text-zinc-500 text-sm font-medium">{item.label}</span>
            <span className="text-zinc-300 font-mono text-sm text-left sm:text-right bg-zinc-950 px-2 py-1 rounded group-hover:text-primary transition-colors break-all">
              {item.value !== undefined && item.value !== null ? item.value.toString() : "N/A"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Web Client Details" subtitle="Detailed fingerprint and environment analysis of your current browser." />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Globe size={120} />
            </div>
            <div className="z-10">
              <h2 className="text-zinc-400 text-sm font-medium mb-1 tracking-wider uppercase">Public IP Address</h2>
              <div className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
                {data.ip}
                {data.ip !== "Unknown" ? (
                  <ShieldCheck className="text-emerald-500" size={28} />
                ) : (
                  <ShieldAlert className="text-amber-500" size={28} />
                )}
              </div>
              <p className="text-zinc-400 text-sm">
                Connected via <span className="text-primary font-medium">{data.connection}</span> network
              </p>
            </div>
            <div className="z-10 w-full md:w-auto">
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex gap-4 text-purple-200">
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-primary/70 font-semibold">OS</span>
                  <span className="text-lg font-medium">{data.os}</span>
                </div>
                <div className="w-px bg-primary/20"></div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-primary/70 font-semibold">Browser</span>
                  <span className="text-lg font-medium">{data.browser}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 animate-slide-up">
            {renderSection("Device & Display", <Monitor className="text-secondary" size={20} />, [
              { label: "Screen Resolution", value: `${data.screenWidth} x ${data.screenHeight}` },
              { label: "Color Depth", value: `${data.colorDepth}-bit` },
              { label: "Pixel Ratio", value: data.pixelRatio },
              { label: "Hardware Concurrency", value: `${data.hardwareConcurrency} Cores` },
              { label: "Device Memory", value: `${data.deviceMemory} GB+` },
              { label: "Platform", value: data.platform },
            ])}

            {renderSection("Software & Privacy", <ShieldCheck className="text-emerald-400" size={20} />, [
              { label: "Language", value: data.language },
              { label: "Timezone", value: data.timezone },
              { label: "Cookies Enabled", value: data.cookiesEnabled ? "Yes" : "No" },
              { label: "Do Not Track", value: data.doNotTrack },
              { label: "User Agent", value: data.userAgent },
            ])}

            {renderSection("Graphics / WebGL", <Cpu className="text-orange-400" size={20} />, [
              { label: "WebGL Vendor", value: data.webglVendor },
              { label: "WebGL Renderer", value: data.webglRenderer },
            ])}

            {renderSection("Network", <Server className="text-secondary" size={20} />, [
              { label: "Effective Connection", value: data.connection },
            ])}
          </div>
        </div>
      )}
    </div>
  );
}
