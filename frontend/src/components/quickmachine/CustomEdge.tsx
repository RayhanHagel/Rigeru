import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react';
import { Icon } from "@/lib/utils";

export function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, label, labelStyle, labelBgStyle, labelBgPadding, labelBgBorderRadius, selected }: any) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: selected ? 3 : 2, stroke: selected ? '#06b6d4' : undefined, transition: 'all 0.2s' }} />
      
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              zIndex: 50
            }}
            className="nodrag nopan"
          >
            <div 
              style={{
                ...labelBgStyle,
                padding: labelBgPadding ? `${labelBgPadding[0]}px ${labelBgPadding[1]}px` : '4px 6px',
                borderRadius: labelBgBorderRadius || 4,
              }}
            >
              <span style={labelStyle}>{label}</span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 100,
            width: 50,
            height: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          className="nodrag nopan group"
        >
          <button
            className="p-1.5 bg-red-500/90 text-white rounded-full border-2 border-zinc-900 shadow-lg hover:bg-red-500 hover:scale-110 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
            onClick={() => setEdges((eds) => eds.filter(e => e.id !== id))}
            style={{ marginTop: label ? '-50px' : '0px' }}
          >
            <Icon name="delete" size={12} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
