import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/Button';
import { Icon } from "@/lib/utils";

interface PopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function PopupModal({ isOpen, onClose, title, children }: PopupModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0 bg-white/5">
          <h3 className="text-lg font-medium text-white">{title}</h3>
          <Button variant="ghost" onClick={onClose} className="!p-2 hover:bg-white/10 rounded-xl transition-colors">
            <Icon name="close" size={20} className="text-zinc-400" />
          </Button>
        </div>
        <div className="p-6 flex flex-col flex-1 overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
