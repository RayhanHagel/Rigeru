"use client";
import React from 'react';

import { FlowEditor } from '@/components/quickmachine/FlowEditor';
import { Network } from 'lucide-react';

export default function QuickMachinePage() {
  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="px-6 py-4 flex-shrink-0 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary/20 text-secondary">
            <Network size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Visual ML Builder</h1>
            <p className="text-sm text-zinc-400">Connect data, configure algorithms, and train machine learning models.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <FlowEditor />
      </div>
    </div>
  );
}
