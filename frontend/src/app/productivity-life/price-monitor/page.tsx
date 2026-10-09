"use client";

import { useEffect, useState, useMemo } from "react";

import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { Header } from "@/components/ui/Header";
import { ModernTabs } from "@/components/ui/ModernTabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Icon } from "@/lib/utils";

interface HistoryEntry {
  date: string;
  price: number;
  original_price: number | null;
  discount: string | null;
}

interface TrackedItem {
  id: string;
  name: string;
  url: string;
  history: HistoryEntry[];
  _current_price: number | null;
  _cheapest_val: number | null;
  _is_cheapest: boolean;
  _price_never_changed: boolean;
}

export default function PriceMonitor() {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState("All Items");
  const [sortOption, setSortOption] = useState("Date Added (Default)");
  
  const [showGraphMap, setShowGraphMap] = useState<Record<string, boolean>>({});

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/web-downloads/price-monitor/items");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const checkRefreshStatus = async () => {
    try {
      const res = await fetch("/api/web-downloads/price-monitor/refresh/status");
      if (res.ok) {
        const data = await res.json();
        if (data.is_refreshing) {
          setIsRefreshing(true);
          setTimeout(checkRefreshStatus, 3000);
        } else {
          setIsRefreshing(false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchItems();
    checkRefreshStatus();
  }, []);

  const handleAdd = async () => {
    if (!newName || !newUrl) {
      setToastMsg("Please fill in both fields.");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }
    try {
      const res = await fetch("/api/web-downloads/price-monitor/items", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName, url: newUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setToastMsg(data.message || "Added successfully.");
        setNewName("");
        setNewUrl("");
        setShowAdd(false);
        fetchItems();
      } else {
        setToastMsg(data.detail || "Error adding item.");
      }
    } catch (e) {
      console.error(e);
      setToastMsg("Network error.");
    }
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to stop tracking this item?")) return;
    try {
      const res = await fetch(`/api/web-downloads/price-monitor/items/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchItems();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefreshAll = async () => {
    try {
      const res = await fetch("/api/web-downloads/price-monitor/refresh", {
        method: "POST",
      });
      if (res.ok) {
        setIsRefreshing(true);
        setToastMsg("Launching background stealth browser to check prices...");
        setTimeout(() => setToastMsg(""), 3000);
        setTimeout(checkRefreshStatus, 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Check when refresh completes and reload items automatically
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRefreshing) {
      interval = setInterval(async () => {
        const res = await fetch("/api/web-downloads/price-monitor/refresh/status");
        if (res.ok) {
          const data = await res.json();
          if (!data.is_refreshing) {
            setIsRefreshing(false);
            setToastMsg("Refresh complete! Displaying updated prices.");
            setTimeout(() => setToastMsg(""), 3000);
            fetchItems();
            clearInterval(interval);
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isRefreshing]);

  const toggleGraph = (id: string) => {
    setShowGraphMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    if (searchQuery) {
      result = result.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (filterOption === "Best Value Items") {
      result = result.filter(i => i._is_cheapest);
    } else if (filterOption === "No Price Change") {
      result = result.filter(i => i._price_never_changed);
    } else if (filterOption === "Other Items") {
      result = result.filter(i => !i._is_cheapest && !i._price_never_changed && i._current_price !== null);
    }

    if (sortOption === "Current Price (Low to High)") {
      const priced = result.filter(i => i._current_price !== null);
      const unpriced = result.filter(i => i._current_price === null);
      priced.sort((a, b) => a._current_price! - b._current_price!);
      result = [...priced, ...unpriced];
    } else if (sortOption === "Current Price (High to Low)") {
      const priced = result.filter(i => i._current_price !== null);
      const unpriced = result.filter(i => i._current_price === null);
      priced.sort((a, b) => b._current_price! - a._current_price!);
      result = [...priced, ...unpriced];
    }

    return result;
  }, [items, searchQuery, filterOption, sortOption]);

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar animate-slide-up flex flex-col font-sans">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--theme-heading)] text-[var(--theme-bg)] px-4 py-2 rounded-lg shadow-lg animate-slide-up flex items-center gap-2 font-medium">
          <Icon name="info" size={18} />
          {toastMsg}
        </div>
      )}

      <Header 
        title="Price Drop Monitor" 
        subtitle="Track product prices locally from Amazon, eBay, Shopee, Tokopedia, and Steam."
        actions={
          <ModernTabs actionButton={
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-300 whitespace-nowrap flex items-center ${isRefreshing ? 'text-[var(--theme-heading)] opacity-70' : 'text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-white/5'}`}
              >
                {isRefreshing ? "Refreshing" : "Refresh All Prices"}
              </button>
              <button 
                onClick={() => setShowAdd(!showAdd)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-300 whitespace-nowrap flex items-center text-[var(--theme-text)] hover:text-[var(--theme-heading)] hover:bg-white/5"
              >
                Add Product
              </button>
            </div>
          } />
        }
      />

      <div className="p-6 lg:p-10 w-full">
        {showAdd && (
          <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] shadow-sm rounded-xl p-6 mb-8 animate-slide-up">
            <h3 className="text-lg font-semibold mb-4 text-[var(--theme-heading)] flex items-center gap-2">Add New Product to Track
            </h3>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm text-[var(--theme-text)] mb-1 block">Product Name</label>
                <TextInput value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Sony WH-1000XM5" />
              </div>
              <div className="flex-[2]">
                <label className="text-sm text-[var(--theme-text)] mb-1 block">Product URL</label>
                <TextInput value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://www.amazon.com/dp/..." />
              </div>
              <div className="flex items-end">
                <Button variant="primary" onClick={handleAdd} className="w-full md:w-auto">Start Tracking</Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] shadow-sm rounded-xl p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-2">
            <div className="flex-1 relative">
              <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)]" />
              <input 
                type="text"
                className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg py-2 pl-10 pr-4 text-[var(--theme-text)] focus:border-[var(--theme-heading)] outline-none transition-colors"
                placeholder="Search Tracked Products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full md:w-64">
              <Select 
                value={filterOption}
                onChange={e => setFilterOption(e.target.value)}
                options={[
                  { value: "All Items", label: "All Items" },
                  { value: "Best Value Items", label: "Best Value Items" },
                  { value: "No Price Change", label: "No Price Change" },
                  { value: "Other Items", label: "Other Items" }
                ]}
              />
            </div>
            <div className="w-full md:w-64">
              <Select 
                value={sortOption}
                onChange={e => setSortOption(e.target.value)}
                options={[
                  { value: "Date Added (Default)", label: "Date Added (Default)" },
                  { value: "Current Price (Low to High)", label: "Current Price (Low to High)" },
                  { value: "Current Price (High to Low)", label: "Current Price (High to Low)" }
                ]}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Icon name="refresh" className="animate-spin text-[var(--theme-text)]" size={32} />
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="text-center p-12 text-[var(--theme-text)] bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
            <Icon name="monitoring" size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No items match your criteria.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredAndSortedItems.map(item => {
              const history = item.history || [];
              const hasHistory = history.length > 0;
              const currentPrice = item._current_price;
              const cheapestVal = item._cheapest_val;
              const isCheapest = item._is_cheapest;
              const priceNeverChanged = item._price_never_changed;

              const domain = item.url.split('/')[2] || "Unknown Platform";
              let previousPrice = null;
              let delta = null;
              if (history.length > 1) {
                previousPrice = history[history.length - 2].price;
                if (currentPrice !== null) {
                  delta = currentPrice - previousPrice;
                }
              }
              
              const showGraph = showGraphMap[item.id] || false;
              
              // Format data for Recharts
              const chartData = history.map(h => ({
                date: h.date.split(' ')[0],
                fullDate: h.date,
                price: h.price
              }));

              return (
                <div key={item.id} className="bg-[var(--theme-ui-bg)] backdrop-blur-md border border-[var(--theme-ui-border)] shadow-sm hover:border-[var(--theme-heading)] hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden">
                  {isCheapest && (
                    <div className="bg-green-500/10 text-green-500 text-sm py-1.5 px-4 font-medium flex items-center gap-2 border-b border-green-500/20">
                      <Icon name="local_fire_department" size={16} /> Great News! This item is currently at its lowest tracked price!
                    </div>
                  )}
                  
                  <div className="p-5 flex flex-col md:flex-row items-center gap-6">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold text-[var(--theme-heading)] hover:opacity-80 hover:underline flex items-center gap-2 break-words">
                        {isCheapest ? <Icon name="local_fire_department" size={18} className="text-orange-500 shrink-0" /> : null}
                        {priceNeverChanged && history.length > 1 ? <Icon name="remove" size={18} className="text-[var(--theme-text)] shrink-0" /> : null}
                        {item.name}
                      </a>
                      <div className="text-sm text-[var(--theme-text)] mt-1">Platform: {domain}</div>
                    </div>
                    
                    {/* Latest Price */}
                    <div className="w-48 shrink-0">
                      <div className="text-xs text-[var(--theme-text)] uppercase font-bold tracking-wider mb-1">Latest Price</div>
                      {hasHistory && currentPrice !== null ? (
                        <div>
                          <div className="text-2xl font-bold text-[var(--theme-heading)] flex items-baseline gap-2">
                            {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {delta !== null && delta !== 0 && (
                              <span className={`text-sm ${delta < 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {delta > 0 ? '+' : ''}{delta.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {history[history.length - 1].original_price && (
                            <div className="text-xs text-[var(--theme-text)] mt-1 flex items-center gap-2">
                              <span className="line-through">{history[history.length - 1].original_price?.toLocaleString()}</span>
                              {history[history.length - 1].discount && (
                                <span className="text-[var(--theme-bg)] bg-[var(--theme-heading)] font-bold px-1.5 rounded">{history[history.length - 1].discount} OFF</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[var(--theme-text)] text-sm">No price history yet</div>
                      )}
                    </div>
                    
                    {/* All-Time Low */}
                    <div className="w-48 shrink-0">
                      <div className="text-xs text-[var(--theme-text)] uppercase font-bold tracking-wider mb-1">All-Time Low</div>
                      {hasHistory && cheapestVal !== null ? (
                        <div>
                          <div className="text-2xl font-bold text-[var(--theme-heading)]">
                            {cheapestVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs mt-1">
                            {isCheapest ? (
                              <span className="text-green-500 font-medium">Best Price</span>
                            ) : priceNeverChanged ? (
                              <span className="text-[var(--theme-text)]">Constant</span>
                            ) : (
                              <span className="text-red-500 font-medium">
                                +{(currentPrice && cheapestVal > 0 ? ((currentPrice - cheapestVal) / cheapestVal * 100) : 0).toFixed(1)}% more exp.
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[var(--theme-text)] text-sm">-</div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => toggleGraph(item.id)}
                        disabled={history.length < 2}
                        className={`!w-auto px-3 ${history.length < 2 ? "opacity-50" : ""}`}
                        title={showGraph ? "Hide Graph" : "Show Graph"}
                      >
                        <Icon name={showGraph ? "monitoring" : "show_chart"} size={18} />
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="!w-auto px-3 !text-red-500 hover:!text-red-400"
                        title="Delete"
                      >
                        <Icon name="delete" size={18} />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Graph */}
                  {showGraph && history.length > 1 && (
                    <div className="border-t border-[var(--theme-ui-border)] p-6 bg-[var(--theme-bg)]">
                      <h4 className="text-sm font-semibold text-[var(--theme-text)] mb-4">Price History</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-ui-border)" vertical={false} />
                            <XAxis 
                              dataKey="date" 
                              stroke="var(--theme-text)" 
                              tick={{ fill: 'var(--theme-text)', fontSize: 12 }} 
                            />
                            <YAxis 
                              domain={['auto', 'auto']} 
                              stroke="var(--theme-text)" 
                              tick={{ fill: 'var(--theme-text)', fontSize: 12 }}
                              tickFormatter={(val) => val.toLocaleString()}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: 'var(--theme-ui-bg)', borderColor: 'var(--theme-ui-border)', color: 'var(--theme-text)', borderRadius: '8px' }}
                              labelStyle={{ color: 'var(--theme-heading)', marginBottom: '5px', fontWeight: 'bold' }}
                              formatter={(value: any) => [Number(value).toLocaleString(), 'Price']}
                              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="price" 
                              stroke="var(--theme-heading)" 
                              strokeWidth={2}
                              dot={{ r: 4, fill: 'var(--theme-bg)', stroke: 'var(--theme-heading)', strokeWidth: 2 }}
                              activeDot={{ r: 6, fill: 'var(--theme-heading)' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
