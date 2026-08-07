import React from "react";

interface ContainerProps {
  children: React.ReactNode;
  border?: boolean;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
}

export function Container({ children, border = false, className = "", title, icon }: ContainerProps) {
  return (
    <div 
      className={`
        w-full p-6 bg-zinc-900/60 backdrop-blur-md rounded-2xl
        ${border ? "border border-white/10" : "border border-transparent"}
        transition-all hover:bg-zinc-900/80 hover:border-white/20
        ${className}
      `}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-4 font-semibold text-zinc-200">
          {icon}
          <span>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}
