"use client";
import { Header } from "@/components/ui/Header";

import { useState, useEffect } from "react";
import { Settings2, Save, Search, Trash2, Edit, Code, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ConfigItem = {
  key: string;
  value: any;
};

function JsonNode({ name, value, onChange, onDelete }: { name: string, value: any, onChange: (val: any) => void, onDelete?: () => void }) {
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return (
        <div className="border-l-2 border-primary/20 pl-3 py-2 my-1 bg-black/10 rounded-r-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2 font-mono">
             <span className="font-semibold text-purple-300">{name} <span className="text-zinc-500 font-normal">[Array]</span></span>
             {onDelete && <button onClick={onDelete} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>}
          </div>
          <div className="flex flex-col gap-1">
            {value.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                 <div className="flex-1 min-w-0">
                   <JsonNode 
                     name={`${idx}`} 
                     value={item} 
                     onChange={(v) => { const newArr = [...value]; newArr[idx] = v; onChange(newArr); }} 
                     onDelete={() => { const newArr = value.filter((_, i) => i !== idx); onChange(newArr); }} 
                   />
                 </div>
              </div>
            ))}
          </div>
          <button onClick={() => onChange([...value, ""])} className="text-[10px] uppercase font-bold tracking-wider text-primary hover:text-purple-300 flex items-center gap-1 mt-2 bg-primary/10 px-2 py-1 rounded transition-colors">
            <Plus size={12} /> Add Item
          </button>
        </div>
      );
    } else {
      return (
        <div className="border-l-2 border-secondary/20 pl-3 py-2 my-1 bg-black/10 rounded-r-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2 font-mono">
             <span className="font-semibold text-indigo-300">{name} <span className="text-zinc-500 font-normal">{'{Object}'}</span></span>
             {onDelete && <button onClick={onDelete} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>}
          </div>
          <div className="flex flex-col gap-1">
            {Object.entries(value).map(([k, v]) => (
              <div key={k} className="flex gap-2 items-start">
                 <div className="flex-1 min-w-0">
                   <JsonNode 
                     name={k} 
                     value={v} 
                     onChange={(newV) => { const newObj = {...value}; newObj[k] = newV; onChange(newObj); }} 
                     onDelete={() => { const newObj = {...value}; delete newObj[k]; onChange(newObj); }} 
                   />
                 </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => {
              const newKey = prompt("Enter new key name:");
              if (newKey && value[newKey] === undefined) {
                onChange({ ...value, [newKey]: "" });
              }
            }} className="text-[10px] uppercase font-bold tracking-wider text-secondary hover:text-indigo-300 flex items-center gap-1 bg-secondary/10 px-2 py-1 rounded transition-colors">
              <Plus size={12} /> Add Key
            </button>
          </div>
        </div>
      );
    }
  }
  
  return (
    <div className="flex items-center gap-2 w-full bg-zinc-900/50 border border-white/5 p-1 rounded-lg hover:border-white/10 transition-colors group">
      {name && <span className="text-xs font-mono text-zinc-400 px-2 shrink-0 select-none">{name}:</span>}
      {typeof value === 'boolean' ? (
        <select value={value ? "true" : "false"} onChange={(e) => onChange(e.target.value === "true")} className="bg-zinc-950 text-emerald-400 text-xs p-1.5 outline-none rounded border border-white/5 flex-1 font-mono cursor-pointer">
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : typeof value === 'number' ? (
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="bg-transparent text-secondary text-xs p-1.5 outline-none flex-1 font-mono w-full" />
      ) : (
        <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-amber-300 text-xs p-1.5 outline-none flex-1 font-mono w-full" />
      )}
      {onDelete && (
        <button onClick={onDelete} className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}


export default function ConfigurationsPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);
  
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [rawTextValue, setRawTextValue] = useState("");
  const [parsedObjectValue, setParsedObjectValue] = useState<any>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchConfigs = async () => {
    try {
      const res = await fetch("/api/settings/configurations", {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configurations || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleEdit = (config: ConfigItem) => {
    setSelectedConfig(config);
    setRawTextValue(JSON.stringify(config.value, null, 4));
    setParsedObjectValue(config.value);
    setErrorMsg("");
  };

  const handleSave = async () => {
    if (!selectedConfig) return;
    setIsSaving(true);
    setErrorMsg("");
    
    let finalValueToSave;
    
    if (isAdvancedMode) {
      try {
        finalValueToSave = JSON.parse(rawTextValue);
      } catch (e) {
        setErrorMsg("Invalid JSON formatting in Advanced Mode.");
        setIsSaving(false);
        return;
      }
    } else {
      finalValueToSave = parsedObjectValue;
    }

    try {
      const res = await fetch("/api/settings/configurations", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ key: selectedConfig.key, value: finalValueToSave })
      });
      if (res.ok) {
        setSelectedConfig(null);
        await fetchConfigs();
      } else {
        setErrorMsg("Failed to save configuration.");
      }
    } catch (e) {
      setErrorMsg("Error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Are you sure you want to delete the configuration '${key}'?`)) return;
    try {
      const res = await fetch(`/api/settings/configurations/${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) {
        await fetchConfigs();
        if (selectedConfig?.key === key) setSelectedConfig(null);
      }
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const filteredConfigs = configs.filter(c => c.key.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="System Configurations" subtitle="Manage internal JSON settings safely using the sleek row editor." />

      <div className="flex flex-col gap-6 w-full flex-1 min-h-0 animate-slide-up">
        <div className="w-full flex flex-col gap-4 overflow-hidden h-64 shrink-0">
          <div className="relative shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search configurations..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-primary/50 transition-colors shadow-inner"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center p-8 text-zinc-500"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
            ) : filteredConfigs.length === 0 ? (
              <div className="text-center p-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">No configurations found.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredConfigs.map(config => (
                  <div 
                    key={config.key}
                    onClick={() => handleEdit(config)}
                    className={`flex flex-col gap-2 p-4 rounded-xl cursor-pointer transition-all border ${selectedConfig?.key === config.key ? 'bg-primary/10 border-primary/50 shadow-md' : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-800/50 hover:border-white/10'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-200">{config.key}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(config.key); }}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono truncate">
                      {JSON.stringify(config.value).substring(0, 50)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-full flex flex-col flex-1 min-h-[500px] overflow-hidden bg-zinc-900/40 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl">
          {selectedConfig ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-950/80 shrink-0">
                <div className="flex items-center gap-3 text-zinc-300 font-medium">
                  {isAdvancedMode ? <Code size={18} className="text-amber-400" /> : <List size={18} className="text-primary" />}
                  Editing: <span className="text-white font-mono text-sm px-2 py-1 bg-white/5 rounded">{selectedConfig.key}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex bg-zinc-900 rounded-lg p-1 border border-white/5">
                    <button 
                      onClick={() => {
                        if (isAdvancedMode) {
                          try {
                            setParsedObjectValue(JSON.parse(rawTextValue));
                            setIsAdvancedMode(false);
                            setErrorMsg("");
                          } catch(e) {
                            setErrorMsg("Fix JSON errors before switching to Visual Mode.");
                          }
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!isAdvancedMode ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Visual
                    </button>
                    <button 
                      onClick={() => {
                        if (!isAdvancedMode) {
                          setRawTextValue(JSON.stringify(parsedObjectValue, null, 4));
                          setIsAdvancedMode(true);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${isAdvancedMode ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Advanced
                    </button>
                  </div>
                  
                  <div className="w-px h-6 bg-white/10"></div>
                  
                  <Button variant="primary" onClick={handleSave} isLoading={isSaving} icon={<Save size={16} />}>
                    Save
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 relative custom-scrollbar bg-zinc-950/30">
                {errorMsg && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-center justify-center shrink-0">
                    {errorMsg}
                  </div>
                )}
                
                {isAdvancedMode ? (
                  <textarea 
                    value={rawTextValue}
                    onChange={(e) => setRawTextValue(e.target.value)}
                    className="w-full min-h-[500px] bg-zinc-950 border border-white/10 rounded-xl p-4 text-amber-300/90 font-mono text-sm outline-none focus:border-amber-500/50 transition-colors resize-y shadow-inner custom-scrollbar"
                    spellCheck={false}
                  />
                ) : (
                  <div className="p-4 bg-zinc-950/50 border border-white/5 rounded-xl shadow-inner min-h-full">
                    <JsonNode 
                      name="root" 
                      value={parsedObjectValue} 
                      onChange={setParsedObjectValue} 
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <Settings2 size={32} className="opacity-50" />
              </div>
              <p className="text-sm">Select a configuration to view and edit its data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
