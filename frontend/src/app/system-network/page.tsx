"use client";
import { Header } from "@/components/ui/Header";
import React from 'react';
import { navigation } from '@/components/layout/Sidebar';
import { LayoutGrid } from 'lucide-react';
import { Card } from '@/components/ui/Card';


export default function CategoryPage() {
  const categoryPath = '/system-network';
  const category = navigation.find(n => n.href === categoryPath);
  
  if (!category) return null;

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title={category.title} subtitle={category.description || "Select a tool from the grid below to get started"} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-slide-up">
        {category.items.map((item) => (
          <Card 
            key={item.href}
            href={item.href}
            title={item.title}
            description={item.description || "Click to open this tool"}
            icon={item.icon}
          />
        ))}
      </div>
    </div>
  );
}
