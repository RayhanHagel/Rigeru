"use client";
import React from "react";
import Link from "next/link";

interface CardProps {
  href?: string;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function Card({ href, title, description, icon, children, className = "" }: CardProps) {
  const content = (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-glow1)] to-[var(--theme-glow2)] opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:-translate-y-1 rounded-2xl pointer-events-none mix-blend-screen" />
      <div className={`relative p-6 rounded-2xl border border-[var(--theme-ui-border)] bg-[var(--theme-ui-bg)] backdrop-blur-md hover:bg-white/10 transition-all duration-300 flex flex-col gap-4 h-full shadow-lg hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-white/20 overflow-hidden ${className}`}>
        
        {/* Subtle shimmer effect on hover */}
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

        {(icon || title || description) && (
          <div className="flex items-start gap-4 z-10">
            {icon && (
              <div className="flex items-center justify-center shrink-0 p-3 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)] shadow-inner group-hover:scale-110 transition-transform duration-300">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="font-bold text-lg text-[var(--theme-heading)] group-hover:text-white transition-colors">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-[var(--theme-text)] mt-1 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="z-10 flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group relative block h-full">
        {content}
      </Link>
    );
  }

  return (
    <div className="group relative block h-full">
      {content}
    </div>
  );
}
