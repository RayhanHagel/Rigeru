"use client";

import React, { InputHTMLAttributes, forwardRef } from "react";
import { Info } from "lucide-react";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helpText?: string;
  icon?: React.ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, helpText, icon, className = "", ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-2 group">
        {label && (
          <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            {label}
            {helpText && (
              <div className="relative flex items-center group/tooltip">
                <Info size={14} className="text-zinc-500 hover:text-zinc-300 cursor-help transition-colors" />
                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-max max-w-xs bg-zinc-800 text-zinc-200 text-xs px-2 py-1 rounded opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-20 shadow-xl border border-white/10">
                  {helpText}
                </div>
              </div>
            )}
          </label>
        )}
        
        <div className="relative flex items-center">
          {icon && (
            <div 
              className="absolute left-3 text-zinc-500 transition-colors"
              style={{ color: undefined }}
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-zinc-900/50 border rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 transition-all backdrop-blur-sm shadow-inner ${icon ? 'pl-10' : ''} ${className}`}
            style={{
              borderColor: "var(--theme-ui-border)",
              // @ts-expect-error CSS custom properties
              "--tw-ring-color": "color-mix(in srgb, var(--theme-heading) 50%, transparent)",
            }}
            {...props}
          />
        </div>
      </div>
    );
  }
);
TextInput.displayName = "TextInput";
