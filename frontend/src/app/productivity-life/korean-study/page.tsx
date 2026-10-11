"use client";

import React, { useState, useEffect, useRef } from 'react';

import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from '@/components/ui/Button';
import { Header } from "@/components/ui/Header";
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
  const scratchpadContainerRef = useRef<HTMLDivElement>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 600, height: 260 });

  useEffect(() => {
    if (!scratchpadContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          setCanvasDimensions({ width: Math.floor(width), height: 260 });
        }
      }
    });
    observer.observe(scratchpadContainerRef.current);
    return () => observer.disconnect();
  }, [showAnswer, activeTab]);

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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");
  const [newCardType, setNewCardType] = useState<string>("cloze");
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);

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

  const handleCreateCustomCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardFront.trim() || !newCardBack.trim()) return;
    setIsSubmittingCard(true);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch("/api/lifestyle/korean-srs/card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          front: newCardFront.trim(),
          back: newCardBack.trim(),
          card_type: newCardType
        })
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        setNewCardFront("");
        setNewCardBack("");
        fetchData();
      } else {
        alert("Failed to create card");
      }
    } catch (e) {
      console.error(e);
      alert("Error creating card");
    } finally {
      setIsSubmittingCard(false);
    }
  };

  const handleDeleteCard = async (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this card?")) return;
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch(`/api/lifestyle/korean-srs/card/${cardId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        setAllCards(prev => prev.filter(c => c.id !== cardId));
        setDueCards(prev => prev.filter(c => c.id !== cardId));
      } else {
        alert("Failed to delete card");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting card");
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar animate-slide-up flex flex-col font-sans">
      <Header 
        title="Korean SRS" 
        subtitle="Master Hangul and vocabulary with spaced repetition. The algorithm adapts to your memory."
        actions={
          <ModernTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab as (id: string) => void}
            tabs={[
              { id: "test", label: "Test" },
              { id: "study", label: "Study" },
              { id: "stats", label: "Stats" }
            ]}
          />
        }
      />
      
      <div className="p-6 lg:p-10 w-full">
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
                    <h2 className="text-xl font-bold text-[var(--theme-heading)]">Library ({allCards.length} Cards)</h2>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => setIsAddModalOpen(true)}
                        icon={<Icon name="add" size={16} />}
                        className="!w-auto px-4 py-2 text-sm"
                      >
                        Add Card
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={generateClozeCard} 
                        isLoading={generatingCloze} 
                        icon={<Icon name="language" size={16} />}
                        className="!w-auto px-4 py-2 text-sm"
                      >
                        Scrape Wiki Cloze
                      </Button>
                    </div>
                  </div>
                  
                  {['hangul', 'conversation', 'cloze', 'vocab'].map(type => {
                    const filtered = allCards.filter(c => c.card_type === type);
                    if (filtered.length === 0) return null;
                    
                    return (
                      <div key={type} className="mb-10">
                        <div className="flex items-center justify-between border-b border-[var(--theme-ui-border)] pb-2 mb-4">
                          <h3 className="text-lg font-semibold text-[var(--theme-heading)] capitalize">{type}</h3>
                          <span className="text-xs text-[var(--theme-text)] opacity-70">{filtered.length} cards</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {filtered.map(card => (
                            <div key={card.id} className="group relative p-5 bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-2xl border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] transition-all duration-300 shadow-sm hover:shadow-md flex flex-col items-center text-center">
                              {/* Delete button (available on cloze, vocab, or custom cards) */}
                              <button
                                onClick={(e) => handleDeleteCard(card.id, e)}
                                title="Delete card"
                                className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
                              >
                                <Icon name="delete" size={16} />
                              </button>
                              <span className="text-2xl font-bold text-[var(--theme-heading)] mb-2 px-2 break-words max-w-full">{card.front}</span>
                              <span className="text-sm text-[var(--theme-text)] font-medium px-2 break-words max-w-full">{card.back}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ModernTabContent>

            {/* Custom Card Creation Modal */}
            {isAddModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                <div
                  className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-5 shadow-2xl"
                  style={{
                    backgroundColor: "var(--theme-ui-bg)",
                    borderColor: "var(--theme-ui-border)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name="add_circle" size={24} className="text-[var(--theme-heading)]" />
                      <h3 className="text-lg font-bold text-[var(--theme-heading)]">Add Korean Card</h3>
                    </div>
                    <button
                      onClick={() => setIsAddModalOpen(false)}
                      className="p-1 rounded-md text-[var(--theme-text)] hover:text-white transition-colors"
                    >
                      <Icon name="close" size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleCreateCustomCard} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider">
                        Card Type
                      </label>
                      <select
                        value={newCardType}
                        onChange={(e) => setNewCardType(e.target.value)}
                        className="w-full p-2.5 rounded-lg border text-sm text-[var(--theme-text)] outline-none"
                        style={{
                          backgroundColor: "var(--theme-bg)",
                          borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                        }}
                      >
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="cloze">Cloze (Fill-in-the-blank)</option>
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="vocab">Vocabulary</option>
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="conversation">Conversation</option>
                        <option className="bg-[var(--theme-bg)] text-[var(--theme-text)]" value="hangul">Hangul</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider">
                        Front (Prompt / Sentence)
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder={newCardType === 'cloze' ? "e.g. 저는 한국어를 [...] 있어요. (use [...] for the missing word)" : "e.g. 사과 (Apple)"}
                        value={newCardFront}
                        onChange={(e) => setNewCardFront(e.target.value)}
                        className="w-full p-2.5 rounded-lg border text-sm text-[var(--theme-text)] outline-none resize-none"
                        style={{
                          backgroundColor: "var(--theme-bg)",
                          borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--theme-heading)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)")}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider">
                        Back (Answer / Missing Word)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={newCardType === 'cloze' ? "e.g. 배우고" : "e.g. Apple"}
                        value={newCardBack}
                        onChange={(e) => setNewCardBack(e.target.value)}
                        className="w-full p-2.5 rounded-lg border text-sm text-[var(--theme-text)] outline-none"
                        style={{
                          backgroundColor: "var(--theme-bg)",
                          borderColor: "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--theme-heading)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-heading) 20%, transparent)")}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setIsAddModalOpen(false)}
                        className="!w-auto px-4 py-2"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        isLoading={isSubmittingCard}
                        className="!w-auto px-4 py-2"
                      >
                        Save Card
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* TEST MODE */}
            <ModernTabContent activeTab={activeTab}>
              {activeTab === 'test' && (
                <div className="flex flex-col items-center justify-center min-h-[500px]">
                  {dueCards.length === 0 ? (
                    <div className="text-center p-12 bg-[var(--theme-ui-bg)] backdrop-blur-md rounded-3xl border border-dashed border-[var(--theme-ui-border)] w-full shadow-sm">
                      <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon name="check" className="text-green-500" size={32} />
                      </div>
                      <h2 className="text-2xl font-bold text-[var(--theme-heading)] mb-2">You're all caught up!</h2>
                      <p className="text-[var(--theme-text)] mb-8">No more cards due right now. Check back later to strengthen your memory.</p>
                      <Button variant="primary" onClick={() => setActiveTab('study')}>Browse Library</Button>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="flex justify-between items-center mb-6 text-sm font-medium text-[var(--theme-text)]">
                        <span>Card {currentCardIndex + 1} of {dueCards.length}</span>
                        <span className="bg-[var(--theme-ui-bg)] text-[var(--theme-heading)] px-3 py-1 rounded-full uppercase tracking-wider text-xs border border-[var(--theme-ui-border)]">
                          {dueCards[currentCardIndex].card_type}
                        </span>
                      </div>
                      
                      <div className="perspective-1000 w-full">
                        <div className={`relative w-full min-h-[360px] transition-all duration-500 transform-style-preserve-3d ${showAnswer ? 'rotate-y-180' : ''}`}>
                          
                          {/* Front of Card */}
                          <div className={`absolute inset-0 w-full h-full bg-[var(--theme-ui-bg)] backdrop-blur-xl border border-[var(--theme-ui-border)] rounded-3xl shadow-md flex flex-col items-center justify-between p-6 sm:p-8 backface-hidden overflow-hidden ${showAnswer ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
                            <div className="w-full flex-1 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar my-auto px-2 max-h-[260px]">
                              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--theme-heading)] text-center leading-relaxed whitespace-pre-line break-words max-w-2xl">
                                {dueCards[currentCardIndex].front}
                              </h2>
                            </div>
                            <Button variant="primary" onClick={() => setShowAnswer(true)} className="mt-4 px-8 py-3 rounded-xl text-base w-full sm:w-auto shrink-0">
                              Show Answer
                            </Button>
                          </div>
                          
                          {/* Back of Card */}
                          <div className={`absolute inset-0 w-full h-full bg-[var(--theme-ui-bg)] backdrop-blur-xl border border-[var(--theme-heading)] rounded-3xl shadow-md flex flex-col items-center justify-between p-6 sm:p-8 backface-hidden rotate-y-180 overflow-hidden ${!showAnswer ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
                            <div className="w-full flex-1 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar my-auto px-2 max-h-[220px]">
                              <h3 className="text-xs text-[var(--theme-text)] mb-2 uppercase tracking-widest font-bold opacity-75">Answer</h3>
                              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--theme-heading)] text-center whitespace-pre-line break-words max-w-2xl">
                                {dueCards[currentCardIndex].back}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 w-full mt-4 shrink-0">
                              <Button
                                size="lg"
                                onClick={() => handleReview(0)}
                                className="!bg-[var(--theme-bg)] border border-red-500/40 !text-red-500 hover:!bg-red-500/10 hover:border-red-500 text-base py-3 flex items-center justify-center gap-2"
                              >
                                <Icon name="close" size={18} />
                                Fail
                              </Button>
                              <Button
                                size="lg"
                                onClick={() => handleReview(1)}
                                className="!bg-[var(--theme-bg)] border border-green-500/40 !text-green-500 hover:!bg-green-500/10 hover:border-green-500 text-base py-3 flex items-center justify-center gap-2"
                              >
                                <Icon name="check" size={18} />
                                Succeed
                              </Button>
                            </div>
                          </div>
                          
                        </div>
                      </div>

                      {/* Scratchpad Whiteboard */}
                      {!showAnswer && (
                        <div className="mt-8 flex flex-col items-center animate-fade-in w-full mx-auto">
                          <div className="flex justify-between items-center w-full mb-3 px-2">
                             <h3 className="text-sm font-semibold text-[var(--theme-heading)] flex items-center gap-2">Writing Scratchpad</h3>
                             <Button size="sm" onClick={() => setStrokes([])} className="!w-auto !h-auto !p-0 !bg-transparent text-[var(--theme-text)] hover:!text-[var(--theme-heading)]">Clear</Button>
                          </div>
                          <div 
                            ref={scratchpadContainerRef}
                            className="w-full flex justify-center bg-white rounded-xl border border-[var(--theme-ui-border)] overflow-hidden"
                          >
                            <WhiteboardCanvas 
                              strokes={strokes} 
                              onStrokesChange={setStrokes} 
                              currentColor="#000000" 
                              currentSize={4} 
                              width={canvasDimensions.width} 
                              height={canvasDimensions.height} 
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
                    <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-2xl border border-[var(--theme-ui-border)] shadow-sm">
                      <div className="text-[var(--theme-text)] text-sm font-medium mb-1">Reviews Today</div>
                      <div className="text-3xl font-bold text-[var(--theme-heading)]">{stats.reviews_today}</div>
                    </div>
                    <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-2xl border border-[var(--theme-ui-border)] shadow-sm">
                      <div className="text-[var(--theme-text)] text-sm font-medium mb-1">Reviews This Week</div>
                      <div className="text-3xl font-bold text-[var(--theme-heading)]">{stats.reviews_week}</div>
                    </div>
                    <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-2xl border border-[var(--theme-ui-border)] shadow-sm">
                      <div className="text-[var(--theme-text)] text-sm font-medium mb-1">Cards Learned</div>
                      <div className="text-3xl font-bold text-green-400">{stats.learned_cards} <span className="text-sm text-[var(--theme-text)] font-normal">/ {stats.total_cards}</span></div>
                    </div>
                    <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-2xl border border-[var(--theme-ui-border)] shadow-sm">
                      <div className="text-[var(--theme-text)] text-sm font-medium mb-1">Due Now</div>
                      <div className="text-3xl font-bold text-orange-400">{stats.due_cards}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
                    {/* Activity Chart */}
                    <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-2xl border border-[var(--theme-ui-border)] shadow-sm flex flex-col justify-between">
                      <h3 className="text-lg font-semibold text-[var(--theme-heading)] mb-6 flex items-center gap-2">Activity (Last 7 Days)</h3>
                      <div className="flex items-end justify-between h-48 gap-3 pt-4">
                        {stats.activity.map((day, i) => {
                          const maxCount = Math.max(...stats.activity.map(a => a.count), 1);
                          const heightPercent = day.count > 0 ? Math.max((day.count / maxCount) * 100, 15) : 6;
                          return (
                            <div key={i} className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                              <span className="text-[11px] font-semibold text-[var(--theme-heading)]">
                                {day.count}
                              </span>
                              <div className="w-full relative flex items-end justify-center h-32 rounded-t-lg bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] overflow-hidden">
                                <div 
                                  className="w-full rounded-t-lg transition-all duration-500"
                                  style={{ 
                                    height: `${heightPercent}%`,
                                    backgroundColor: day.count > 0 ? "var(--theme-heading)" : "color-mix(in srgb, var(--theme-heading) 20%, transparent)",
                                    opacity: day.count > 0 ? 0.9 : 0.4
                                  }}
                                ></div>
                              </div>
                              <span className="text-[11px] text-[var(--theme-text)] font-medium mt-1">{day.date}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weak Cards */}
                    <div className="bg-[var(--theme-ui-bg)] backdrop-blur-md p-6 rounded-2xl border border-[var(--theme-ui-border)] shadow-sm">
                      <h3 className="text-lg font-semibold text-[var(--theme-heading)] mb-6 flex items-center gap-2">Weakest Cards</h3>
                      {stats.weak_cards.length === 0 ? (
                        <p className="text-[var(--theme-text)] italic">No weak cards detected yet. Keep studying!</p>
                      ) : (
                        <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                          {stats.weak_cards.map((card, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-[var(--theme-bg)] rounded-xl border border-[var(--theme-ui-border)]">
                              <div className="flex flex-col">
                                <span className="font-bold text-[var(--theme-heading)] text-lg">{card.front}</span>
                                <span className="text-xs text-[var(--theme-text)]">{card.back}</span>
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
