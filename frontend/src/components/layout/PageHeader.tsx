"use client";
import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, icon, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[var(--theme-ui-border)] animate-[fade-in_0.5s_ease-out]">
      <div className="flex items-center gap-5">
        {icon && (
          <div className="p-4 bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-2xl border border-[var(--theme-ui-border)] text-[var(--theme-text)] shadow-[0_0_20px_var(--theme-glow1)]">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-[var(--theme-heading)] to-[var(--theme-text)] tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[var(--theme-text)] mt-2 text-lg font-medium opacity-80">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
