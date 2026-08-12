"use client";

import React, { useState, useEffect } from 'react';

import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from '@/components/ui/Button';
import { WhiteboardCanvas, Stroke } from '@/components/whiteboard/WhiteboardCanvas';
import { Icon } from "@/lib/utils";

type Card = {
  id: string;
  front: string;
  back: string;
  card_type: string;
  interval?: number;
  ease_factor?: number;
  repetition?: number;
};

type Stats = {
  reviews_today: number;
  reviews_week: number;
  total_cards: number;
  learned_cards: number;
  due_cards: number;
  weak_cards: { front: string; back: string; fails: number }[];
  activity: { date: string; count: number }[];
};

export default function KoreanStudyPage() {
  const [activeTab, setActiveTab] = useState<'study' | 'test' | 'stats'>('test');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Test mode state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [generatingCloze, setGeneratingCloze] = useState(false);
  
  // Whiteboard state
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const headers = { "Authorization": `Bearer ${token}` };
      
      if (activeTab === 'study') {
        const res = await fetch("/api/lifestyle/korean-srs/all", { headers });
        if (res.ok) setAllCards(await res.json());
      } else if (activeTab === 'test') {
        const res = await fetch("/api/lifestyle/korean-srs/next", { headers });
        if (res.ok) setDueCards(await res.json());
        setCurrentCardIndex(0);
        setShowAnswer(false);
      } else if (activeTab === 'stats') {
        const res = await fetch("/api/lifestyle/korean-srs/stats", { headers });
        if (res.ok) setStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (quality: number) => {
    if (dueCards.length === 0) return;
    
    const card = dueCards[currentCardIndex];
    try {
      const token = localStorage.getItem("auth_token") || "";
      await fetch("/api/lifestyle/korean-srs/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ card_id: card.id, quality })
      });
      
      // Move to next card
      if (currentCardIndex < dueCards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setShowAnswer(false);
        setStrokes([]);
      } else {
        // Fetch more due cards if we reached the end
        fetchData();
      }
    } catch (e) {
      console.error("Failed to submit review", e);
    }
  };

  const generateClozeCard = async () => {
    setGeneratingCloze(true);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch("/api/lifestyle/korean-srs/generate-cloze", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        alert("Successfully scraped and generated a new Wikipedia Cloze card!");
        fetchData();
      } else {
        alert("Failed to generate cloze card. Wikipedia might not have returned a valid sentence.");
      }
    } catch (e) {
      console.error(e);
      alert("Error generating cloze.");
    } finally {
      setGeneratingCloze(false);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
          <div className="flex items-center gap-0">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Korean SRS</h1>
              <p className="text-zinc-400 text-sm font-medium">Master Hangul and vocabulary with spaced repetition. The algorithm adapts to your memory.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <ModernTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab as (id: string) => void}
              tabs={[
                { id: "test", label: "Test" },
                { id: "study", label: "Study" },
                { id: "stats", label: "Stats" }
              ]}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-10 h-10 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="animate-slide-up">
            
            {/* STUDY MODE */}
            <ModernTabContent activeTab={activeTab}>
                          {activeTab === 'study' && (
                                        <div className="space-y-8">
                                          <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-xl font-bold text-zinc-200">Library ({allCards.length} Cards)</h2>
                                            <Button variant="secondary" onClick={generateClozeCard} isLoading={generatingCloze} icon={<Icon name="language" size={16} />}>
                                              Scrape Wiki Cloze
                                            </Button>
                                          </div>
                                          
                                          {['hangul', 'conversation', 'cloze', 'vocab'].map(type => {
                                            const filtered = allCards.filter(c => c.card_type === type);
                                            if (filtered.length === 0) return null;
                                            
                                            return (
                                              <div key={type} className="mb-10">
                                                <h3 className="text-lg font-semibold text-zinc-300 capitalize mb-4 border-b border-white/10 pb-2">{type}</h3>
                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                  {filtered.map(card => (
                                                    <div key={card.id} className="group relative p-5 bg-zinc-900/60 rounded-2xl border border-white/5 hover:border-secondary/30 transition-all duration-300 hover:bg-zinc-800/80 shadow-lg flex flex-col items-center text-center">
                                                      <span className="text-2xl font-bold text-zinc-100 mb-2">{card.front}</span>
                                                      <span className="text-sm text-zinc-400 font-medium">{card.back}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                          </ModernTabContent>

            {/* TEST MODE */}
            <ModernTabContent activeTab={activeTab}>
                          {activeTab === 'test' && (
                                        <div className="flex flex-col items-center justify-center min-h-[500px]">
                                          {dueCards.length === 0 ? (
                                            <div className="text-center p-12 bg-zinc-900/40 rounded-3xl border border-dashed border-zinc-700 w-full">
                                              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <Icon name="check" className="text-green-500" size={32} />
                                              </div>
                                              <h2 className="text-2xl font-bold text-zinc-200 mb-2">You're all caught up!</h2>
                                              <p className="text-zinc-400 mb-8">No more cards due right now. Check back later to strengthen your memory.</p>
                                              <Button variant="primary" onClick={() => setActiveTab('study')}>Browse Library</Button>
                                            </div>
                                          ) : (
                                            <div className="w-full">
                                              <div className="flex justify-between items-center mb-6 text-sm font-medium text-zinc-500">
                                                <span>Card {currentCardIndex + 1} of {dueCards.length}</span>
                                                <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full uppercase tracking-wider text-xs border border-secondary/20">
                                                  {dueCards[currentCardIndex].card_type}
                                                </span>
                                              </div>
                                              
                                              <div className="perspective-1000">
                                                <div className={`relative w-full min-h-[300px] transition-all duration-500 transform-style-preserve-3d ${showAnswer ? 'rotate-y-180' : ''}`}>
                                                  
                                                  {/* Front of Card */}
                                                  <div className={`absolute inset-0 w-full h-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-10 backface-hidden ${showAnswer ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
                                                    <h2 className="text-5xl md:text-6xl font-bold text-zinc-100 mb-8 text-center leading-tight">
                                                      {dueCards[currentCardIndex].front}
                                                    </h2>
                                                    <Button variant="secondary" onClick={() => setShowAnswer(true)} className="mt-4 px-8 py-6 rounded-xl text-lg w-full sm:w-auto">
                                                      Show Answer
                                                    </Button>
                                                  </div>
                                                  
                                                  {/* Back of Card */}
                                                  <div className={`absolute inset-0 w-full h-full bg-zinc-800/90 backdrop-blur-xl border border-secondary/30 rounded-3xl shadow-[0_0_40px_rgba(99,102,241,0.15)] flex flex-col items-center justify-center p-10 backface-hidden rotate-y-180 ${!showAnswer ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
                                                    <div className="text-center mb-12 w-full">
                                                      <h3 className="text-xl text-zinc-400 mb-2 uppercase tracking-widest text-sm font-bold">Answer</h3>
                                                      <p className="text-4xl font-bold text-indigo-300">{dueCards[currentCardIndex].back}</p>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-auto">
                                                      <button onClick={() => handleReview(0)} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                                                        <span className="font-bold">Fail</span>
                                                        <span className="text-xs opacity-70">1m</span>
                                                      </button>
                                                      <button onClick={() => handleReview(3)} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors">
                                                        <span className="font-bold">Hard</span>
                                                        <span className="text-xs opacity-70">Days</span>
                                                      </button>
                                                      <button onClick={() => handleReview(4)} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors">
                                                        <span className="font-bold">Good</span>
                                                        <span className="text-xs opacity-70">Weeks</span>
                                                      </button>
                                                      <button onClick={() => handleReview(5)} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 border border-secondary/20 transition-colors">
                                                        <span className="font-bold">Easy</span>
                                                        <span className="text-xs opacity-70">Months</span>
                                                      </button>
                                                    </div>
                                                  </div>
                                                  
                                                </div>
                                              </div>

                                              {/* Scratchpad Whiteboard */}
                                              {!showAnswer && (
                                                <div className="mt-8 flex flex-col items-center animate-fade-in w-full mx-auto">
                                                  <div className="flex justify-between items-center w-full mb-3 px-2">
                                                     <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">Writing Scratchpad</h3>
                                                     <button onClick={() => setStrokes([])} className="text-xs font-medium text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"><Icon name="replay" size={12}/> Clear</button>
                                                  </div>
                                                  <div className="w-full flex justify-center bg-zinc-950 p-2 rounded-xl border border-white/5">
                                                    <WhiteboardCanvas 
                                                      strokes={strokes} 
                                                      onStrokesChange={setStrokes} 
                                                      currentColor="#000000" 
                                                      currentSize={4} 
                                                      width={480} 
                                                      height={240} 
                                                    />
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                          </ModernTabContent>

            {/* STATS MODE */}
            <ModernTabContent activeTab={activeTab}>
                          {activeTab === 'stats' && stats && (
                                        <div className="space-y-8">
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="bg-zinc-900/60 p-6 rounded-2xl border border-white/5">
                                              <div className="text-zinc-500 text-sm font-medium mb-1">Reviews Today</div>
                                              <div className="text-3xl font-bold text-zinc-100">{stats.reviews_today}</div>
                                            </div>
                                            <div className="bg-zinc-900/60 p-6 rounded-2xl border border-white/5">
                                              <div className="text-zinc-500 text-sm font-medium mb-1">Reviews This Week</div>
                                              <div className="text-3xl font-bold text-secondary">{stats.reviews_week}</div>
                                            </div>
                                            <div className="bg-zinc-900/60 p-6 rounded-2xl border border-white/5">
                                              <div className="text-zinc-500 text-sm font-medium mb-1">Cards Learned</div>
                                              <div className="text-3xl font-bold text-green-400">{stats.learned_cards} <span className="text-sm text-zinc-600 font-normal">/ {stats.total_cards}</span></div>
                                            </div>
                                            <div className="bg-zinc-900/60 p-6 rounded-2xl border border-white/5">
                                              <div className="text-zinc-500 text-sm font-medium mb-1">Due Now</div>
                                              <div className="text-3xl font-bold text-orange-400">{stats.due_cards}</div>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
                                            {/* Activity Chart Mockup */}
                                            <div className="bg-zinc-900/40 p-6 rounded-2xl border border-white/10">
                                              <h3 className="text-lg font-semibold text-zinc-200 mb-6 flex items-center gap-2">Activity (Last 7 Days)</h3>
                                              <div className="flex items-end justify-between h-48 gap-2">
                                                {stats.activity.map((day, i) => {
                                                  const maxCount = Math.max(...stats.activity.map(a => a.count), 1);
                                                  const heightPercent = (day.count / maxCount) * 100;
                                                  return (
                                                    <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                                                      <div className="w-full relative flex items-end justify-center h-full rounded-t-lg bg-white/5 overflow-hidden">
                                                        <div 
                                                          className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 group-hover:from-indigo-500 group-hover:to-purple-400"
                                                          style={{ height: `${heightPercent}%` }}
                                                        ></div>
                                                        <span className="absolute bottom-2 text-xs font-bold text-white drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity">{day.count}</span>
                                                      </div>
                                                      <span className="text-xs text-zinc-500 font-medium">{day.date}</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>

                                            {/* Weak Cards */}
                                            <div className="bg-zinc-900/40 p-6 rounded-2xl border border-white/10">
                                              <h3 className="text-lg font-semibold text-zinc-200 mb-6 flex items-center gap-2">Weakest Cards</h3>
                                              {stats.weak_cards.length === 0 ? (
                                                <p className="text-zinc-500 italic">No weak cards detected yet. Keep studying!</p>
                                              ) : (
                                                <div className="space-y-3">
                                                  {stats.weak_cards.map((card, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                                                      <div className="flex flex-col">
                                                        <span className="font-bold text-zinc-200 text-lg">{card.front}</span>
                                                        <span className="text-xs text-zinc-500">{card.back}</span>
                                                      </div>
                                                      <div className="flex flex-col items-end">
                                                        <span className="text-red-400 font-bold">{card.fails} misses</span>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                          </ModernTabContent>

          </div>
        )}
      </div>
      
      {/* Required for the 3D flip effect */}
      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}} />
    </div>
  );
}
