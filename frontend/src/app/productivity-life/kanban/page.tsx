"use client";
import { Header } from "@/components/ui/Header";

import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  due_date: string | null;
}

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState({ text: "", type: "" });
  
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/lifestyle/kanban");
      if (res.ok) {
        setTasks(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSyncCalendar = async () => {
    setSyncing(true);
    setSyncMsg({ text: "", type: "" });
    try {
      const res = await fetch("/api/lifestyle/kanban/sync-calendar", { 
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Sync failed");
      }
      setSyncMsg({ text: data.detail, type: "success" });
    } catch (e: any) {
      setSyncMsg({ text: e.message, type: "error" });
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateTask = async (status: string) => {
    if (!newTaskTitle) {
      setIsAdding(null);
      return;
    }
    try {
      const res = await fetch("/api/lifestyle/kanban", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: newTaskTitle, status, due_date: newTaskDate || null }),
      });
      if (res.ok) {
        const newTask = await res.json();
        setTasks([newTask, ...tasks]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAdding(null);
      setNewTaskTitle("");
      setNewTaskDate("");
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await fetch(`/api/lifestyle/kanban/${id}`, { 
        method: "DELETE",
      });
      setTasks(tasks.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
      await fetch(`/api/lifestyle/kanban/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const columns = [
    { id: "todo", title: "To Do", color: "border-sky-500/30 bg-sky-500/5", textColor: "text-sky-400" },
    { id: "in_progress", title: "In Progress", color: "border-amber-500/30 bg-amber-500/5", textColor: "text-amber-400" },
    { id: "done", title: "Done", color: "border-emerald-500/30 bg-emerald-500/5", textColor: "text-emerald-400" }
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <Header 
          title="Kanban Board" 
          subtitle="Organize your tasks and sync them with Google Calendar." 
        />
        
        <div className="flex items-center bg-[var(--theme-ui-bg)] p-1.5 rounded-xl border border-[var(--theme-ui-border)] backdrop-blur-md shadow-sm shrink-0 mb-6">
          <Button 
            variant="secondary" 
            onClick={handleSyncCalendar} 
            disabled={syncing}
            icon={syncing ? <Icon name="refresh" size={18} className="animate-spin text-[var(--theme-heading)]" /> : <Icon name="calendar_today" size={18} className="text-[var(--theme-heading)]" />}
          >
            {syncing ? "Syncing" : "Sync to Calendar"}
          </Button>
        </div>
      </div>

      {syncMsg.text && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${syncMsg.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>
          <Icon name="error" className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium">{syncMsg.text}</p>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--theme-text)]">Loading tasks</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 animate-slide-up w-full">
          {columns.map(col => (
            <div key={col.id} className={`rounded-2xl border ${col.color} p-4 flex flex-col min-h-[300px] flex-1 bg-[var(--theme-ui-bg)] backdrop-blur-md shadow-sm`}>
              <div className="flex items-center justify-between mb-4 border-b border-[var(--theme-ui-border)] pb-2">
                <h3 className={`text-lg font-bold ${col.textColor}`}>{col.title} <span className="text-[var(--theme-text)] text-sm ml-2">({tasks.filter(t => t.status === col.id).length})</span></h3>
                <button 
                  onClick={() => setIsAdding(col.id)}
                  className="p-1.5 hover:bg-[var(--theme-bg)] rounded transition-colors text-[var(--theme-text)] hover:text-[var(--theme-heading)]"
                >
                  <Icon name="add" size={18} />
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                {isAdding === col.id && (
                  <div className="bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-xl p-3 animate-in fade-in zoom-in-95 duration-200 shadow-sm">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      className="w-full bg-transparent text-sm text-[var(--theme-heading)] focus:outline-none mb-3 placeholder-[var(--theme-text)]"
                    />
                    <div className="flex items-center justify-between border-t border-[var(--theme-ui-border)] pt-3">
                      <input 
                        type="date" 
                        value={newTaskDate}
                        onChange={e => setNewTaskDate(e.target.value)}
                        className="bg-[var(--theme-ui-bg)] text-xs text-[var(--theme-text)] p-1 rounded border border-[var(--theme-ui-border)] outline-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setIsAdding(null)} className="text-xs text-[var(--theme-text)] hover:text-[var(--theme-heading)]">Cancel</button>
                        <button onClick={() => handleCreateTask(col.id)} className={`text-xs font-bold ${col.textColor}`}>Add</button>
                      </div>
                    </div>
                  </div>
                )}

                {tasks.filter(t => t.status === col.id).map(task => (
                  <div key={task.id} className="group bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] rounded-xl p-4 shadow-sm transition-all duration-300 relative">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-[var(--theme-heading)]">{task.title}</h4>
                        {task.due_date && (
                          <div className="flex items-center gap-1.5 mt-3 text-xs text-[var(--theme-text)] bg-[var(--theme-ui-bg)] inline-flex px-2 py-1 rounded-md border border-[var(--theme-ui-border)]">
                            <Icon name="calendar_today" size={12} />
                            {task.due_date}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center">
                      <select 
                        value={task.status} 
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className="text-xs bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] border border-[var(--theme-ui-border)] outline-none rounded px-2 py-1 cursor-pointer focus:border-[var(--theme-heading)]"
                      >
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="todo">To Do</option>
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="in_progress">In Progress</option>
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="done">Done</option>
                      </select>
                      <button onClick={() => handleDeleteTask(task.id)} className="text-[var(--theme-text)] hover:text-red-400 px-2 py-1 transition-colors">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
