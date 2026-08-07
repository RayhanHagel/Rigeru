import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Wand2, Trash2 } from 'lucide-react';
import { useLayoutUpdate } from '../useLayoutUpdate';

export function HypertuneNode({ id, data, selected }: any) {
  const { deleteElements, getNodes } = useReactFlow();
  const layoutDir = useLayoutUpdate(id);
  const targetPos = layoutDir === 'vertical' ? Position.Top : Position.Left;
  const sourcePos = layoutDir === 'vertical' ? Position.Bottom : Position.Right;

  return (
    <div className={`group px-4 py-3 shadow-lg rounded-xl border-2 bg-[var(--theme-ui-bg)] backdrop-blur-md min-w-[150px] transition-all duration-200 ${selected ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'border-[var(--theme-ui-border)]'}`}>
      
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

      {layoutDir === 'vertical' ? (
        <>
          <Handle type="target" position={Position.Top} id="data" style={{ left: '30%', top: '-6px' }} className="w-3 h-3 bg-yellow-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
          <Handle type="target" position={Position.Top} id="model" style={{ left: '70%', top: '-6px' }} className="w-3 h-3 bg-yellow-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute left-[20%] top-[-20px] text-[9px] text-zinc-500">Data</div>
          <div className="absolute left-[65%] top-[-20px] text-[9px] text-zinc-500">Model</div>
        </>
      ) : (
        <>
          <Handle type="target" position={Position.Left} id="data" style={{ top: '30%' }} className="w-3 h-3 bg-yellow-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
          <Handle type="target" position={Position.Left} id="model" style={{ top: '70%' }} className="w-3 h-3 bg-yellow-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute left-[-40px] top-[22%] text-[9px] text-zinc-500">Data</div>
          <div className="absolute left-[-45px] top-[62%] text-[9px] text-zinc-500">Model</div>
        </>
      )}
      
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-yellow-500/20 text-yellow-500">
          <Wand2 size={16} />
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-bold text-zinc-100">{data.label || 'Hypertuning'}</div>
          <div className="text-xs text-zinc-400">{data.tuner || 'Optuna'} <span className="text-yellow-500 ml-1">({data.trials || 50} Trials)</span></div>
        </div>
      </div>
      <Handle type="source" position={sourcePos} className="w-3 h-3 bg-yellow-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
