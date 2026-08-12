"use client";
import { Header } from "@/components/ui/Header";

import React, { useState } from "react";

import { DirectUploadBox } from "@/components/ui/DirectUploadBox";
import { Button } from "@/components/ui/Button";
import { 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { Icon } from "@/lib/utils";

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

export default function ChartMakerPage() {
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [chartType, setChartType] = useState<"bar" | "line" | "pie" | "scatter">("bar");
  const [xAxisKey, setXAxisKey] = useState<string>("");
  const [yAxisKey, setYAxisKey] = useState<string>("");

  const handleUploadComplete = async (fileInfo: { hash_name: string }) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const formData = new FormData();
      formData.append("file_hash", fileInfo.hash_name);
      
      const res = await fetch("http://localhost:8000/api/files-documents/chart/parse", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to parse data");
      }
      
      const resData = await res.json();
      const parsedData = resData.data;
      
      if (parsedData.length > 0) {
        const cols = Object.keys(parsedData[0]);
        setColumns(cols);
        setXAxisKey(cols[0]);
        setYAxisKey(cols.length > 1 ? cols[1] : cols[0]);
      }
      
      setData(parsedData);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderChart = () => {
    if (!data.length || !xAxisKey || !yAxisKey) return null;

    const formattedData = data.map(item => {
      // Ensure Y axis is numeric
      const val = Number(item[yAxisKey]);
      return {
        ...item,
        [yAxisKey]: isNaN(val) ? 0 : val
      };
    });

    const ChartProps = {
      data: formattedData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    };

    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...ChartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xAxisKey} stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#333' }} />
              <Legend />
              <Bar dataKey={yAxisKey} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...ChartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xAxisKey} stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#333' }} />
              <Legend />
              <Line type="monotone" dataKey={yAxisKey} stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#333' }} />
              <Legend />
              <Pie
                data={formattedData}
                dataKey={yAxisKey}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={150}
                fill="#8884d8"
                label
              >
                {formattedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      case "scatter":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xAxisKey} stroke="#888" />
              <YAxis dataKey={yAxisKey} stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#333' }} cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter name="Data" data={formattedData} fill="#10b981" />
            </ScatterChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Chart Maker" subtitle="Upload a CSV or Excel file to instantly generate beautiful, interactive charts." />

      {!data.length ? (
        <div className="w-full mx-auto mt-12">
          <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 shadow-xl text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
              <Icon name="table" size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Upload Data</h3>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">Upload a .csv or .xlsx file to begin configuring your chart.</p>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-zinc-400">Parsing data...</p>
              </div>
            ) : (
              <DirectUploadBox 
                accept=".csv,.xlsx,.xls" 
                onUploadComplete={handleUploadComplete} 
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8 w-full">
          
          <div className="w-full">
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-zinc-100 mb-6 flex items-center gap-2">Configuration
              </h3>
              
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Chart Type</label>
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                    <button onClick={() => setChartType("bar")} className={`p-2 rounded-lg text-sm flex items-center justify-center gap-2 border transition-all ${chartType === "bar" ? "bg-primary/20 border-primary/50 text-purple-300" : "bg-zinc-950 border-white/5 text-zinc-500 hover:text-zinc-300"}`}><Icon name="bar_chart" size={16}/> Bar</button>
                    <button onClick={() => setChartType("line")} className={`p-2 rounded-lg text-sm flex items-center justify-center gap-2 border transition-all ${chartType === "line" ? "bg-secondary/20 border-secondary/50 text-blue-300" : "bg-zinc-950 border-white/5 text-zinc-500 hover:text-zinc-300"}`}><Icon name="show_chart" size={16}/> Line</button>
                    <button onClick={() => setChartType("pie")} className={`p-2 rounded-lg text-sm flex items-center justify-center gap-2 border transition-all ${chartType === "pie" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-zinc-950 border-white/5 text-zinc-500 hover:text-zinc-300"}`}><Icon name="pie_chart" size={16}/> Pie</button>
                    <button onClick={() => setChartType("scatter")} className={`p-2 rounded-lg text-sm flex items-center justify-center gap-2 border transition-all ${chartType === "scatter" ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-zinc-950 border-white/5 text-zinc-500 hover:text-zinc-300"}`}><Icon name="tune" size={16}/> Scatter</button>
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-400 mb-2">X-Axis (Labels)</label>
                  <select 
                    value={xAxisKey} 
                    onChange={(e) => setXAxisKey(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2.5 text-zinc-200 text-sm outline-none focus:border-primary h-[42px]"
                  >
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Y-Axis (Values)</label>
                  <select 
                    value={yAxisKey} 
                    onChange={(e) => setYAxisKey(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2.5 text-zinc-200 text-sm outline-none focus:border-primary h-[42px]"
                  >
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <div className="flex-none flex items-end">
                  <Button variant="secondary" className="w-full h-[42px]" onClick={() => setData([])}>
                    Upload New File
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full">
            <div className="bg-zinc-950 border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl h-full min-h-[500px] flex items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
              {renderChart()}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
