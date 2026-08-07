import React from "react";

interface ColumnsProps {
  children: React.ReactNode;
  className?: string;
}

export function Columns({ children, className = "" }: ColumnsProps) {
  return (
    <div className={`flex flex-col md:flex-row gap-4 w-full ${className}`}>
      {React.Children.map(children, (child) => {
        // We handle width dynamically if passed to Column
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

interface ColumnProps {
  children: React.ReactNode;
  width?: number;
}

export function Column({ children, width }: ColumnProps) {
  return <>{children}</>;
}
