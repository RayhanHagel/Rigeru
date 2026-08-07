"use client";
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeTypes,
  Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import toast from 'react-hot-toast';

import { DataNode } from './nodes/DataNode';
import { PreprocessNode } from './nodes/PreprocessNode';
import { ModelNode } from './nodes/ModelNode';
import { KFoldNode } from './nodes/KFoldNode';
import { StackingNode } from './nodes/StackingNode';
import { SplitNode } from './nodes/SplitNode';
import { EvaluateNode } from './nodes/EvaluateNode';
import { CustomModelNode } from './nodes/CustomModelNode';
import { HypertuneNode } from './nodes/HypertuneNode';
import { DeepLearningSubCanvas } from './DeepLearningSubCanvas';
import { FeatureSplitNode } from './nodes/FeatureSplitNode';
import { FilterDataNode } from './nodes/FilterDataNode';
import { MergeDataNode } from './nodes/MergeDataNode';
import { CompareModelsNode } from './nodes/CompareModelsNode';
import { VisualizeNode } from './nodes/VisualizeNode';
import { CustomEdge } from './CustomEdge';
import { ALGORITHM_CONFIGS } from './algorithms';

import { AlertTriangle, X, Network, Search, Save, Download, Upload, LayoutPanelLeft, LayoutPanelTop } from 'lucide-react';
import { DirectUploadBox } from '@/components/ui/DirectUploadBox';
import { Button } from '@/components/ui/Button';

import { LayoutContext } from './LayoutContext';

const initialNodes: Node[] = [
  {
    id: 'data-1',
    type: 'dataNode',
    position: { x: 50, y: 150 },
    data: { label: 'Data Source' }
  }
];

const initialEdges: Edge[] = [];

export function FlowEditor() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Background Job States
  const [jobId, setJobId] = useState<string | null>(null);
  const [isJobRunning, setIsJobRunning] = useState(false);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobLogs, setJobLogs] = useState<string[]>([]);
  const [jobResult, setJobResult] = useState<any>(null);
  
  // Subcanvas state
  const [isSubCanvasOpen, setIsSubCanvasOpen] = useState(false);
  
  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutDir, setLayoutDir] = useState<'horizontal'|'vertical'>('horizontal');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const nodeTypes = useMemo<NodeTypes>(() => ({
    dataNode: DataNode,
    preprocessNode: PreprocessNode,
    modelNode: ModelNode,
    kfoldNode: KFoldNode,
    stackingNode: StackingNode,
    splitNode: SplitNode,
    evaluateNode: EvaluateNode,
    customModelNode: CustomModelNode,
    hypertuneNode: HypertuneNode,
    featureSplitNode: FeatureSplitNode,
    filterDataNode: FilterDataNode,
    mergeDataNode: MergeDataNode,
    compareModelsNode: CompareModelsNode,
    visualizeNode: VisualizeNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    default: CustomEdge,
  }), []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const isValidConnection = (connection: Connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    if (!sourceNode || !targetNode) return true;

    if (sourceNode.type === 'dataNode') {
      if (['preprocessNode', 'modelNode', 'customModelNode', 'hypertuneNode', 'evaluateNode'].includes(targetNode.type as string)) {
        toast.error("Data Leakage Warning: Raw data should flow through Split/Filter nodes before hitting preprocessing or models.");
        return false;
      }
    }

    if (sourceNode.type === 'splitNode') {
      if (connection.sourceHandle === 'test' && ['preprocessNode', 'modelNode', 'customModelNode', 'hypertuneNode'].includes(targetNode.type as string)) {
        toast.error("Test data should bypass training models/preprocessing to avoid data leakage.");
        return false;
      }
    }

    return true;
  };

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (isValidConnection(params)) {
        setEdges((eds) => {
          let newEdge: any = { ...params };
          const targetNode = nodes.find(n => n.id === params.target);
          
          if (targetNode && targetNode.type === 'customModelNode') {
            const sourceNode = nodes.find(n => n.id === params.source);
            const sourceName = sourceNode?.data?.label || sourceNode?.type || 'Node';
            const shortId = (params.source || '').split('-').pop()?.substring(0, 4) || '';
            const count = eds.filter(e => e.target === params.target).length + 1;
            
            newEdge.label = `Input #${count}`;
            newEdge.labelStyle = { fill: '#06b6d4', fontSize: 10, fontWeight: 'bold' };
            newEdge.labelBgStyle = { fill: '#18181b', stroke: '#27272a', fillOpacity: 1 };
            newEdge.labelBgPadding = [6, 4];
            newEdge.labelBgBorderRadius = 4;
          }
          
          return addEdge(newEdge, eds);
        });
      }
    },
    [nodes]
  );

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };

  const updateNodeData = (id: string, newData: any) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id === id) {
        const updated = { ...n, data: { ...n.data, ...newData } };
        if (selectedNode && selectedNode.id === id) {
          setSelectedNode(updated);
        }
        return updated;
      }
      return n;
    }));
  };

  const addNode = (type: string, label: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: type,
      position: { x: Math.random() * 200 + 200, y: Math.random() * 200 + 100 },
      data: { label }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  // Execution Logic
  const runPipeline = async () => {
    // Basic validation before sending to backend
    const hasData = nodes.some(n => n.type === 'dataNode');
    if (!hasData) {
      toast.error("Please add a Data Node to your pipeline.");
      return;
    }

    try {
      setIsJobRunning(true);
      setJobProgress(0);
      setJobLogs([]);
      setJobResult(null);

      const res = await fetch('/api/quickmachine/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      
      const data = await res.json();
      if (res.ok) {
        setJobId(data.job_id);
        toast.success("Pipeline execution started!");
      } else {
        toast.error(data.detail || "Failed to start pipeline.");
        setIsJobRunning(false);
      }
    } catch (err) {
      toast.error("Network error starting pipeline.");
      setIsJobRunning(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isJobRunning && jobId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/quickmachine/status/${jobId}`);
          const data = await res.json();
          
          if (res.ok) {
            setJobProgress(data.progress);
            setJobLogs(data.logs);
            
            if (data.status === 'completed') {
              setJobResult(data.result);
              setIsJobRunning(false);
              toast.success("Pipeline finished successfully!");
              clearInterval(interval);
            } else if (data.status === 'failed') {
              setIsJobRunning(false);
              toast.error("Pipeline execution failed.");
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 2000); // poll every 2 seconds
    }
    return () => clearInterval(interval);
  }, [isJobRunning, jobId]);

  const handleExport = () => {
    const dataStr = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quickmachine_pipeline.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          toast.success("Pipeline loaded successfully");
        } catch (err) {
          toast.error("Invalid pipeline file");
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toolboxItems = [
    { type: 'dataNode', label: 'Data Source', title: 'Data Node', desc: 'Upload or select a dataset', color: 'purple' },
    { type: 'filterDataNode', label: 'Filter Data', title: 'Filter Data Node', desc: 'Select specific columns or rows', color: 'purple' },
    { type: 'featureSplitNode', label: 'Feature Split', title: 'Feature Split Node', desc: 'Split categorical & numerical data', color: 'purple' },
    { type: 'mergeDataNode', label: 'Merge Data', title: 'Merge Data Node', desc: 'Merge or concatenate datasets', color: 'purple' },
    { type: 'splitNode', label: 'Train/Test Split', title: 'Train/Test Split Node', desc: 'Split data into training and test sets', color: 'pink' },
    { type: 'preprocessNode', label: 'Preprocess', title: 'Preprocess Node', desc: 'Scale and encode features', color: 'blue' },
    { type: 'visualizeNode', label: 'Visualize Data', title: 'Visualize Data Node', desc: 'Box, violin, distribution, scatter...', color: 'rose' },
    { type: 'kfoldNode', label: 'K-Fold CV', title: 'K-Fold Node', desc: 'Perform K-Fold Cross Validation', color: 'amber' },
    { type: 'modelNode', label: 'Baseline Model', title: 'Baseline Model', desc: 'Standard algorithms (RF, XGBoost, etc.)', color: 'orange' },
    { type: 'stackingNode', label: 'Stacking Model', title: 'Stacking Node', desc: 'Ensemble multiple baseline models', color: 'purple' },
    { type: 'customModelNode', label: 'Deep Learning', title: 'Deep Learning Node', desc: 'Visual layer builder or raw code', color: 'cyan' },
    { type: 'hypertuneNode', label: 'Hypertuning', title: 'Hypertuning Node', desc: 'Optimize hyperparameters automatically', color: 'yellow' },
    { type: 'compareModelsNode', label: 'Compare Models', title: 'Compare Models Node', desc: 'Compare performance of multiple models', color: 'green' },
    { type: 'evaluateNode', label: 'Evaluation', title: 'Evaluate Node', desc: 'Generate metrics against test data', color: 'green' },
  ];

  const filteredToolbox = toolboxItems.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderToolbox = () => (
    <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-zinc-100">Toolbox</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleExport} title="Export Pipeline"><Download size={16} /></Button>
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} title="Import Pipeline"><Upload size={16} /></Button>
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
        </div>
      </div>
      
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input 
          type="text" 
          placeholder="Search nodes..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-cyan-500"
        />
      </div>

      <div className="flex flex-col gap-3">
        {filteredToolbox.map(item => (
          <button 
            key={item.type}
            onClick={() => addNode(item.type, item.label)} 
            className={`p-3 border rounded-xl border-${item.color}-500/30 hover:border-${item.color}-500 bg-${item.color}-500/10 text-left transition-colors`}
          >
            <div className={`font-semibold text-${item.color}-400`}>{item.title}</div>
            <div className="text-xs text-zinc-400 mt-1">{item.desc}</div>
          </button>
        ))}
        
        {filteredToolbox.length === 0 && (
          <div className="text-zinc-500 text-sm text-center py-8">No nodes found.</div>
        )}
      </div>
      
      <div className="mt-auto pt-6 border-t border-white/5">
        <Button className="w-full" variant="primary" onClick={runPipeline} disabled={isJobRunning}>
          {isJobRunning ? 'Pipeline Running...' : 'Run Entire Pipeline'}
        </Button>
      </div>
    </div>
  );

  const renderSidebar = () => {
    if (!selectedNode) return renderToolbox();

    const data = selectedNode.data as Record<string, any>;

    return (
      <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-100">{data.label as string} Config</h2>
          <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>Close</Button>
        </div>
        
        {selectedNode.type === 'dataNode' && (
          <div className="flex flex-col gap-4">
            <DirectUploadBox 
              accept=".csv,.xlsx" 
              label="Upload Dataset"
              onUploadComplete={(info) => {
                updateNodeData(selectedNode.id, { fileName: info.original_name, fileHash: info.hash_name });
              }}
            />
            {data.fileName && (
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-sm text-zinc-400">Target Column</label>
                <input type="text" placeholder="e.g. Price" value={data.targetCol || ''} onChange={(e) => updateNodeData(selectedNode.id, { targetCol: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white" />
                
                <label className="text-sm text-zinc-400 mt-2">Missing Value Handling</label>
                <select value={data.missingVal || 'drop'} onChange={(e) => updateNodeData(selectedNode.id, { missingVal: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                  <option value="drop">Drop Rows</option>
                  <option value="mean">Impute (Mean)</option>
                  <option value="median">Impute (Median)</option>
                </select>
              </div>
            )}
          </div>
        )}

        {selectedNode.type === 'splitNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Test Size (%)</label>
              <input type="number" value={data.testSize || 20} onChange={(e) => updateNodeData(selectedNode.id, { testSize: Number(e.target.value) })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Random State</label>
              <input type="number" value={data.randomState || 42} onChange={(e) => updateNodeData(selectedNode.id, { randomState: Number(e.target.value) })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white" />
            </div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={data.stratify || false} onChange={(e) => updateNodeData(selectedNode.id, { stratify: e.target.checked })} className="rounded bg-zinc-900 border-white/10" />
              <span className="text-sm text-zinc-400">Stratified Split</span>
            </label>
          </div>
        )}

        {selectedNode.type === 'preprocessNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Numerical Scaler</label>
              <select value={data.scaler || 'StandardScaler'} onChange={(e) => updateNodeData(selectedNode.id, { scaler: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>StandardScaler</option>
                <option>MinMaxScaler</option>
                <option>RobustScaler</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm text-zinc-400">Categorical Encoder</label>
              <select value={data.encoder || 'OneHotEncoder'} onChange={(e) => updateNodeData(selectedNode.id, { encoder: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>OneHotEncoder</option>
                <option>LabelEncoder</option>
                <option>OrdinalEncoder</option>
              </select>
            </div>
          </div>
        )}

        {selectedNode.type === 'modelNode' && (() => {
          const taskType = data.taskType || 'Classification';
          const modelName = data.model || 'Random Forest';
          const algos = Object.keys(ALGORITHM_CONFIGS[taskType] || {});
          const params = ALGORITHM_CONFIGS[taskType]?.[modelName]?.params || {};
          
          return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Task Type</label>
              <select value={taskType} onChange={(e) => updateNodeData(selectedNode.id, { taskType: e.target.value, model: Object.keys(ALGORITHM_CONFIGS[e.target.value])[0], params: {} })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>Classification</option>
                <option>Regression</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Algorithm</label>
              <select value={modelName} onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value, params: {} })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                {algos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            
            {Object.keys(params).length > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-orange-400 border-b border-orange-500/20 pb-2">Hyperparameters</h3>
                {Object.keys(params).map(pKey => {
                  const paramState = data.params?.[pKey] || { mode: 'static', value: params[pKey][0] };
                  return (
                    <div key={pKey} className="flex flex-col gap-2 p-3 bg-zinc-900/50 rounded-lg border border-white/5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-medium text-zinc-300">{pKey}</label>
                        <select 
                          value={paramState.mode}
                          onChange={(e) => updateNodeData(selectedNode.id, { params: { ...data.params, [pKey]: { ...paramState, mode: e.target.value } } })}
                          className="text-[10px] bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-zinc-400"
                        >
                          <option value="static">Static</option>
                          <option value="tune">Tune</option>
                        </select>
                      </div>
                      {paramState.mode === 'static' ? (
                        <select 
                          value={paramState.value}
                          onChange={(e) => updateNodeData(selectedNode.id, { params: { ...data.params, [pKey]: { ...paramState, value: e.target.value } } })}
                          className="bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white"
                        >
                          {params[pKey].map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <div className="text-[10px] text-zinc-500 italic">Will be tuned by Hypertune Node</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          );
        })()}

        {selectedNode.type === 'kfoldNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Number of Splits</label>
              <input type="number" value={data.n_splits || 5} onChange={(e) => updateNodeData(selectedNode.id, { n_splits: Number(e.target.value) })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white" />
            </div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={data.shuffle ?? true} onChange={(e) => updateNodeData(selectedNode.id, { shuffle: e.target.checked })} className="rounded bg-zinc-900 border-white/10" />
              <span className="text-sm text-zinc-400">Shuffle Data</span>
            </label>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm text-zinc-400">Random State (Seed)</label>
              <input type="number" value={data.random_state || 42} onChange={(e) => updateNodeData(selectedNode.id, { random_state: Number(e.target.value) })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white" />
            </div>
          </div>
        )}

        {selectedNode.type === 'stackingNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Final Estimator (Meta-Model)</label>
              <select value={data.final_estimator || 'Logistic Regression'} onChange={(e) => updateNodeData(selectedNode.id, { final_estimator: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>Logistic Regression</option>
                <option>Ridge Classifier</option>
                <option>Random Forest</option>
                <option>Gradient Boosting</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm text-zinc-400">Cross-Validation Folds</label>
              <input type="number" value={data.cv || 5} onChange={(e) => updateNodeData(selectedNode.id, { cv: Number(e.target.value) })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white" />
            </div>
            <div className="p-3 bg-black/20 rounded-lg border border-white/5 text-xs text-zinc-400 text-center mt-2">
              Connect multiple Baseline Models to this node. The outputs of these models will train the Meta-Model.
            </div>
          </div>
        )}

        {selectedNode.type === 'customModelNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Framework</label>
              <select value={data.framework || 'PyTorch'} onChange={(e) => updateNodeData(selectedNode.id, { framework: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>PyTorch</option>
                <option>TensorFlow</option>
              </select>
            </div>
            
            <div className="flex border border-white/10 rounded-lg overflow-hidden mt-2">
              <button onClick={() => updateNodeData(selectedNode.id, { mode: 'visual' })} className={`flex-1 py-2 text-xs font-medium text-center ${(!data.mode || data.mode === 'visual') ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}`}>Visual Builder</button>
              <button onClick={() => updateNodeData(selectedNode.id, { mode: 'code' })} className={`flex-1 py-2 text-xs font-medium text-center ${(data.mode === 'code') ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}`}>Code Editor</button>
            </div>

            {(!data.mode || data.mode === 'visual') ? (
              <div className="flex flex-col gap-3 mt-2">
                <Button 
                  variant="primary" 
                  className="w-full mt-1 border-dashed border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                  onClick={() => setIsSubCanvasOpen(true)}
                >
                  <Network size={16} className="mr-2" /> Open Visual Graph Builder
                </Button>
                <div className="text-center text-xs text-zinc-400 p-4 bg-black/40 rounded-lg border border-white/5">
                  {data.layers?.length ? `${data.layers.length} Layer Nodes Configured` : 'No layers configured.'}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-xs text-zinc-400">Custom Code</label>
                <textarea 
                  className="w-full h-48 bg-zinc-950 border border-white/10 rounded-lg p-3 text-xs text-green-400 font-mono resize-none focus:outline-none focus:border-cyan-500/50" 
                  value={data.code || `# Write your custom ${data.framework || 'PyTorch'} class here\n`}
                  onChange={(e) => updateNodeData(selectedNode.id, { code: e.target.value })}
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        )}

        {selectedNode.type === 'hypertuneNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Tuner Engine</label>
              <select value={data.tuner || 'Optuna'} onChange={(e) => updateNodeData(selectedNode.id, { tuner: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>Optuna</option>
                <option>KT Bayesian Optimization</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm text-zinc-400">Trial Amount</label>
              <input type="number" value={data.trials || 50} onChange={(e) => updateNodeData(selectedNode.id, { trials: Number(e.target.value) })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white" />
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm text-zinc-400">Objective</label>
              <select value={data.objective || 'val_loss'} onChange={(e) => updateNodeData(selectedNode.id, { objective: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>val_loss</option>
                <option>val_accuracy</option>
                <option>f1_score</option>
              </select>
            </div>
          </div>
        )}
        
        {selectedNode.type === 'evaluateNode' && (
          <div className="flex flex-col gap-4">
             <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Metrics Options</label>
              <div className="p-3 bg-black/20 rounded-lg border border-white/5 text-xs text-zinc-400 text-center">
                Evaluation runs automatically when the pipeline is executed.
              </div>
              
              {jobResult && (
                <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <h3 className="text-sm font-bold text-green-400 mb-3">Evaluation Results</h3>
                  <div className="flex flex-col gap-2">
                    {Object.entries(jobResult).map(([key, val]: any) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-xs text-zinc-300">{key}</span>
                        <span className="text-sm font-mono font-bold text-white">{val.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedNode.type === 'visualizeNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Plot Type</label>
              <select value={data.plotType || 'Distribution Plot'} onChange={(e) => updateNodeData(selectedNode.id, { plotType: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>Distribution Plot</option>
                <option>Box Plot</option>
                <option>Violin Plot</option>
                <option>Scatter Plot</option>
                <option>Bar Plot</option>
                <option>Heatmap</option>
                <option>Venn Diagram</option>
                <option>Silhouette Plot</option>
              </select>
            </div>
          </div>
        )}

        {selectedNode.type === 'featureSplitNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Split Strategy</label>
              <select value={data.splitStrategy || 'Auto (Num/Cat)'} onChange={(e) => updateNodeData(selectedNode.id, { splitStrategy: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>Auto (Num/Cat)</option>
                <option>Custom Columns</option>
              </select>
            </div>
            {data.splitStrategy === 'Custom Columns' && (
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-sm text-zinc-400">Group A Columns (comma separated)</label>
                <input type="text" placeholder="e.g. age, height" value={data.groupA || ''} onChange={(e) => updateNodeData(selectedNode.id, { groupA: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white text-xs" />
              </div>
            )}
          </div>
        )}

        {selectedNode.type === 'filterDataNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Operation</label>
              <select value={data.operation || 'Drop Columns'} onChange={(e) => updateNodeData(selectedNode.id, { operation: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>Drop Columns</option>
                <option>Keep Only Columns</option>
                <option>Filter Rows by Condition</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm text-zinc-400">{data.operation === 'Filter Rows by Condition' ? 'Condition (e.g. age > 30)' : 'Columns (comma separated)'}</label>
              <input type="text" placeholder="..." value={data.target || ''} onChange={(e) => updateNodeData(selectedNode.id, { target: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white text-xs" />
            </div>
          </div>
        )}

        {selectedNode.type === 'mergeDataNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Merge Type</label>
              <select value={data.mergeType || 'Inner Join'} onChange={(e) => updateNodeData(selectedNode.id, { mergeType: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>Inner Join</option>
                <option>Outer Join</option>
                <option>Left Join</option>
                <option>Right Join</option>
                <option>Concatenate Rows</option>
                <option>Concatenate Columns</option>
              </select>
            </div>
            {!data.mergeType?.includes('Concatenate') && (
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-sm text-zinc-400">Join Key (Column Name)</label>
                <input type="text" placeholder="e.g. user_id" value={data.joinKey || ''} onChange={(e) => updateNodeData(selectedNode.id, { joinKey: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white text-xs" />
              </div>
            )}
          </div>
        )}

        {selectedNode.type === 'compareModelsNode' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Primary Metric</label>
              <select value={data.metric || 'Accuracy'} onChange={(e) => updateNodeData(selectedNode.id, { metric: e.target.value })} className="bg-zinc-900/50 border border-white/10 rounded-lg p-2 text-white">
                <option>Accuracy</option>
                <option>F1 Score</option>
                <option>Precision</option>
                <option>Recall</option>
                <option>Loss</option>
                <option>ROC-AUC</option>
              </select>
            </div>
            <div className="p-3 bg-black/20 rounded-lg border border-white/5 text-xs text-zinc-400 text-center mt-2">
              Connect multiple Model nodes to evaluate and compare their performances on this metric.
            </div>
          </div>
        )}

      </div>
    );
  };

  return (
    <LayoutContext.Provider value={layoutDir}>
      <div className="w-full h-full flex overflow-hidden relative">
        <div className="flex-1 relative" style={{ backgroundColor: 'var(--theme-bg)' }}>
          {/* Top Bar for Layout Controls */}
          <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-black/50 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-lg">
            <button 
              onClick={() => setLayoutDir('horizontal')}
              className={`p-1.5 rounded-md transition-colors ${layoutDir === 'horizontal' ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Horizontal Layout"
            >
              <LayoutPanelLeft size={16} />
            </button>
            <button 
              onClick={() => setLayoutDir('vertical')}
              className={`p-1.5 rounded-md transition-colors ${layoutDir === 'vertical' ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Vertical Layout"
            >
              <LayoutPanelTop size={16} />
            </button>
          </div>

          <div className="absolute inset-0">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedNode(null)}
              fitView
            >
              <Background color="#ccc" gap={16} />
              <Controls />
            </ReactFlow>
          </div>
        
        {nodes.length > 1 && nodes.some(node => !edges.some(edge => edge.source === node.id || edge.target === node.id)) && (
          <div className="absolute bottom-6 right-6 bg-red-500/10 border border-red-500/50 rounded-xl px-4 py-3 text-red-400 flex items-center gap-3 shadow-lg backdrop-blur-md z-40 animate-pulse pointer-events-none">
            <AlertTriangle size={18} />
            <span className="text-sm font-semibold">Warning: You have unconnected nodes</span>
          </div>
        )}
        
        {/* Floating Job Status Panel */}
        {(isJobRunning || jobId) && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[500px] bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl z-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-zinc-100 font-bold">Pipeline Execution</h3>
              <span className="text-xs font-mono px-2 py-1 bg-white/5 rounded text-zinc-400">{jobProgress}%</span>
            </div>
            
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${jobProgress}%` }} />
            </div>
            
            <div className="h-32 overflow-y-auto bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col gap-1 font-mono text-[10px]">
              {jobLogs.map((log, i) => (
                <div key={i} className="text-zinc-400">
                  <span className="text-zinc-600 mr-2">[{i}]</span>
                  {log.includes('Error') ? <span className="text-red-400">{log}</span> : log}
                </div>
              ))}
              {!isJobRunning && jobResult && (
                <div className="text-green-400 mt-2 font-bold">» Pipeline completed successfully! See Evaluation Node for results.</div>
              )}
            </div>
            
            {!isJobRunning && (
              <Button size="sm" variant="secondary" className="w-full mt-4" onClick={() => setJobId(null)}>Dismiss</Button>
            )}
          </div>
        )}

      </div>
      <div className="w-80 h-full border-l flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-bg) 95%, transparent)', borderColor: 'var(--theme-ui-border)' }}>
        {renderSidebar()}
      </div>

      {/* Sub-Canvas Modal */}
      {selectedNode && selectedNode.type === 'customModelNode' && (
        <DeepLearningSubCanvas
          isOpen={isSubCanvasOpen}
          onClose={() => setIsSubCanvasOpen(false)}
          nodeData={selectedNode.data}
          onUpdateNodeData={(newData: any) => updateNodeData(selectedNode.id, newData)}
          mainGraphEdges={edges}
          mainGraphNodes={nodes}
          mainGraphSelectedNodeId={selectedNode.id}
        />
      )}
    </div>
  </LayoutContext.Provider>
);
}
