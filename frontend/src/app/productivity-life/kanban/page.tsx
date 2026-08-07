"use client";

import React, { useState, useEffect } from "react";
import { LayoutDashboard, Plus, Calendar, GripVertical, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Kanban Board</h1>
            <p className="text-zinc-400 text-sm font-medium">Organize your tasks and sync them with Google Calendar.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={handleSyncCalendar} 
            disabled={syncing}
            icon={syncing ? <RefreshCw size={18} className="animate-spin text-primary" /> : <Calendar size={18} className="text-primary" />}
          >
            {syncing ? "Syncing" : "Sync to Calendar"}
          </Button>
        </div>
      </div>

      {syncMsg.text && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${syncMsg.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium">{syncMsg.text}</p>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-zinc-500">Loading tasks</div>
      ) : (
        <div className="flex flex-col gap-6 animate-slide-up w-full">
          {columns.map(col => (
            <div key={col.id} className={`rounded-2xl border ${col.color} p-4 flex flex-col min-h-[300px]`}>
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <h3 className={`text-lg font-semibold ${col.textColor}`}>{col.title} <span className="text-zinc-500 text-sm ml-2">({tasks.filter(t => t.status === col.id).length})</span></h3>
                <button 
                  onClick={() => setIsAdding(col.id)}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white"
                >
                  <Plus size={18} />
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                {isAdding === col.id && (
                  <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 animate-in fade-in zoom-in-95 duration-200">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      className="w-full bg-transparent text-sm text-white focus:outline-none mb-3"
                    />
                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <input 
                        type="date" 
                        value={newTaskDate}
                        onChange={e => setNewTaskDate(e.target.value)}
                        className="bg-zinc-950 text-xs text-zinc-400 p-1 rounded border border-white/5 outline-none"
                        style={{ colorScheme: 'dark' }}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setIsAdding(null)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                        <button onClick={() => handleCreateTask(col.id)} className={`text-xs font-medium ${col.textColor}`}>Add</button>
                      </div>
                    </div>
                  </div>
                )}

                {tasks.filter(t => t.status === col.id).map(task => (
                  <div key={task.id} className="group bg-zinc-900/80 border border-white/10 hover:border-white/20 rounded-xl p-4 shadow-sm transition-all relative">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-zinc-200">{task.title}</h4>
                        {task.due_date && (
                          <div className="flex items-center gap-1.5 mt-3 text-xs text-zinc-500 bg-zinc-950 inline-flex px-2 py-1 rounded-md border border-white/5">
                            <Calendar size={12} />
                            {task.due_date}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center">
                      <select 
                        value={task.status} 
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className="text-xs bg-zinc-800 text-zinc-300 border-none outline-none rounded px-2 py-1 cursor-pointer"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      <button onClick={() => handleDeleteTask(task.id)} className="text-zinc-500 hover:text-red-400 px-2 py-1">✕</button>
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
