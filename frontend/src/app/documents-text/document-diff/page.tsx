"use client";

import React, { useState } from "react";
import { Header } from "@/components/ui/Header";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";
import { DirectUploadBox } from "@/components/ui/DirectUploadBox";

interface DiffStat {
  added: number;
  removed: number;
  unchanged: number;
  total_lines_doc1: number;
  total_lines_doc2: number;
}

interface LineDiff {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export default function DocumentDiffPage() {
  const [activeTab, setActiveTab] = useState<"files" | "text">("files");

  // Mode: Text
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");

  // Mode: Files
  const [fileAHash, setFileAHash] = useState<string | null>(null);
  const [fileAName, setFileAName] = useState<string>("Document A");
  const [fileBHash, setFileBHash] = useState<string | null>(null);
  const [fileBName, setFileBName] = useState<string>("Document B");

  // Processing state
  const [isComparing, setIsComparing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [stats, setStats] = useState<DiffStat | null>(null);
  const [lineDiffs, setLineDiffs] = useState<LineDiff[] | null>(null);
  const [tableHtml, setTableHtml] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "unified">("unified");

  const handleCompare = async () => {
    setErrorMsg("");
    setIsComparing(true);

    try {
      let payload: any = { mode: activeTab };

      if (activeTab === "text") {
        if (!textA.trim() && !textB.trim()) {
          setErrorMsg("Please provide text in at least one of the inputs to compare.");
          setIsComparing(false);
          return;
        }
        payload.text1 = textA;
        payload.text2 = textB;
        payload.file1_name = "Text A";
        payload.file2_name = "Text B";
      } else {
        if (!fileAHash || !fileBHash) {
          setErrorMsg("Please upload both documents (.pdf, .docx, .txt, .md) to compare.");
          setIsComparing(false);
          return;
        }
        payload.file1_hash = fileAHash;
        payload.file2_hash = fileBHash;
        payload.file1_name = fileAName;
        payload.file2_name = fileBName;
      }

      const res = await fetch("/api/files-documents/diff/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Failed to compare documents");
      }

      setStats(data.stats);
      setLineDiffs(data.line_diffs);
      setTableHtml(data.table_html);
    } catch (err: any) {
      setErrorMsg(err.message || "Error comparing documents");
    } finally {
      setIsComparing(false);
    }
  };

  const tabs = [
    { id: "files", label: "Compare Files (.pdf, .docx, .txt)", icon: "file_copy" },
    { id: "text", label: "Compare Raw Text", icon: "text_snippet" },
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col gap-6 font-sans custom-scrollbar">
      <Header
        title="Document Diff & Compare"
        subtitle="Analyze line-by-line differences, additions, and deletions across PDF, Word documents, Markdown, and raw text."
        actions={
          <ModernTabs
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={(tab: string) => {
              setActiveTab(tab as any);
              setErrorMsg("");
            }}
          />
        }
      />

      <div className="flex-1 space-y-6">
        {/* FILES TAB */}
        {activeTab === "files" && (
          <ModernTabContent activeTab="files">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Document A */}
                <div className="bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-heading)]">
                      Original / Baseline Document
                    </span>
                    {fileAHash && (
                      <span className="text-xs text-emerald-400 font-mono truncate max-w-[200px]">
                        ✓ {fileAName}
                      </span>
                    )}
                  </div>

                  <DirectUploadBox
                    label="Upload Original Document (.pdf, .docx, .txt, .md, .csv)"
                    accept=".pdf,.docx,.txt,.md,.csv"
                    onUploadComplete={(info) => {
                      setFileAHash(info.hash_name);
                      setFileAName(info.original_name);
                    }}
                    onClear={() => {
                      setFileAHash(null);
                      setFileAName("Document A");
                    }}
                  />
                </div>

                {/* Document B */}
                <div className="bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-heading)]">
                      Modified / Comparison Document
                    </span>
                    {fileBHash && (
                      <span className="text-xs text-emerald-400 font-mono truncate max-w-[200px]">
                        ✓ {fileBName}
                      </span>
                    )}
                  </div>

                  <DirectUploadBox
                    label="Upload Modified Document (.pdf, .docx, .txt, .md, .csv)"
                    accept=".pdf,.docx,.txt,.md,.csv"
                    onUploadComplete={(info) => {
                      setFileBHash(info.hash_name);
                      setFileBName(info.original_name);
                    }}
                    onClear={() => {
                      setFileBHash(null);
                      setFileBName("Document B");
                    }}
                  />
                </div>
              </div>
            </div>
          </ModernTabContent>
        )}

        {/* TEXT TAB */}
        {activeTab === "text" && (
          <ModernTabContent activeTab="text">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--theme-heading)]">
                  Original Text
                </label>
                <textarea
                  value={textA}
                  onChange={(e) => setTextA(e.target.value)}
                  placeholder="Paste or type original content here..."
                  rows={12}
                  className="w-full p-4 rounded-xl border font-mono text-xs leading-relaxed text-[var(--theme-text)] placeholder-[var(--theme-text)]/40 focus:outline-none transition-all custom-scrollbar resize-y shadow-inner"
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--theme-heading)")}
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)")
                  }
                />
              </div>

              <div className="bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--theme-heading)]">
                  Modified Text
                </label>
                <textarea
                  value={textB}
                  onChange={(e) => setTextB(e.target.value)}
                  placeholder="Paste or type modified content here..."
                  rows={12}
                  className="w-full p-4 rounded-xl border font-mono text-xs leading-relaxed text-[var(--theme-text)] placeholder-[var(--theme-text)]/40 focus:outline-none transition-all custom-scrollbar resize-y shadow-inner"
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--theme-heading)")}
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)")
                  }
                />
              </div>
            </div>
          </ModernTabContent>
        )}

        {/* Action Button & Error */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--theme-ui-bg)] p-4 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md">
          <div className="text-xs text-[var(--theme-text)] flex items-center gap-2">
            <Icon name="compare_arrows" size={18} className="text-[var(--theme-heading)]" />
            <span>Computes differences using Python unified diff algorithm.</span>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="!w-auto px-6 whitespace-nowrap"
            onClick={handleCompare}
            disabled={isComparing}
            icon={<Icon name={isComparing ? "progress_activity" : "difference"} size={16} className={isComparing ? "animate-spin" : ""} />}
          >
            {isComparing ? "Comparing..." : "Compare Content"}
          </Button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <Icon name="error" size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* RESULTS SECTION */}
        {stats && (
          <div className="space-y-6 animate-fade-in">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[var(--theme-ui-bg)] p-4 rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
                <span className="text-xs text-[var(--theme-text)] uppercase font-semibold">Lines Added</span>
                <p className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1">
                  <Icon name="add" size={18} /> {stats.added}
                </p>
              </div>

              <div className="bg-[var(--theme-ui-bg)] p-4 rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
                <span className="text-xs text-[var(--theme-text)] uppercase font-semibold">Lines Removed</span>
                <p className="text-xl font-bold text-rose-400 mt-1 flex items-center gap-1">
                  <Icon name="remove" size={18} /> {stats.removed}
                </p>
              </div>

              <div className="bg-[var(--theme-ui-bg)] p-4 rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
                <span className="text-xs text-[var(--theme-text)] uppercase font-semibold">Unchanged Lines</span>
                <p className="text-xl font-bold text-[var(--theme-heading)] mt-1">
                  {stats.unchanged}
                </p>
              </div>

              <div className="bg-[var(--theme-ui-bg)] p-4 rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
                <span className="text-xs text-[var(--theme-text)] uppercase font-semibold">Total Baseline</span>
                <p className="text-xl font-bold text-[var(--theme-text)] mt-1">
                  {stats.total_lines_doc1} lines
                </p>
              </div>
            </div>

            {/* View Switcher and Diff Display */}
            <div className="bg-[var(--theme-ui-bg)] p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-semibold text-[var(--theme-heading)] flex items-center gap-2">
                  <Icon name="visibility" size={18} /> Detailed Differences
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode("unified")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${viewMode === "unified" ? "bg-[var(--theme-heading)] text-[var(--theme-bg)]" : "border border-[var(--theme-ui-border)] text-[var(--theme-text)]"}`}
                  >
                    Unified View
                  </button>
                  <button
                    onClick={() => setViewMode("split")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${viewMode === "split" ? "bg-[var(--theme-heading)] text-[var(--theme-bg)]" : "border border-[var(--theme-ui-border)] text-[var(--theme-text)]"}`}
                  >
                    Side-by-Side Table
                  </button>
                </div>
              </div>

              <div className="h-px bg-[var(--theme-ui-border)]" />

              {viewMode === "unified" && lineDiffs && (
                <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl max-h-[550px] overflow-y-auto overflow-x-auto font-mono text-xs leading-relaxed custom-scrollbar divide-y divide-[var(--theme-ui-border)]/30">
                  {lineDiffs.map((diff, index) => (
                    <div
                      key={index}
                      className={`flex items-start px-4 py-1.5 transition-colors ${
                        diff.type === "added"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : diff.type === "removed"
                          ? "bg-rose-500/15 text-rose-300 line-through"
                          : "text-[var(--theme-text)]/80 hover:bg-[var(--theme-ui-bg)]/40"
                      }`}
                    >
                      <span className="w-8 shrink-0 select-none text-[var(--theme-text)]/40 text-right pr-3">
                        {index + 1}
                      </span>
                      <span className="w-6 shrink-0 select-none font-bold">
                        {diff.type === "added" ? "+" : diff.type === "removed" ? "-" : " "}
                      </span>
                      <span className="whitespace-pre-wrap break-all">{diff.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === "split" && tableHtml && (
                <div
                  className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl max-h-[550px] overflow-y-auto overflow-x-auto custom-scrollbar p-3 [&_table]:w-full [&_table]:border-collapse [&_td]:p-1.5 [&_td]:font-mono [&_td]:text-xs [&_.diff_header]:text-[var(--theme-text)]/40 [&_.diff_header]:text-right [&_.diff_header]:pr-2 [&_.diff_header]:border-r [&_.diff_header]:border-[var(--theme-ui-border)] [&_.diff_add]:bg-emerald-500/20 [&_.diff_add]:text-emerald-300 [&_.diff_chg]:bg-amber-500/20 [&_.diff_chg]:text-amber-300 [&_.diff_sub]:bg-rose-500/20 [&_.diff_sub]:text-rose-300"
                  dangerouslySetInnerHTML={{ __html: tableHtml }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
