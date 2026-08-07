"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Invalid credentials");
      }

      const data = await res.json();
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("username", data.username);
      
      // Force a full reload to let MainLayout pick up the new token reliably
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--theme-bg)] text-[var(--theme-text)] selection:bg-[var(--theme-glow1)] font-sans p-4 relative overflow-hidden z-50">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-[var(--theme-ui-bg)] backdrop-blur-2xl border border-[var(--theme-ui-border)] rounded-3xl p-8 shadow-2xl shadow-black/50 z-10 animate-fade-in relative">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[var(--theme-heading)] rounded-2xl flex items-center justify-center shadow-lg shadow-[0_0_15px_var(--theme-glow1)] mb-6">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--theme-heading)]">Welcome Back</h1>
          <p className="text-zinc-500 text-sm text-center">Enter your credentials to access the workspace.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Username</label>
            <div className="relative group">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/40 border border-white/5 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-xl py-3.5 pl-12 pr-4 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-700"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Password</label>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/5 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-xl py-3.5 pl-12 pr-4 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-700"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-center animate-slide-up">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed group mt-2"
          >
            {loading ? "Authenticating" : "Sign In"}
            {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
      </div>
    </div>
  );
}
