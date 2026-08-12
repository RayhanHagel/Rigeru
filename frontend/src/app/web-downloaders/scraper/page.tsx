"use client";
import { Header } from "@/components/ui/Header";

import { useState, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

type ScrapedResult = {
  "Target URL": string;
  "Extracted Data": string;
};

export default function WebScraperPage() {
  const [urls, setUrls] = useState<string[]>([""]);
  const [cssSelector, setCssSelector] = useState("");
  
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  
  // Listen for messages from the interactive iframe

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SELECTOR_PICKED') {
        setCssSelector(e.data.selector);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  const [isScraping, setIsScraping] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  
  const [results, setResults] = useState<ScrapedResult[]>([]);

  const handlePreview = async () => {
    const urlList = urls.map(u => u.trim()).filter(Boolean);
    if (urlList.length === 0) {
      alert("Please enter at least one URL.");
      return;
    }
    
    setIsPreviewing(true);
    try {
      const res = await fetch("/api/web-downloads/scraper/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: urlList })
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewImages(data.image_urls || []);
      } else {
        alert(data.detail);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to fetch preview.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleStartScraping = async () => {
    const urlList = urls.map(u => u.trim()).filter(Boolean);
    if (urlList.length === 0 || !cssSelector.trim()) {
      alert("Please provide both URLs and a CSS selector.");
      return;
    }

    setIsScraping(true);
    setResults([]);
    setTaskId(null);
    setStatusMessage("Starting background task");
    
    try {
      const res = await fetch("/api/web-downloads/scraper/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: urlList, css_selector: cssSelector.trim(), headless: true })
      });
      const data = await res.json();
      
      if (res.ok) {
        setTaskId(data.task_id);
        pollTask(data.task_id);
      } else {
        alert(data.detail);
        setIsScraping(false);
      }
    } catch (e) {
      console.error(e);
      setIsScraping(false);
      alert("Failed to start scraping.");
    }
  };

  const pollTask = async (id: string) => {
    try {
      const res = await fetch(`/api/web-downloads/scraper/status/${id}`);
      const data = await res.json();
      
      setStatusMessage(data.message);
      
      if (data.status === "completed") {
        setResults(data.result);
        setIsScraping(false);
      } else if (data.status === "failed") {
        setIsScraping(false);
        alert(data.message);
      } else {
        // Continue polling
        setTimeout(() => pollTask(id), 2000);
      }
    } catch (e) {
      console.error(e);
      setIsScraping(false);
      alert("Error polling task status.");
    }
  };

  const handleDownloadCsv = () => {
    if (results.length === 0) return;
    
    const header = Object.keys(results[0]);
    const csvContent = [
      header.join(","),
      ...results.map(row => 
        header.map(fieldName => JSON.stringify((row as any)[fieldName])).join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "scraped_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Visual Web Scraper" subtitle="Use a local headless browser to extract specific elements from a list of websites." />

      <div className="flex flex-col gap-6 mb-8 animate-slide-up w-full">
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 flex flex-col max-h-[500px] shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Target URLs</h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-4">
            {urls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <input 
                  type="text"
                  value={url}
                  onChange={(e) => {
                    const newUrls = [...urls];
                    newUrls[index] = e.target.value;
                    setUrls(newUrls);
                  }}
                  placeholder="https://example.com"
                  className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none font-mono text-sm"
                />
                {urls.length > 1 && (
                  <Button 
                    variant="secondary" 
                    onClick={() => setUrls(urls.filter((_, i) => i !== index))}
                    className="px-3"
                  >
                    <Icon name="delete" size={16} className="text-zinc-400 hover:text-red-400 transition-colors" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-white/5 flex gap-4">
            <Button variant="secondary" onClick={() => setUrls([...urls, ""])} icon={<Icon name="add" size={16} />}>
              Add URL
            </Button>
            <Button variant="secondary" onClick={handlePreview} isLoading={isPreviewing} icon={<Icon name="visibility" size={16} />} disabled={urls.every(u => !u.trim()) || isInteractiveMode}>
              Preview Image
            </Button>
            <Button 
              variant={isInteractiveMode ? "primary" : "secondary"} 
              onClick={() => {
                setIsInteractiveMode(!isInteractiveMode);
                setPreviewImages([]);
              }} 
              icon={<Icon name="search" size={16} />} 
              disabled={urls.every(u => !u.trim())}
            >
              Interactive Selector
            </Button>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 flex flex-col shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
          
          <label className="text-sm font-medium text-zinc-300 mb-2">CSS Selector to Extract</label>
          <input 
            type="text" 
            value={cssSelector}
            onChange={(e) => setCssSelector(e.target.value)}
            placeholder="e.g., h1, .price, #main-content"
            className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none mb-4"
          />
          
          <div className="bg-zinc-950/50 rounded-lg p-4 mb-4 text-sm text-zinc-400">
            <p className="font-semibold text-zinc-300 mb-2">Common Selectors:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><code className="text-primary">h1</code>, <code className="text-primary">h2</code>, <code className="text-primary">p</code> (Tags)</li>
              <li><code className="text-primary">.product-title</code> (Class)</li>
              <li><code className="text-primary">#main-price</code> (ID)</li>
            </ul>
          </div>
          

          <Button 
            variant="primary" 
            onClick={handleStartScraping} 
            isLoading={isScraping}
            icon={<Icon name="play_arrow" size={16} />}
            className="w-full mt-6"
            disabled={urls.every(u => !u.trim()) || !cssSelector.trim()}
          >
            Start Scraping
          </Button>
        </div>
      </div>

      {previewImages.length > 0 && !isInteractiveMode && (
        <div className="mb-8 bg-zinc-900/50 border border-white/5 rounded-xl p-6 animate-slide-up">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">Live Preview ({previewImages.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {previewImages.map((img, idx) => (
              <div key={idx} className="rounded-lg overflow-hidden border border-white/10 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`Preview ${idx+1}`} className="w-full h-auto object-contain max-h-[400px]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {isInteractiveMode && urls[0] && (
        <div className="mb-8 bg-zinc-900/50 border border-white/5 rounded-xl p-6 animate-slide-up">
          <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">Interactive Element Picker
          </h2>
          <p className="text-sm text-zinc-400 mb-4">
            Hover over elements in the preview below. Click any highlighted element to automatically generate its CSS selector.
          </p>
          <div className="rounded-lg overflow-hidden border border-white/10 bg-white h-[600px]">
            <iframe 
              src={`/api/web-downloads/scraper/proxy?url=${encodeURIComponent(urls[0])}`}
              className="w-full h-full border-none"
              title="Interactive Web Scraper"
            />
          </div>
        </div>
      )}

      {(isScraping || results.length > 0) && (
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {isScraping ? (
                <><Icon name="schedule" size={18} className="text-secondary animate-spin-slow" /> Scraping in Progress</>
              ) : (
                <><Icon name="check_circle" size={18} className="text-green-400" /> Scraping Completed</>
              )}
            </h2>
            
            {results.length > 0 && (
              <Button variant="secondary" onClick={handleDownloadCsv} icon={<Icon name="download" size={16} />}>
                Download CSV
              </Button>
            )}
          </div>
          
          {isScraping && (
            <div className="flex items-center gap-3 p-4 bg-secondary/10 border border-secondary/20 rounded-lg text-secondary mb-6">
              <div className="w-4 h-4 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
              {statusMessage}
            </div>
          )}
          
          {results.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-zinc-950 text-zinc-400 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-semibold w-1/3">Target URL</th>
                    <th className="px-6 py-4 font-semibold border-l border-white/5">Extracted Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-zinc-900/30">
                  {results.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 text-zinc-300 max-w-[300px] truncate" title={row["Target URL"]}>
                        <a href={row["Target URL"]} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {row["Target URL"]}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-zinc-200 border-l border-white/5 whitespace-pre-wrap">
                        {row["Extracted Data"]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
