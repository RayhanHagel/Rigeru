"use client";
import { Header } from "@/components/ui/Header";

import { useEffect, useState, useMemo } from "react";

import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Icon } from "@/lib/utils";

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
          <Icon name="error" size={18} />
          {errorMsg}
          <button onClick={() => setErrorMsg("")} className="ml-2 font-bold hover:text-red-200">✕</button>
        </div>
      )}

      <Header title="Currency Converter & Tracker" subtitle="Check real-time exchange rates, historical trends, and an extrapolated 7-day forecast." />

      <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm mb-6 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[var(--theme-text)] font-semibold text-sm">Amount & Base Currency</label>
            <div className="flex gap-2">
              <TextInput 
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-24 text-center font-mono font-semibold"
                placeholder="1.0"
              />
              <div className="flex-1">
                {loadingCurrencies ? (
                  <div className="h-10 bg-[var(--theme-ui-border)] animate-pulse rounded-md w-full" />
                ) : (
                  <Select 
                    options={currencyOptions}
                    value={base}
                    onChange={(e) => setBase(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center mt-6">
            <Button variant="secondary" onClick={handleSwap} icon={<Icon name="swap_horiz" size={24} />} title="Swap Currencies" className="rounded-full w-12 h-12 p-0 flex items-center justify-center" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[var(--theme-text)] font-semibold text-sm">Target Currency & Result</label>
            <div className="flex gap-2">
              <div className="flex-1">
                {loadingCurrencies ? (
                  <div className="h-10 bg-[var(--theme-ui-border)] animate-pulse rounded-md w-full" />
                ) : (
                  <Select 
                    options={currencyOptions}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                )}
              </div>
              <div className="w-40 bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg flex items-center justify-center px-4 font-mono font-bold text-[var(--theme-heading)] overflow-hidden shrink-0">
                {converting ? (
                  <Icon name="sync" size={18} className="animate-spin text-[var(--theme-text)]" />
                ) : convertResult !== null ? (
                  convertResult.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                ) : (
                  "0.00"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm min-h-[400px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[var(--theme-heading)]">Exchange Rate Trend ({base} to {target})</h3>
          {cachedTime && (
            <span className="text-xs text-[var(--theme-text)] opacity-70">
              Last updated: {new Date(cachedTime).toLocaleString()}
            </span>
          )}
        </div>
        
        {loadingTrend ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--theme-text)]">
            <Icon name="sync" size={48} className="animate-spin opacity-50 mb-4" />
            <p>Loading market data...</p>
          </div>
        ) : chartData.length > 0 ? (
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-ui-border)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--theme-text)" 
                  tick={{ fill: 'var(--theme-text)', fontSize: 12 }} 
                  tickMargin={10} 
                  axisLine={false} 
                  tickLine={false} 
                  minTickGap={30}
                />
                <YAxis 
                  stroke="var(--theme-text)" 
                  tick={{ fill: 'var(--theme-text)', fontSize: 12 }} 
                  domain={['auto', 'auto']} 
                  tickMargin={10} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--theme-ui-bg)', 
                    borderColor: 'var(--theme-ui-border)', 
                    borderRadius: '8px',
                    color: 'var(--theme-text)'
                  }} 
                  itemStyle={{ fontWeight: 'bold' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line 
                  type="monotone" 
                  dataKey="historical" 
                  name="Historical Rate" 
                  stroke="var(--theme-heading)" 
                  strokeWidth={3} 
                  dot={false} 
                  activeDot={{ r: 6 }} 
                  connectNulls={true}
                />
                <Line 
                  type="monotone" 
                  dataKey="extrapolation" 
                  name="Forecast (7 Days)" 
                  stroke="var(--theme-heading)" 
                  strokeWidth={3} 
                  strokeDasharray="5 5" 
                  dot={false} 
                  connectNulls={true}
                  opacity={0.6}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--theme-text)] opacity-70">
            <Icon name="query_stats" size={48} className="mb-4" />
            <p>No trend data available for this pair.</p>
          </div>
        )}
      </div>
    </div>
  );
}
