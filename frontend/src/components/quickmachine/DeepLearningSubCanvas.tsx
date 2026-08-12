import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Connection,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/Button';
import { CustomEdge } from './CustomEdge';
import { LayerNode } from './nodes/LayerNode';
import { Icon } from "@/lib/utils";
const nodeTypes = {
  layerNode: LayerNode,
};

const edgeTypes = {
  default: CustomEdge,
};

const TuneKeyInput = ({ param, updateParam, nodes }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const keys = Array.from(new Set(nodes.flatMap((n: any) => Object.values(n.data.params || {}).filter((p: any) => p.mode === 'tune' && p.tuneKey).map((p: any) => p.tuneKey)))) as string[];

  return (
    <div className="relative">
      <input 
        type="text"
        value={param.tuneKey || ''}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onChange={(e) => updateParam({ ...param, tuneKey: e.target.value })}
        className="bg-zinc-900 border border-yellow-500/30 rounded px-2 py-1.5 text-xs text-yellow-400 focus:outline-none focus:border-yellow-500 w-full"
        placeholder="e.g. shared_hidden_size"
      />
      {isOpen && keys.length > 0 && (
        <ul className="absolute z-[100] w-full mt-1 bg-zinc-800 border border-yellow-500/30 rounded-lg shadow-xl overflow-hidden max-h-32 overflow-y-auto">
          {keys.map(k => (
            <li 
              key={k} 
              className="px-2 py-1.5 text-xs text-yellow-400 hover:bg-yellow-500/20 cursor-pointer"
              onMouseDown={(e) => e.preventDefault()} // prevent blur
              onClick={() => {
                updateParam({ ...param, tuneKey: k });
                setIsOpen(false);
              }}
            >
              {k}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


const LAYER_DEFAULTS: Record<string, { desc: string, defaultParams: any }> = {
  'Linear / Dense': {
    desc: 'Applies a linear transformation to the incoming data. Forms the core of fully connected networks.',
    defaultParams: { out_features: { mode: 'static', value: 64 }, activation: { mode: 'static', value: 'ReLU' } }
  },
  'Conv2D': {
    desc: 'Applies a 2D convolution over an input signal. Ideal for image processing and extracting spatial features.',
    defaultParams: { out_channels: { mode: 'static', value: 32 }, kernel_size: { mode: 'static', value: 3 }, stride: { mode: 'static', value: 1 }, padding: { mode: 'static', value: 1 }, activation: { mode: 'static', value: 'ReLU' } }
  },
  'MaxPool2D': {
    desc: 'Applies a 2D max pooling over an input signal, reducing spatial dimensions and preventing overfitting.',
    defaultParams: { kernel_size: { mode: 'static', value: 2 }, stride: { mode: 'static', value: 2 }, padding: { mode: 'static', value: 0 } }
  },
  'AvgPool2D': {
    desc: 'Applies a 2D average pooling over an input signal, smoothing the features.',
    defaultParams: { kernel_size: { mode: 'static', value: 2 }, stride: { mode: 'static', value: 2 }, padding: { mode: 'static', value: 0 } }
  },
  'Dropout': {
    desc: 'Randomly zeroes some elements of the tensor during training to prevent network overfitting.',
    defaultParams: { p: { mode: 'static', value: 0.5 } }
  },
  'Flatten': {
    desc: 'Flattens a multi-dimensional tensor into a 1D tensor. Used to transition from Conv layers to Dense layers.',
    defaultParams: {}
  },
  'LSTM': {
    desc: 'Long Short-Term Memory RNN. Excellent for processing sequences and time-series data without vanishing gradients.',
    defaultParams: { hidden_size: { mode: 'static', value: 128 }, num_layers: { mode: 'static', value: 1 }, batch_first: { mode: 'static', value: 'True' }, dropout: { mode: 'static', value: 0.0 }, bidirectional: { mode: 'static', value: 'False' } }
  },
  'GRU': {
    desc: 'Gated Recurrent Unit RNN. A computationally cheaper alternative to LSTM with similar sequential performance.',
    defaultParams: { hidden_size: { mode: 'static', value: 128 }, num_layers: { mode: 'static', value: 1 }, batch_first: { mode: 'static', value: 'True' }, dropout: { mode: 'static', value: 0.0 }, bidirectional: { mode: 'static', value: 'False' } }
  },
  'RNN': {
    desc: 'Standard Recurrent Neural Network layer for sequence processing.',
    defaultParams: { hidden_size: { mode: 'static', value: 128 }, num_layers: { mode: 'static', value: 1 }, batch_first: { mode: 'static', value: 'True' }, dropout: { mode: 'static', value: 0.0 }, bidirectional: { mode: 'static', value: 'False' } }
  },
  'LayerNorm': {
    desc: 'Normalizes over the last dimension. Highly effective in Transformers and NLP models.',
    defaultParams: { normalized_shape: { mode: 'static', value: 256 }, eps: { mode: 'static', value: 1e-05 } }
  },
  'RMSNorm': {
    desc: 'Root Mean Square Normalization. A computationally cheaper, SOTA alternative to LayerNorm used in LLaMA and DeepSeek.',
    defaultParams: { dim: { mode: 'static', value: 256 }, eps: { mode: 'static', value: 1e-06 } }
  },
  'BatchNorm1D': {
    desc: 'Applies Batch Normalization over a 2D or 3D input. Stabilizes training of dense networks.',
    defaultParams: { num_features: { mode: 'static', value: 64 }, momentum: { mode: 'static', value: 0.1 } }
  },
  'BatchNorm2D': {
    desc: 'Applies Batch Normalization over a 4D input (a mini-batch of 2D inputs with additional channel dimension). Stabilizes CNNs.',
    defaultParams: { num_features: { mode: 'static', value: 32 }, momentum: { mode: 'static', value: 0.1 } }
  },
  'SwiGLU': {
    desc: 'SOTA Activation FeedForward block. Replaces traditional MLP blocks in modern LLMs (LLaMA, DeepSeek).',
    defaultParams: { dim: { mode: 'static', value: 256 }, hidden_dim: { mode: 'static', value: 1024 } }
  },
  'MultiheadAttention': {
    desc: 'Standard Transformer attention mechanism allowing the model to jointly attend to information from different representation subspaces.',
    defaultParams: { embed_dim: { mode: 'static', value: 256 }, num_heads: { mode: 'static', value: 8 }, dropout: { mode: 'static', value: 0.0 } }
  },
  'MQA': {
    desc: 'Multi-Query Attention. Shares a single Key-Value head across all queries, drastically reducing memory bandwidth.',
    defaultParams: { embed_dim: { mode: 'static', value: 256 }, num_heads: { mode: 'static', value: 8 }, dropout: { mode: 'static', value: 0.0 } }
  },
  'GQA': {
    desc: 'Grouped-Query Attention. A balance between MHA and MQA, grouping query heads to share a smaller number of KV heads.',
    defaultParams: { embed_dim: { mode: 'static', value: 256 }, num_heads: { mode: 'static', value: 8 }, num_kv_heads: { mode: 'static', value: 2 } }
  },
  'MLA': {
    desc: 'Multi-head Latent Attention (DeepSeek). Massively compresses the KV cache into a low-rank latent vector for highly efficient long-context inference.',
    defaultParams: { hidden_size: { mode: 'static', value: 512 }, num_heads: { mode: 'static', value: 8 }, kv_lora_rank: { mode: 'static', value: 64 }, q_lora_rank: { mode: 'static', value: 64 } }
  },
  'RoPE': {
    desc: 'Rotary Positional Embeddings. Encodes absolute positional information with rotation matrices (used in LLaMA, DeepSeek).',
    defaultParams: { dim: { mode: 'static', value: 64 }, base: { mode: 'static', value: 10000 } }
  },
  'DeepSeekMoE': {
    desc: 'Sparse Mixture of Experts block. Routes tokens to a small subset of specialized experts, massively increasing parameter count without increasing compute.',
    defaultParams: { hidden_dim: { mode: 'static', value: 512 }, num_experts: { mode: 'static', value: 8 }, top_k: { mode: 'static', value: 2 }, shared_experts: { mode: 'static', value: 1 } }
  },
  'Embedding': {
    desc: 'A simple lookup table that stores embeddings of a fixed dictionary and size. Crucial for categorical variables or text tokens.',
    defaultParams: { num_embeddings: { mode: 'static', value: 10000 }, embedding_dim: { mode: 'static', value: 256 } }
  },
  'Conv1D': {
    desc: 'Applies a 1D convolution over an input signal composed of several input planes. Ideal for sequence or audio processing.',
    defaultParams: { in_channels: { mode: 'static', value: 16 }, out_channels: { mode: 'static', value: 32 }, kernel_size: { mode: 'static', value: 3 } }
  },
  'ConvTranspose2D': {
    desc: 'Applies a 2D transposed convolution operator over an input image. Used for generative upsampling in GANs or Autoencoders.',
    defaultParams: { in_channels: { mode: 'static', value: 32 }, out_channels: { mode: 'static', value: 16 }, kernel_size: { mode: 'static', value: 3 }, stride: { mode: 'static', value: 2 } }
  },
  'AdaptiveAvgPool2D': {
    desc: 'Applies a 2D adaptive average pooling over an input signal. The output is of size H x W, regardless of input size.',
    defaultParams: { output_size: { mode: 'static', value: 1 } }
  }
};

function SubCanvasInternal({ nodeData, onUpdateNodeData, onClose, mainGraphEdges, mainGraphNodes, mainGraphSelectedNodeId }: any) {
  const [nodes, setNodes, onNodesChange] = useNodesState(nodeData.layers || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(nodeData.layerEdges || []);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Sync Input Nodes based on mainGraphEdges
  useEffect(() => {
    if (!mainGraphEdges || !mainGraphSelectedNodeId) return;

    const incomingEdges = mainGraphEdges.filter((e: any) => e.target === mainGraphSelectedNodeId);

    setNodes((currentNodes) => {
      const newNodes = [...currentNodes];
      let changed = false;

      incomingEdges.forEach((edge: any, index: number) => {
        const inputId = `input_from_${edge.source}`;
        const existingInput = newNodes.find(n => n.id === inputId);
        
        let sourceNodeName = edge.label;
        if (!sourceNodeName) {
          sourceNodeName = `Input from ${edge.source}`;
        }

        if (!existingInput) {
          changed = true;
          newNodes.push({
            id: inputId,
            type: 'layerNode',
            position: { x: 50, y: 100 + (index * 150) },
            data: {
              layerType: 'Input',
              isInput: true,
              label: sourceNodeName,
              params: {}
            }
          });
        }
      });

      const validInputIds = incomingEdges.map((e: any) => `input_from_${e.source}`);
      const nodesToRemove = newNodes.filter(n => n.data.isInput && !validInputIds.includes(n.id));
      
      if (nodesToRemove.length > 0) {
        changed = true;
        nodesToRemove.forEach(n => {
          const idx = newNodes.indexOf(n);
          if (idx > -1) newNodes.splice(idx, 1);
        });
      }

      return changed ? newNodes : currentNodes;
    });

  }, [mainGraphEdges, mainGraphSelectedNodeId, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = (e: React.MouseEvent, node: any) => {
    setSelectedLayerId(node.id);
  };

  const addLayer = (layerType: string) => {
    const newNodeId = `layer_${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: 'layerNode',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: {
        layerType,
        params: LAYER_DEFAULTS[layerType]?.defaultParams || {}
      }
    };
    setNodes((nds) => nds.concat(newNode));
    setSelectedLayerId(newNodeId);
  };

  const updateSelectedLayerParam = (paramName: string, paramData: any) => {
    setNodes((nds) => nds.map(n => {
      if (n.id === selectedLayerId) {
        return { 
          ...n, 
          data: { 
            ...n.data, 
            params: { 
              ...(n.data.params || {}), 
              [paramName]: paramData 
            } 
          } 
        };
      }
      return n;
    }));
  };

  const handleSaveAndClose = () => {
    onUpdateNodeData({ layers: nodes, layerEdges: edges });
    onClose();
  };

  const selectedNode = nodes.find(n => n.id === selectedLayerId);

  // Helper for rendering a parameter configurator
  const renderParamConfig = (paramName: string, label: string, paramDesc: string, type: 'int' | 'float' | 'string' | 'categorical' = 'int', choices: string[] = [], tooltip: string = "") => {
    const params = selectedNode?.data?.params as Record<string, any> || {};
    const param = params[paramName] || { mode: 'static', value: '' };
    
    return (
      <div className="flex flex-col gap-2 p-3 bg-black/40 rounded-lg border border-white/5 mb-3" key={paramName}>
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-zinc-300" title={tooltip}>{label}</label>
            {paramDesc && <span className="text-[9px] text-zinc-500 mt-0.5 leading-tight">{paramDesc}</span>}
          </div>
          <div className="flex bg-zinc-900 border border-white/10 rounded overflow-hidden">
            <button 
              className={`px-2 py-1 text-[10px] ${param.mode !== 'tune' ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500'}`}
              onClick={() => updateSelectedLayerParam(paramName, { ...param, mode: 'static' })}
            >Static</button>
            <button 
              className={`px-2 py-1 text-[10px] ${param.mode === 'tune' ? 'bg-yellow-500/20 text-yellow-500' : 'text-zinc-500'}`}
              onClick={() => updateSelectedLayerParam(paramName, { ...param, mode: 'tune', type })}
            >Tune</button>
          </div>
        </div>

        {param.mode !== 'tune' ? (
          choices.length > 0 ? (
            <select 
              value={param.value} 
              onChange={(e) => updateSelectedLayerParam(paramName, { ...param, value: e.target.value })}
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
            >
              <option value="">Select...</option>
              {choices.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input 
              type={type === 'string' ? 'text' : 'number'}
              value={param.value}
              onChange={(e) => updateSelectedLayerParam(paramName, { ...param, value: type === 'string' ? e.target.value : Number(e.target.value) })}
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
              placeholder={tooltip ? "Leave blank to auto-infer" : ""}
            />
          )
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-yellow-500/80">Tune Key (Shared Identifier)</label>
              <TuneKeyInput 
                param={param} 
                updateParam={(newParam: any) => updateSelectedLayerParam(paramName, newParam)} 
                nodes={nodes} 
              />
            </div>
            
            {choices.length > 0 ? (
              <div className="text-[10px] text-zinc-500">Categorical tuning will sample from available choices.</div>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="number"
                  placeholder="Min"
                  value={param.min || ''}
                  onChange={(e) => updateSelectedLayerParam(paramName, { ...param, min: Number(e.target.value) })}
                  className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white w-full"
                />
                <input 
                  type="number"
                  placeholder="Max"
                  value={param.max || ''}
                  onChange={(e) => updateSelectedLayerParam(paramName, { ...param, max: Number(e.target.value) })}
                  className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white w-full"
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLayerConfig = () => {
    if (!selectedNode) return <div className="text-zinc-500 text-sm text-center py-10">Select a layer node to configure it.</div>;

    const layerType = selectedNode.data.layerType as string;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-lg font-bold text-cyan-400">{layerType}</h3>
          <Button variant="ghost" size="sm" onClick={() => setSelectedLayerId(null)}>Close</Button>
        </div>
        
        {LAYER_DEFAULTS[layerType]?.desc && (
          <div className="text-xs text-zinc-400 p-3 bg-cyan-900/10 rounded-lg border border-cyan-500/20 mb-2 leading-relaxed">
            {LAYER_DEFAULTS[layerType].desc}
          </div>
        )}

        {layerType === 'Input' && (
          <div className="text-zinc-400 text-sm p-4 bg-zinc-900/50 rounded-lg border border-white/5">
            This node represents an incoming data connection from the main graph ({selectedNode.data.label as string}). 
            You cannot delete it from here. To remove it, disconnect the data source in the main graph.
          </div>
        )}

        {layerType === 'Linear / Dense' && (
          <>
            {renderParamConfig('in_features', 'In Features / Units', 'Size of each input sample.', 'int', [], 'If left blank, nn.LazyLinear will auto-infer input shape.')}
            {renderParamConfig('out_features', 'Out Features / Units', 'Size of each output sample.', 'int')}
            {renderParamConfig('activation', 'Activation', 'Non-linear activation function to apply.', 'categorical', ['None', 'ReLU', 'Sigmoid', 'Tanh', 'Softmax'])}
          </>
        )}
        
        {layerType === 'Conv2D' && (
          <>
            {renderParamConfig('in_channels', 'In Channels', 'Number of channels in the input image.', 'int', [], 'Leave blank for auto-inference in PyTorch (LazyConv2d)')}
            {renderParamConfig('out_channels', 'Out Channels / Filters', 'Number of channels produced by the convolution.', 'int')}
            {renderParamConfig('kernel_size', 'Kernel Size', 'Size of the convolving kernel (e.g. 3 for a 3x3 kernel).', 'int')}
            {renderParamConfig('stride', 'Stride', 'Stride of the convolution.', 'int')}
            {renderParamConfig('padding', 'Padding', 'Zero-padding added to both sides of the input.', 'int')}
            {renderParamConfig('activation', 'Activation', 'Non-linear activation function to apply.', 'categorical', ['None', 'ReLU', 'Sigmoid', 'Tanh'])}
          </>
        )}

        {(layerType === 'MaxPool2D' || layerType === 'AvgPool2D') && (
          <>
            {renderParamConfig('kernel_size', 'Kernel Size', 'Size of the convolving kernel (e.g. 3 for a 3x3 kernel).', 'int')}
            {renderParamConfig('stride', 'Stride', 'Stride of the convolution.', 'int')}
            {renderParamConfig('padding', 'Padding', 'Zero-padding added to both sides of the input.', 'int')}
          </>
        )}

        {layerType === 'Dropout' && (
          <>
            {renderParamConfig('p', 'Dropout Rate (0.0 - 1.0)', 'Probability of an element to be zeroed.', 'float')}
          </>
        )}

        {(layerType === 'LSTM' || layerType === 'GRU' || layerType === 'RNN') && (
          <>
            {renderParamConfig('input_size', 'Input Size', 'The number of expected features in the input x.', 'int')}
            {renderParamConfig('hidden_size', 'Hidden Size', 'The number of features in the hidden state h.', 'int')}
            {renderParamConfig('num_layers', 'Num Layers', 'Number of recurrent layers.', 'int')}
            {renderParamConfig('batch_first', 'Batch First', 'If True, input tensors are provided as (batch, seq, feature).', 'categorical', ['True', 'False'])}
            {renderParamConfig('dropout', 'Dropout Rate', 'If non-zero, introduces a Dropout layer on the outputs of each RNN layer.', 'float')}
            {renderParamConfig('bidirectional', 'Bidirectional', 'If True, becomes a bidirectional RNN.', 'categorical', ['True', 'False'])}
          </>
        )}
        
        {layerType === 'Flatten' && (
          <div className="text-xs text-zinc-400 p-3 bg-black/40 rounded-lg border border-white/5">
            Flattens the input tensor. No configuration needed.
          </div>
        )}
        
        {layerType === 'Input' && (
          <div className="text-xs text-zinc-400 p-3 bg-black/40 rounded-lg border border-white/5">
            Entry point of the model. 
          </div>
        )}

        {/* Dynamic Fallback for SOTA Layers */
        !['Linear / Dense', 'Conv2D', 'MaxPool2D', 'AvgPool2D', 'Dropout', 'LSTM', 'GRU', 'RNN', 'Flatten', 'Input'].includes(layerType) && LAYER_DEFAULTS[layerType]?.defaultParams && Object.keys(LAYER_DEFAULTS[layerType].defaultParams).length > 0 && (
          <>
            {Object.keys(LAYER_DEFAULTS[layerType].defaultParams).map(paramKey => {
              const val = LAYER_DEFAULTS[layerType].defaultParams[paramKey].value;
              const isNum = typeof val === 'number' || !isNaN(parseFloat(val));
              const type = isNum ? 'float' : 'categorical';
              return (
                <div key={paramKey}>
                  {renderParamConfig(paramKey, paramKey, '', type, !isNum ? [val.toString()] : [])}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex bg-black/80 backdrop-blur-sm">
      <div className="flex-1 m-8 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative" style={{ backgroundColor: 'var(--theme-ui-bg)', borderColor: 'var(--theme-ui-border)', borderWidth: '1px' }}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--theme-ui-border)', backgroundColor: 'color-mix(in srgb, var(--theme-bg) 50%, transparent)' }}>
        <div className="flex items-center gap-3">
          <Icon name="hub" className="text-cyan-400" />
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Deep Learning Sub-Canvas</h2>
            <p className="text-xs text-zinc-400">Design your neural network architecture visually.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}><Icon name="close" size={16} className="mr-2"/> Cancel</Button>
          <Button variant="primary" onClick={handleSaveAndClose} className="bg-cyan-600 hover:bg-cyan-700 text-white"><Icon name="save" size={16} className="mr-2"/> Save Graph</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Toolbox Sidebar */}
        <div className="w-64 border-r p-4 flex flex-col gap-2 overflow-y-auto z-10 shrink-0" style={{ borderColor: 'var(--theme-ui-border)', backgroundColor: 'color-mix(in srgb, var(--theme-bg) 80%, transparent)' }}>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Layer Toolbox</h3>
          {Object.keys(LAYER_DEFAULTS).map(layer => (
            <button 
              key={layer}
              onClick={() => addLayer(layer)}
              className="p-3 border rounded-xl border-cyan-500/20 hover:border-cyan-500 bg-cyan-500/5 text-left transition-colors"
            >
              <div className="text-sm font-semibold text-cyan-300">{layer}</div>
            </button>
          ))}
        </div>

        {/* Sub-Canvas */}
        <div className="flex-1 relative" style={{ backgroundColor: 'var(--theme-bg)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedLayerId(null)}
            fitView
          >
            <Background color="#ccc" gap={16} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Config Sidebar */}
        <div className="w-80 border-l p-6 overflow-y-auto z-10 shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-bg) 95%, transparent)', borderColor: 'var(--theme-ui-border)' }}>
          {renderLayerConfig()}
        </div>
      </div>
      </div>
    </div>,
    document.body
  );
}

export function DeepLearningSubCanvas(props: any) {
  if (!props.isOpen) return null;
  return (
    <ReactFlowProvider>
      <SubCanvasInternal {...props} />
    </ReactFlowProvider>
  );
}
