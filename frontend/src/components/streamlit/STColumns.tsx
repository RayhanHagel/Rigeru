import React from "react";

interface STColumnsProps {
  children: React.ReactNode;
  className?: string;
}

export function STColumns({ children, className = "" }: STColumnsProps) {
  return (
    <div className={`flex flex-col md:flex-row gap-4 w-full ${className}`}>
      {React.Children.map(children, (child) => {
        // We handle width dynamically if passed to STColumn
        const childProps = React.isValidElement(child) ? (child.props as any) : null;
        const flexValue = childProps && childProps.width 
          ? `flex-[${childProps.width}]` 
          : "flex-1";
          
        return (
          <div className={`${flexValue} w-full min-w-0`}>
            {child}
          </div>
        );
      })}
    </div>
  );
}

export function STColumn({ children, width }: { children: React.ReactNode; width?: number }) {
  return <>{children}</>;
}
