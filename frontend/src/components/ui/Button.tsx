"use client";

import React from "react";
import { Icon } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "danger" | "ghost";
  icon?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg" | "icon";
}

export function Button({ 
  children, 
  variant = "secondary", // Ignored now, kept for backward compatibility with props
  icon, 
  isLoading, 
  fullWidth, 
  size = "md",
  className = "", 
  disabled,
  style,
  ...props 
}: ButtonProps) {
  
  const sizeMap: Record<string, string> = {
    sm: "h-8 text-xs px-3",
    md: "h-10 text-sm px-4",
    lg: "h-12 text-lg px-6",
    icon: "h-10 w-10 p-0 flex items-center justify-center text-sm"
  };

  const currentSizeClass = sizeMap[size] || sizeMap.md;

  // Enforce the 'Process Images' style (borderless, primary colors) but dynamic size
  const baseStyles = `w-full relative inline-flex items-center justify-center gap-2 font-medium transition-colors duration-300 rounded-lg overflow-hidden group focus:outline-none !shadow-none !ring-0 !outline-none border-none ${currentSizeClass}`;
  
  const disabledStyle = disabled || isLoading ? "opacity-50 cursor-not-allowed saturate-50" : "cursor-pointer";

  const accentStyle: React.CSSProperties = {
    backgroundColor: "var(--theme-heading)",
    color: "var(--theme-bg)",
    boxShadow: "none",
    ...style // Allow passing custom styles like mt-2, but override base colors if necessary, though style is spread last
  };

  return (
    <button
      className={`${baseStyles} ${disabledStyle} ${className}`}
      disabled={disabled || isLoading}
      style={accentStyle}
      {...props}
    >
      {!disabled && (
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
      )}
      
      {/* Only show loading spinner, explicitly ignoring the `icon` prop otherwise as requested */}
      {isLoading ? <Icon name="progress_activity" size={16} className="animate-spin" /> : null}
      <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">{children}</span>
    </button>
  );
}
