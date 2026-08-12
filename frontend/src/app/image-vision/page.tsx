"use client";

import { Header } from '@/components/ui/Header';
import { navigation } from '@/components/layout/Sidebar';

import { Card } from '@/components/ui/Card';
import { Icon } from "@/lib/utils";


export default function MediaVisionPage() {
  const categoryPath = '/image-vision';
  const category = navigation.find(n => n.href === categoryPath);
  
  if (!category) return null;

  return (
    <div className="p-8 w-full animate-slide-up">
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
