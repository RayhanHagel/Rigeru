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
      const res = await fetch(`/api/web-downloads/currency/trend?base=${currentBase}&target=${currentTarget}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
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
      const res = await fetch(`/api/web-downloads/currency/convert?amount=${currentAmount}&base=${currentBase}&target=${currentTarget}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
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
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans custom-scrollbar">
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-up flex items-center gap-2">
          <Icon name="error" size={18} />
          {errorMsg}
          <Button size="sm" onClick={() => setErrorMsg("")} className="!w-auto !h-auto !p-0 !bg-transparent !text-white hover:!text-red-200 font-bold ml-2">✕</Button>
        </div>
      )}

      <Header title="Currency Converter & Tracker" subtitle="Check real-time exchange rates, historical trends, and an extrapolated 7-day forecast." />

      <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm mb-6 mt-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-[var(--theme-text)] font-semibold text-xs uppercase tracking-wider">Amount</label>
            <input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full md:w-32 bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] focus:border-[var(--theme-heading)] rounded-lg px-4 py-2 text-center font-mono font-semibold text-[var(--theme-heading)] outline-none"
              placeholder="1.0"
            />
          </div>

          <div className="flex flex-col gap-1 w-full md:flex-1">
            <label className="text-[var(--theme-text)] font-semibold text-xs uppercase tracking-wider">From</label>
            {loadingCurrencies ? (
              <div className="h-10 bg-[var(--theme-ui-border)] animate-pulse rounded-lg w-full" />
            ) : (
              <div className="relative">
                <select 
                  className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg px-4 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-heading)] appearance-none cursor-pointer"
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                >
                  {currencyOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[var(--theme-bg)] text-[var(--theme-text)]">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Icon name="expand_more" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)] pointer-events-none" />
              </div>
            )}
          </div>

          <Button 
            size="md"
            onClick={handleSwap}
            className="!w-auto shrink-0 mt-0 md:mt-5"
            title="Swap Currencies"
          >
            Swap
          </Button>

          <div className="flex flex-col gap-1 w-full md:flex-1">
            <label className="text-[var(--theme-text)] font-semibold text-xs uppercase tracking-wider">To</label>
            {loadingCurrencies ? (
              <div className="h-10 bg-[var(--theme-ui-border)] animate-pulse rounded-lg w-full" />
            ) : (
              <div className="relative">
                <select 
                  className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg px-4 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-heading)] appearance-none cursor-pointer"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {currencyOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[var(--theme-bg)] text-[var(--theme-text)]">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Icon name="expand_more" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)] pointer-events-none" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 w-full md:w-48 shrink-0">
            <label className="text-[var(--theme-text)] font-semibold text-xs uppercase tracking-wider">Result</label>
            <div className="h-10 w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg flex items-center justify-between px-4 font-mono font-bold overflow-hidden">
              <span className="text-[var(--theme-text)] text-xs">{target}</span>
              <div className="text-[var(--theme-heading)] flex items-center">
                {converting ? (
                  <Icon name="sync" size={16} className="animate-spin text-[var(--theme-text)] opacity-50" />
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
          <div className="flex-1 w-full h-[300px]">
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
