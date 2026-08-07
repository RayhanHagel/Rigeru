import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  mangaGridSize: number;
  setMangaGridSize: (size: number) => void;

  malGridSize: number;
  setMalGridSize: (size: number) => void;
  
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  isSettingsCollapsed: boolean;
  setSettingsCollapsed: (collapsed: boolean) => void;

  theme: string;
  setTheme: (theme: string) => void;

  spotifyConfig: {
    username: string;
    refresh_interval: number;
    timezone: string;
    fetch_method: string;
    api_key: string;
    track_limit: number;
  };
  setSpotifyConfig: (config: any) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mangaGridSize: 4,
      setMangaGridSize: (size) => set({ mangaGridSize: size }),

      malGridSize: 4,
      setMalGridSize: (size) => set({ malGridSize: size }),
      
      isSidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      
      isSettingsCollapsed: true,
      setSettingsCollapsed: (collapsed) => set({ isSettingsCollapsed: collapsed }),

      theme: "Nebula",
      setTheme: (theme) => set({ theme }),

      spotifyConfig: {
        username: "",
        refresh_interval: 60,
        timezone: "UTC+07:00",
        fetch_method: "Scraping",
        api_key: "",
        track_limit: 5,
      },
      setSpotifyConfig: (config) => set({ spotifyConfig: config }),
    }),
    {
      name: 'rigeru-settings', // name of item in the storage (must be unique)
    }
  )
);
