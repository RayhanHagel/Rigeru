"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Header } from "@/components/ui/Header";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

interface GitHubAccount {
  id: string;
  account_type: "pat" | "ssh";
  label: string;
  created_at: string;
}

interface TrackedRepo {
  id: string;
  owner: string;
  repo: string;
  account_id?: string | null;
  account_label?: string | null;
  account_type?: string | null;
  default_branch: string;
  is_private: number | boolean;
  created_at: string;
}

interface CommitSummary {
  sha: string;
  short_sha: string;
  message: string;
  author_name: string;
  author_email: string;
  author_avatar?: string | null;
  date: string;
  html_url: string;
  parents: string[];
}

interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface CommitDetail {
  sha: string;
  short_sha: string;
  message: string;
  author_name: string;
  author_email: string;
  author_avatar?: string | null;
  date: string;
  html_url: string;
  stats: {
    total: number;
    additions: number;
    deletions: number;
  };
  files: FileChange[];
  raw_diff?: string;
}

export default function GitHubTrackerPage() {
  const [activeTab, setActiveTab] = useState<string>("history");

  // Accounts state
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [newAccType, setNewAccType] = useState<"pat" | "ssh">("pat");
  const [newAccLabel, setNewAccLabel] = useState("");
  const [newAccPat, setNewAccPat] = useState("");
  const [newAccSsh, setNewAccSsh] = useState("");
  const [showPatSecret, setShowPatSecret] = useState(false);
  const [accMessage, setAccMessage] = useState("");
  const [accError, setAccError] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  // Tracked Repos state
  const [trackedRepos, setTrackedRepos] = useState<TrackedRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [trackOwner, setTrackOwner] = useState("");
  const [trackRepoName, setTrackRepoName] = useState("");
  const [trackAccountId, setTrackAccountId] = useState("");
  const [trackIsPrivate, setTrackIsPrivate] = useState(false);
  const [trackDefaultBranch, setTrackDefaultBranch] = useState("main");
  const [repoMessage, setRepoMessage] = useState("");
  const [repoError, setRepoError] = useState("");

  // Commit history viewer state
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [branches, setBranches] = useState<Array<{ name: string; commit?: any }>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [commits, setCommits] = useState<CommitSummary[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [commitsError, setCommitsError] = useState("");
  const [page, setPage] = useState<number>(1);

  // Commit Detail Modal / Pane
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<CommitDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedCommitSha) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedCommitSha]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/github/accounts", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const fetchTrackedRepos = useCallback(async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/github/repos", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rList = data.repos || [];
        setTrackedRepos(rList);
        if (rList.length > 0 && !selectedRepoId) {
          setSelectedRepoId(rList[0].id);
        }
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingRepos(false);
    }
  }, [selectedRepoId]);

  useEffect(() => {
    fetchAccounts();
    fetchTrackedRepos();
  }, [fetchAccounts, fetchTrackedRepos]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccMessage("");
    setAccError("");
    if (!newAccLabel.trim()) {
      setAccError("Account label is required");
      return;
    }
    if (newAccType === "pat" && !newAccPat.trim()) {
      setAccError("Personal Access Token is required");
      return;
    }
    if (newAccType === "ssh" && !newAccSsh.trim()) {
      setAccError("SSH Private Key is required");
      return;
    }

    try {
      const res = await fetch("/api/github/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          account_type: newAccType,
          label: newAccLabel.trim(),
          token: newAccType === "pat" ? newAccPat.trim() : null,
          ssh_key: newAccType === "ssh" ? newAccSsh.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add account");

      setAccMessage("Authentication credential saved successfully");
      setNewAccLabel("");
      setNewAccPat("");
      setNewAccSsh("");
      fetchAccounts();
    } catch (err: any) {
      setAccError(err.message || "Failed to save credential");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Are you sure you want to remove this GitHub account/credential?")) return;
    try {
      const res = await fetch(`/api/github/accounts/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchAccounts();
        fetchTrackedRepos();
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleAddTrackedRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepoMessage("");
    setRepoError("");

    let cleanOwner = trackOwner.trim();
    let cleanRepo = trackRepoName.trim();

    // Check if user entered URL e.g. https://github.com/torvalds/linux
    if (cleanOwner.includes("github.com/")) {
      const urlParts = cleanOwner.split("github.com/")[1].split("/").filter(Boolean);
      if (urlParts.length >= 2) {
        cleanOwner = urlParts[0];
        cleanRepo = urlParts[1].replace(".git", "");
      }
    } else if (cleanOwner.includes("/") && !cleanRepo) {
      const parts = cleanOwner.split("/").filter(Boolean);
      if (parts.length >= 2) {
        cleanOwner = parts[0];
        cleanRepo = parts[1].replace(".git", "");
      }
    }

    if (!cleanOwner || !cleanRepo) {
      setRepoError("Owner and Repository name are required (or paste a full GitHub URL)");
      return;
    }

    try {
      const res = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          owner: cleanOwner,
          repo: cleanRepo,
          account_id: trackAccountId || null,
          default_branch: trackDefaultBranch.trim() || "main",
          is_private: trackIsPrivate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to track repository");

      setRepoMessage(`Successfully tracking ${cleanOwner}/${cleanRepo}`);
      setTrackOwner("");
      setTrackRepoName("");
      fetchTrackedRepos();
    } catch (err: any) {
      setRepoError(err.message || "Failed to add repo");
    }
  };

  const handleDeleteTrackedRepo = async (id: string) => {
    if (!confirm("Remove this repository from tracker?")) return;
    try {
      const res = await fetch(`/api/github/repos/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchTrackedRepos();
        if (selectedRepoId === id) {
          setSelectedRepoId("");
          setCommits([]);
        }
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const currentRepo = trackedRepos.find((r) => r.id === selectedRepoId);

  // Fetch branches whenever selected repo changes
  useEffect(() => {
    if (!currentRepo) {
      setBranches([]);
      setSelectedBranch("");
      return;
    }

    const fetchBranches = async () => {
      try {
        const query = new URLSearchParams({
          owner: currentRepo.owner,
          repo: currentRepo.repo,
          ...(currentRepo.account_id ? { account_id: currentRepo.account_id } : {}),
        });
        const res = await fetch(`/api/github/branches?${query.toString()}`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const bList = data.branches || [];
          setBranches(bList);
          const hasDefault = bList.some((b: any) => b.name === currentRepo.default_branch);
          setSelectedBranch(hasDefault ? currentRepo.default_branch : bList[0]?.name || "main");
        } else {
          setBranches([]);
          setSelectedBranch(currentRepo.default_branch || "main");
        }
      } catch (e) {
        console.error(e);
        setSelectedBranch(currentRepo.default_branch || "main");
      }
    };

    fetchBranches();
  }, [currentRepo]);

  // Fetch commits
  const fetchCommits = useCallback(
    async (p: number = 1, forceRefresh: boolean = false) => {
      if (!currentRepo) return;
      setLoadingCommits(true);
      setCommitsError("");

      try {
        const query = new URLSearchParams({
          owner: currentRepo.owner,
          repo: currentRepo.repo,
          page: p.toString(),
          per_page: "25",
          force_refresh: forceRefresh ? "true" : "false",
          ...(selectedBranch ? { branch: selectedBranch } : {}),
          ...(currentRepo.account_id ? { account_id: currentRepo.account_id } : {}),
        });

        const res = await fetch(`/api/github/commits?${query.toString()}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load commits");

        setCommits(data.commits || []);
        setPage(p);
      } catch (err: any) {
        setCommitsError(err.message || "Failed to fetch commits");
        setCommits([]);
      } finally {
        setLoadingCommits(false);
      }
    },
    [currentRepo, selectedBranch]
  );

  useEffect(() => {
    if (currentRepo) {
      fetchCommits(1);
    }
  }, [currentRepo, selectedBranch, fetchCommits]);

  // Fetch commit detail & diff
  const handleInspectCommit = async (sha: string) => {
    if (!currentRepo) return;
    setSelectedCommitSha(sha);
    setCommitDetail(null);
    setLoadingDetail(true);
    setDetailError("");

    try {
      const query = new URLSearchParams({
        owner: currentRepo.owner,
        repo: currentRepo.repo,
        sha,
        ...(currentRepo.account_id ? { account_id: currentRepo.account_id } : {}),
      });

      const res = await fetch(`/api/github/commit-detail?${query.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to fetch commit changes");
      setCommitDetail(data);
    } catch (err: any) {
      setDetailError(err.message || "Failed to load commit details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const tabs = [
    { id: "history", label: "Commit History" },
    { id: "repos", label: "Tracked Repositories" },
    { id: "auth", label: "Accounts & SSH Keys" },
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto flex flex-col font-sans custom-scrollbar">
      <Header
        title="GitHub Commit History"
        subtitle="Track public and private GitHub repositories, inspect commits, diffs, and code modifications in real time"
        actions={
          <ModernTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
        }
      />

      <ModernTabContent activeTab={activeTab}>
        {/* TAB 1: COMMIT HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Repo selector & Branch bar */}
            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-4 rounded-xl border border-[var(--theme-ui-border)] shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <Icon name="source" size={20} className="text-[var(--theme-heading)]" />
                  <span className="text-sm font-semibold text-[var(--theme-heading)]">Repo:</span>
                </div>
                <select
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  style={{
                    backgroundColor: "var(--theme-bg)",
                    borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                  }}
                  className="px-3 py-2 text-sm rounded-lg border text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-heading)] transition-all min-w-[200px]"
                >
                  {trackedRepos.length === 0 ? (
                    <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="">
                      No tracked repos (Add one in Tracked Repos)
                    </option>
                  ) : (
                    trackedRepos.map((r) => (
                      <option key={r.id} className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={r.id}>
                        {r.owner}/{r.repo} {r.is_private ? "🔒" : ""}
                      </option>
                    ))
                  )}
                </select>

                {currentRepo && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--theme-text)] opacity-70">Branch:</span>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg border text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-heading)] transition-all font-mono"
                    >
                      {branches.length > 0 ? (
                        branches.map((b) => (
                          <option key={b.name} className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={b.name}>
                            {b.name}
                          </option>
                        ))
                      ) : (
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={currentRepo.default_branch || "main"}>
                          {currentRepo.default_branch || "main"}
                        </option>
                      )}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                {currentRepo && (
                  <a
                    href={`https://github.com/${currentRepo.owner}/${currentRepo.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 text-xs inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] transition-colors text-[var(--theme-text)] whitespace-nowrap"
                  >
                    <Icon name="open_in_new" size={14} /> Open in GitHub
                  </a>
                )}
                <Button
                  size="sm"
                  onClick={() => fetchCommits(page, true)}
                  disabled={loadingCommits || !currentRepo}
                  className="whitespace-nowrap w-auto"
                >
                  <Icon name="refresh" size={14} className={loadingCommits ? "animate-spin" : ""} /> Refresh
                </Button>
              </div>
            </div>

            {/* Error banner */}
            {commitsError && (
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm flex items-start gap-2">
                <Icon name="error" size={18} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold">Unable to fetch commit log</div>
                  <div className="text-xs opacity-90 mt-1">{commitsError}</div>
                  {commitsError.includes("401") || commitsError.includes("404") ? (
                    <div className="text-xs mt-2 underline cursor-pointer" onClick={() => setActiveTab("auth")}>
                      Private repo? Configure a GitHub PAT or SSH key in the Accounts tab.
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Commits table / list */}
            {loadingCommits ? (
              <div className="flex flex-col items-center justify-center p-16 gap-3 text-[var(--theme-text)] opacity-70">
                <Icon name="progress_activity" size={32} className="animate-spin text-[var(--theme-heading)]" />
                <span className="text-sm">Loading commits from repository...</span>
              </div>
            ) : commits.length === 0 ? (
              <div className="bg-[var(--theme-ui-bg)] p-12 rounded-xl border border-[var(--theme-ui-border)] text-center flex flex-col items-center gap-3">
                <Icon name="history_toggle_off" size={40} className="text-[var(--theme-text)] opacity-40" />
                <h3 className="text-base font-semibold text-[var(--theme-heading)]">No commits found</h3>
                <p className="text-xs text-[var(--theme-text)] opacity-70 max-w-sm">
                  {trackedRepos.length === 0
                    ? "Add a repository in the 'Tracked Repositories' tab to inspect commit history."
                    : "No commits detected on the selected branch or the repository is empty."}
                </p>
                {trackedRepos.length === 0 && (
                  <Button variant="primary" onClick={() => setActiveTab("repos")} className="mt-2 text-xs">
                    <Icon name="add" size={16} /> Track a Repository
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] shadow-sm overflow-hidden">
                <div className="p-3.5 border-b border-[var(--theme-ui-border)] flex items-center justify-between text-xs text-[var(--theme-text)] opacity-80 bg-black/5">
                  <div className="flex items-center gap-2 font-medium">
                    <Icon name="commit" size={16} className="text-[var(--theme-heading)]" />
                    <span>Commits on branch <span className="font-mono text-[var(--theme-heading)]">{selectedBranch}</span></span>
                  </div>
                  <div>Showing {commits.length} commits</div>
                </div>

                <div className="divide-y divide-[var(--theme-ui-border)]">
                  {commits.map((c) => (
                    <div
                      key={c.sha}
                      className="p-4 hover:bg-[var(--theme-ui-border)]/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {c.author_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.author_avatar}
                            alt={c.author_name}
                            className="w-8 h-8 rounded-full border border-[var(--theme-ui-border)] mt-0.5 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[var(--theme-ui-border)] flex items-center justify-center font-bold text-xs shrink-0 text-[var(--theme-text)]">
                            {c.author_name?.charAt(0) || "U"}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-[var(--theme-heading)] hover:underline cursor-pointer" onClick={() => handleInspectCommit(c.sha)}>
                              {c.message.split("\n")[0]}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--theme-text)] opacity-70 flex-wrap">
                            <span className="font-semibold text-[var(--theme-heading)]">{c.author_name}</span>
                            <span>•</span>
                            <span>{c.date ? new Date(c.date).toLocaleString() : "Unknown date"}</span>
                            {c.parents && c.parents.length > 1 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
                                merge
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)] opacity-90">
                          {c.short_sha}
                        </span>

                        <Button
                          size="sm"
                          onClick={() => handleInspectCommit(c.sha)}
                          className="!h-7 text-xs px-2.5 flex items-center gap-1 w-auto whitespace-nowrap hover:border-[var(--theme-heading)]"
                        >
                          <Icon name="visibility" size={14} /> Changes
                        </Button>

                        <a
                          href={c.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-[var(--theme-ui-border)] text-[var(--theme-text)] opacity-70 hover:opacity-100 hover:border-[var(--theme-heading)] transition-all"
                          title="Open on GitHub"
                        >
                          <Icon name="open_in_new" size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination bar */}
                <div className="p-3.5 border-t border-[var(--theme-ui-border)] flex items-center justify-between text-xs bg-black/5">
                  <div className="w-24 flex justify-start">
                    <Button
                      size="sm"
                      disabled={page <= 1 || loadingCommits}
                      onClick={() => fetchCommits(page - 1)}
                      className="!h-8 px-3 text-xs !w-auto whitespace-nowrap flex items-center gap-1.5"
                    >
                      <Icon name="chevron_left" size={16} /> Newer
                    </Button>
                  </div>

                  <div className="px-3 py-1 rounded-md bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)] font-medium font-mono text-xs select-none">
                    Page <span className="text-[var(--theme-heading)] font-bold">{page}</span>
                  </div>

                  <div className="w-24 flex justify-end">
                    <Button
                      size="sm"
                      disabled={commits.length < 25 || loadingCommits}
                      onClick={() => fetchCommits(page + 1)}
                      className="!h-8 px-3 text-xs !w-auto whitespace-nowrap flex items-center gap-1.5"
                    >
                      Older <Icon name="chevron_right" size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRACKED REPOSITORIES */}
        {activeTab === "repos" && (
          <div className="space-y-6">
            {/* Add Repo Form */}
            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
              <h3 className="text-base font-semibold text-[var(--theme-heading)] mb-1 flex items-center gap-2">
                <Icon name="add_circle" size={18} /> Track a New Repository
              </h3>
              <p className="text-xs text-[var(--theme-text)] opacity-70 mb-4">
                Add public repositories directly, or attach a configured PAT/SSH key to view private repository commits.
              </p>

              <form onSubmit={handleAddTrackedRepo} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--theme-text)]">
                      Owner / Organization <span className="opacity-60">(or full GitHub URL)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. torvalds or https://github.com/torvalds/linux"
                      value={trackOwner}
                      onChange={(e) => setTrackOwner(e.target.value)}
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                      }}
                      className="px-3.5 py-2 text-sm rounded-lg border text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-heading)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--theme-text)]">Repository Name</label>
                    <input
                      type="text"
                      placeholder="e.g. linux (leave blank if full URL is pasted on left)"
                      value={trackRepoName}
                      onChange={(e) => setTrackRepoName(e.target.value)}
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                      }}
                      className="px-3.5 py-2 text-sm rounded-lg border text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-heading)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--theme-text)]">Auth Credential</label>
                    <select
                      value={trackAccountId}
                      onChange={(e) => setTrackAccountId(e.target.value)}
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                      }}
                      className="px-3 py-2 text-sm rounded-lg border text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-heading)]"
                    >
                      <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="">
                        None (Public Repository)
                      </option>
                      {accounts.map((acc) => (
                        <option key={acc.id} className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value={acc.id}>
                          {acc.label} ({acc.account_type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--theme-text)]">Default Branch</label>
                    <input
                      type="text"
                      placeholder="main"
                      value={trackDefaultBranch}
                      onChange={(e) => setTrackDefaultBranch(e.target.value)}
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                      }}
                      className="px-3.5 py-2 text-sm rounded-lg border text-[var(--theme-text)] outline-none font-mono text-xs focus:ring-1 focus:ring-[var(--theme-heading)]"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                      <input
                        type="checkbox"
                        checked={trackIsPrivate}
                        onChange={(e) => setTrackIsPrivate(e.target.checked)}
                        className="rounded border-[var(--theme-ui-border)] text-[var(--theme-heading)] w-4 h-4"
                      />
                      <span className="text-xs text-[var(--theme-text)] select-none">Private Repository</span>
                    </label>
                  </div>
                </div>

                {repoError && <div className="text-xs text-rose-400">{repoError}</div>}
                {repoMessage && <div className="text-xs text-emerald-400">{repoMessage}</div>}

                <div className="flex justify-end pt-2">
                  <Button variant="primary" type="submit" className="text-xs flex items-center gap-1.5">
                    <Icon name="bookmark_add" size={16} /> Track Repository
                  </Button>
                </div>
              </form>
            </div>

            {/* Repos List */}
            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[var(--theme-ui-border)] flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[var(--theme-heading)] flex items-center gap-2">
                  <Icon name="format_list_bulleted" size={18} /> Active Tracked Repositories
                </h4>
                <span className="text-xs text-[var(--theme-text)] opacity-70">{trackedRepos.length} Repositories</span>
              </div>

              {loadingRepos ? (
                <div className="p-8 text-center text-xs text-[var(--theme-text)] opacity-70">Loading repositories...</div>
              ) : trackedRepos.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--theme-text)] opacity-70">
                  No repositories currently tracked. Use the form above to add your first repo.
                </div>
              ) : (
                <div className="divide-y divide-[var(--theme-ui-border)]">
                  {trackedRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[var(--theme-ui-border)]/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] flex items-center justify-center text-[var(--theme-heading)]">
                          <Icon name={repo.is_private ? "lock" : "public"} size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[var(--theme-heading)] flex items-center gap-2">
                            <span>{repo.owner}/{repo.repo}</span>
                            {repo.is_private ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                                PRIVATE
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-[var(--theme-text)] opacity-70 flex items-center gap-2 mt-0.5">
                            <span>Branch: <span className="font-mono">{repo.default_branch}</span></span>
                            <span>•</span>
                            <span>
                              Auth: {repo.account_label ? `${repo.account_label} (${repo.account_type?.toUpperCase()})` : "Public / None"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedRepoId(repo.id);
                            setActiveTab("history");
                          }}
                          className="!w-8 !h-8 !p-0 flex items-center justify-center hover:border-[var(--theme-heading)]"
                          title="View commit history"
                        >
                          <Icon name="visibility" size={16} />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDeleteTrackedRepo(repo.id)}
                          className="!w-8 !h-8 !p-0 flex items-center justify-center hover:text-rose-400 hover:border-rose-500/50"
                          title="Untrack repository"
                        >
                          <Icon name="delete" size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AUTH & SSH KEYS */}
        {activeTab === "auth" && (
          <div className="space-y-6">
            {/* Toggleable PAT / SSH setup guide */}
            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--theme-ui-border)]/20 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] flex items-center justify-center text-[var(--theme-heading)]">
                    <Icon name="help_outline" size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--theme-heading)]">
                      How to Set Up a Personal Access Token (PAT) or SSH Private Key
                    </h4>
                    <p className="text-xs text-[var(--theme-text)] opacity-70">
                      Step-by-step instructions to create and configure credentials for private repository access
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--theme-heading)] font-medium">
                  <span>{showGuide ? "Hide Guide" : "Show Guide"}</span>
                  <Icon name={showGuide ? "expand_less" : "expand_more"} size={20} />
                </div>
              </button>

              {showGuide && (
                <div className="p-5 border-t border-[var(--theme-ui-border)] bg-black/5 space-y-5 text-xs text-[var(--theme-text)] leading-relaxed">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* PAT Guide */}
                    <div className="space-y-3 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-bg)]/60">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--theme-heading)]">
                        <Icon name="password" size={18} /> Option A: Personal Access Token (PAT)
                      </div>
                      <ol className="list-decimal list-inside space-y-2 opacity-90 pl-1">
                        <li>
                          Open <span className="font-semibold text-[var(--theme-heading)]">GitHub Settings</span> &rarr;{" "}
                          <span className="font-semibold text-[var(--theme-heading)]">Developer settings</span> &rarr;{" "}
                          <span className="font-semibold text-[var(--theme-heading)]">Personal access tokens</span>.
                        </li>
                        <li>
                          Click <span className="font-semibold text-[var(--theme-heading)]">Generate new token (classic)</span> or fine-grained token.
                        </li>
                        <li>
                          Under Scopes, enable:
                          <ul className="list-disc list-inside pl-4 mt-1 space-y-1 font-mono text-[11px] text-[var(--theme-heading)]">
                            <li>repo (Full control of private repositories)</li>
                            <li>read:user (Read user profile and avatars)</li>
                          </ul>
                        </li>
                        <li>Generate token, copy the secret string (begins with <code className="px-1 py-0.5 rounded bg-black/20 font-mono">ghp_</code>).</li>
                        <li>Select <strong>Personal Access Token (PAT)</strong> below, paste it into the field, and click <strong>Save GitHub Credential</strong>.</li>
                      </ol>
                    </div>

                    {/* SSH Guide */}
                    <div className="space-y-3 p-4 rounded-xl border border-[var(--theme-ui-border)] bg-[var(--theme-bg)]/60">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--theme-heading)]">
                        <Icon name="key" size={18} /> Option B: SSH Private Key
                      </div>
                      <ol className="list-decimal list-inside space-y-2 opacity-90 pl-1">
                        <li>
                          Generate a dedicated keypair in your terminal (do not use a passphrase):
                          <pre className="p-2 mt-1.5 rounded-lg bg-black/40 border border-[var(--theme-ui-border)] font-mono text-[11px] text-[var(--theme-heading)] overflow-x-auto custom-scrollbar">
                            ssh-keygen -t ed25519 -C "rigeru-git" -f rigeru_key -N ""
                          </pre>
                        </li>
                        <li>
                          Add the public key (<code className="px-1 py-0.5 rounded bg-black/20 font-mono">rigeru_key.pub</code>) to GitHub:
                          <div className="mt-1 opacity-80">
                            Go to <strong>Settings</strong> &rarr; <strong>SSH and GPG keys</strong> &rarr; <strong>New SSH key</strong> (Key type: <em>Authentication Key</em>).
                          </div>
                        </li>
                        <li>
                          Open the private key file (<code className="px-1 py-0.5 rounded bg-black/20 font-mono">rigeru_key</code>), copy the entire block including:
                          <div className="font-mono text-[10px] opacity-70 mt-1">
                            -----BEGIN OPENSSH PRIVATE KEY----- ... -----END OPENSSH PRIVATE KEY-----
                          </div>
                        </li>
                        <li>
                          Select <strong>SSH Private Key</strong> below, paste the content, give it a label, and save it.
                        </li>
                      </ol>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-[var(--theme-ui-border)] bg-[var(--theme-bg)] flex items-center gap-2 text-[11px] opacity-80">
                    <Icon name="security" size={16} className="text-emerald-400 shrink-0" />
                    <span>
                      Credentials remain strictly local on your machine in the Rigeru SQLite database and are never broadcasted or logged externally.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
              <h3 className="text-base font-semibold text-[var(--theme-heading)] mb-1 flex items-center gap-2">
                <Icon name="vpn_key" size={18} /> Add GitHub Credentials (PAT or SSH)
              </h3>
              <p className="text-xs text-[var(--theme-text)] opacity-70 mb-4">
                Authenticate with GitHub to track and inspect private repositories. Keys and tokens are stored securely in your local workstation database.
              </p>

              <form onSubmit={handleAddAccount} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--theme-text)]">Credential Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewAccType("pat")}
                        className={`flex-1 py-2 px-3 text-xs rounded-lg border transition-all flex items-center justify-center gap-2 ${
                          newAccType === "pat"
                            ? "bg-[var(--theme-heading)] text-[var(--theme-bg)] font-bold border-[var(--theme-heading)]"
                            : "border-[var(--theme-ui-border)] text-[var(--theme-text)]"
                        }`}
                      >
                        <Icon name="password" size={16} /> Personal Access Token (PAT)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAccType("ssh")}
                        className={`flex-1 py-2 px-3 text-xs rounded-lg border transition-all flex items-center justify-center gap-2 ${
                          newAccType === "ssh"
                            ? "bg-[var(--theme-heading)] text-[var(--theme-bg)] font-bold border-[var(--theme-heading)]"
                            : "border-[var(--theme-ui-border)] text-[var(--theme-text)]"
                        }`}
                      >
                        <Icon name="key" size={16} /> SSH Private Key
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--theme-text)]">Account / Key Label</label>
                    <input
                      type="text"
                      placeholder="e.g. My GitHub Account / Work Key"
                      value={newAccLabel}
                      onChange={(e) => setNewAccLabel(e.target.value)}
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                      }}
                      className="px-3.5 py-2 text-sm rounded-lg border text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-heading)]"
                    />
                  </div>
                </div>

                {newAccType === "pat" ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--theme-text)] flex items-center justify-between">
                      <span>GitHub Personal Access Token (classic or fine-grained)</span>
                      <span className="opacity-60 text-[10px]">Requires `repo` scope for private repositories</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPatSecret ? "text" : "password"}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={newAccPat}
                        onChange={(e) => setNewAccPat(e.target.value)}
                        style={{
                          backgroundColor: "var(--theme-bg)",
                          borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                        }}
                        className="w-full pl-3.5 pr-10 py-2 text-sm rounded-lg border text-[var(--theme-text)] font-mono outline-none focus:ring-1 focus:ring-[var(--theme-heading)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPatSecret(!showPatSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text)] opacity-60 hover:opacity-100"
                      >
                        <Icon name={showPatSecret ? "visibility_off" : "visibility"} size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--theme-text)] flex items-center justify-between">
                      <span>SSH Private Key (OpenSSH format)</span>
                      <span className="opacity-60 text-[10px]">Must have read/pull access on GitHub</span>
                    </label>
                    <textarea
                      rows={5}
                      placeholder={`-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----`}
                      value={newAccSsh}
                      onChange={(e) => setNewAccSsh(e.target.value)}
                      style={{
                        backgroundColor: "var(--theme-bg)",
                        borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                      }}
                      className="px-3.5 py-2 text-xs rounded-lg border text-[var(--theme-text)] font-mono outline-none focus:ring-1 focus:ring-[var(--theme-heading)] custom-scrollbar"
                    />
                  </div>
                )}

                {accError && <div className="text-xs text-rose-400">{accError}</div>}
                {accMessage && <div className="text-xs text-emerald-400">{accMessage}</div>}

                <div className="flex justify-end pt-2">
                  <Button variant="primary" type="submit" className="text-xs flex items-center gap-1.5">
                    <Icon name="save" size={16} /> Save GitHub Credential
                  </Button>
                </div>
              </form>
            </div>

            {/* Accounts list */}
            <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-xl border border-[var(--theme-ui-border)] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[var(--theme-ui-border)] flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[var(--theme-heading)] flex items-center gap-2">
                  <Icon name="badge" size={18} /> Configured GitHub Credentials
                </h4>
                <span className="text-xs text-[var(--theme-text)] opacity-70">{accounts.length} Credentials</span>
              </div>

              {loadingAccounts ? (
                <div className="p-8 text-center text-xs text-[var(--theme-text)] opacity-70">Loading credentials...</div>
              ) : accounts.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--theme-text)] opacity-70">
                  No credentials saved yet. Add a PAT or SSH key above to track private repositories.
                </div>
              ) : (
                <div className="divide-y divide-[var(--theme-ui-border)]">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-[var(--theme-ui-border)]/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] flex items-center justify-center text-[var(--theme-heading)]">
                          <Icon name={acc.account_type === "pat" ? "password" : "key"} size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[var(--theme-heading)] flex items-center gap-2">
                            <span>{acc.label}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--theme-ui-border)] text-[var(--theme-text)] font-mono">
                              {acc.account_type.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--theme-text)] opacity-60">
                            Added: {new Date(acc.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="!w-8 !h-8 !p-0 flex items-center justify-center hover:text-rose-400 hover:border-rose-500/50"
                          title="Remove credential"
                        >
                          <Icon name="delete" size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </ModernTabContent>

      {/* COMMIT DIFF MODAL */}
      {selectedCommitSha && mounted && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fade-in">
          <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-[var(--theme-ui-border)] flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-heading)]">
                    {commitDetail?.short_sha || selectedCommitSha.substring(0, 7)}
                  </span>
                  <h3 className="text-base font-bold text-[var(--theme-heading)] truncate">
                    {commitDetail?.message.split("\n")[0] || "Commit Changes"}
                  </h3>
                </div>
                {commitDetail && (
                  <div className="text-xs text-[var(--theme-text)] opacity-70 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{commitDetail.author_name}</span>
                    <span>•</span>
                    <span>{commitDetail.date ? new Date(commitDetail.date).toLocaleString() : ""}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-mono">+{commitDetail.stats.additions}</span>
                    <span className="text-rose-400 font-mono">-{commitDetail.stats.deletions}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {commitDetail?.html_url && (
                  <a
                    href={commitDetail.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] text-[var(--theme-text)] transition-colors"
                    title="View on GitHub"
                  >
                    <Icon name="open_in_new" size={16} />
                  </a>
                )}
                <button
                  onClick={() => setSelectedCommitSha(null)}
                  className="p-2 rounded-lg border border-[var(--theme-ui-border)] hover:bg-[var(--theme-ui-border)] text-[var(--theme-text)] transition-colors"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
              {loadingDetail ? (
                <div className="flex flex-col items-center justify-center p-16 gap-3 text-[var(--theme-text)] opacity-70">
                  <Icon name="progress_activity" size={32} className="animate-spin text-[var(--theme-heading)]" />
                  <span className="text-sm">Fetching commit diff & modified files...</span>
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                  {detailError}
                </div>
              ) : commitDetail ? (
                <div>
                  {/* Long commit message body */}
                  {commitDetail.message.includes("\n") && (
                    <div className="p-3 mb-4 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-xs text-[var(--theme-text)] whitespace-pre-wrap font-sans opacity-90">
                      {commitDetail.message}
                    </div>
                  )}

                  {/* Raw diff fallback for SSH keys */}
                  {commitDetail.raw_diff ? (
                    <div className="rounded-lg border border-[var(--theme-ui-border)] overflow-hidden">
                      <div className="p-2.5 bg-[var(--theme-bg)] border-b border-[var(--theme-ui-border)] font-mono text-xs text-[var(--theme-heading)] font-semibold">
                        Git Patch Diff
                      </div>
                      <pre className="p-4 text-xs font-mono bg-black/30 overflow-x-auto text-[var(--theme-text)] leading-relaxed custom-scrollbar whitespace-pre">
                        {commitDetail.raw_diff}
                      </pre>
                    </div>
                  ) : commitDetail.files && commitDetail.files.length > 0 ? (
                    <div className="space-y-4">
                      <div className="text-xs text-[var(--theme-text)] opacity-70">
                        {commitDetail.files.length} changed file{commitDetail.files.length !== 1 ? "s" : ""}
                      </div>

                      {commitDetail.files.map((file, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-[var(--theme-ui-border)] overflow-hidden bg-[var(--theme-bg)]/50"
                        >
                          <div className="p-3 bg-[var(--theme-ui-bg)] border-b border-[var(--theme-ui-border)] flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 font-mono text-[var(--theme-heading)] font-medium">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  file.status === "added"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : file.status === "removed"
                                    ? "bg-rose-500/20 text-rose-400"
                                    : "bg-amber-500/20 text-amber-300"
                                }`}
                              >
                                {file.status.toUpperCase()}
                              </span>
                              <span>{file.filename}</span>
                            </div>

                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="text-emerald-400">+{file.additions}</span>
                              <span className="text-rose-400">-{file.deletions}</span>
                            </div>
                          </div>

                          {file.patch ? (
                            <pre className="p-4 text-xs font-mono bg-black/40 overflow-x-auto text-[var(--theme-text)] leading-relaxed custom-scrollbar whitespace-pre">
                              {file.patch.split("\n").map((line, lIdx) => {
                                const isAdd = line.startsWith("+");
                                const isDel = line.startsWith("-");
                                const isHunk = line.startsWith("@@");
                                return (
                                  <div
                                    key={lIdx}
                                    className={`${
                                      isAdd
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : isDel
                                        ? "bg-rose-500/15 text-rose-300"
                                        : isHunk
                                        ? "text-sky-400 opacity-80 py-0.5"
                                        : "opacity-80"
                                    }`}
                                  >
                                    {line}
                                  </div>
                                );
                              })}
                            </pre>
                          ) : (
                            <div className="p-4 text-xs text-[var(--theme-text)] opacity-50 italic">
                              Binary or large file content not shown.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-[var(--theme-text)] opacity-60">
                      No modified file diffs available for this commit.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
