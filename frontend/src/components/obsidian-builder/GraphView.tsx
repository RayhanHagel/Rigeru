"use client";
import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

import * as d3 from 'd3-force';
import { Icon } from "@/lib/utils";

export default function GraphView({ graphData, settings = {}, onNodeClick }: { graphData: any, settings?: any, onNodeClick?: (id: string) => void }) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle Resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', updateDimensions);
    // Slight delay to ensure DOM is settled
    setTimeout(updateDimensions, 100);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (fgRef.current && settings) {
      // Apply center force
      fgRef.current.d3Force('center', d3.forceCenter(0, 0).strength(settings.centerForce ?? 0.05));
      
      // Apply charge (repel) force
      fgRef.current.d3Force('charge').strength(-(settings.repelForce ?? 300));
      
      // Apply link distance and strength
      fgRef.current.d3Force('link').distance(settings.linkDistance ?? 50);
      
      // Collision force to prevent exact overlaps
      fgRef.current.d3Force('collide', d3.forceCollide((node: any) => {
        const radius = (settings.nodeSize ?? 5.0) + 2;
        return radius;
      }).iterations(2));
      
      // Reheat simulation
      fgRef.current.d3ReheatSimulation();
    }
  }, [graphData, settings]);

  const handleZoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.5, 400);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() / 1.5, 400);
    }
  };

  const handleFit = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-950/50 rounded-xl overflow-hidden relative">
      
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-black/50 p-2 rounded-lg border border-white/10 backdrop-blur-sm">
        <button onClick={handleZoomIn} className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded transition-colors" title="Zoom In">
          <Icon name="zoom_in" size={18} />
        </button>
        <button onClick={handleFit} className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded transition-colors" title="Fit to Screen">
          <Icon name="fullscreen" size={18} />
        </button>
        <button onClick={handleZoomOut} className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded transition-colors" title="Zoom Out">
          <Icon name="zoom_out" size={18} />
        </button>
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="id"
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkColor={() => 'rgba(255, 255, 255, 0.3)'}
        linkWidth={settings.linkThickness ?? 1.5}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.id;
          const groupIdx = typeof node.group === 'number' ? node.group : 0;
          
          const depthColors = [
            '#ef4444', // 0: red-500 (Root)
            '#f97316', // 1: orange-500
            '#eab308', // 2: yellow-500
            '#22c55e', // 3: green-500
            '#0ea5e9', // 4: sky-500
            '#3b82f6', // 5: blue-500
            '#a855f7', // 6: purple-500
            '#ec4899', // 7: pink-500
          ];
          const nodeColor = depthColors[groupIdx % depthColors.length];
          const radius = settings.nodeSize ?? 5.0;

          // Draw the circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = nodeColor;
          ctx.fill();

          // Draw text only if we zoomed in enough
          if (globalScale >= (settings.textFadeThreshold ?? 1.5)) {
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            // Text shadow for readability
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillText(label, node.x, node.y + radius + (2 / globalScale));
            ctx.fillText(label, node.x + (1/globalScale), node.y + radius + (3 / globalScale));
            
            ctx.fillStyle = '#e4e4e7'; // zinc-200
            ctx.fillText(label, node.x, node.y + radius + (3 / globalScale));
          }

          node.__radius = radius; 
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.__radius + 2, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        onNodeClick={(node: any) => {
          if (onNodeClick) onNodeClick(node.id);
        }}
      />
    </div>
  );
}
