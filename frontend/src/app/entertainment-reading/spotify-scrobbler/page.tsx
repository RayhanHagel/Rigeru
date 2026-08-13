"use client";

import { useEffect, useState } from "react";

import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Icon } from "@/lib/utils";

type ScrobbleTrack = [string, string | null, string, string, string | null];

interface FeedData {
  avatar_url: string | null;
  scrobble_amount: string;
  scrobble_artist: string;
  recent_songs: ScrobbleTrack[];
}

export default function SpotifyScrobbler() {
  const { spotifyConfig, setSpotifyConfig } = useSettingsStore();
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"feed" | "settings">("feed");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSaveSpotifyConfig = async () => {
    setIsSavingConfig(true);
    try {
      await fetch("/api/media-entertainment/spotify-scrobbler/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify(spotifyConfig),
      });
      alert("Settings saved!");
    } catch (e) {
      console.error(e);
      alert("Failed to save settings.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Load cache on mount
  useEffect(() => {
    const cached = localStorage.getItem('spotify_scrobbler_cache');
    if (cached) {
      try {
        setFeed(JSON.parse(cached));
      } catch (e) {
        console.error("Failed to parse cached feed", e);
      }
    }
  }, []);

  const fetchFeed = async () => {
    if (!spotifyConfig.username) return;
    setIsFetching(true);
    setError(null);
    try {
      const { username, fetch_method, api_key, track_limit, timezone } = spotifyConfig;
      const url = `/api/media-entertainment/spotify-scrobbler/feed?username=${encodeURIComponent(username)}&fetch_method=${encodeURIComponent(fetch_method)}&api_key=${encodeURIComponent(api_key)}&limit=${track_limit}&tz_str=${encodeURIComponent(timezone)}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scrobble_amount !== null) {
          setFeed(data);
          localStorage.setItem('spotify_scrobbler_cache', JSON.stringify(data));
        } else {
          setError(`Could not connect via ${fetch_method}. Check your network or API key.`);
        }
      } else {
        setError("Failed to fetch feed.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error fetching feed.");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (spotifyConfig.username) {
      fetchFeed();
    }
  }, [spotifyConfig.username]); // Initial fetch

  useEffect(() => {
    if (spotifyConfig.username && spotifyConfig.refresh_interval) {
      const interval = setInterval(fetchFeed, spotifyConfig.refresh_interval * 1000);
      return () => clearInterval(interval);
    }
  }, [spotifyConfig.username, spotifyConfig.refresh_interval, spotifyConfig.fetch_method, spotifyConfig.api_key, spotifyConfig.track_limit, spotifyConfig.timezone]);

  // Scaling function similar to Python's get_scale
  const getScale = (idx: number) => {
    const scales = [
      { cover: 120, title: 24, artist: 16, time: 12, opacity: 1.00, pt: 8, pb: 28 },
      { cover: 90, title: 20, artist: 14, time: 11, opacity: 0.85, pt: 4, pb: 20 },
      { cover: 72, title: 18, artist: 13, time: 11, opacity: 0.70, pt: 4, pb: 16 },
      { cover: 58, title: 16, artist: 12, time: 10, opacity: 0.55, pt: 4, pb: 14 },
      { cover: 48, title: 14, artist: 11, time: 10, opacity: 0.45, pt: 4, pb: 12 },
    ];
    return scales[Math.min(idx, scales.length - 1)];
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar animate-slide-up flex flex-col font-sans">
      {/* Header */}
      <Header 
        title="Spotify Scrobbler"
        subtitle="Live, auto-refreshing feed of your Last.fm"
        actions={
          <div className="flex items-center gap-3">
            {activeTab === "feed" && spotifyConfig.username && (
              <div className="flex items-center bg-[var(--theme-ui-bg)] p-1.5 rounded-xl border border-[var(--theme-ui-border)] backdrop-blur-md shadow-sm h-full">
                <button 
                  onClick={fetchFeed} 
                  disabled={isFetching}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isFetching ? 'text-[var(--theme-heading)] opacity-70' : 'text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-white/5'}`}
                >
                  <Icon name="refresh" size={16} className={isFetching ? "animate-spin" : ""} />
                  <span className="hidden sm:inline">Force Sync</span>
                </button>
              </div>
            )}
            <ModernTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab as (id: string) => void}
              tabs={[
                { id: "feed", label: "Live Feed" },
                { id: "settings", label: "Settings" }
              ]}
            />
          </div>
        }
      />

      <ModernTabContent activeTab={activeTab}>
        {activeTab === "feed" && (
          <div className="flex flex-col h-full w-full">
            {!spotifyConfig.username ? (
              <div className="flex flex-col items-center justify-center h-64 text-center rounded-3xl border border-dashed border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]/30 backdrop-blur-sm">
                <div className="p-4 bg-[var(--theme-ui-bg)] rounded-full mb-4 border border-[var(--theme-ui-border)]">
                  <Icon name="music_note" size={32} className="text-[var(--theme-text)]" />
                </div>
                <p className="text-[var(--theme-text)] text-lg">No Last.fm username configured.</p>
                <p className="text-[var(--theme-text)] text-sm opacity-70">Go to the Settings tab to configure.</p>
              </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm">
          <p className="text-red-400 text-lg">{error}</p>
        </div>
      ) : !feed ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-dashed border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)]/30 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-[var(--theme-heading)]/30 border-t-[var(--theme-heading)] rounded-full animate-spin mb-4" />
          <p className="text-[var(--theme-text)] text-lg">Fetching latest listening history</p>
        </div>
      ) : (
        <div className="w-full pb-20 animate-slide-up">
          {/* Profile Header */}
          <div className="flex items-center gap-4 py-3 mb-8">
            <img 
              src={feed.avatar_url?.startsWith('/app/static') ? `${feed.avatar_url.replace('/app/static', '/static')}` : feed.avatar_url!} 
              alt="Avatar" 
              className="w-14 h-14 rounded-full border-2 border-[var(--theme-ui-border)] object-cover shadow-[0_4px_12px_rgba(0,0,0,0.3)]" 
            />
            <div>
              <div className="font-serif italic text-[13px] text-[var(--theme-text)] tracking-wide">listening history</div>
              <div className="font-mono text-base font-semibold text-[var(--theme-heading)] tracking-wide">{spotifyConfig.username}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-mono text-2xl font-semibold text-[var(--theme-heading)] tracking-tight">{parseInt(feed.scrobble_amount).toLocaleString()}</div>
              <div className="font-serif italic text-xs text-[var(--theme-text)]">scrobbles</div>
            </div>
          </div>

          {/* Cards */}
          <div>
            {feed.recent_songs.map((song, idx) => {
              const [song_name, cover_src, song_artist, last_listened, song_link] = song;
              const scale = getScale(idx);
              const isScrobbling = last_listened.trim().toLowerCase() === "scrobbling now";
              
              const resolveImageUrl = (url: string | null) => {
                if (!url) return "https://miro.medium.com/v2/resize:fit:720/format:webp/0*iODIlb6_lMPaOQoR";
                if (url.startsWith('/app/static/')) {
                  return `${url.replace('/app/static', '/static')}`;
                }
                return url;
              };
              
              const imageSrc = resolveImageUrl(cover_src);

              return (
                <div key={`${idx}-${song_name}-${last_listened}`} style={{ paddingTop: scale.pt, paddingBottom: scale.pb }}>
                  <div 
                    className="flex items-center gap-5 transition-all duration-300 hover:translate-x-1.5"
                    style={{ opacity: scale.opacity }}
                  >
                    <div 
                      className={`relative flex-shrink-0 rounded-lg shadow-xl overflow-hidden bg-[var(--theme-bg)] flex items-center justify-center ${isScrobbling ? "overflow-visible shadow-[0_0_20px_rgba(var(--theme-heading),0.3)]" : ""}`}
                      style={{ width: scale.cover, height: scale.cover }}
                    >
                      <img 
                        src={imageSrc} 
                        className="w-full h-full block rounded-lg object-cover transition-transform duration-500 hover:scale-105" 
                      />
                      {isScrobbling && (
                        <div className="absolute -inset-1 rounded-xl border-2 border-[var(--theme-heading)] animate-[pulse_2s_ease-out_infinite] pointer-events-none" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {isScrobbling && (
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[var(--theme-heading)] mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-heading)] animate-[blink_1.2s_ease-in-out_infinite] shadow-[0_0_8px_var(--theme-heading)]" />
                          NOW PLAYING
                        </div>
                      )}
                      <div className="font-serif text-[var(--theme-heading)] leading-tight mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: scale.title }}>
                        {song_link ? <a href={song_link} target="_blank" rel="noreferrer" className="hover:underline">{song_name}</a> : song_name}
                      </div>
                      <div className="font-mono font-normal text-[var(--theme-text)] tracking-wide whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: scale.artist }}>
                        {song_artist}
                      </div>
                    </div>
                    
                    <div className="font-mono font-normal text-[var(--theme-text)] tracking-wider whitespace-nowrap flex-shrink-0 text-right" style={{ fontSize: scale.time }}>
                      {last_listened}
                    </div>
                  </div>
                  
                  {idx < feed.recent_songs.length - 1 && (
                    <div className="h-px bg-gradient-to-r from-transparent via-[var(--theme-ui-border)] to-transparent mt-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="flex flex-col gap-6 w-full animate-slide-up pb-20">
            <SectionHeader title="Scrobbler Configuration" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Last.fm Username</label>
                  <input 
                    type="text" 
                    value={spotifyConfig.username}
                    onChange={(e) => setSpotifyConfig({ ...spotifyConfig, username: e.target.value })}
                    className="w-full rounded-md px-3 py-2 outline-none transition-colors border"
                    style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Refresh Interval (seconds)</label>
                  <input 
                    type="number" 
                    min={10} max={300}
                    value={spotifyConfig.refresh_interval}
                    onChange={(e) => setSpotifyConfig({ ...spotifyConfig, refresh_interval: Number(e.target.value) })}
                    className="w-full rounded-md px-3 py-2 outline-none transition-colors border"
                    style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Fetch Method</label>
                  <select 
                    value={spotifyConfig.fetch_method}
                    onChange={(e) => setSpotifyConfig({ ...spotifyConfig, fetch_method: e.target.value })}
                    className="w-full rounded-md px-3 py-2 outline-none transition-colors border"
                    style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                  >
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="Scraping">Scraping</option>
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="API">API</option>
                  </select>
                </div>
              </div>
              
              {spotifyConfig.fetch_method === "API" && (
                <div className="flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Last.fm API Key</label>
                    <div className="relative">
                      <input 
                        type={showApiKey ? "text" : "password"} 
                        value={spotifyConfig.api_key}
                        onChange={(e) => setSpotifyConfig({ ...spotifyConfig, api_key: e.target.value })}
                        className="w-full rounded-md px-3 py-2 pr-10 outline-none transition-colors border"
                        style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)] hover:text-[var(--theme-heading)] transition-colors flex items-center justify-center h-full"
                      >
                        <Icon name={showApiKey ? "visibility_off" : "visibility"} size={18} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Track Limit</label>
                    <input 
                      type="number" 
                      min={1} max={50}
                      value={spotifyConfig.track_limit}
                      onChange={(e) => setSpotifyConfig({ ...spotifyConfig, track_limit: Number(e.target.value) })}
                      className="w-full rounded-md px-3 py-2 outline-none transition-colors border"
                      style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Timezone</label>
                    <select 
                      value={spotifyConfig.timezone}
                      onChange={(e) => setSpotifyConfig({ ...spotifyConfig, timezone: e.target.value })}
                      className="w-full rounded-md px-3 py-2 outline-none transition-colors border"
                      style={{ backgroundColor: "var(--theme-bg)", borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)" }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--theme-heading)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)"}
                    >
                      {Array.from({ length: 27 }, (_, i) => i - 12).map(i => {
                        const sign = i >= 0 ? "+" : "-";
                        const val = `UTC${sign}${Math.abs(i).toString().padStart(2, '0')}:00`;
                        return <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={val} value={val}>{val}</option>;
                      })}
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex mt-4">
              <Button variant="primary" onClick={handleSaveSpotifyConfig} isLoading={isSavingConfig} className="w-full py-4 text-base">
                Save Settings
              </Button>
            </div>
          </div>
        )}
      </ModernTabContent>
    </div>
  );
}

