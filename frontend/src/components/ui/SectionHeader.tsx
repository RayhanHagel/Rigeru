import React from "react";

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, icon, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-4 w-full mb-2 ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--theme-text)] flex items-center gap-2 shrink-0">
        {icon}
        {title}
      </h2>
      <div className="h-px bg-[var(--theme-ui-border)] flex-1" />
    </div>
  );
}
