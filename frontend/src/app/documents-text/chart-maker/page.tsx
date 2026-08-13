"use client";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";

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
        <div className="flex flex-col gap-6 w-full animate-slide-up mt-6">
          <SectionHeader title="Upload Data" icon={<Icon name="table" size={18} />} />
          <div className="w-full">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40">
                <div className="w-8 h-8 border-4 border-[var(--theme-heading)] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[var(--theme-text)]">Parsing data...</p>
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
        <div className="flex flex-col gap-6 w-full mt-6">
          <SectionHeader title="Configuration" icon={<Icon name="settings" size={18} />} />
          
          <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Chart Type</label>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                  <button onClick={() => setChartType("bar")} className={`p-2 rounded-lg text-sm flex items-center justify-center gap-2 border transition-all ${chartType === "bar" ? "bg-[var(--theme-heading)] border-[var(--theme-heading)] text-[var(--theme-bg)]" : "bg-[var(--theme-ui-bg)] border-[var(--theme-ui-border)] text-[var(--theme-text)] hover:border-[var(--theme-heading)] hover:shadow-md"}`}><Icon name="bar_chart" size={16}/> Bar</button>
                  <button onClick={() => setChartType("line")} className={`p-2 rounded-lg text-sm flex items-center justify-center gap-2 border transition-all ${chartType === "line" ? "bg-[var(--theme-heading)] border-[var(--theme-heading)] text-[var(--theme-bg)]" : "bg-[var(--theme-ui-bg)] border-[var(--theme-ui-border)] text-[var(--theme-text)] hover:border-[var(--theme-heading)] hover:shadow-md"}`}><Icon name="show_chart" size={16}/> Line</button>
                  <button onClick={() => setChartType("pie")} className={`p-2 rounded-lg text-sm flex items-center justify-center gap-2 border transition-all ${chartType === "pie" ? "bg-[var(--theme-heading)] border-[var(--theme-heading)] text-[var(--theme-bg)]" : "bg-[var(--theme-ui-bg)] border-[var(--theme-ui-border)] text-[var(--theme-text)] hover:border-[var(--theme-heading)] hover:shadow-md"}`}><Icon name="pie_chart" size={16}/> Pie</button>
                  <button onClick={() => setChartType("scatter")} className={`p-2 rounded-lg text-sm flex items-center justify-center gap-2 border transition-all ${chartType === "scatter" ? "bg-[var(--theme-heading)] border-[var(--theme-heading)] text-[var(--theme-bg)]" : "bg-[var(--theme-ui-bg)] border-[var(--theme-ui-border)] text-[var(--theme-text)] hover:border-[var(--theme-heading)] hover:shadow-md"}`}><Icon name="tune" size={16}/> Scatter</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">X-Axis (Labels)</label>
                <select 
                  value={xAxisKey} 
                  onChange={(e) => setXAxisKey(e.target.value)}
                  className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] rounded-lg p-2 text-[var(--theme-text)] text-sm outline-none focus:border-[var(--theme-heading)] h-[38px] transition-colors"
                >
                  {columns.map(c => <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--theme-text)] mb-2">Y-Axis (Values)</label>
                <select 
                  value={yAxisKey} 
                  onChange={(e) => setYAxisKey(e.target.value)}
                  className="w-full bg-[var(--theme-bg)] border border-[color-mix(in_srgb,var(--theme-heading)_20%,transparent)] rounded-lg p-2 text-[var(--theme-text)] text-sm outline-none focus:border-[var(--theme-heading)] h-[38px] transition-colors"
                >
                  {columns.map(c => <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div className="flex items-end">
                <Button variant="secondary" className="w-full h-[38px]" onClick={() => setData([])}>
                  Upload New File
                </Button>
              </div>
            </div>
          </div>

          <SectionHeader title="Preview" icon={<Icon name="visibility" size={18} />} />
          <div className="w-full">
            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-4 md:p-8 rounded-xl border border-[var(--theme-ui-border)] shadow-sm h-full min-h-[500px] flex items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--theme-heading)]/5 to-transparent pointer-events-none"></div>
              {renderChart()}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
