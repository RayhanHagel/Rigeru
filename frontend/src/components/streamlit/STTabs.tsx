"use client";

import React, { useState } from "react";
import { parseMaterialIcon } from "@/lib/utils";

interface STTabsProps {
  tabs: string[];
  children: React.ReactNode | React.ReactNode[];
  className?: string;
}

export function STTabs({ tabs, children, className = "" }: STTabsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex gap-2 border-b border-white/10 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab, idx) => {
          const { icon, label } = parseMaterialIcon(tab);
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`
                px-4 py-2 font-medium text-sm rounded-t-lg transition-colors border-b-2
                whitespace-nowrap flex items-center gap-2
                ${activeTab === idx 
                  ? "" 
                  : "text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-white/5"}
              `}
              style={activeTab === idx ? {
                color: "var(--theme-heading)",
                borderBottomColor: "var(--theme-heading)",
                backgroundColor: "color-mix(in srgb, var(--theme-heading) 10%, transparent)",
              } : undefined}
            >
              {icon && (
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {icon}
                </span>
              )}
              {label}
            </button>
          );
        })}
      </div>
      <div className="w-full">
        {childrenArray[activeTab]}
      </div>
    </div>
  );
}
