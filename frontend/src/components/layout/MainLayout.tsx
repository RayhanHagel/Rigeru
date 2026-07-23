"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { SettingsSidebar } from "@/components/layout/SettingsSidebar";
import { APP_THEMES } from "@/lib/themes";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed, isSettingsCollapsed, theme } = useSettingsStore();

  // Resolve theme colors — fallback to Nebula if the stored name doesn't match
  const themeKey = Object.keys(APP_THEMES).find(k => k.startsWith(theme)) || "Nebula (Default)";
  const colors = APP_THEMES[themeKey];

  // Apply CSS custom properties to <html> so every component can use them
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--theme-bg", colors.BG);
    root.style.setProperty("--theme-text", colors.TEXT);
    root.style.setProperty("--theme-heading", colors.HEADING);
    root.style.setProperty("--theme-glow1", colors.GLOW_1);
    root.style.setProperty("--theme-glow2", colors.GLOW_2);
    root.style.setProperty("--theme-ui-bg", colors.UI_BG);
    root.style.setProperty("--theme-ui-border", colors.UI_BORDER);

    // Also set the body background
    document.body.style.backgroundColor = colors.BG;
  }, [colors]);

  // Determine if this is a mono/terminal theme
  const isMono = theme.includes("Terminal") || theme.includes("Hacker") || theme.includes("Wave");

  return (
    <div className="flex h-screen w-full relative">
      {isMono && (
        <style dangerouslySetInnerHTML={{ __html: `* { font-family: 'Consolas', 'Courier New', monospace !important; }` }} />
      )}
      <Sidebar />
      
      <main 
        className={`flex-1 h-full overflow-y-auto overflow-x-hidden relative transition-all duration-300 ${
          isSidebarCollapsed ? "md:ml-0" : "md:ml-72"
        } ${
          isSettingsCollapsed ? "lg:mr-0" : "lg:mr-80"
        }`}
      >
        <div 
          className="absolute top-0 -left-1/4 w-[150%] h-[150%] pointer-events-none -z-10"
          style={{
            background: `radial-gradient(ellipse at top, var(--theme-glow1), var(--theme-glow2), transparent 70%)`
          }}
        />
        
        <div className="w-full min-h-full">
          {children}
        </div>
      </main>
      
      <SettingsSidebar />
    </div>
  );
}
