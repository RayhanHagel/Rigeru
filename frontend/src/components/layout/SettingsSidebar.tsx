"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Settings2, X, Save, HardDrive, Trash2, Palette } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { APP_THEMES } from "@/lib/themes";

export function SettingsSidebar() {
  const pathname = usePathname();
  const { mangaGridSize, setMangaGridSize, malGridSize, setMalGridSize, isSettingsCollapsed, setSettingsCollapsed, spotifyConfig, setSpotifyConfig, theme, setTheme } = useSettingsStore();
  const [isSavingSpotify, setIsSavingSpotify] = useState(false);

  const [staticSize, setStaticSize] = useState("0 B");
  const [isClearing, setIsClearing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchStaticSize = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/static-storage/size");
      if (res.ok) {
        const data = await res.json();
        setStaticSize(data.size_str);
      }
    } catch (e) {
      console.error("Failed to fetch static storage size", e);
    }
  };

  useEffect(() => {
    fetchStaticSize();
  }, [pathname]);

  const handleClearStatic = async () => {
    if (!confirm("Are you sure you want to clear all static saved images? This cannot be undone.")) return;
    setIsClearing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/system/static-storage/clear", { method: "DELETE" });
      if (res.ok) {
        await fetchStaticSize();
      }
    } catch (e) {
      console.error("Failed to clear static images", e);
    }
    setIsClearing(false);
  };

  useEffect(() => {
    if (pathname === "/media-entertainment/spotify-scrobbler") {
      fetch("http://127.0.0.1:8000/api/media-entertainment/spotify-scrobbler/config")
        .then(res => res.json())
        .then(data => setSpotifyConfig(data))
        .catch(console.error);
    }
  }, [pathname, setSpotifyConfig]);

  const handleSaveSpotifyConfig = async () => {
    setIsSavingSpotify(true);
    try {
      await fetch("http://127.0.0.1:8000/api/media-entertainment/spotify-scrobbler/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spotifyConfig),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingSpotify(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    borderColor: "var(--theme-ui-border)",
  };
  const inputFocusClass = "w-full bg-zinc-950 border rounded-lg p-2 text-white outline-none text-sm transition-colors";

  // Determine what settings to show based on the current route
  const renderSettings = () => {
    if (pathname === "/media-entertainment/manga-library") {
      return (
        <div className="flex flex-col gap-4 animate-fade-in">
          <Slider 
            label="Library Grid Size" 
            min={1} 
            max={10} 
            value={mangaGridSize} 
            onChange={setMangaGridSize} 
            helpText="Change the amount of covers shown per row."
          />
        </div>
      );
    }
    
    if (pathname === "/media-entertainment/spotify-scrobbler") {
      return (
        <div className="flex flex-col gap-5 animate-fade-in">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Last.fm Username</label>
            <input 
              type="text" 
              value={spotifyConfig.username}
              onChange={(e) => setSpotifyConfig({ ...spotifyConfig, username: e.target.value })}
              className={inputFocusClass}
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Refresh Interval (s)</label>
            <input 
              type="number" 
              min={10} max={300}
              value={spotifyConfig.refresh_interval}
              onChange={(e) => setSpotifyConfig({ ...spotifyConfig, refresh_interval: Number(e.target.value) })}
              className={inputFocusClass}
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Method</label>
            <select 
              value={spotifyConfig.fetch_method}
              onChange={(e) => setSpotifyConfig({ ...spotifyConfig, fetch_method: e.target.value })}
              className={inputFocusClass}
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
            >
              <option value="Scraping">Scraping</option>
              <option value="API">API</option>
            </select>
          </div>
          
          {spotifyConfig.fetch_method === "API" && (
            <div 
              className="flex flex-col gap-5 p-4 rounded-xl border"
              style={{
                backgroundColor: "color-mix(in srgb, var(--theme-heading) 5%, transparent)",
                borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
              }}
            >
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "color-mix(in srgb, var(--theme-heading) 70%, white)" }}>API Key</label>
                <input 
                  type="password" 
                  value={spotifyConfig.api_key}
                  onChange={(e) => setSpotifyConfig({ ...spotifyConfig, api_key: e.target.value })}
                  className={inputFocusClass}
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "color-mix(in srgb, var(--theme-heading) 70%, white)" }}>Track Limit</label>
                <input 
                  type="number" 
                  min={1} max={50}
                  value={spotifyConfig.track_limit}
                  onChange={(e) => setSpotifyConfig({ ...spotifyConfig, track_limit: Number(e.target.value) })}
                  className={inputFocusClass}
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "color-mix(in srgb, var(--theme-heading) 70%, white)" }}>Timezone</label>
                <select 
                  value={spotifyConfig.timezone}
                  onChange={(e) => setSpotifyConfig({ ...spotifyConfig, timezone: e.target.value })}
                  className={inputFocusClass}
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
                >
                  {Array.from({ length: 27 }, (_, i) => i - 12).map(i => {
                    const sign = i >= 0 ? "+" : "-";
                    const val = `UTC${sign}${Math.abs(i).toString().padStart(2, '0')}:00`;
                    return <option key={val} value={val}>{val}</option>;
                  })}
                </select>
              </div>
            </div>
          )}
          
          <Button variant="primary" onClick={handleSaveSpotifyConfig} isLoading={isSavingSpotify} className="w-full mt-2">
            {isSavingSpotify ? null : <Save size={16} />} Save Settings
          </Button>
        </div>
      );
    }
    
    if (pathname === "/media-entertainment/malsync") {
      return (
        <div className="flex flex-col gap-4 animate-fade-in">
          <Slider 
            label="Library Grid Size" 
            min={1} 
            max={10} 
            value={malGridSize} 
            onChange={setMalGridSize} 
            helpText="Change the amount of covers shown per row."
          />
        </div>
      );
    }

    // Default empty state
    return (
      <div className="flex flex-col items-center justify-center h-48 text-zinc-600 text-sm">
        <Settings2 size={32} className="mb-2 opacity-50" />
        <p>No settings for this page</p>
      </div>
    );
  };

  return (
    <>
      <aside 
        className={`w-80 h-screen fixed right-0 top-0 backdrop-blur-2xl border-l z-40 flex flex-col transition-transform duration-300 hidden lg:flex ${isSettingsCollapsed ? "translate-x-full" : "translate-x-0"}`}
        style={{ 
          backgroundColor: "color-mix(in srgb, var(--theme-bg) 80%, transparent)",
          borderColor: "var(--theme-ui-border)",
        }}
      >
        <div className="p-6 border-b flex items-center justify-between gap-3" style={{ borderColor: "color-mix(in srgb, var(--theme-ui-border) 50%, transparent)" }}>
          <div className="flex items-center gap-3">
            <Settings2 size={20} className="text-zinc-400" />
            <h2 className="text-lg font-semibold text-zinc-200">Page Settings</h2>
          </div>
          <button 
            onClick={() => setSettingsCollapsed(true)} 
            className="p-1 rounded-md text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-8">
          {/* Theme Selector */}
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">App Theme</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                <Palette size={16} />
                <span>Color Scheme</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(APP_THEMES).map(([name, colors]) => {
                  const isActive = theme === name || (theme === "Nebula" && name === "Nebula (Default)");
                  return (
                    <button
                      key={name}
                      onClick={() => setTheme(name)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        isActive ? "ring-1" : "hover:bg-white/5"
                      }`}
                      style={{
                        backgroundColor: isActive ? "color-mix(in srgb, var(--theme-heading) 15%, transparent)" : undefined,
                        borderColor: isActive ? "var(--theme-heading)" : "var(--theme-ui-border)",
                        color: isActive ? "var(--theme-heading)" : undefined,
                        // @ts-expect-error CSS custom properties
                        "--tw-ring-color": isActive ? "var(--theme-heading)" : undefined,
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0"
                        style={{ backgroundColor: colors.HEADING }}
                      />
                      <span className={isActive ? "" : "text-zinc-400"}>{name.replace(" (Default)", "")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Page Settings */}
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Page Settings</h3>
            {renderSettings()}
          </div>
        </div>
        
        {/* Static Storage Footer */}
        <div className="p-6 border-t mt-auto" style={{ borderColor: "var(--theme-ui-border)" }}>
          <div className="bg-zinc-950/50 border rounded-lg p-3" style={{ borderColor: "var(--theme-ui-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
                <HardDrive size={14} />
                <span>Static Images</span>
              </div>
              <span className="text-zinc-300 text-xs font-mono">{staticSize}</span>
            </div>
            <button 
              onClick={handleClearStatic}
              suppressHydrationWarning
              disabled={!isMounted || isClearing || staticSize === "0 B"}
              className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 rounded py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={12} />
              {isClearing ? "Clearing..." : "Clear Static Images"}
            </button>
          </div>
        </div>
      </aside>

    {isSettingsCollapsed && (
      <button
        onClick={() => setSettingsCollapsed(false)}
        className="fixed right-4 top-4 z-40 p-2 backdrop-blur-xl border rounded-md text-zinc-400 hover:text-white shadow-lg transition-colors hidden lg:flex"
        style={{ 
          backgroundColor: "color-mix(in srgb, var(--theme-bg) 90%, transparent)",
          borderColor: "var(--theme-ui-border)",
        }}
      >
        <Settings2 size={24} />
      </button>
    )}
    </>
  );
}
