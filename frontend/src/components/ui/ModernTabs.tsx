"use client";

import React, { useState, useEffect, useRef } from "react";
import { parseMaterialIcon } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  /** Can be a material icon string like ':material/bolt:' or a raw string/node */
  icon?: string | React.ReactNode; 
}

interface ModernTabsProps {
  tabs: TabItem[] | string[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  className?: string;
}

export function ModernTabs({ tabs, activeTab, setActiveTab, className = "" }: ModernTabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A small timeout ensures DOM is fully rendered before measuring
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const activeElement = containerRef.current.querySelector('[data-state="active"]') as HTMLElement;
        if (activeElement) {
          setIndicatorStyle({
            left: activeElement.offsetLeft,
            width: activeElement.offsetWidth,
            opacity: 1
          });
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab, tabs]);

  return (
    <div className={className}>
      <div 
        ref={containerRef}
        className="relative inline-flex max-w-full bg-[var(--theme-ui-bg)] p-1.5 rounded-xl border border-[var(--theme-ui-border)] backdrop-blur-md shadow-sm overflow-x-auto gap-1"
      >
        <div 
           className="absolute top-1.5 bottom-1.5 rounded-lg bg-[var(--theme-heading)] shadow-[0_0_15px_var(--theme-glow1)] transition-all duration-300 ease-out z-0"
           style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px`, opacity: indicatorStyle.opacity }}
        />
        {tabs.map((tabRaw, idx) => {
          // Normalize string vs object tabs
          const isString = typeof tabRaw === 'string';
          const id = isString ? tabRaw : tabRaw.id;
          const rawLabel = isString ? tabRaw : tabRaw.label;
          const explicitIcon = isString ? undefined : tabRaw.icon;
          
          // Parse material icon if the label contains it
          const { icon: parsedIcon, label } = parseMaterialIcon(rawLabel);
          
          // If the explicit icon is a material string like ':material/bolt:', parse it
          let resolvedExplicitIcon = explicitIcon;
          if (typeof explicitIcon === 'string') {
            const { icon: parsedExplicit } = parseMaterialIcon(explicitIcon);
            resolvedExplicitIcon = parsedExplicit || explicitIcon;
          }
          
          const finalIcon = resolvedExplicitIcon || parsedIcon;

          return (
            <button
              key={id}
              data-state={activeTab === id ? 'active' : 'inactive'}
              onClick={() => setActiveTab(id)}
              className={`
                relative z-10 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 whitespace-nowrap flex items-center
                ${activeTab === id 
                  ? "text-[var(--theme-bg)]" 
                  : "text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-white/5"}
              `}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { motion, AnimatePresence } from "framer-motion";

export function ModernTabContent({ activeTab, children, className = "" }: { activeTab: string, children: React.ReactNode, className?: string }) {
  return (
    <div className={`relative w-full ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -20, filter: "blur(4px)" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
