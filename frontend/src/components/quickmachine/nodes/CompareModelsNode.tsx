import { Handle, Position, useReactFlow } from '@xyflow/react';

import { useLayoutUpdate } from '../useLayoutUpdate';
import { Icon } from "@/lib/utils";

export function CompareModelsNode({ id, data, selected }: any) {
  const { deleteElements, getNodes } = useReactFlow();
  const layoutDir = useLayoutUpdate(id);
  const isVert = layoutDir === 'vertical';
  const sourcePos = isVert ? Position.Bottom : Position.Right;

  return (
    <div className={`group px-4 py-3 shadow-lg rounded-xl border-2 bg-[var(--theme-ui-bg)] backdrop-blur-md min-w-[150px] transition-all duration-200 ${selected ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'border-[var(--theme-ui-border)]'}`}>
      
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

      {isVert ? (
        <>
          <Handle type="target" position={Position.Top} id="models" style={{ left: '30%', top: '-6px' }} className="w-3 h-3 bg-green-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
          <Handle type="target" position={Position.Top} id="test_data" style={{ left: '70%', top: '-6px' }} className="w-3 h-3 bg-green-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute left-[15%] top-[-20px] text-[9px] text-zinc-500">Models</div>
          <div className="absolute left-[60%] top-[-20px] text-[9px] text-zinc-500">Test Data</div>
        </>
      ) : (
        <>
          <Handle type="target" position={Position.Left} id="models" style={{ top: '30%' }} className="w-3 h-3 bg-green-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
          <Handle type="target" position={Position.Left} id="test_data" style={{ top: '70%' }} className="w-3 h-3 bg-green-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute left-[-40px] top-[22%] text-[9px] text-zinc-500">Models</div>
          <div className="absolute left-[-55px] top-[62%] text-[9px] text-zinc-500">Test Data</div>
        </>
      )}
      
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
          <Icon name="emoji_events" size={16} />
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-bold text-zinc-100">{data.label || 'Compare Models'}</div>
          <div className="text-xs text-zinc-400">Leaderboard</div>
        </div>
      </div>
      
      <Handle type="source" position={sourcePos} className="w-3 h-3 bg-green-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
