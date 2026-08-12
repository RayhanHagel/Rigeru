import { Handle, Position, useReactFlow } from '@xyflow/react';

import { useLayoutUpdate } from '../useLayoutUpdate';
import { Icon } from "@/lib/utils";

export function CustomModelNode({ id, data, selected }: any) {
  const { deleteElements, getNodes } = useReactFlow();
  const layoutDir = useLayoutUpdate(id);
  const targetPos = layoutDir === 'vertical' ? Position.Top : Position.Left;
  const sourcePos = layoutDir === 'vertical' ? Position.Bottom : Position.Right;

  return (
    <div className={`group px-4 py-3 shadow-lg rounded-xl border-2 bg-[var(--theme-ui-bg)] backdrop-blur-md min-w-[150px] transition-all duration-200 ${selected ? 'border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'border-[var(--theme-ui-border)]'}`}>
      
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          const selectedNodes = getNodes().filter(n => n.selected);
          if (selectedNodes.some(n => n.id === id)) {
            deleteElements({ nodes: selectedNodes });
          } else {
            deleteElements({ nodes: [{ id }] });
          }
        }}
        className="absolute -top-3 -right-3 p-1.5 bg-red-500/20 text-red-500 rounded-full border border-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/40 z-10"
      >
        <Icon name="delete" size={12} />
      </button>
      <Handle type="target" position={targetPos} className="w-3 h-3 bg-cyan-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
          <Icon name="memory" size={16} />
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-bold text-zinc-100">{data.label || 'Deep Learning'}</div>
          <div className="text-xs text-cyan-500 flex gap-2">
            <span>{data.framework || 'PyTorch'}</span>
            <span className="text-zinc-400">|</span>
            <span className="text-cyan-300">
              {data.mode === 'code' ? 'Code Editor' : `${data.layers?.length || 0} Layers`}
            </span>
          </div>
        </div>
      </div>
      <Handle type="source" position={sourcePos} className="w-3 h-3 bg-cyan-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
