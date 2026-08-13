"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useSettingsStore } from "@/store/useSettingsStore";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { APP_THEMES } from "@/lib/themes";
import { Icon } from "@/lib/utils";

export function SettingsSidebar() {
  const pathname = usePathname();
  const { mangaGridSize, setMangaGridSize, malGridSize, setMalGridSize, isSettingsCollapsed, setSettingsCollapsed, spotifyConfig, setSpotifyConfig, theme, setTheme } = useSettingsStore();
  const [isSavingSpotify, setIsSavingSpotify] = useState(false);

  const [staticSize, setStaticSize] = useState("0 B");
  const [isClearing, setIsClearing] = useState(false);
  const [tempSize, setTempSize] = useState("0 B");
  const [isClearingTemp, setIsClearingTemp] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [authMsg, setAuthMsg] = useState({ text: "", type: "" });
  const [isSavingAuth, setIsSavingAuth] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setNewUsername(localStorage.getItem("username") || "");
  }, []);

  const fetchStaticSize = async () => {
    try {
      const res = await fetch("/api/system/static-storage/size", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setStaticSize(data.size_str);
      }
    } catch (e) {
      console.error("Failed to fetch static storage size", e);
    }
  };

  const fetchTempSize = async () => {
    try {
      const res = await fetch("/api/system/temp-storage/size", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTempSize(data.size_str);
      }
    } catch (e) {
      console.error("Failed to fetch temp storage size", e);
    }
  };

  useEffect(() => {
    fetchStaticSize();
    fetchTempSize();
  }, [pathname]);

  const handleClearTemp = async () => {
    if (!confirm("Are you sure you want to clear all temp files? This cannot be undone.")) return;
    setIsClearingTemp(true);
    try {
      const res = await fetch("/api/system/temp-storage/clear", { 
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (res.ok) {
        await fetchTempSize();
      }
    } catch (e) {
      console.error("Failed to clear temp files", e);
    }
    setIsClearingTemp(false);
  };

  const handleClearStatic = async () => {
    if (!confirm("Are you sure you want to clear all static saved images? This cannot be undone.")) return;
    setIsClearing(true);
    try {
      const res = await fetch("/api/system/static-storage/clear", { 
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (res.ok) {
        await fetchStaticSize();
      }
    } catch (e) {
      console.error("Failed to clear static images", e);
    }
    setIsClearing(false);
  };

  useEffect(() => {
    const loadSpotifyConfig = () => {
      if (!isMounted) return;
      if (pathname === "/entertainment-reading/spotify-scrobbler") {
        fetch("/api/media-entertainment/spotify-scrobbler/config", {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
          .then(res => res.json())
          .then(data => setSpotifyConfig(data))
          .catch(console.error);
      }
    };
    loadSpotifyConfig();
  }, [pathname, setSpotifyConfig, isMounted]);

  const handleSaveSpotifyConfig = async () => {
    setIsSavingSpotify(true);
    try {
      await fetch("/api/media-entertainment/spotify-scrobbler/config", {
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

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setAuthMsg({ text: "Please fill both password fields", type: "error" });
      return;
    }
    setIsSavingAuth(true);
    setAuthMsg({ text: "", type: "" });
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, new_username: newUsername }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update credentials");
      
      setAuthMsg({ text: "Credentials updated! You will need to log in again.", type: "success" });
      setTimeout(() => {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }, 2000);
    } catch (e: any) {
      setAuthMsg({ text: e.message, type: "error" });
    } finally {
      setIsSavingAuth(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    borderColor: "var(--theme-ui-border)",
  };
  const inputFocusClass = "w-full bg-[var(--theme-ui-bg)] border rounded-lg p-2 text-[var(--theme-text)] outline-none text-sm transition-colors";

  // Determine what settings to show based on the current route
  const renderSettings = () => {
    if (pathname === "/entertainment-reading/manga-library") {
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
            <h2 className="text-lg font-semibold text-zinc-200">Page Settings</h2>
          </div>
          <button 
            onClick={() => setSettingsCollapsed(true)} 
            className="p-1 rounded-md text-zinc-500 hover:text-white transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-8">
          {/* Theme Selector */}
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">App Theme</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
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
                        isActive ? "ring-1" : "hover:bg-[var(--theme-ui-bg)]"
                      }`}
                      style={{
                        backgroundColor: isActive ? "color-mix(in srgb, var(--theme-heading) 15%, transparent)" : undefined,
                        borderColor: isActive ? "var(--theme-heading)" : "var(--theme-ui-border)",
                        color: isActive ? "var(--theme-heading)" : undefined,
                        // @ts-expect-error CSS custom properties
                        "--tw-ring-color": isActive ? "var(--theme-heading)" : undefined,
                      }}
                    >
                      <div className="flex rounded overflow-hidden border border-[var(--theme-ui-border)] flex-shrink-0 h-4 w-10">
                        <div className="flex-1 h-full" style={{ backgroundColor: colors.BG }} />
                        <div className="flex-1 h-full" style={{ backgroundColor: colors.UI_BG }} />
                        <div className="flex-1 h-full" style={{ backgroundColor: colors.GLOW_1 }} />
                        <div className="flex-1 h-full" style={{ backgroundColor: colors.TEXT }} />
                        <div className="flex-1 h-full" style={{ backgroundColor: colors.HEADING }} />
                      </div>
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
          
          {/* Account Settings */}
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Account Settings</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-1">Username</label>
                <input 
                  type="text" 
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className={inputFocusClass}
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-1">Current Password</label>
                <div className="relative">
                  <input 
                    type={showCurrentPassword ? "text" : "password"} 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={`${inputFocusClass} pr-10`}
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[var(--theme-heading)] transition-colors flex items-center justify-center h-full"
                  >
                    <Icon name={showCurrentPassword ? "visibility_off" : "visibility"} size={18} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-1">New Password</label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${inputFocusClass} pr-10`}
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "var(--theme-ui-border)"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[var(--theme-heading)] transition-colors flex items-center justify-center h-full"
                  >
                    <Icon name={showNewPassword ? "visibility_off" : "visibility"} size={18} />
                  </button>
                </div>
              </div>
              {authMsg.text && (
                <div className={`p-2 rounded text-xs text-center ${authMsg.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                  {authMsg.text}
                </div>
              )}
              <Button 
                variant="primary" 
                onClick={handleChangePassword} 
                isLoading={isSavingAuth} 
                className="w-full border-none !shadow-none !ring-0 !outline-none transition-colors"
                style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
              >
                {isSavingAuth ? null : <Icon name="save" size={16} />} Update Credentials
              </Button>
            </div>
          </div>
        </div>
        
        {/* Storage Footer */}
        <div className="p-6 border-t mt-auto" style={{ borderColor: "var(--theme-ui-border)" }}>
          <div className="flex flex-col gap-3">
            <div className="bg-[var(--theme-ui-bg)] border rounded-lg p-3" style={{ borderColor: "var(--theme-ui-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
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
                <Icon name="delete" size={12} />
                {isClearing ? "Clearing" : "Clear Static Images"}
              </button>
            </div>
            
            <div className="bg-[var(--theme-ui-bg)] border rounded-lg p-3" style={{ borderColor: "var(--theme-ui-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
                  <span>Temp Files</span>
                </div>
                <span className="text-zinc-300 text-xs font-mono">{tempSize}</span>
              </div>
              <button 
                onClick={handleClearTemp}
                suppressHydrationWarning
                disabled={!isMounted || isClearingTemp || tempSize === "0 B"}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 rounded py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="delete" size={12} />
                {isClearingTemp ? "Clearing" : "Clear Temp Files"}
              </button>
            </div>
          </div>
        </div>
      </aside>

    {isSettingsCollapsed && (
      <button
        onClick={() => setSettingsCollapsed(false)}
        className="fixed right-4 top-4 z-50 p-2 backdrop-blur-xl border rounded-md text-zinc-400 hover:text-white shadow-lg transition-colors hidden lg:flex"
        style={{ 
          backgroundColor: "color-mix(in srgb, var(--theme-bg) 90%, transparent)",
          borderColor: "var(--theme-ui-border)",
        }}
      >
        <Icon name="tune" size={24} />
      </button>
    )}
    </>
  );
}
