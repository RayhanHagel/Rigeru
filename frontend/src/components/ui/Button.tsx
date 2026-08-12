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
  variant = "secondary", 
  icon, 
  isLoading, 
  fullWidth, 
  size = "md",
  className = "", 
  disabled,
  style,
  ...props 
}: ButtonProps) {
  
  const baseStyles = "relative inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg overflow-hidden group focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants: Record<string, string> = {
    primary: "text-white border",
    secondary: "bg-zinc-800/50 text-zinc-200 hover:bg-zinc-700/80 hover:text-white border border-white/10 hover:border-white/20 focus:ring-zinc-500 backdrop-blur-sm",
    tertiary: "bg-transparent text-zinc-400 hover:bg-white/5",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 focus:ring-red-500",
    ghost: "bg-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-white border border-transparent focus:ring-zinc-500",
  };

  const widthStyle = fullWidth ? "w-full" : "";
  const disabledStyle = disabled || isLoading ? "opacity-50 cursor-not-allowed saturate-50" : "cursor-pointer";

  // Dynamic accent styles for primary and tertiary variants
  const accentStyle: React.CSSProperties = {};
  if (variant === "primary") {
    Object.assign(accentStyle, {
      backgroundColor: "var(--theme-heading)",
      borderColor: "var(--theme-heading)",
      boxShadow: `0 0 15px color-mix(in srgb, var(--theme-heading) 30%, transparent)`,
    });
  } else if (variant === "tertiary") {
    Object.assign(accentStyle, {
      "--tw-ring-color": "var(--theme-heading)",
    });
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${widthStyle} ${disabledStyle} ${className}`}
      disabled={disabled || isLoading}
      style={{ ...accentStyle, ...style }}
      {...props}
    >
      {/* Shine effect for primary button */}
      {variant === "primary" && !disabled && (
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
      )}
      
      {isLoading ? <Icon name="progress_activity" size={16} className="animate-spin" /> : icon}
      <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">{children}</span>
    </button>
  );
}
