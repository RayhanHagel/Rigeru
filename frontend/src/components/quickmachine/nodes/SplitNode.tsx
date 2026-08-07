import { Handle, Position, useReactFlow } from '@xyflow/react';
import { SplitSquareHorizontal, Trash2 } from 'lucide-react';
import { useLayoutUpdate } from '../useLayoutUpdate';

export function SplitNode({ id, data, selected }: any) {
  const { deleteElements, getNodes } = useReactFlow();
  const layoutDir = useLayoutUpdate(id);
  const isVert = layoutDir === 'vertical';
  
  const targetPos = isVert ? Position.Top : Position.Left;
  const sourcePos = isVert ? Position.Bottom : Position.Right;

  return (
    <div className={`group px-4 py-3 shadow-lg rounded-xl border-2 bg-[var(--theme-ui-bg)] backdrop-blur-md min-w-[150px] transition-all duration-200 ${selected ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'border-[var(--theme-ui-border)]'}`}>
      
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
        <Trash2 size={12} />
      </button>
      <Handle type="target" position={targetPos} className="w-3 h-3 bg-pink-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-pink-500/20 text-pink-400">
          <SplitSquareHorizontal size={16} />
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-bold text-zinc-100">{data.label || 'Train/Test Split'}</div>
          <div className="text-xs text-zinc-400 flex flex-col gap-0.5">
             <span>Test: {data.testSize || 20}%</span>
             <span>Seed: {data.randomState || 'None'}</span>
          </div>
        </div>
      </div>
      <Handle type="source" position={sourcePos} id="train" style={isVert ? { left: '35%' } : { top: '35%' }} className="w-3 h-3 bg-pink-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={sourcePos} id="test" style={isVert ? { left: '65%' } : { top: '65%' }} className="w-3 h-3 bg-pink-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {isVert ? (
        <>
          <div className="absolute left-[35%] bottom-[-20px] -translate-x-1/2 text-[9px] text-zinc-500 whitespace-nowrap">Train</div>
          <div className="absolute left-[65%] bottom-[-20px] -translate-x-1/2 text-[9px] text-zinc-500 whitespace-nowrap">Test</div>
        </>
      ) : (
        <>
          <div className="absolute right-[-32px] top-[35%] -translate-y-full text-[9px] text-zinc-500">Train</div>
          <div className="absolute right-[-30px] top-[65%] -translate-y-full text-[9px] text-zinc-500">Test</div>
        </>
      )}
    </div>
  );
}
