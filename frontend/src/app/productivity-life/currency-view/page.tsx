"use client";
import { Header } from "@/components/ui/Header";

import { useEffect, useState, useMemo } from "react";
import { Coins, ArrowRightLeft, TrendingUp, RefreshCw, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function CurrencyView() {
  const [currencies, setCurrencies] = useState<Record<string, string>>({});
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [amount, setAmount] = useState<number>(1.0);
  const [base, setBase] = useState<string>("USD");
  const [target, setTarget] = useState<string>("IDR");
  
  const [convertResult, setConvertResult] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);

  const [trendData, setTrendData] = useState<any[]>([]);
  const [cachedTime, setCachedTime] = useState<string>("");
  const [loadingTrend, setLoadingTrend] = useState(false);

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const fetchCurrencies = async () => {
    setLoadingCurrencies(true);
    try {
      const res = await fetch("/api/web-downloads/currency/available", {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrencies(data);
        
        // Ensure defaults are valid if USD/IDR exist
        if (!data["USD"]) setBase(Object.keys(data)[0] || "");
        if (!data["IDR"]) setTarget(Object.keys(data)[1] || "");
      } else {
        setErrorMsg("Failed to load currencies.");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Network error.");
    }
    setLoadingCurrencies(false);
  };

  const currencyOptions = useMemo(() => {
    return Object.entries(currencies).map(([code, name]) => ({
      value: code,
      label: `${code} - ${name}`
    }));
  }, [currencies]);

  const fetchTrend = async (currentBase = base, currentTarget = target) => {
    if (currentBase === currentTarget) {
      setTrendData([]);
      return;
    }
    setLoadingTrend(true);
    try {
      const res = await fetch(`/api/web-downloads/currency/trend?base=${currentBase}&target=${currentTarget}`);
      if (res.ok) {
        const data = await res.json();
        setTrendData(data.trend_data);
        setCachedTime(data.cached_time);
      } else {
        setTrendData([]);
      }
    } catch (e) {
      console.error(e);
      setTrendData([]);
    }
    setLoadingTrend(false);
  };

  const handleConvert = async (currentAmount = amount, currentBase = base, currentTarget = target) => {
    if (!currentAmount || currentAmount <= 0 || !currentBase || !currentTarget) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/web-downloads/currency/convert?amount=${currentAmount}&base=${currentBase}&target=${currentTarget}`);
      if (res.ok) {
        const data = await res.json();
        setConvertResult(data.result);
        
        // Fetch trend automatically after successful conversion
        fetchTrend(currentBase, currentTarget);
      } else {
        setErrorMsg("Conversion failed.");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Network error.");
    }
    setConverting(false);
  };

  useEffect(() => {
    if (Object.keys(currencies).length > 0 && amount > 0 && base && target) {
      const timer = setTimeout(() => {
        handleConvert(amount, base, target);
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, base, target, currencies]);

  // Split data into Historical and Extrapolation lines for Recharts
  const chartData = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    return trendData.map(d => ({
      date: d.date,
      historical: d.type === "Historical" ? d.rate : null,
      extrapolation: d.type === "Extrapolation" ? d.rate : null,
      // Connect the lines by having one point with both if needed, 
      // but Recharts handles it gracefully if we just map it.
      // Wait, Recharts lines break if there are nulls and connectNulls is false.
      // We will set connectNulls={true}
    }));
  }, [trendData]);

  const handleSwap = () => {
    const temp = base;
    setBase(target);
    setTarget(temp);
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-up flex items-center gap-2">
          <AlertCircle size={18} />
          {errorMsg}
          <button onClick={() => setErrorMsg("")} className="ml-2 font-bold hover:text-red-200">✕</button>
        </div>
      )}

      <Header title="Currency Converter & Tracker" subtitle="Check real-time exchange rates, historical trends, and an extrapolated 7-day forecast." />

      {loadingCurrencies ? (
        <div className="flex justify-center p-12">
          <RefreshCw className="animate-spin text-zinc-500" size={32} />
        </div>
      ) : (
        <div className="flex flex-col gap-6 animate-slide-up w-full">
          {/* Calculator Section */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">Conversion Calculator
            </h3>
            
            <div className="flex flex-col md:flex-row items-end gap-4 w-full">
              <div className="flex-1 w-full">
                <label className="text-sm text-zinc-400 mb-1 block">Amount</label>
                <TextInput 
                  type="number"
                  value={amount.toString()}
                  onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="flex-[2] w-full">
                <label className="text-sm text-zinc-400 mb-1 block">From</label>
                <Select
                  value={base}
                  onChange={e => setBase(e.target.value)}
                  options={currencyOptions}
                />
              </div>
              
              <div className="flex pb-2 justify-center">
                <button 
                  onClick={handleSwap}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-white/5"
                  title="Swap currencies"
                >
                  <ArrowRightLeft size={20} />
                </button>
              </div>
              
              <div className="flex-[2] w-full">
                <label className="text-sm text-zinc-400 mb-1 block">To</label>
                <Select
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  options={currencyOptions}
                />
              </div>
              
              <div className="w-full md:w-auto">
                <Button 
                  variant="primary" 
                  onClick={() => handleConvert()}
                  disabled={converting}
                  className="w-full md:w-32"
                >
                  {converting ? <RefreshCw size={18} className="animate-spin" /> : "Convert"}
                </Button>
              </div>
            </div>
            
            {convertResult !== null && (
              <div className="mt-4 p-6 bg-zinc-950 border border-white/10 shadow-lg rounded-xl flex items-center justify-center text-center animate-slide-up">
                <div className="text-3xl md:text-4xl">
                  <span className="font-light text-zinc-300">{amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {base} = </span>
                  <span className="font-bold text-primary">{convertResult.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {target}</span>
                </div>
              </div>
            )}
          </div>

          {/* Trend Section */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">30-Day Trend & 7-Day Forecast: {base} to {target}
              </h3>
              
              <Button variant="secondary" onClick={() => fetchTrend()} disabled={loadingTrend} size="sm">
                {loadingTrend ? <RefreshCw size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
                Load Trend
              </Button>
            </div>
            
            {base === target ? (
              <div className="p-8 bg-zinc-800/50 rounded-lg text-center text-zinc-400 border border-white/5">
                <Info size={32} className="mx-auto mb-3 opacity-50" />
                Select two different currencies to view a trend chart.
              </div>
            ) : loadingTrend ? (
              <div className="h-80 flex items-center justify-center">
                <RefreshCw size={32} className="animate-spin text-zinc-500" />
              </div>
            ) : chartData.length > 0 ? (
              <div>
                <div className="text-xs text-zinc-500 mb-6 flex items-center gap-2 bg-zinc-950/50 p-2 rounded-md border border-white/5 inline-flex">
                  <Info size={14} /> 
                  {cachedTime === "Just now" 
                    ? "Displaying live data fetched just now." 
                    : `Displaying cached data from ${cachedTime}. Fetching latest data in background`}
                </div>
                
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="rgba(255,255,255,0.4)" 
                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} 
                      />
                      <YAxis 
                        domain={['auto', 'auto']} 
                        stroke="rgba(255,255,255,0.4)" 
                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                        tickFormatter={(val) => val.toLocaleString()}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                        labelStyle={{ color: '#a1a1aa', marginBottom: '5px' }}
                        formatter={(value: any, name: any) => [Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line 
                        type="monotone" 
                        dataKey="historical" 
                        name="Historical"
                        stroke="#a855f7" 
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#18181b', stroke: '#a855f7', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#a855f7' }}
                        connectNulls
                      />
                      <Line 
                        type="monotone" 
                        dataKey="extrapolation" 
                        name="Extrapolation"
                        stroke="#d8b4fe" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3, fill: '#18181b', stroke: '#d8b4fe', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#d8b4fe' }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-zinc-800/50 rounded-lg text-center text-zinc-400 border border-white/5">
                <AlertCircle size={32} className="mx-auto mb-3 opacity-50" />
                No trend data available for this pair. Click "Load Trend" to try fetching.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
