"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useEffect } from "react";
import { Icon } from "@/lib/utils";



interface Endpoint {
  path: string;
  method: string;
  summary: string;
  description: string;
  tags: string[];
}

export default function ApiEndpointsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("All");

  useEffect(() => {
    const fetchApiDocs = async () => {
      try {
        const res = await fetch("/openapi.json");
        if (!res.ok) throw new Error("Failed to fetch OpenAPI schema");
        const json = await res.json();
        
        const extracted: Endpoint[] = [];
        const paths = json.paths || {};
        
        for (const [path, methods] of Object.entries(paths)) {
          for (const [method, details] of Object.entries(methods as any)) {
            const d = details as any;
            extracted.push({
              path,
              method: method.toUpperCase(),
              summary: d.summary || "No summary provided",
              description: d.description || "",
              tags: d.tags || ["Uncategorized"]
            });
          }
        }
        
        setEndpoints(extracted);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchApiDocs();
  }, []);

  const tags = ["All", ...Array.from(new Set(endpoints.flatMap(e => e.tags)))].sort();
  
  const filteredEndpoints = selectedTag === "All" 
    ? endpoints 
    : endpoints.filter(e => e.tags.includes(selectedTag));

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-secondary/20 text-secondary border-secondary/30";
      case "POST": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "PUT": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "DELETE": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-zinc-500/20 text-[var(--theme-text)] opacity-80 border-zinc-500/30";
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar animate-slide-up flex flex-col font-sans">
      <Header title="API Endpoints" subtitle="Comprehensive documentation of the backend REST API endpoints." />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
          <Icon name="lock" size={20} />
          <span>Error loading API documentation: {error}. Is the backend running?</span>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Top Filter */}
          <div className="w-full shrink-0">
            <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-4 shadow-lg backdrop-blur-sm">
              <h3 className="text-[var(--theme-heading)] font-semibold mb-4 flex items-center gap-2">Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      selectedTag === tag 
                        ? "bg-primary/20 text-purple-300 border border-primary/30" 
                        : "text-[var(--theme-text)] opacity-80 bg-[var(--theme-bg)] hover:bg-white/5 hover:text-[var(--theme-text)] border border-[var(--theme-ui-border)]/50"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {tag === "All" ? <Icon name="language" size={14}/> : <Icon name="deployed_code" size={14}/>}
                      {tag}
                    </span>
                    {tag !== "All" && (
                      <span className="text-[10px] bg-[var(--theme-ui-bg)] text-[var(--theme-text)] opacity-60 px-1.5 py-0.5 rounded-full">
                        {endpoints.filter(e => e.tags.includes(tag)).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Endpoints List */}
          <div className="flex-1 space-y-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--theme-heading)] flex items-center gap-2">{selectedTag} Endpoints
              </h2>
              <span className="text-sm text-[var(--theme-text)] opacity-60 bg-[var(--theme-ui-bg)] px-3 py-1 rounded-full border border-[var(--theme-ui-border)]/50">
                {filteredEndpoints.length} routes
              </span>
            </div>

            {filteredEndpoints.map((ep, i) => (
              <div key={`${ep.method}-${ep.path}-${i}`} className="bg-[var(--theme-ui-bg)]/40 border border-[var(--theme-ui-border)]/50 rounded-xl overflow-hidden hover:border-[var(--theme-ui-border)] transition-colors shadow-lg group">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  
                  <div className="flex items-center gap-4 flex-1">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold tracking-wider border shadow-sm ${getMethodColor(ep.method)} w-20 text-center shrink-0`}>
                      {ep.method}
                    </span>
                    <span className="text-[var(--theme-text)] font-mono text-sm sm:text-base break-all">
                      {ep.path}
                    </span>
                  </div>

                  <div className="flex gap-2 shrink-0 overflow-x-auto">
                    {ep.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 text-[10px] uppercase tracking-wider bg-[var(--theme-ui-bg)] text-[var(--theme-text)] opacity-80 px-2 py-1 rounded-md whitespace-nowrap">
                        <Icon name="label" size={10} /> {tag}
                      </span>
                    ))}
                  </div>

                </div>
                
                <div className="px-5 pb-5 pt-2 border-t border-[var(--theme-ui-border)]/50 bg-[var(--theme-bg)]/30">
                  <h4 className="text-[var(--theme-text)] font-medium mt-2">{ep.summary}</h4>
                  {ep.description && (
                    <p className="text-sm text-[var(--theme-text)] opacity-60 leading-relaxed w-full h-full">
                      {ep.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
