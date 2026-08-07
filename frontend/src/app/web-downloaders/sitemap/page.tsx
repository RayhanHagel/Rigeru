"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useEffect, useRef } from "react";
import { Link2, Network, Search, Loader2, Globe, FileText, Activity, ChevronRight, ChevronDown, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

type NodeData = {
  url: string;
  title: string;
  depth: number;
  parent: string | null;
  children: NodeData[];
};

export default function SitemapPage() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(100);
  const [maxDepth, setMaxDepth] = useState(3);
  
  const [isCrawling, setIsCrawling] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  
  const [rootNode, setRootNode] = useState<NodeData | null>(null);
  const [nodesCount, setNodesCount] = useState(0);
  const [maxDepthReached, setMaxDepthReached] = useState(0);

  const nodesMapRef = useRef<Record<string, NodeData>>({});
  const eventSourceRef = useRef<EventSource | null>(null);

  const downloadJson = () => {
    const nodes = Object.values(nodesMapRef.current).map(({ url, title, depth, parent }) => ({ url, title, depth, parent }));
    const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const domain = url ? new URL(url.startsWith("http") ? url : "http://" + url).hostname : "sitemap";
    a.download = `${domain}-sitemap.json`;
    a.click();
  };

  const startCrawl = () => {
    if (!url.trim()) return;
    if (isCrawling) return;

    // Reset state
    nodesMapRef.current = {};
    setRootNode(null);
    setNodesCount(0);
    setMaxDepthReached(0);
    setIsCrawling(true);
    setStatusMsg("Connecting to crawler");

    const encodedUrl = encodeURIComponent(url);
    const token = localStorage.getItem("auth_token") || "";
    const sseUrl = `/api/web-downloads/sitemap/stream?url=${encodedUrl}&max_pages=${maxPages}&max_depth=${maxDepth}&token=${token}`;
    
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "status") {
          setStatusMsg(data.message);
        } 
        else if (data.type === "done" || data.error) {
          setStatusMsg(data.message || data.error);
          setIsCrawling(false);
          es.close();
        } 
        else if (data.type === "node") {
          const newNode: NodeData = {
            url: data.url,
            title: data.title,
            depth: data.depth,
            parent: data.parent,
            children: []
          };
          
          nodesMapRef.current[data.url] = newNode;
          setNodesCount(prev => prev + 1);
          setMaxDepthReached(prev => Math.max(prev, data.depth));
          
          if (!data.parent) {
            setRootNode(newNode);
          } else {
            const parentNode = nodesMapRef.current[data.parent];
            if (parentNode) {
              // Avoid duplicates
              if (!parentNode.children.find(c => c.url === newNode.url)) {
                parentNode.children.push(newNode);
              }
            } else {
              // Edge case: parent not found in map yet, shouldn't happen with BFS but just in case
              // We'll append it later if possible, but skipping for simplicity
            }
          }
          
          // Force a re-render of the tree by shallow copying the root node if it exists
          setRootNode(prev => prev ? { ...prev } : null);
        }
      } catch (err) {
        console.error("Failed to parse SSE data", err);
      }
    };

    es.onerror = () => {
      setStatusMsg("Connection closed or error occurred.");
      setIsCrawling(false);
      es.close();
    };
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="Website Structure Mapper" subtitle="Crawl any website to map its internal page hierarchy." />

      <div className="flex flex-col gap-6 animate-slide-up w-full">
        
        {/* Left Column: Controls & Stats */}
        <div className="w-full space-y-6">
          <div className="bg-zinc-950/50 border border-white/10 rounded-xl p-6 shadow-xl flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">Target Website
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Website URL</label>
                <div className="relative">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-zinc-950/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                  />
                  <Search size={16} className="absolute left-3 top-3 text-zinc-500" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Max Pages</label>
                  <input
                    type="number"
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    min={1} max={1000}
                    className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Max Depth</label>
                  <input
                    type="number"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    min={1} max={10}
                    className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <Button 
                onClick={startCrawl} 
                disabled={isCrawling || !url}
                className="w-full mt-2"
                variant="primary"
              >
                {isCrawling ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Crawling
                  </span>
                ) : "Start Mapping"}
              </Button>

              <Button
                onClick={downloadJson}
                disabled={nodesCount === 0}
                className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-medium flex items-center gap-2"
              >
                <Download size={16} /> Save as JSON
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950/50 border border-white/10 rounded-xl p-5 shadow-lg">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <FileText size={16} />
                <span className="text-xs font-medium">Pages Found</span>
              </div>
              <div className="text-3xl font-bold text-zinc-200">{nodesCount}</div>
            </div>
            
            <div className="bg-zinc-950/50 border border-white/10 rounded-xl p-5 shadow-lg">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Activity size={16} />
                <span className="text-xs font-medium">Max Depth</span>
              </div>
              <div className="text-3xl font-bold text-zinc-200">{maxDepthReached}</div>
            </div>
          </div>
          
          <div className="bg-zinc-950/50 border border-white/10 rounded-xl p-4 shadow-lg flex items-center gap-3">
            {isCrawling ? (
              <Loader2 size={18} className="text-primary animate-spin shrink-0" />
            ) : statusMsg.includes("Finished") ? (
              <CheckCircle2 size={18} className="text-green-400 shrink-0" />
            ) : (
              <Globe size={18} className="text-zinc-500 shrink-0" />
            )}
            <span className="text-sm text-zinc-400 line-clamp-2 leading-tight">
              {statusMsg || "Ready to crawl. Enter a URL above."}
            </span>
          </div>
        </div>

        {/* Right Column: Tree Map */}
        <div className="w-full">
          <div className="bg-zinc-950/50 border border-white/10 rounded-xl p-6 shadow-xl h-[700px] flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-4 flex items-center gap-2">Structure Map
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {rootNode ? (
                <TreeNode node={rootNode} isRoot />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-3">
                  <Network size={48} className="opacity-20" />
                  <p className="text-sm">The website structure will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Recursive Tree Node Component
const TreeNode = ({ node, isRoot = false }: { node: NodeData, isRoot?: boolean }) => {
  const [expanded, setExpanded] = useState(isRoot || node.depth < 2);
  const hasChildren = node.children.length > 0;
  
  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors group ${
          hasChildren ? "cursor-pointer hover:bg-zinc-800/50" : "hover:bg-zinc-800/50"
        }`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="shrink-0 w-4 h-4 flex items-center justify-center text-zinc-500">
          {hasChildren ? (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
          )}
        </div>
        
        <Link2 size={14} className={isRoot ? "text-primary" : "text-zinc-500 group-hover:text-primary transition-colors"} />
        
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`text-sm truncate hover:underline ${
            isRoot ? "font-bold text-primary" : "text-zinc-300 hover:text-primary"
          }`}
        >
          {node.title}
        </a>
        
        {!isRoot && (
          <span className="text-xs text-zinc-600 truncate ml-2 max-w-[200px] opacity-0 group-hover:opacity-100 transition-opacity">
            {node.url}
          </span>
        )}
      </div>
      
      {expanded && hasChildren && (
        <div className="ml-5 pl-2 border-l border-white/10 mt-1 flex flex-col gap-0.5">
          {node.children.map((child, idx) => (
            <TreeNode key={idx} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};
