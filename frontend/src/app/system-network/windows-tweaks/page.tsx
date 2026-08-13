"use client";
import React from 'react';
import { Header } from "@/components/ui/Header";

export default function WindowsTweaksPage() {
  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Windows Tweaks" subtitle="Customize and optimize Windows settings." />
      <div className="flex flex-col gap-6 animate-slide-up w-full">
        <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] rounded-2xl p-6 shadow-sm">
          <p className="text-[var(--theme-text)]">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}
