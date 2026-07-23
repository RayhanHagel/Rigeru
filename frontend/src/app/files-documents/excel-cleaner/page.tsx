"use client";

import React, { useState, useRef } from "react";
import { Upload, Download, RefreshCcw, Table, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

type TableData = {
  rows: number;
  cols: number;
  columns: string[];
  columnTypes: Record<string, string>;
  data: Record<string, any>[];
};

type FilterRule = {
  id: string;
  column: string;
  operator: string;
  value: string;
};

export default function ExcelCleanerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [originalData, setOriginalData] = useState<TableData | null>(null);
  const [processedData, setProcessedData] = useState<TableData | null>(null);
  
  // Cleaning Options
  const [dropNa, setDropNa] = useState(false);
  const [dropDuplicates, setDropDuplicates] = useState(false);
  const [rules, setRules] = useState<FilterRule[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setProcessedData(null);
      setErrorMsg("");
      
      // Auto preview
      await fetchPreview(selectedFile, hasHeader);
    }
  };

  const addRule = () => {
    setRules([...rules, { 
      id: Math.random().toString(36).substring(7), 
      column: originalData?.columns[0] || "", 
      operator: "==", 
      value: "" 
    }]);
  };

  const updateRule = (id: string, field: keyof FilterRule, value: string) => {
    setRules(rules.map(r => {
      if (r.id === id) {
        if (field === "column") {
          return { ...r, column: value, operator: "==", value: "" };
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const fetchPreview = async (selectedFile: File, header: boolean) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("has_header", header.toString());
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/excel-cleaner/preview", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to load file preview");
      }
      
      const data = await res.json();
      setOriginalData(data);
    } catch (e: any) {
      setErrorMsg(e.message);
      setOriginalData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setHasHeader(checked);
    if (file) {
      await fetchPreview(file, checked);
      setProcessedData(null);
    }
  };

  const handleApplyCleaning = async () => {
    if (!file) return;
    
    setIsLoading(true);
    setErrorMsg("");
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("has_header", hasHeader.toString());
    formData.append("drop_na", dropNa.toString());
    formData.append("drop_duplicates", dropDuplicates.toString());
    formData.append("rules", JSON.stringify(rules));
    formData.append("action", "preview");
    formData.append("export_format", "CSV"); // Doesn't matter for preview
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/excel-cleaner/process", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to process data");
      }
      
      const data = await res.json();
      setProcessedData(data);
    } catch (e: any) {
      setErrorMsg(e.message);
      setProcessedData(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownload = async (format: "CSV" | "Excel") => {
    if (!file) return;
    
    setIsLoading(true);
    setErrorMsg("");
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("has_header", hasHeader.toString());
    formData.append("drop_na", dropNa.toString());
    formData.append("drop_duplicates", dropDuplicates.toString());
    formData.append("rules", JSON.stringify(rules));
    formData.append("action", "download");
    formData.append("export_format", format);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/excel-cleaner/process", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Failed to export ${format}`);
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const ext = format === "CSV" ? ".csv" : ".xlsx";
      a.download = `cleaned_${baseName}${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTable = (tableData: TableData, title: string) => {
    return (
      <div className="mt-8 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Table size={20} className="text-blue-400" />
            {title}
          </h3>
          <span className="bg-zinc-800 text-zinc-300 text-xs px-3 py-1 rounded-full font-mono">
            {tableData.rows} rows × {tableData.cols} columns
          </span>
        </div>
        
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950/50 max-h-[400px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-sm text-left text-zinc-300">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                {tableData.columns.map((col, idx) => (
                  <th key={idx} className="px-4 py-3 font-medium whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.data.length === 0 ? (
                <tr>
                  <td colSpan={tableData.cols} className="px-4 py-8 text-center text-zinc-500">
                    No data to display
                  </td>
                </tr>
              ) : (
                tableData.data.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    {tableData.columns.map((col, colIdx) => {
                      const val = row[col];
                      return (
                        <td key={colIdx} className="px-4 py-2 whitespace-nowrap max-w-xs truncate" title={val !== null ? String(val) : ""}>
                          {val !== null ? String(val) : <span className="text-zinc-600 italic">NaN</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-zinc-500 text-xs mt-2 italic text-right">Showing first 50 rows preview</p>
      </div>
    );
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-6xl mx-auto overflow-y-auto">
      <div className="flex items-center gap-4 mb-8 border-b border-blue-500/30 pb-6">
        <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
          <Table size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Excel & CSV Cleaner</h1>
          <p className="text-zinc-400 text-sm font-medium mt-1">Upload a dataset, clean up rows, apply logic filters, and export the result.</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-8">
        
        {/* Controls Section: Stacked above data preview */}
        <div className="flex flex-col gap-6">
          {/* Upload Data */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm h-fit">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Upload size={18} className="text-blue-400" />
              Upload Data
            </h3>
            
            <label className="flex items-center gap-2 cursor-pointer mb-4 text-sm text-zinc-300">
              <input 
                type="checkbox" 
                checked={hasHeader} 
                onChange={handleHeaderChange}
                className="w-4 h-4 rounded border-white/20 bg-zinc-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900"
              />
              File has Headers
            </label>
            
            <input 
              type="file" 
              accept=".csv,.xls,.xlsx" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <Button 
              variant="secondary" 
              fullWidth 
              onClick={() => fileInputRef.current?.click()}
              className="border-dashed border-2 py-8 hover:bg-white/5"
            >
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <Upload size={24} className={file ? "text-green-400" : ""} />
                <span>{file ? file.name : "Click to select CSV/Excel file"}</span>
              </div>
            </Button>
            
            {errorMsg && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                <Info size={16} className="mt-0.5 shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}
          </div>
          
          {/* Cleaning Options */}
          {originalData && (
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm animate-fade-in">
              <h3 className="text-lg font-semibold text-white mb-4">Cleaning Options</h3>
              
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white transition-colors">
                  <input 
                    type="checkbox" 
                    checked={dropNa} 
                    onChange={(e) => setDropNa(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-zinc-900 text-blue-500 focus:ring-blue-500"
                  />
                  Drop Empty Rows
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white transition-colors">
                  <input 
                    type="checkbox" 
                    checked={dropDuplicates} 
                    onChange={(e) => setDropDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-zinc-900 text-blue-500 focus:ring-blue-500"
                  />
                  Drop Duplicates
                </label>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-white">
                    Data Filters
                  </label>
                  <button 
                    onClick={addRule}
                    className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-1 rounded"
                  >
                    <Plus size={14} /> Add Rule
                  </button>
                </div>
                
                {rules.length === 0 ? (
                  <div className="text-center py-4 border border-dashed border-white/10 rounded-xl text-zinc-500 text-sm">
                    No filters active. Click "Add Rule" to filter rows.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rules.map((rule) => {
                      const colType = originalData?.columnTypes?.[rule.column] || "text";
                      return (
                        <div key={rule.id} className="flex flex-col sm:flex-row items-end gap-3 bg-zinc-950/50 border border-white/5 p-3 rounded-lg">
                          <div className="w-full sm:w-1/3 flex flex-col gap-1">
                            <label className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider flex justify-between">
                              <span>Column</span>
                              <span className="text-blue-500/70">{colType}</span>
                            </label>
                            <select 
                              value={rule.column}
                              onChange={(e) => updateRule(rule.id, "column", e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            >
                              {originalData?.columns.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="w-full sm:w-1/4 flex flex-col gap-1">
                            <label className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Operator</label>
                            <select 
                              value={rule.operator}
                              onChange={(e) => updateRule(rule.id, "operator", e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            >
                              <option value="==">Equals (==)</option>
                              <option value="!=">Not Equals (!=)</option>
                              {colType === "number" && (
                                <>
                                  <option value=">">Greater Than (&gt;)</option>
                                  <option value="<">Less Than (&lt;)</option>
                                  <option value=">=">Greater/Equal (&gt;=)</option>
                                  <option value="<=">Less/Equal (&lt;=)</option>
                                </>
                              )}
                              {colType === "date" && (
                                <>
                                  <option value=">">Newer Than (&gt;)</option>
                                  <option value="<">Older Than (&lt;)</option>
                                  <option value=">=">Newer/Equal (&gt;=)</option>
                                  <option value="<=">Older/Equal (&lt;=)</option>
                                </>
                              )}
                              {colType === "time" && (
                                <>
                                  <option value=">">Later Than (&gt;)</option>
                                  <option value="<">Earlier Than (&lt;)</option>
                                  <option value=">=">Later/Equal (&gt;=)</option>
                                  <option value="<=">Earlier/Equal (&lt;=)</option>
                                </>
                              )}
                              {colType === "text" && (
                                <option value="contains">Contains Text</option>
                              )}
                            </select>
                          </div>
                          
                          <div className="w-full sm:flex-1 flex flex-col gap-1">
                            <label className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Value</label>
                            <input 
                              type={colType === "date" ? "date" : colType === "time" ? "time" : "text"}
                              placeholder={(colType === "date" || colType === "time") ? "" : "Type value..."}
                              value={rule.value}
                              onChange={(e) => updateRule(rule.id, "value", e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          
                          <button 
                            onClick={() => removeRule(rule.id)}
                            className="h-[38px] px-3 bg-red-500/10 text-red-400/80 hover:text-red-400 hover:bg-red-500/20 rounded flex items-center justify-center transition-colors"
                            title="Remove Rule"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <Button 
                variant="primary" 
                fullWidth 
                icon={<RefreshCcw size={16} />}
                onClick={handleApplyCleaning}
                isLoading={isLoading}
              >
                Apply Cleaning & Filters
              </Button>
            </div>
          )}
          
          {/* Download section */}
          {processedData && (
            <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-6 backdrop-blur-sm animate-fade-in">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Download size={18} className="text-blue-400" />
                  Download Cleaned Data
                </h3>
                
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button 
                    variant="secondary" 
                    onClick={() => handleDownload("CSV")}
                    isLoading={isLoading}
                    className="flex-1 sm:flex-none"
                  >
                    Download CSV
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => handleDownload("Excel")}
                    isLoading={isLoading}
                    className="flex-1 sm:flex-none"
                  >
                    Download Excel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Data Preview Section: Placed underneath */}
        <div className="w-full">
          {!originalData ? (
            <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-white/5 rounded-2xl bg-zinc-900/20">
              <div className="text-center text-zinc-500">
                <Table size={48} className="mx-auto mb-4 opacity-20" />
                <p>Upload a file to see preview</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {processedData ? renderTable(processedData, "Processed Data Preview") : renderTable(originalData, "Original Data Preview")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
