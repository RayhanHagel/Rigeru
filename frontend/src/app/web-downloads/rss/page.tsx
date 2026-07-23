"use client";

import { useState, useEffect } from "react";
import { Rss, Plus, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function RssManager() {
  const [activeTab, setActiveTab] = useState("feed");
  
  // Feed Reader state
  const [articles, setArticles] = useState<any[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [feedError, setFeedError] = useState("");

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Array<{title: string, url: string}>>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [subMsg, setSubMsg] = useState("");
  const [subError, setSubError] = useState("");

  const fetchSubscriptions = async () => {
    setLoadingSubs(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/web-downloads/rss/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubs(false);
    }
  };

  const fetchFeeds = async (forceRefresh: boolean = false) => {
    setLoadingFeeds(true);
    setFeedError("");
    try {
      const url = `http://127.0.0.1:8000/api/web-downloads/rss/feeds${forceRefresh ? '?force_refresh=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch feeds");
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (e: any) {
      setFeedError(e.message);
    } finally {
      setLoadingFeeds(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    fetchFeeds();
  }, []);

  const handleAddSub = async () => {
    if (!newTitle || !newUrl) return setSubError("Title and URL are required.");
    setLoadingSubs(true);
    setSubError("");
    setSubMsg("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/web-downloads/rss/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, url: newUrl })
      });
      if (!res.ok) throw new Error("Failed to add subscription");
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
      setSubMsg(data.message);
      setNewTitle("");
      setNewUrl("");
      // Refresh feeds as well
      fetchFeeds();
    } catch (e: any) {
      setSubError(e.message);
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleRemoveSub = async (title: string, url: string) => {
    setLoadingSubs(true);
    setSubError("");
    setSubMsg("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/web-downloads/rss/subscriptions/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url })
      });
      if (!res.ok) throw new Error("Failed to remove subscription");
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
      setSubMsg(data.message);
      // Refresh feeds as well
      fetchFeeds();
    } catch (e: any) {
      setSubError(e.message);
    } finally {
      setLoadingSubs(false);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-5xl mx-auto overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 border-b border-orange-500/30 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-orange-500/20 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
            <Rss size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">RSS Feed Manager</h1>
            <p className="text-zinc-400 text-sm font-medium mt-1">Read and manage your RSS subscriptions.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("feed")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "feed" ? "bg-orange-500 text-black" : "bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            Feed Reader
          </button>
          <button
            onClick={() => setActiveTab("subs")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "subs" ? "bg-orange-500 text-black" : "bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            Manage Subscriptions
          </button>
        </div>
      </div>
      
      {activeTab === "feed" ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Latest Articles</h2>
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => fetchFeeds(true)} isLoading={loadingFeeds}>
              Refresh
            </Button>
          </div>
          
          {feedError && <div className="p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30">{feedError}</div>}
          
          {loadingFeeds && articles.length === 0 ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" /></div>
          ) : articles.length === 0 ? (
            <div className="p-10 border border-dashed border-zinc-800 rounded-2xl text-center text-zinc-500">
              No articles found. Add some subscriptions first.
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article, idx) => (
                <a 
                  key={idx} 
                  href={article.link} 
                  target="_blank" 
                  rel="noreferrer"
                  className="block bg-zinc-900/50 border border-white/10 rounded-xl p-5 hover:border-orange-500/50 hover:bg-zinc-900/80 transition-all group"
                >
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">{article.title}</h3>
                    <ExternalLink size={16} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  </div>
                  <div className="flex gap-3 text-xs font-medium mb-3">
                    <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-md">{article.source}</span>
                    <span className="text-zinc-500 flex items-center">{article.date}</span>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-2" dangerouslySetInnerHTML={{ __html: article.summary }} />
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-6">Add New Subscription</h2>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Feed Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Hacker News" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white focus:border-orange-500 outline-none transition-all"
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-sm font-medium text-zinc-300 mb-2">RSS URL</label>
                <input 
                  type="text" 
                  placeholder="https://news.ycombinator.com/rss" 
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white focus:border-orange-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="primary" icon={<Plus size={16} />} onClick={handleAddSub} isLoading={loadingSubs} className="bg-orange-500 hover:bg-orange-600 text-black border-none">
                Subscribe
              </Button>
            </div>
            {subError && <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">{subError}</div>}
            {subMsg && <div className="mt-4 p-3 bg-green-500/20 text-green-400 rounded-lg text-sm">{subMsg}</div>}
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Your Subscriptions ({subscriptions.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map(({title, url}) => (
                <div key={url} className="bg-zinc-900/30 border border-white/10 rounded-xl p-4 flex justify-between items-center group">
                  <div className="overflow-hidden pr-4">
                    <h4 className="font-bold text-zinc-200 truncate">{title}</h4>
                    <p className="text-xs text-zinc-500 truncate mt-1">{url}</p>
                  </div>
                  <button 
                    onClick={() => handleRemoveSub(title, url)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                    title="Remove Subscription"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
