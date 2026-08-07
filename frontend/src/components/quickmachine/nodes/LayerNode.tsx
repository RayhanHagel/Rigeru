import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Layers, Trash2 } from 'lucide-react';
import { useLayoutUpdate } from '../useLayoutUpdate';

export function LayerNode({ id, data, selected }: any) {
  const { deleteElements, getNodes } = useReactFlow();
  const layoutDir = useLayoutUpdate(id);
  const targetPos = layoutDir === 'vertical' ? Position.Top : Position.Left;
  const sourcePos = layoutDir === 'vertical' ? Position.Bottom : Position.Right;

  // Color mapping based on layer type
  const getTypeColor = (type: string) => {
    if (type.includes('Conv')) return 'cyan';
    if (type.includes('Linear') || type.includes('Dense')) return 'blue';
    if (type.includes('Pool')) return 'teal';
    if (type.includes('Dropout')) return 'pink';
    if (type.includes('Flatten')) return 'gray';
    if (type.includes('RNN') || type.includes('LSTM') || type.includes('GRU')) return 'indigo';
    if (type.includes('Norm')) return 'emerald';
    if (type.includes('Attention') || type.includes('MQA') || type.includes('GQA') || type.includes('MLA') || type.includes('MoE') || type.includes('SwiGLU')) return 'orange';
    if (type.includes('Embedding') || type.includes('RoPE')) return 'lime';
    return 'purple';
  };

  const c = getTypeColor(data.layerType || '');

  return (
    <div className={`group px-4 py-3 shadow-lg rounded-xl border-2 bg-[var(--theme-ui-bg)] backdrop-blur-md min-w-[150px] transition-all duration-200 ${selected ? `border-${c}-500 shadow-[0_0_15px_var(--tw-shadow-color)] shadow-${c}-500/40` : 'border-[var(--theme-ui-border)]'}`}>
      
      {!data.isInput && (
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
      )}

      {data.isInput ? null : (
        <Handle type="target" position={targetPos} className={`w-3 h-3 bg-${c}-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity`} />
      )}
      
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg bg-${c}-500/20 text-${c}-400`}>
          <Layers size={16} />
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-bold text-zinc-100">{data.label || data.layerType || 'Layer'}</div>
          {data.activation && data.activation !== 'None' && (
            <div className={`text-[10px] text-${c}-400 mt-0.5 uppercase`}>{data.activation}</div>
          )}
        </div>
      </div>
      
      {data.isOutput ? null : (
        <Handle type="source" position={sourcePos} className={`w-3 h-3 bg-${c}-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity`} />
      )}
    </div>
  );
}
