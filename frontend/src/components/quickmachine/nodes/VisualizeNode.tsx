import { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { createPortal } from 'react-dom';
import { BarChart2, Trash2, Play, Download, X } from 'lucide-react';
import { useLayoutUpdate } from '../useLayoutUpdate';

export function VisualizeNode({ id, data, selected }: any) {
  const { deleteElements, getNodes, getEdges } = useReactFlow();
  const layoutDir = useLayoutUpdate(id);
  const targetPos = layoutDir === 'vertical' ? Position.Top : Position.Left;
  const sourcePos = layoutDir === 'vertical' ? Position.Bottom : Position.Right;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVisualize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
    setIsLoading(true);
    setError(null);
    
    try {
      const nodes = getNodes();
      const edges = getEdges();
      
      const response = await fetch('http://localhost:8000/api/quickmachine/visualize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          nodes,
          edges,
          target_node_id: id
        })
      });
      
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.detail || 'Failed to generate plot');
      
      setImageB64(resData.image);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageB64) return;
    const a = document.createElement('a');
    a.href = imageB64;
    a.download = `plot_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
    <div className={`group px-4 py-3 shadow-lg rounded-xl border-2 bg-[var(--theme-ui-bg)] backdrop-blur-md min-w-[150px] transition-all duration-200 ${selected ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'border-[var(--theme-ui-border)]'}`}>
      
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

      <Handle type="target" position={targetPos} className="w-3 h-3 bg-rose-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
          <BarChart2 size={16} />
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-bold text-zinc-100">{data.label || 'Visualize Data'}</div>
          <div className="text-xs text-zinc-400">{data.plotType || 'Distribution Plot'}</div>
        </div>
        <button 
          onClick={handleVisualize}
          className="ml-2 p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-md transition-colors"
          title="Generate Plot"
        >
          <Play size={14} />
        </button>
      </div>
      
      <Handle type="source" position={sourcePos} className="w-3 h-3 bg-rose-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>

    {/* Visualization Modal */}
    {isModalOpen && typeof document !== 'undefined' && createPortal(
      <div 
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setIsModalOpen(false)}
      >
        <div 
          className="bg-zinc-900 border border-white/10 rounded-xl p-4 max-w-4xl w-[90%] max-h-[85vh] mx-4 shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">{data.plotType || 'Distribution Plot'}
            </h3>
            <div className="flex gap-2">
              {imageB64 && (
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 text-white rounded hover:bg-rose-600 transition-colors text-sm"
                >
                  <Download size={14} /> Download
                </button>
              )}
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 flex items-center justify-center bg-black/40 rounded-lg border border-white/5 relative overflow-hidden">
            {isLoading ? (
              <div className="text-rose-400 animate-pulse">Generating plot...</div>
            ) : error ? (
              <div className="text-red-400 text-sm max-w-md text-center bg-red-500/10 p-4 rounded border border-red-500/20">{error}</div>
            ) : imageB64 ? (
              <img src={imageB64} alt="Visualization" className="max-w-full max-h-full object-contain" />
            ) : null}
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
