import React from "react";

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`w-full h-px bg-white/10 my-6 ${className}`} />;
}
