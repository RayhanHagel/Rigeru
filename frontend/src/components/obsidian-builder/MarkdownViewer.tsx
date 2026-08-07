"use client";
import React from 'react';
import { FileText, X, Loader2 } from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
  title: string;
  isLoading: boolean;
  onClose: () => void;
  onInternalLinkClick: (target: string) => void;
}

export default function MarkdownViewer({ content, title, isLoading, onClose, onInternalLinkClick }: MarkdownViewerProps) {
  
  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-3">
                <Loader2 className="animate-spin text-purple-400" size={32} />
                <p>Loading Markdown...</p>
            </div>
        );
    }

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    
    let inCodeBlock = false;
    let codeBlockContent = '';
    let codeBlockLang = '';

    const processInline = (text: string, keyPrefix: string) => {
        // Split by [[Link]]
        const parts = text.split(/(\[\[.*?\]\])/g);
        return parts.map((part, i) => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const linkName = part.slice(2, -2);
                return (
                    <button
                        key={`${keyPrefix}-${i}`}
                        onClick={() => onInternalLinkClick(linkName)}
                        className="text-purple-400 hover:text-purple-300 hover:underline cursor-pointer font-medium inline"
                    >
                        {linkName}
                    </button>
                );
            }
            // Basic bold
            const boldParts = part.split(/(\*\*.*?\*\*)/g);
            return boldParts.map((bp, j) => {
                if (bp.startsWith('**') && bp.endsWith('**')) {
                    return <strong key={`${keyPrefix}-${i}-${j}`} className="font-bold text-zinc-100">{bp.slice(2, -2)}</strong>;
                }
                return bp;
            });
        });
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                elements.push(
                    <pre key={`code-${i}`} className="bg-black/60 p-4 rounded-lg my-4 overflow-x-auto border border-white/10 text-zinc-300 font-mono text-sm">
                        <code>{codeBlockContent}</code>
                    </pre>
                );
                inCodeBlock = false;
                codeBlockContent = '';
            } else {
                inCodeBlock = true;
                codeBlockLang = line.slice(3).trim();
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent += line + '\n';
            continue;
        }

        if (line.startsWith('# ')) {
            elements.push(<h1 key={i} className="text-3xl font-bold text-zinc-100 mt-6 mb-4">{processInline(line.slice(2), `h1-${i}`)}</h1>);
        } else if (line.startsWith('## ')) {
            elements.push(<h2 key={i} className="text-2xl font-bold text-zinc-100 mt-5 mb-3">{processInline(line.slice(3), `h2-${i}`)}</h2>);
        } else if (line.startsWith('### ')) {
            elements.push(<h3 key={i} className="text-xl font-bold text-zinc-100 mt-4 mb-2">{processInline(line.slice(4), `h3-${i}`)}</h3>);
        } else if (line.trim() === '') {
            elements.push(<div key={i} className="h-2"></div>);
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            elements.push(<li key={i} className="text-zinc-300 ml-6 list-disc mb-1">{processInline(line.slice(2), `li-${i}`)}</li>);
        } else if (line.startsWith('> ')) {
            elements.push(<blockquote key={i} className="border-l-4 border-purple-500/50 pl-4 py-1 my-2 text-zinc-400 italic">{processInline(line.slice(2), `bq-${i}`)}</blockquote>);
        } else {
            elements.push(<p key={i} className="text-zinc-300 leading-relaxed mb-2 inline-block">{processInline(line, `p-${i}`)}</p>);
        }
    }
    
    return elements;
  };

  return (
    <div className="absolute inset-y-0 right-0 w-[450px] bg-zinc-900/95 border-l border-white/10 shadow-2xl z-30 flex flex-col backdrop-blur-xl">
      <div className="flex items-center justify-between p-5 border-b border-white/10 bg-black/40">
        <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 truncate pr-4"><span className="truncate">{title}</span>
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors shrink-0">
            <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar break-words whitespace-pre-wrap">
        {renderContent()}
      </div>
    </div>
  );
}
