"use client";

import React from "react";
import { Info } from "lucide-react";

interface SliderProps {
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  onChange: (val: number) => void;
  helpText?: string;
}

export function Slider({ label, min, max, value, step = 1, onChange, helpText }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full flex flex-col gap-3 group">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          {label}
          {helpText && (
            <div className="relative flex items-center">
              <Info size={14} className="text-zinc-500 hover:text-zinc-300 cursor-help transition-colors" />
              {/* Tooltip could go here */}
            </div>
          )}
        </label>
        <span 
          className="text-xs font-mono px-2 py-1 rounded-md border"
          style={{
            backgroundColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
            color: "var(--theme-heading)",
            borderColor: "color-mix(in srgb, var(--theme-heading) 30%, transparent)",
          }}
        >
          {value}
        </span>
      </div>
      
      <div className="relative flex items-center h-5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 transition-all z-10"
          style={{
            accentColor: "var(--theme-heading)",
            // @ts-expect-error CSS custom properties
            "--tw-ring-color": "color-mix(in srgb, var(--theme-heading) 50%, transparent)",
          }}
        />
        {/* Fancy track highlight */}
        <div 
          className="absolute left-0 h-1.5 rounded-l-lg pointer-events-none"
          style={{ 
            width: `${percentage}%`,
            background: `linear-gradient(to right, color-mix(in srgb, var(--theme-heading) 80%, #6366f1), var(--theme-heading))`,
          }}
        />
      </div>
      
      {helpText && (
        <p className="text-xs text-zinc-500 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-0 group-hover:h-auto overflow-hidden">
          {helpText}
        </p>
      )}
    </div>
  );
}
