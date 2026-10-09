"use client";

import React, { useState, useEffect, useRef } from "react";
export interface TabItem {
  id: string;
  label: string;
}

interface ModernTabsProps {
  tabs?: TabItem[] | string[];
  activeTab?: string;
  setActiveTab?: (id: string) => void;
  className?: string;
  actionButton?: React.ReactNode;
}

import { motion, AnimatePresence } from "framer-motion";

export function ModernTabs({ tabs = [], activeTab = "", setActiveTab = () => {}, className = "", actionButton }: ModernTabsProps) {
  const tabId = React.useId();

  return (
    <div className={className}>
      <div 
        className="relative inline-flex max-w-full bg-[var(--theme-ui-bg)] p-1.5 rounded-xl border border-[var(--theme-ui-border)] backdrop-blur-md shadow-sm gap-1 items-center"
      >
        {actionButton && (
          <>
            {actionButton}
            {tabs.length > 0 && <div className="w-px h-6 bg-[var(--theme-ui-border)] mx-1 shrink-0" />}
          </>
        )}
        {tabs.map((tabRaw, idx) => {
          // Normalize string vs object tabs
          const isString = typeof tabRaw === 'string';
          const id = isString ? tabRaw : tabRaw.id;
          const label = isString ? tabRaw : tabRaw.label;
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              data-tab-state={isActive ? 'active' : 'inactive'}
              onClick={() => setActiveTab(id)}
              className={`
                relative z-10 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 whitespace-nowrap flex items-center
                ${isActive 
                  ? "text-[var(--theme-bg)]" 
                  : "text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-white/5"}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId={`modernTabIndicator-${tabId}`}
                  className="absolute inset-0 rounded-lg bg-[var(--theme-heading)] shadow-[0_0_15px_var(--theme-glow1)]"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}



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
