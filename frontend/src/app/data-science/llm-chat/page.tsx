"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ToolConfig = {
  [key: string]: { label: string; description: string; enabled: boolean };
};

export default function LLMChatBotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [tokenUsage, setTokenUsage] = useState("");
  
  const [showSettings, setShowSettings] = useState(false);
  const [tools, setTools] = useState<ToolConfig>({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  const [activeModel, setActiveModel] = useState("Local LLM Agent");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem("auth_token") || "";
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      const res = await fetch(`http://${host}:8000/api/files-documents/llm-chat/config?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        const enabledTools = data.enabled_tools || [];
        
        const AVAILABLE_TOOLS = {
          "wikipedia_search": { label: "Wikipedia Search", description: "Search Wikipedia for factual summaries." },
          "arxiv_search": { label: "arXiv Search", description: "Search academic and scientific papers." },
          "web_search": { label: "Web Search", description: "Search the live web for general info." },
          "scrape_page": { label: "Scrape Page", description: "Fetch the full readable text of a specific URL." },
          "get_youtube_transcript": { label: "YouTube Transcript", description: "Gets transcript/captions of a YouTube video." },
          "search_images": { label: "Image Search", description: "Searches for image URLs." },
          "get_current_date": { label: "Current Date", description: "Returns the current date and time." },
          "verify_claim": { label: "Verify Claim", description: "Fact checks a specific claim using the web." },
          "read_github_repo": { label: "Read GitHub Repo", description: "Reads the README of a GitHub repository." },
          "read_pdf": { label: "Read PDF", description: "Downloads and reads a PDF from a URL." },
          "translate_source": { label: "Translate Source", description: "Translates foreign text into English." },
          "query_wikidata": { label: "Query Wikidata", description: "Executes a SPARQL query on Wikidata." },
          "solve_math_and_latex": { label: "Solve Math", description: "Solves math equations and formats them as LaTeX." }
        };

        const newTools: ToolConfig = {};
        Object.keys(AVAILABLE_TOOLS).forEach((key) => {
          newTools[key] = {
            ...AVAILABLE_TOOLS[key as keyof typeof AVAILABLE_TOOLS],
            enabled: enabledTools.includes(key)
          };
        });
        setTools(newTools);
      }
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    fetchConfig();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const saveConfig = async (updatedTools: ToolConfig) => {
    setIsSavingConfig(true);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
      
      const enabledTools = Object.keys(updatedTools).filter(k => updatedTools[k].enabled);
      
      await fetch(`http://${host}:8000/api/files-documents/llm-chat/config?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled_tools: enabledTools })
      });
    } catch(e) { 
      console.error(e);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleTool = (key: string) => {
    const updated = { ...tools, [key]: { ...tools[key], enabled: !tools[key].enabled } };
    setTools(updated);
    saveConfig(updated);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, statusMsg]);

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    
    const newMessages = [...messages, { role: "user" as const, content: input }];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsGenerating(true);
    setStatusMsg("Thinking...");
    setTokenUsage("");
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem("auth_token") || "";
    const encodedMessages = encodeURIComponent(JSON.stringify(newMessages));
    const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    const sseUrl = `http://${host}:8000/api/files-documents/llm-chat/stream?messages=${encodedMessages}&token=${token}`;
    
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "error") {
          setStatusMsg(`Error: ${data.message}`);
          setIsGenerating(false);
          es.close();
        } else if (data.type === "status") {
          setStatusMsg(data.message);
        } else if (data.type === "token") {
          setStatusMsg("");
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1].content += data.content;
            return copy;
          });
        } else if (data.type === "clear") {
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1].content = "";
            return copy;
          });
        } else if (data.type === "usage") {
          setTokenUsage(`Tokens - Prompt: ${data.prompt_tokens} | Completion: ${data.completion_tokens}`);
        } else if (data.type === "done") {
          setStatusMsg("");
          setIsGenerating(false);
          es.close();
        }
      } catch (err) {
        console.error("Failed to parse SSE message", err);
      }
    };

    es.onerror = () => {
      setStatusMsg("Connection closed.");
      setIsGenerating(false);
      es.close();
    };
  };

  const stopGeneration = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setStatusMsg("Stopped.");
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (showSettings) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [showSettings]);

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <Header title="LLM Chat Bot" subtitle="Autonomous agent with configurable tools." />
      
      <div className="flex items-center justify-between mb-4 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-4">
            <span className="text-zinc-400 text-sm font-medium">{activeModel}</span>
            {tokenUsage && (
                <span className="text-zinc-400 text-sm">{tokenUsage}</span>
            )}
        </div>
        <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg text-sm text-zinc-300 transition-colors shadow-lg"
        >
             <Icon name="tune" size={16} /> Configure Tools
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-h-0 bg-zinc-950/50 border border-white/10 rounded-xl relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center text-zinc-500 mt-10">
              Hello! Ask me a question. I can use tools to find the answer if they are enabled.
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Icon name="smart_toy" size={16} />
                  </div>
                )}
                
                <div className={`flex flex-col max-w-[80%] ${msg.role === 'assistant' ? 'items-start' : 'items-end'}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm ${msg.role === 'assistant' ? 'bg-zinc-900/80 border border-white/5 text-zinc-200 whitespace-pre-wrap' : 'bg-primary text-white whitespace-pre-wrap'}`}>
                    {msg.content}
                  </div>
                </div>
                
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
                    <Icon name="person" size={16} />
                  </div>
                )}
              </div>
            ))
          )}
          {statusMsg && (
            <div className="flex items-center gap-3 text-zinc-400 text-sm">
              <Icon name="progress_activity" size={14} className="animate-spin" />
              <span>{statusMsg}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-zinc-900/50 border-t border-white/5 shrink-0 relative">
          <div className="relative w-full mx-auto">
            <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message the agent..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-24 py-4 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none max-h-32 custom-scrollbar"
                rows={1}
                disabled={isGenerating}
              />
              <div className="absolute right-2 bottom-2">
                {isGenerating ? (
                  <Button variant="danger" size="icon" onClick={stopGeneration} className="w-10 h-10">
                    <Icon name="close" size={18} />
                  </Button>
                ) : (
                  <Button variant="primary" size="icon" onClick={handleSend} disabled={!input.trim()} className="w-10 h-10">
                    <Icon name="send" size={18} />
                  </Button>
                )}
              </div>
          </div>
          <p className="text-center text-[10px] text-zinc-500 mt-2">Press Enter to send, Shift+Enter for new line.</p>
        </div>
      </div>

      {/* Tools Settings Modal */}
      {showSettings && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-900/50 shrink-0">
              <h3 className="font-semibold text-zinc-100 flex items-center gap-2 text-lg">Tool Configuration</h3>
              <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-white transition-colors bg-zinc-800/50 hover:bg-zinc-700 p-2 rounded-lg">
                <Icon name="close" size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-3 bg-zinc-950/80 min-h-0">
              <p className="text-sm text-zinc-400 mb-6 pb-4 border-b border-white/5">
                Enable tools for the LLM to use autonomously during conversation.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.keys(tools).map((key) => {
                  const tool = tools[key];
                  return (
                    <div 
                      key={key} 
                      onClick={() => handleToggleTool(key)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${tool.enabled ? 'bg-primary/10 border-primary/40 shadow-[0_0_10px_rgba(168,85,247,0.1)]' : 'bg-black/40 border-white/5 hover:border-white/10'}`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${tool.enabled ? 'bg-primary border-primary text-white' : 'border-zinc-600 bg-zinc-900'}`}>
                        {tool.enabled && <Icon name="check" size={14} />}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${tool.enabled ? 'text-white' : 'text-zinc-400'}`}>{tool.label}</p>
                        <p className="text-[11px] text-zinc-500 leading-tight">{tool.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {isSavingConfig && (
              <div className="p-3 bg-primary/20 text-center text-xs font-medium text-primary border-t border-primary/20 flex justify-center items-center gap-2 shrink-0">
                <Icon name="progress_activity" size={14} className="animate-spin" /> Saving configuration...
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
