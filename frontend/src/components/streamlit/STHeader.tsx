import React from "react";
import { parseMaterialIcon, MaterialIcon } from "@/lib/utils";

interface STHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function STHeader({ title, subtitle, className = "" }: STHeaderProps) {
  const { icon, label } = parseMaterialIcon(title);

  return (
    <div className={`mb-8 ${className}`}>
      <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
        {icon && <MaterialIcon name={icon} style={{ color: "var(--theme-heading)" }} />}
        {label}
      </h1>
      {subtitle && (
        <p className="text-zinc-400 text-base font-medium mt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function STTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-xl font-bold text-zinc-100 mb-4 ${className}`}>{children}</h2>;
}

export function STMarkdown({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  if (typeof children === 'string') {
    const { icon, label } = parseMaterialIcon(children);
    return (
      <p className={`text-zinc-300 text-sm leading-relaxed mb-4 flex items-center gap-2 ${className}`}>
        {icon && <MaterialIcon name={icon} />}
        {label}
      </p>
    );
  }
  return <div className={`text-zinc-300 text-sm leading-relaxed mb-4 ${className}`}>{children}</div>;
}
