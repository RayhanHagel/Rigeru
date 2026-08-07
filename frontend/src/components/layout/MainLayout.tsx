"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { SettingsSidebar } from "@/components/layout/SettingsSidebar";
import { APP_THEMES } from "@/lib/themes";

// Global fetch interceptor to attach JWT token immediately upon script load
if (typeof window !== "undefined" && !(window as any).__fetchIntercepted) {
  (window as any).__fetchIntercepted = true;
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    let [resource, config] = args;
    const url = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : '';
    
    if (url.includes('/api/') && !url.includes('/api/auth/login')) {
      config = config || {};
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      };
    }
    return originalFetch(resource, config);
  };
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed, isSettingsCollapsed, theme } = useSettingsStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Authentication Check
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token && pathname !== "/login") {
      router.push("/login");
    } else {
      setIsAuthenticated(!!token);
    }
    setLoading(false);
  }, [pathname, router]);

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

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-[var(--theme-bg)]">Loading</div>;
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return null; // Prevents flashing before redirect
  }

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

        
        <div className="w-full min-h-full">
          {children}
        </div>
      </main>
      
      <SettingsSidebar />
    </div>
  );
}
