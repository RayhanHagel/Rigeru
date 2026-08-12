import React from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, className = "", actions }: HeaderProps) {
  return (
    <div className={`flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-[var(--theme-ui-border)] pb-4 shrink-0 ${className}`}>
      <div className="flex items-center gap-0">
        <div>
          <h1 className="text-3xl font-bold text-[var(--theme-heading)] tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-[var(--theme-text)] text-sm font-medium">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}

export function STTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-xl font-bold text-zinc-100 mb-4 ${className}`}>{children}</h2>;
}

export function STMarkdown({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-zinc-300 text-sm leading-relaxed mb-4 ${className}`}>{children}</div>;
}
