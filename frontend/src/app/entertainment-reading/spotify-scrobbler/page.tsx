"use client";

import { useEffect, useState } from "react";

import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

type ScrobbleTrack = [string, string | null, string, string, string | null];

interface FeedData {
  avatar_url: string | null;
  scrobble_amount: string;
  scrobble_artist: string;
  recent_songs: ScrobbleTrack[];
}

export default function SpotifyScrobbler() {
  const { spotifyConfig } = useSettingsStore();
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 border-b border-primary/30 pb-4">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Spotify Scrobbler</h1>
            <p className="text-zinc-400 text-sm font-medium">Live, auto-refreshing feed of your Last.fm</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {spotifyConfig.username && (
            <Button variant="secondary" onClick={fetchFeed} isLoading={isFetching} icon={<Icon name="refresh" size={16} />}>
              Force Sync
            </Button>
          )}
        </div>
      </div>

      {!spotifyConfig.username ? (
        <div className="flex flex-col items-center justify-center h-64 text-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 backdrop-blur-sm">
          <div className="p-4 bg-zinc-900/50 rounded-full mb-4">
            <Icon name="music_note" size={32} className="text-zinc-600" />
          </div>
          <p className="text-zinc-400 text-lg">No Last.fm username configured.</p>
          <p className="text-zinc-500 text-sm">Open the Page Settings sidebar on the right to configure.</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm">
          <p className="text-red-400 text-lg">{error}</p>
        </div>
      ) : !feed ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-zinc-500 text-lg">Fetching latest listening history</p>
        </div>
      ) : (
        <div className="w-full pb-20 animate-slide-up">
          {/* Profile Header */}
          <div className="flex items-center gap-4 py-3 mb-8">
            <img 
              src={feed.avatar_url?.startsWith('/app/static') ? `${feed.avatar_url.replace('/app/static', '/static')}` : feed.avatar_url!} 
              alt="Avatar" 
              className="w-14 h-14 rounded-full border-2 border-white/10 object-cover shadow-[0_4px_12px_rgba(0,0,0,0.3)]" 
            />
            <div>
              <div className="font-serif italic text-[13px] text-zinc-400 tracking-wide">listening history</div>
              <div className="font-mono text-base font-semibold text-zinc-100 tracking-wide">{spotifyConfig.username}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-mono text-2xl font-semibold text-zinc-100 tracking-tight">{parseInt(feed.scrobble_amount).toLocaleString()}</div>
              <div className="font-serif italic text-xs text-zinc-400">scrobbles</div>
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
                      className={`relative flex-shrink-0 rounded-lg shadow-xl overflow-hidden bg-zinc-950 flex items-center justify-center ${isScrobbling ? "overflow-visible shadow-[0_0_20px_rgba(168,85,247,0.3)]" : ""}`}
                      style={{ width: scale.cover, height: scale.cover }}
                    >
                      <img 
                        src={imageSrc} 
                        className="w-full h-full block rounded-lg object-cover transition-transform duration-500 hover:scale-105" 
                      />
                      {isScrobbling && (
                        <div className="absolute -inset-1 rounded-xl border-2 border-zinc-100 animate-[pulse_2s_ease-out_infinite] pointer-events-none" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {isScrobbling && (
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-zinc-100 mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-100 animate-[blink_1.2s_ease-in-out_infinite] shadow-[0_0_8px_#f4f4f5]" />
                          NOW PLAYING
                        </div>
                      )}
                      <div className="font-serif text-zinc-100 leading-tight mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: scale.title }}>
                        {song_link ? <a href={song_link} target="_blank" rel="noreferrer" className="hover:underline">{song_name}</a> : song_name}
                      </div>
                      <div className="font-mono font-normal text-zinc-400 tracking-wide whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: scale.artist }}>
                        {song_artist}
                      </div>
                    </div>
                    
                    <div className="font-mono font-normal text-zinc-500 tracking-wider whitespace-nowrap flex-shrink-0 text-right" style={{ fontSize: scale.time }}>
                      {last_listened}
                    </div>
                  </div>
                  
                  {idx < feed.recent_songs.length - 1 && (
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
