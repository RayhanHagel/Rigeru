export const APP_THEMES: Record<string, {
  BG: string;
  TEXT: string;
  HEADING: string;
  GLOW_1: string;
  GLOW_2: string;
  UI_BG: string;
  UI_BORDER: string;
}> = {
  "Nebula (Default)": {
    "BG": "#131620",
    "TEXT": "rgba(255,255,255,0.78)",
    "HEADING": "rgba(255,255,255,0.92)",
    "GLOW_1": "rgba(120,80,255,0.18)",
    "GLOW_2": "rgba(255,60,120,0.12)",
    "UI_BG": "rgba(255,255,255,0.05)",
    "UI_BORDER": "rgba(255,255,255,0.10)"
  },
  "Cyberpunk": {
    "BG": "#090a0f",
    "TEXT": "rgba(220,240,255,0.85)",
    "HEADING": "#00FFCC",
    "GLOW_1": "rgba(0,255,204,0.15)",
    "GLOW_2": "rgba(255,0,128,0.15)",
    "UI_BG": "rgba(0,255,204,0.05)",
    "UI_BORDER": "rgba(0,255,204,0.25)"
  },
  "Light Minimal": {
    "BG": "#F9FAFB",
    "TEXT": "#1f2937",
    "HEADING": "#111827",
    "GLOW_1": "rgba(59,130,246,0.12)",
    "GLOW_2": "rgba(147,51,234,0.08)",
    "UI_BG": "#ffffff",
    "UI_BORDER": "rgba(0,0,0,0.25)"
  },
  "Deep Forest": {
    "BG": "#0a120d",
    "TEXT": "rgba(230,245,235,0.80)",
    "HEADING": "#86efac",
    "GLOW_1": "rgba(34,197,94,0.15)",
    "GLOW_2": "rgba(234,179,8,0.10)",
    "UI_BG": "rgba(255,255,255,0.04)",
    "UI_BORDER": "rgba(34,197,94,0.20)"
  },
  "Midnight Blue": {
    "BG": "#080c17",
    "TEXT": "rgba(200,220,255,0.80)",
    "HEADING": "#93c5fd",
    "GLOW_1": "rgba(59,130,246,0.18)",
    "GLOW_2": "rgba(14,165,233,0.12)",
    "UI_BG": "rgba(255,255,255,0.05)",
    "UI_BORDER": "rgba(59,130,246,0.20)"
  },
  "Sunset Glow": {
    "BG": "#1a0f14",
    "TEXT": "rgba(255,230,220,0.85)",
    "HEADING": "#ff8c42",
    "GLOW_1": "rgba(255,94,77,0.15)",
    "GLOW_2": "rgba(255,140,66,0.12)",
    "UI_BG": "rgba(255,255,255,0.04)",
    "UI_BORDER": "rgba(255,140,66,0.25)"
  },
  "Retro Wave": {
    "BG": "#0d0221",
    "TEXT": "rgba(220,210,255,0.85)",
    "HEADING": "#ff00ff",
    "GLOW_1": "rgba(255,0,255,0.15)",
    "GLOW_2": "rgba(0,255,255,0.15)",
    "UI_BG": "rgba(255,0,255,0.04)",
    "UI_BORDER": "rgba(0,255,255,0.30)"
  },
  "Solarized Light": {
    "BG": "#fdf6e3",
    "TEXT": "#657b83",
    "HEADING": "#268bd2",
    "GLOW_1": "rgba(38,139,210,0.10)",
    "GLOW_2": "rgba(211,54,130,0.08)",
    "UI_BG": "#eee8d5",
    "UI_BORDER": "rgba(101,123,131,0.25)"
  },
  "Hacker Terminal": {
    "BG": "#000000",
    "TEXT": "#00ff00",
    "HEADING": "#00ff00",
    "GLOW_1": "rgba(0,255,0,0.10)",
    "GLOW_2": "rgba(0,150,0,0.10)",
    "UI_BG": "rgba(0,255,0,0.05)",
    "UI_BORDER": "rgba(0,255,0,0.40)"
  },
  "Volcanic": {
    "BG": "#1a0a0a",
    "TEXT": "rgba(255,235,225,0.80)",
    "HEADING": "#ef4444",
    "GLOW_1": "rgba(239,68,68,0.15)",
    "GLOW_2": "rgba(245,158,11,0.10)",
    "UI_BG": "rgba(255,255,255,0.03)",
    "UI_BORDER": "rgba(239,68,68,0.20)"
  },
  "Ocean Depth": {
    "BG": "#051622",
    "TEXT": "rgba(200,230,240,0.80)",
    "HEADING": "#22d3ee",
    "GLOW_1": "rgba(34,211,238,0.15)",
    "GLOW_2": "rgba(30,58,138,0.15)",
    "UI_BG": "rgba(34,211,238,0.05)",
    "UI_BORDER": "rgba(34,211,238,0.25)"
  },
  "Amethyst": {
    "BG": "#160f1e",
    "TEXT": "rgba(230,220,250,0.85)",
    "HEADING": "#a78bfa",
    "GLOW_1": "rgba(167,139,250,0.15)",
    "GLOW_2": "rgba(236,72,153,0.10)",
    "UI_BG": "rgba(255,255,255,0.03)",
    "UI_BORDER": "rgba(167,139,250,0.20)"
  },
  "Sepia Tone": {
    "BG": "#f4ecd8",
    "TEXT": "#5b4636",
    "HEADING": "#785940",
    "GLOW_1": "rgba(120,89,64,0.08)",
    "GLOW_2": "rgba(200,180,150,0.10)",
    "UI_BG": "#ece3ce",
    "UI_BORDER": "rgba(120,89,64,0.20)"
  },
  "Monochrome Slate": {
    "BG": "#1f2937",
    "TEXT": "rgba(209,213,219,0.90)",
    "HEADING": "#f9fafb",
    "GLOW_1": "rgba(255,255,255,0.05)",
    "GLOW_2": "rgba(156,163,175,0.05)",
    "UI_BG": "rgba(255,255,255,0.05)",
    "UI_BORDER": "rgba(209,213,219,0.15)"
  },
  "Catppuccin Mocha": {
    "BG": "#1e1e2e",
    "TEXT": "#cdd6f4",
    "HEADING": "#89b4fa",
    "GLOW_1": "rgba(137, 180, 250, 0.15)",
    "GLOW_2": "rgba(245, 194, 231, 0.10)",
    "UI_BG": "#313244",
    "UI_BORDER": "#45475a"
  }
};
