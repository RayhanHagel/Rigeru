import { Handle, Position, useReactFlow } from '@xyflow/react';

import { useLayoutUpdate } from '../useLayoutUpdate';
import { Icon } from "@/lib/utils";

export function FeatureSplitNode({ id, data, selected }: any) {
  const { deleteElements, getNodes } = useReactFlow();
  const layoutDir = useLayoutUpdate(id);
  const isVert = layoutDir === 'vertical';
  
  const targetPos = isVert ? Position.Top : Position.Left;
  const sourcePos = isVert ? Position.Bottom : Position.Right;

  return (
    <div className={`group px-4 py-3 shadow-lg rounded-xl border-2 bg-[var(--theme-ui-bg)] backdrop-blur-md min-w-[150px] transition-all duration-200 ${selected ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'border-[var(--theme-ui-border)]'}`}>
      
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
      
      <Handle type="target" position={targetPos} className="w-3 h-3 bg-purple-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
          <Icon name="fork_right" size={16} />
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-bold text-zinc-100">{data.label || 'Feature Split'}</div>
          <div className="text-xs text-zinc-400">Cat / Num</div>
        </div>
      </div>
      
      <Handle type="source" position={sourcePos} id="categorical" style={isVert ? { left: '30%', top: 'auto', bottom: '-6px' } : { top: '30%', left: 'auto', right: '-6px' }} className="w-3 h-3 bg-purple-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={sourcePos} id="numerical" style={isVert ? { left: '70%', top: 'auto', bottom: '-6px' } : { top: '70%', left: 'auto', right: '-6px' }} className="w-3 h-3 bg-purple-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {isVert ? (
        <>
          <div className="absolute left-[15%] bottom-[-20px] text-[9px] text-zinc-500">Categorical</div>
          <div className="absolute left-[60%] bottom-[-20px] text-[9px] text-zinc-500">Numerical</div>
        </>
      ) : (
        <>
          <div className="absolute right-[-45px] top-[22%] text-[9px] text-zinc-500">Categorical</div>
          <div className="absolute right-[-45px] top-[62%] text-[9px] text-zinc-500">Numerical</div>
        </>
      )}
    </div>
  );
}
