import React from "react";

/**
 * Shared utility functions for the frontend.
 */

/**
 * Parses a Streamlit-style material icon string (e.g., ":material/icon_name: Label")
 * into its icon name and label parts.
 */
export function parseMaterialIcon(text: string): { icon: string | null; label: string } {
  const match = text.match(/:material\/([a-z_]+):\s*(.*)/);
  if (match) {
    return { icon: match[1], label: match[2].trim() };
  }
  return { icon: null, label: text.trim() };
}

/**
 * Renders a Google Material Symbols Outlined icon.
 */
export function MaterialIcon({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={{ fontSize: 'inherit', ...style }}>
      {name}
    </span>
  );
}

/**
 * Enhanced icon component with explicit size prop — drop-in Lucide replacement.
 * Usage: <Icon name="download" size={20} className="text-white" />
 */
export function Icon({ name, size = 20, className = "", style }: {
  name: string; size?: number; className?: string; style?: React.CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: `${size}px`, lineHeight: 1, ...style }}
    >
      {name}
    </span>
  );
}
