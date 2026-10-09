"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";

import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Icon } from "@/lib/utils";

// ─── Web Audio Sound Effects ────────────────────────────────────────────────
function useAudioContext() {
  const ctxRef = useRef<AudioContext | null>(null);
  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return ctxRef.current;
  }, []);
  return getCtx;
}

function playGhostLegDraw(ctx: AudioContext, index: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sine";
  const baseFreq = 300 + index * 80;
  osc.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(baseFreq, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.14, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
}

function playGhostLegComplete(ctx: AudioContext) {
  const notes = [392, 523.25, 659.25];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "triangle";
    const t = ctx.currentTime + i * 0.1;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.start(t); osc.stop(t + 0.5);
  });
}

function playCoinFlip(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(2400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2); gain2.connect(ctx.destination);
  osc2.type = "sine";
  const lt = ctx.currentTime + 0.62;
  osc2.frequency.setValueAtTime(180, lt);
  osc2.frequency.exponentialRampToValueAtTime(60, lt + 0.12);
  gain2.gain.setValueAtTime(0.3, lt);
  gain2.gain.exponentialRampToValueAtTime(0.001, lt + 0.15);
  osc2.start(lt); osc2.stop(lt + 0.2);
}

function playDiceRoll(ctx: AudioContext) {
  for (let i = 0; i < 8; i++) {
    const t = ctx.currentTime + i * 0.07;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(800 + Math.random() * 400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.05);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.start(t); osc.stop(t + 0.07);
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "triangle";
  const lt = ctx.currentTime + 0.62;
  osc.frequency.setValueAtTime(220, lt);
  osc.frequency.exponentialRampToValueAtTime(80, lt + 0.15);
  gain.gain.setValueAtTime(0.25, lt);
  gain.gain.exponentialRampToValueAtTime(0.001, lt + 0.18);
  osc.start(lt); osc.stop(lt + 0.2);
}

function playTick(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06);
}

function playSpinStart(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
}

function playWinnerSound(ctx: AudioContext) {
  [440, 554, 659, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    const t = ctx.currentTime + i * 0.15;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t); osc.stop(t + 0.3);
  });
}

// -- GHOST LEG (AMIDAKUJI) COMPONENT --
const GhostLegMaze = ({ 
  people, 
  tasks, 
  isAssigning, 
  setIsAssigning,
  onPathStart,
  onComplete,
}: { 
  people: string[], 
  tasks: string[], 
  isAssigning: boolean, 
  setIsAssigning: (v: boolean) => void,
  onPathStart: (index: number) => void,
  onComplete: () => void,
}) => {
  const N = Math.max(people.length, tasks.length);
  const H = 8; // Number of horizontal levels
  
  // Pad arrays to equal length N
  const paddedPeople = useMemo(() => {
    const arr = [...people];
    while (arr.length < N) arr.push("No Assignee");
    return arr;
  }, [people, N]);
  
  const paddedTasks = useMemo(() => {
    const arr = [...tasks];
    while (arr.length < N) arr.push("No Task");
    return arr;
  }, [tasks, N]);

  // Maze State
  const [rungs, setRungs] = useState<boolean[][]>([]);
  const [activePathIndex, setActivePathIndex] = useState<number>(-1);
  const [shuffledTasks, setShuffledTasks] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<{person: string, task: string}[]>([]);

  // Generate Maze & Start Animation
  useEffect(() => {
    if (isAssigning && N >= 2) {
      // 1. Shuffle Tasks at the bottom to guarantee high randomness
      const newShuffled = [...paddedTasks].sort(() => Math.random() - 0.5);
      setShuffledTasks(newShuffled);
      
      // 2. Generate Random Rungs
      const newRungs = Array.from({ length: H }, () => Array(N - 1).fill(false));
      for (let y = 0; y < H; y++) {
        let x = 0;
        while (x < N - 1) {
          if (Math.random() > 0.5) {
            newRungs[y][x] = true;
            x += 2; // prevent adjacent rungs on same level
          } else {
            x += 1;
          }
        }
      }
      setRungs(newRungs);
      
      // 3. Trace logic for all lines to store final results
      const results = [];
      for (let i = 0; i < N; i++) {
        let currentX = i;
        for (let y = 0; y < H; y++) {
          if (currentX < N - 1 && newRungs[y][currentX]) {
            currentX += 1;
          } else if (currentX > 0 && newRungs[y][currentX - 1]) {
            currentX -= 1;
          }
        }
        results.push({ person: paddedPeople[i], task: newShuffled[currentX] });
      }
      setAssignments(results);
      
      // 4. Animate one by one
      setActivePathIndex(0);
      onPathStart(0);
    } else if (isAssigning && N < 2) {
      setIsAssigning(false); // abort if not enough items
    }
  }, [isAssigning, N, paddedPeople, paddedTasks, onPathStart]);

  // Sequence the animation
  useEffect(() => {
    if (activePathIndex >= 0 && activePathIndex < N) {
      if (activePathIndex > 0) onPathStart(activePathIndex);
      const timer = setTimeout(() => {
        setActivePathIndex(prev => prev + 1);
      }, 1500); // 1.5s per line
      return () => clearTimeout(timer);
    } else if (activePathIndex === N) {
      // Finished
      const timer = setTimeout(() => {
        setIsAssigning(false);
        setActivePathIndex(-1); // keep results shown
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activePathIndex, N, setIsAssigning, onPathStart, onComplete]);

  if (N < 2 || (!isAssigning && assignments.length === 0)) {
    return (
      <div className="animate-slide-up bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-8 shadow-sm flex flex-col items-center justify-center h-[600px]">
        <Icon name="casino" size={48} className="text-[var(--theme-text)] opacity-50 mb-4" />
        <p className="text-[var(--theme-text)]">{N < 2 ? "Add at least one person and one task to generate the Ghost Leg maze." : "Click START GHOST LEG to assign tasks!"}</p>
      </div>
    );
  }

  // --- SVG Path Generation Helper ---
  const generateSvgPath = (startIndex: number) => {
    let currentX = startIndex;
    const getX = (x: number) => (x + 0.5) * (100 / N);
    // rungs occupy the middle 0-100 y range; paths start above (-5) and end below (105)
    const rowHeight = 100 / (H + 1);
    
    let d = `M ${getX(currentX)} -5`;
    
    for (let y = 0; y < H; y++) {
      // go down to this rung level
      d += ` L ${getX(currentX)} ${(y + 1) * rowHeight}`;
      
      if (currentX < N - 1 && rungs[y] && rungs[y][currentX]) {
        currentX += 1; // cross right
        d += ` L ${getX(currentX)} ${(y + 1) * rowHeight}`;
      } else if (currentX > 0 && rungs[y] && rungs[y][currentX - 1]) {
        currentX -= 1; // cross left
        d += ` L ${getX(currentX)} ${(y + 1) * rowHeight}`;
      }
    }
    // go to bottom (past the SVG edge, into task label area)
    d += ` L ${getX(currentX)} 105`;
    return d;
  };

  return (
    <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-8 shadow-sm backdrop-blur-md relative h-[700px] flex flex-col overflow-visible">
      {/* Top Row: People */}
      <div className="flex justify-between mb-4 relative z-10 w-full">
        {paddedPeople.map((p, i) => {
          const isActive = activePathIndex === i;
          return (
            <div key={i} className="flex flex-col items-center flex-1">
              <div className={`p-2 rounded-lg text-xs font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-full transition-all duration-300 ${isActive ? "bg-[var(--theme-heading)] text-[var(--theme-bg)] shadow-[0_0_15px_var(--theme-heading)] scale-110" : "bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)]"}`}>
                {p}
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle: Maze Canvas */}
      <div className="flex-1 relative w-full overflow-visible">
        {/* Draw grid lines (idle state) */}
        {rungs.length > 0 && (
          <svg viewBox="-5 -5 110 110" className="w-full h-full absolute inset-0 overflow-visible" preserveAspectRatio="none">
            {/* Vertical lines — full extended height */}
            {Array.from({ length: N }).map((_, i) => (
              <line 
                key={`v-${i}`} 
                x1={(i + 0.5) * (100 / N)} y1="-5" 
                x2={(i + 0.5) * (100 / N)} y2="105" 
                stroke="var(--theme-ui-border)" strokeWidth="4" 
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {/* Horizontal Rungs */}
            {rungs.map((row, y) => row.map((hasRung, x) => {
              if (!hasRung) return null;
              return (
                <line 
                  key={`h-${y}-${x}`}
                  x1={(x + 0.5) * (100 / N)} y1={(y + 1) * (100 / (H + 1))}
                  x2={(x + 1.5) * (100 / N)} y2={(y + 1) * (100 / (H + 1))}
                  stroke="var(--theme-ui-border)" strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                />
              );
            }))}

            {/* Trace Paths (Active and Completed) */}
            {assignments.length > 0 && Array.from({ length: N }).map((_, i) => {
              // Draw if we are not assigning (activePathIndex === -1)
              // Or draw if we are currently assigning and i <= activePathIndex
              const shouldDraw = activePathIndex === -1 || i <= activePathIndex;
              if (!shouldDraw) return null;

              const isCurrentlyAnimating = activePathIndex === i;
              const color = `hsl(${(i * 137.5) % 360}, 70%, 50%)`;

              return (
                <path 
                  key={`trace-${i}`}
                  d={generateSvgPath(i)}
                  fill="none" 
                  stroke={isCurrentlyAnimating ? "var(--theme-heading)" : color} 
                  strokeWidth={isCurrentlyAnimating ? "6" : "4"} 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className={isCurrentlyAnimating ? "drop-shadow-[0_0_10px_var(--theme-heading)] animate-[snakeDraw_1.5s_linear_forwards]" : ""}
                  style={isCurrentlyAnimating ? { strokeDasharray: 2000, strokeDashoffset: 2000 } : {}}
                />
              );
            })}
          </svg>
        )}
      </div>

      {/* Bottom Row: Tasks */}
      <div className="flex justify-between mt-4 relative z-10 w-full">
        {(shuffledTasks.length > 0 ? shuffledTasks : paddedTasks).map((t, i) => {
          // Check if this task is the current destination
          let isActiveDst = false;
          let isAssignedTo = null;
          if (activePathIndex >= 0 && activePathIndex < N && assignments.length > 0) {
            isActiveDst = assignments[activePathIndex].task === t;
          }
          // After finishing, highlight all
          if (activePathIndex === -1 && assignments.length > 0) {
             isAssignedTo = assignments.find(a => a.task === t)?.person;
          }
          
          return (
            <div key={i} className="flex flex-col items-center flex-1 relative group">
              <div className={`p-2 rounded-lg text-xs font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-full transition-all duration-300 ${isActiveDst ? "bg-[var(--theme-heading)] text-[var(--theme-bg)] shadow-[0_0_15px_var(--theme-heading)] scale-110" : "bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] text-[var(--theme-text)]"} ${isAssignedTo ? "border-[var(--theme-heading)]" : ""}`}>
                {t}
              </div>
              {/* Show assignee badge after completion */}
              {isAssignedTo && (
                <div className="absolute top-full mt-2 bg-[var(--theme-bg)] text-xs text-[var(--theme-heading)] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-[var(--theme-ui-border)] shadow-md z-20">
                  Assigned to: {isAssignedTo}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};


// ─── COIN FLIP COMPONENT ─────────────────────────────────────────────────────
const CoinFlip = ({ onFlip }: { onFlip: () => void }) => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [flipCount, setFlipCount] = useState(0);
  const [history, setHistory] = useState<("heads" | "tails")[]>([]);
  const [flipBatchSize, setFlipBatchSize] = useState(1);
  // cumulative Y rotation so we can keep spinning in the same direction
  const [coinRotation, setCoinRotation] = useState(0);

  const handleFlip = () => {
    if (isFlipping) return;
    onFlip();

    // Decide outcomes BEFORE animation
    const newOutcomes: ("heads" | "tails")[] = [];
    let hCount = 0;
    let tCount = 0;
    for (let i = 0; i < flipBatchSize; i++) {
      const outcome = Math.random() < 0.5 ? "heads" : "tails";
      newOutcomes.push(outcome);
      if (outcome === "heads") hCount++; else tCount++;
    }

    const finalFace = newOutcomes[newOutcomes.length - 1];

    const spins = 1440; // 4 full rotations during the flip
    setCoinRotation(r => {
      const base = Math.ceil(r / 360) * 360; // round up to nearest full rotation
      return base + spins + (finalFace === "tails" ? 180 : 0);
    });

    setIsFlipping(true);
    setResult(null);
    setFlipCount(c => c + flipBatchSize);
    
    setTimeout(() => {
      if (flipBatchSize === 1) {
        setResult(finalFace);
      } else {
        if (hCount > tCount) setResult(`Heads Wins! (${hCount} vs ${tCount})`);
        else if (tCount > hCount) setResult(`Tails Wins! (${tCount} vs ${hCount})`);
        else setResult(`It's a Tie! (${hCount} vs ${tCount})`);
      }
      setHistory(h => [...newOutcomes.reverse(), ...h]);
      setIsFlipping(false);
    }, 900);
  };

  const headsCount = history.filter(r => r === "heads").length;
  const tailsCount = history.filter(r => r === "tails").length;

  return (
    <div className="flex flex-col items-center gap-8 w-full mx-auto py-8 animate-slide-up">

      <div className="relative" style={{ perspective: "600px" }}>
        <div
          className={`w-44 h-44 rounded-full cursor-pointer select-none ${!isFlipping ? "hover:scale-105" : ""}`}
          onClick={handleFlip}
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${coinRotation}deg)`,
            transition: isFlipping
              ? "transform 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
              : "transform 0.3s ease",
          }}
        >
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center"
            style={{
              backfaceVisibility: "hidden",
              background: "radial-gradient(circle at 35% 35%, #fde68a, #d97706, #92400e)",
              boxShadow: "0 0 0 6px #92400e, 0 8px 32px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.3)",
            }}
          >
            <span className="text-5xl select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">👑</span>
          </div>
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "radial-gradient(circle at 35% 35%, #c4b5fd, #7c3aed, #4c1d95)",
              boxShadow: "0 0 0 6px #4c1d95, 0 8px 32px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.3)",
            }}
          >
            <span className="text-5xl select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">⭐</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 w-full justify-center py-2">
        <span className="text-[var(--theme-text)] text-sm font-medium">Flips at once:</span>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {[1, 3, 5, 10, 100].map(n => (
            <Button
              key={n}
              size="sm"
              onClick={() => setFlipBatchSize(n)}
              className={`!w-auto !h-9 !px-3 !min-h-0 font-bold text-sm transition-all ${flipBatchSize === n ? "!bg-[var(--theme-heading)] !text-[var(--theme-bg)]" : "!bg-[var(--theme-bg)] !text-[var(--theme-text)] border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] hover:!text-[var(--theme-heading)]"}`}
            >
              {n}
            </Button>
          ))}
          <div className="w-px h-6 bg-[var(--theme-ui-border)] mx-1 hidden sm:block" />
          <input 
            type="number"
            min="1"
            max="10000"
            value={flipBatchSize}
            onChange={(e) => setFlipBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 h-9 bg-[var(--theme-bg)] text-sm text-[var(--theme-text)] px-2 rounded-lg border border-[var(--theme-ui-border)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors text-center font-bold"
          />
        </div>
      </div>

      <div className="h-16 flex items-center justify-center">
        {isFlipping ? (
          <p className="text-[var(--theme-text)] text-lg animate-pulse">Flipping…</p>
        ) : result ? (
          <div className="animate-in slide-in-from-bottom-4 fade-in duration-400 text-center">
            <p className="text-3xl font-black text-[var(--theme-heading)] drop-shadow-[0_0_12px_var(--theme-heading)] capitalize">{result}</p>
          </div>
        ) : (
          <p className="text-[var(--theme-text)] text-sm">Click the coin or press Flip</p>
        )}
      </div>

      <Button
        variant="primary"
        className="px-10 py-4 text-lg rounded-2xl shadow-md"
        onClick={handleFlip}
        disabled={isFlipping}
        icon={<Icon name="monetization_on" size={20} />}
      >
        {isFlipping ? "Flipping…" : "Flip Coin"}
      </Button>

      {history.length > 0 && (
        <div className="w-full bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[var(--theme-text)] mb-3 font-medium">History ({flipCount} flips) &middot; &#x1F451; Heads: {headsCount} / &#x2B50; Tails: {tailsCount}</p>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
            {history.map((r, i) => (
              <span
                key={i}
                className={`text-xs px-3 py-1 rounded-full font-bold border ${r === "heads" ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"}`}
              >
                {r === "heads" ? "👑 H" : "⭐ T"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


// ─── DICE ROLLER COMPONENT ───────────────────────────────────────────────────
const DOT_LAYOUTS: Record<number, string[]> = {
  1: ["col-start-2 row-start-2"],
  2: ["col-start-1 row-start-1", "col-start-3 row-start-3"],
  3: ["col-start-1 row-start-1", "col-start-2 row-start-2", "col-start-3 row-start-3"],
  4: ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-1 row-start-3", "col-start-3 row-start-3"],
  5: ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-2 row-start-2", "col-start-1 row-start-3", "col-start-3 row-start-3"],
  6: ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-1 row-start-2", "col-start-3 row-start-2", "col-start-1 row-start-3", "col-start-3 row-start-3"],
};

const DiceFace = ({ value, size = "lg" }: { value: number; size?: "sm" | "lg" }) => {
  const dots = DOT_LAYOUTS[value] || [];
  const dim = size === "lg" ? "w-28 h-28" : "w-14 h-14";
  const dotSize = size === "lg" ? "w-5 h-5" : "w-2.5 h-2.5";
  return (
    <div className={`${dim} bg-[var(--theme-bg)] border-2 border-[var(--theme-ui-border)] rounded-2xl grid grid-cols-3 grid-rows-3 p-3 gap-0 relative shadow-inner`}>
      {dots.map((cls, i) => (
        <div key={i} className={`${dotSize} rounded-full bg-[var(--theme-heading)] shadow-sm ${cls} place-self-center`} />
      ))}
    </div>
  );
};

const DiceRoller = ({ onRoll }: { onRoll: () => void }) => {
  const [diceCount, setDiceCount] = useState(2);
  const [results, setResults] = useState<number[]>([]);
  const [displayResults, setDisplayResults] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [history, setHistory] = useState<{ rolls: number[]; total: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const roll = () => {
    if (isRolling) return;
    onRoll();
    setIsRolling(true);
    setDisplayResults(Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6)));
    let ticks = 0;
    intervalRef.current = setInterval(() => {
      setDisplayResults(Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6)));
      ticks++;
      if (ticks >= 10) {
        clearInterval(intervalRef.current!);
        const final = Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6));
        setResults(final);
        setDisplayResults(final);
        setHistory(h => [{ rolls: final, total: final.reduce((a, b) => a + b, 0) }, ...h].slice(0, 6));
        setIsRolling(false);
      }
    }, 70);
  };

  const shown = isRolling ? displayResults : results;
  const total = shown.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col items-center gap-6 w-full py-8">
      <div className="flex flex-wrap items-center gap-4 w-full justify-center py-2">
        <span className="text-[var(--theme-text)] text-sm font-medium">Number of dice:</span>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {[1, 2, 3, 4, 5, 6].map(n => (
          <Button
            key={n}
            size="sm"
            onClick={() => { setDiceCount(n); setResults([]); setDisplayResults([]); }}
            className={`!w-9 !h-9 !p-0 !min-h-0 font-bold text-sm transition-all ${diceCount === n ? "!bg-[var(--theme-heading)] !text-[var(--theme-bg)]" : "!bg-[var(--theme-bg)] !text-[var(--theme-text)] border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] hover:!text-[var(--theme-heading)]"}`}
          >
            {n}
          </Button>
        ))}
          <div className="w-px h-6 bg-[var(--theme-ui-border)] mx-1 hidden sm:block" />
          <input 
            type="number"
            min="1"
            max="1000"
            value={diceCount}
            onChange={(e) => { 
              setDiceCount(Math.max(1, parseInt(e.target.value) || 1)); 
              setResults([]); setDisplayResults([]);
            }}
            className="w-20 h-9 bg-[var(--theme-bg)] text-sm text-[var(--theme-text)] px-2 rounded-lg border border-[var(--theme-ui-border)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors text-center font-bold"
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap gap-4 justify-center min-h-[120px] items-center">
          {(shown.length > 0 ? shown : Array.from({ length: diceCount }, (_, i) => i % 6 + 1)).map((v, i) => (
            <div 
              key={i} 
              onClick={shown.length === 0 ? roll : undefined}
              className={`${isRolling ? "animate-bounce" : shown.length > 0 ? "animate-in zoom-in-50 fade-in duration-300" : "opacity-40 hover:opacity-80 hover:scale-105 cursor-pointer transition-all duration-300"} `} 
              style={{ animationDelay: shown.length > 0 ? `${i * 50}ms` : '0ms' }}
            >
              <DiceFace value={v} size="lg" />
            </div>
          ))}
        </div>
        {shown.length === 0 && (
          <p className="text-[var(--theme-text)] text-sm mb-4">Click the dice or press Roll</p>
        )}
      </div>

      {shown.length > 0 && (
        <div className="text-center">
          <p className="text-[var(--theme-text)] text-xs mb-1">Total</p>
          <p className={`text-5xl font-black ${isRolling ? "text-[var(--theme-text)] animate-pulse" : "text-[var(--theme-heading)] drop-shadow-[0_0_12px_var(--theme-heading)]"}`}>
            {total}
          </p>
        </div>
      )}

      <Button
        variant="primary"
        className="px-10 py-4 text-lg rounded-2xl shadow-md"
        onClick={roll}
        disabled={isRolling}
        icon={isRolling ? <Icon name="refresh" className="animate-spin" size={20} /> : <Icon name="casino" size={20} />}
      >
        {isRolling ? "Rolling…" : `Roll ${diceCount === 1 ? "Die" : `${diceCount} Dice`}`}
      </Button>

      {history.length > 0 && (
        <div className="w-full bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[var(--theme-text)] mb-3 font-medium">Recent Rolls</p>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-[var(--theme-bg)] px-3 py-2 rounded-lg border border-[var(--theme-ui-border)] shadow-inner">
                <div className="flex gap-2 items-center">
                  {h.rolls.map((v, j) => (
                    <DiceFace key={j} value={v} size="sm" />
                  ))}
                </div>
                <span className="text-sm font-bold text-[var(--theme-heading)]">= {h.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


export default function RandomizerPage() {
  const [activeTab, setActiveTab] = useState<"wheel" | "tasks" | "coin" | "dice" | "groups">("wheel");
  const getAudioCtx = useAudioContext();
  
  // Wheel State
  const [wheelItems, setWheelItems] = useState<string[]>(["Alice", "Bob", "Charlie", "Diana"]);
  const [newWheelItem, setNewWheelItem] = useState("");
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelWinner, setWheelWinner] = useState<string | null>(null);
  
  const wheelRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  // Wheel Flick Animation + tick sound
  useEffect(() => {
    if (!isSpinning) return;
    let animationFrameId: number;
    let lastAngle = -1;
    const numSlices = wheelItems.length;
    if (numSlices === 0) return;
    const sliceAngle = 360 / numSlices;

    const checkFlick = () => {
      if (wheelRef.current && arrowRef.current) {
        const computedStyle = window.getComputedStyle(wheelRef.current);
        const matrix = computedStyle.transform;
        if (matrix !== 'none') {
          const values = matrix.split('(')[1].split(')')[0].split(',');
          const a = parseFloat(values[0]);
          const b = parseFloat(values[1]);
          let angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
          if (angle < 0) angle += 360;

          const currentSlice = Math.floor(angle / sliceAngle);
          if (lastAngle !== -1 && currentSlice !== lastAngle) {
             arrowRef.current.animate([
               { transform: 'rotate(-30deg) translateY(-4px)' },
               { transform: 'rotate(0deg) translateY(0px)' }
             ], { duration: 150, easing: 'ease-out' });
             try { playTick(getAudioCtx()); } catch {}
          }
          lastAngle = currentSlice;
        }
      }
      animationFrameId = requestAnimationFrame(checkFlick);
    };
    checkFlick();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isSpinning, wheelItems.length, getAudioCtx]);

  // Idle continuous spinning logic
  const idleAngleRef = useRef(0);
  const isSpinningRef = useRef(isSpinning);
  isSpinningRef.current = isSpinning;

  useEffect(() => {
    let animationFrameId: number;
    const idleSpin = () => {
      if (!isSpinningRef.current && !wheelWinner && wheelRef.current) {
        idleAngleRef.current = (idleAngleRef.current + 0.3) % 360;
        wheelRef.current.style.transform = `rotate(${idleAngleRef.current}deg)`;
        wheelRef.current.style.transition = "none";
      }
      animationFrameId = requestAnimationFrame(idleSpin);
    };
    idleSpin();
    return () => cancelAnimationFrame(animationFrameId);
  }, [wheelWinner]);


  // Task State
  const [people, setPeople] = useState<string[]>(["Alice", "Bob", "Charlie"]);
  const [tasks, setTasks] = useState<string[]>(["Clean Kitchen", "Take out Trash", "Vacuum", "Cook Dinner"]);
  const [newPerson, setNewPerson] = useState("");
  const [newTask, setNewTask] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Ghost Leg sound callbacks
  const handleGhostLegPathStart = useCallback((index: number) => {
    try { playGhostLegDraw(getAudioCtx(), index); } catch {}
  }, [getAudioCtx]);

  const handleGhostLegComplete = useCallback(() => {
    try { playGhostLegComplete(getAudioCtx()); } catch {}
  }, [getAudioCtx]);

  // Wheel Logic
  const handleSpin = () => {
    if (wheelItems.length < 2 || isSpinning) return;
    try { playSpinStart(getAudioCtx()); } catch {}
    setIsSpinning(true);
    setWheelWinner(null);
    
    const spins = Math.floor(Math.random() * 5) + 5;
    const randomDegree = Math.floor(Math.random() * 360);
    const totalRotation = idleAngleRef.current + (spins * 360) + randomDegree;
    
    setWheelRotation(totalRotation);
    
    setTimeout(() => {
      setIsSpinning(false);
      const sliceAngle = 360 / wheelItems.length;
      const normalizedRotation = totalRotation % 360;
      const topAngle = (360 - normalizedRotation) % 360;
      const winningIndex = Math.floor(topAngle / sliceAngle);
      setWheelWinner(wheelItems[winningIndex]);
      idleAngleRef.current = totalRotation % 360; // Sync idle ref so it resumes from here smoothly
      try { playWinnerSound(getAudioCtx()); } catch {}
    }, 5000); 
  };

  const addWheelItem = () => {
    if (newWheelItem.trim() && !wheelItems.includes(newWheelItem.trim())) {
      setWheelItems([...wheelItems, newWheelItem.trim()]);
      setNewWheelItem("");
      setWheelWinner(null);
    }
  };

  const removeWheelItem = (index: number) => {
    setWheelItems(wheelItems.filter((_, i) => i !== index));
    setWheelWinner(null);
  };

  const addPerson = () => {
    if (newPerson.trim() && !people.includes(newPerson.trim())) {
      setPeople([...people, newPerson.trim()]);
      setNewPerson("");
    }
  };

  const addTask = () => {
    if (newTask.trim() && !tasks.includes(newTask.trim())) {
      setTasks([...tasks, newTask.trim()]);
      setNewTask("");
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto custom-scrollbar flex flex-col font-sans">
      <>
        <style dangerouslySetInnerHTML={{__html: `
        @keyframes snakeDraw {
          to { stroke-dashoffset: 0; }
        }
      `}} />

      <div className="w-full h-full relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans custom-scrollbar">
        <Header 
          title="Randomizer" 
          subtitle="Spin the wheel, flip a coin, roll dice, or assign tasks with Ghost Leg."
          actions={
            <ModernTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab as (id: string) => void}
              tabs={[
                { id: "wheel", label: "Spin Wheel" },
                { id: "coin",  label: "Coin Flip" },
                { id: "dice",  label: "Dice Roller" },
                { id: "tasks", label: "Task Assigner" },
              ]}
            />
          }
        />

        <div className="p-6 lg:p-10 w-full">
          <ModernTabContent activeTab={activeTab}>
            {activeTab === "wheel" && (
              <div className="flex flex-col gap-6 animate-slide-up w-full">
                <div className="w-full">
                  <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] shadow-sm rounded-xl p-6 backdrop-blur-md relative z-10">
                    <h3 className="font-semibold text-[var(--theme-heading)] mb-4 flex items-center gap-2">Participants</h3>
                    
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div className="flex gap-2 flex-1 w-full">
                        <input 
                          type="text"
                          value={newWheelItem}
                          onChange={(e) => setNewWheelItem(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addWheelItem()}
                          placeholder="Add name..."
                          className="flex-1 bg-[var(--theme-bg)] text-sm text-[var(--theme-text)] px-3 py-2 rounded-lg border border-[var(--theme-ui-border)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors"
                        />
                        <Button variant="secondary" onClick={addWheelItem} className="!w-auto shrink-0">Add</Button>
                        <Button variant="danger" onClick={() => { setWheelItems([]); setWheelWinner(null); }} className="!w-auto shrink-0 !bg-red-500/10 border border-red-500/30 text-red-500 hover:!bg-red-500 hover:!text-[var(--theme-bg)]" title="Clear All">
                          <Icon name="delete" size={16} />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {wheelItems.length === 0 ? (
                        <p className="text-sm text-[var(--theme-text)] py-2">Add items to spin the wheel</p>
                      ) : (
                        wheelItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-[var(--theme-bg)] px-3 py-1.5 rounded-lg border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] transition-colors w-fit group cursor-pointer" onClick={() => removeWheelItem(idx)}>
                            <span className="text-sm text-[var(--theme-text)] group-hover:text-[var(--theme-heading)]">{item}</span>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); removeWheelItem(idx); }} className="!w-auto !h-auto !p-0 !bg-transparent !text-[var(--theme-text)] group-hover:!text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                              <Icon name="delete" size={14} />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="w-full">
                  <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-8 shadow-sm backdrop-blur-md flex flex-col items-center justify-center min-h-[500px] overflow-hidden relative z-10">
                    
                    <div className="relative w-80 h-80 md:w-96 md:h-96 mb-12">
                      {/* Pointer */}
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 drop-shadow-md" style={{ perspective: "100px" }}>
                        <div 
                          ref={arrowRef}
                          className="transform origin-top flex items-center justify-center"
                        >
                          <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                            <path d="M16 40L32 16H22V0H10V16H0L16 40Z" fill="var(--theme-heading)" stroke="var(--theme-bg)" strokeWidth="2" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                      
                      {/* Wheel */}
                      <div 
                        ref={wheelRef}
                        className="w-full h-full rounded-full border-4 border-[var(--theme-ui-border)] shadow-inner relative overflow-hidden"
                        style={{
                          transition: isSpinning ? "transform 5s cubic-bezier(0.15, 0.9, 0.2, 1)" : "none",
                          // When not spinning and not winner, transform is managed by idleSpin requestAnimationFrame
                          transform: (isSpinning || wheelWinner) ? `rotate(${wheelRotation}deg)` : undefined
                        }}
                      >
                        <svg viewBox="0 0 100 100" className="w-full h-full rounded-full border-4 border-[var(--theme-bg)] overflow-visible">
                          {wheelItems.length > 0 ? (
                            wheelItems.map((item, i) => {
                              if (wheelItems.length === 1) {
                                return (
                                  <g key={i}>
                                    <circle cx="50" cy="50" r="50" fill={`var(--theme-heading)`} />
                                    <text x="50" y="50" fill="var(--theme-bg)" fontSize="6" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                                      {item}
                                    </text>
                                  </g>
                                );
                              }

                              const sliceAngle = 360 / wheelItems.length;
                              // For a standard wheel, 0 degrees is typically straight up. 
                              // In our SVG math: 0 deg = top (y: 0, x: 50).
                              const startAngle = i * sliceAngle;
                              const endAngle = (i + 1) * sliceAngle;
                              
                              const startX = 50 + 50 * Math.sin(startAngle * Math.PI / 180);
                              const startY = 50 - 50 * Math.cos(startAngle * Math.PI / 180);
                              const endX = 50 + 50 * Math.sin(endAngle * Math.PI / 180);
                              const endY = 50 - 50 * Math.cos(endAngle * Math.PI / 180);
                              
                              const largeArcFlag = sliceAngle > 180 ? 1 : 0;
                              
                              const pathData = [
                                `M 50 50`,
                                `L ${startX} ${startY}`,
                                `A 50 50 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                                `Z`
                              ].join(" ");

                              const hue = (i * 137.508) % 360; 
                              const color = `hsl(${hue}, 70%, 50%)`;

                              const textAngle = startAngle + sliceAngle / 2;
                              // Radius offset to push text outward
                              const textRadius = 32;
                              
                              return (
                                <g key={i}>
                                  <path d={pathData} fill={color} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                                  <g transform={`translate(50, 50) rotate(${textAngle}) translate(0, -${textRadius})`}>
                                    {/* Rotate text -90 to make it perpendicular to the edge like spokes */}
                                    <text 
                                      x="0" 
                                      y="0" 
                                      fill="white" 
                                      fontSize="4" 
                                      fontWeight="bold" 
                                      textAnchor="middle" 
                                      dominantBaseline="middle"
                                      transform="rotate(-90)"
                                      style={{ filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.5))' }}
                                    >
                                      {item.length > 18 ? item.substring(0, 15) + "..." : item}
                                    </text>
                                  </g>
                                </g>
                              );
                            })
                          ) : (
                            <circle cx="50" cy="50" r="50" fill="var(--theme-bg)" />
                          )}
                        </svg>
                        
                        {/* Center Dot */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[var(--theme-bg)] rounded-full border-2 border-[var(--theme-ui-border)] z-10 shadow-md">
                          <div className="w-4 h-4 m-[6px] bg-[var(--theme-heading)] rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                    
                    {wheelWinner ? (
                      <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 flex flex-col items-center">
                        <h2 className="text-4xl font-black text-[var(--theme-heading)] mb-6 flex items-center gap-4">{wheelWinner} 
                          <Icon name="redeem" className="text-[var(--theme-heading)] animate-bounce" size={32} style={{ animationDelay: "150ms" }} />
                        </h2>
                        <Button variant="primary" className="px-8 py-4 text-lg rounded-xl shadow-md" onClick={handleSpin}>
                          Spin Again
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="primary" 
                        className={`px-10 py-6 text-xl rounded-2xl shadow-md transition-transform ${isSpinning ? "scale-95 opacity-50" : "hover:scale-105"}`}
                        onClick={handleSpin}
                        disabled={isSpinning || wheelItems.length < 2}
                        icon={isSpinning ? <Icon name="refresh" className="animate-spin" size={24} /> : <Icon name="play_arrow" size={24} />}
                      >
                        {isSpinning ? "SPINNING" : "SPIN THE WHEEL"}
                      </Button>
                    )}
                    
                  </div>
                </div>
              </div>
            )}
          </ModernTabContent>

          {/* ── COIN FLIP TAB ── */}
          <ModernTabContent activeTab={activeTab}>
            {activeTab === "coin" && (
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-8 shadow-sm backdrop-blur-md w-full flex justify-center">
                <CoinFlip onFlip={() => { try { playCoinFlip(getAudioCtx()); } catch {} }} />
              </div>
            )}
          </ModernTabContent>

          {/* ── DICE ROLLER TAB ── */}
          <ModernTabContent activeTab={activeTab}>
            {activeTab === "dice" && (
              <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] rounded-xl p-8 shadow-sm backdrop-blur-md w-full flex justify-center">
                <DiceRoller onRoll={() => { try { playDiceRoll(getAudioCtx()); } catch {} }} />
              </div>
            )}
          </ModernTabContent>

          {/* ── TEAMS & GROUPS TAB ── */}
          <ModernTabContent activeTab={activeTab}>
            {activeTab === "tasks" && (
              <div className="flex flex-col gap-6 animate-slide-up w-full">
                
                <div className="flex flex-col md:flex-row gap-6 w-full">
                  <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] shadow-sm rounded-xl p-6 backdrop-blur-md flex-1 w-full">
                    <h3 className="font-semibold text-[var(--theme-heading)] mb-4 flex items-center gap-2">People</h3>
                    <div className="flex gap-2 mb-4">
                      <input 
                        type="text" value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()}
                        placeholder="Add person..." className="flex-1 w-full bg-[var(--theme-bg)] text-sm text-[var(--theme-text)] px-3 py-2 rounded-lg border border-[var(--theme-ui-border)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors"
                      />
                      <Button variant="secondary" onClick={addPerson} className="!w-auto shrink-0">Add</Button>
                      <Button variant="danger" onClick={() => setPeople([])} className="!w-auto shrink-0 !bg-red-500/10 border border-red-500/30 text-red-500 hover:!bg-red-500 hover:!text-[var(--theme-bg)]" title="Clear All">
                        <Icon name="delete" size={16} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                      {people.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-[var(--theme-bg)] px-3 py-1.5 rounded-lg border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] transition-colors group w-fit cursor-pointer" onClick={() => setPeople(people.filter((_, i) => i !== idx))}>
                          <span className="text-sm font-medium text-[var(--theme-text)] group-hover:text-[var(--theme-heading)]">{p}</span>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setPeople(people.filter((_, i) => i !== idx)); }} className="!w-auto !h-auto !p-0 !bg-transparent !text-[var(--theme-text)] group-hover:!text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Icon name="delete" size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-[var(--theme-ui-bg)] border border-[var(--theme-ui-border)] shadow-sm rounded-xl p-6 backdrop-blur-md flex-1 w-full">
                    <h3 className="font-semibold text-[var(--theme-heading)] mb-4 flex items-center gap-2">Tasks</h3>
                    <div className="flex gap-2 mb-4">
                      <input 
                        type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
                        placeholder="Add task..." className="flex-1 w-full bg-[var(--theme-bg)] text-sm text-[var(--theme-text)] px-3 py-2 rounded-lg border border-[var(--theme-ui-border)] focus:outline-none focus:border-[var(--theme-heading)] transition-colors"
                      />
                      <Button variant="secondary" onClick={addTask} className="!w-auto shrink-0">Add</Button>
                      <Button variant="danger" onClick={() => setTasks([])} className="!w-auto shrink-0 !bg-red-500/10 border border-red-500/30 text-red-500 hover:!bg-red-500 hover:!text-[var(--theme-bg)]" title="Clear All">
                        <Icon name="delete" size={16} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                      {tasks.map((t, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-[var(--theme-bg)] px-3 py-1.5 rounded-lg border border-[var(--theme-ui-border)] hover:border-[var(--theme-heading)] transition-colors group w-fit cursor-pointer" onClick={() => setTasks(tasks.filter((_, i) => i !== idx))}>
                          <span className="text-sm font-medium text-[var(--theme-text)] group-hover:text-[var(--theme-heading)]">{t}</span>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter((_, i) => i !== idx)); }} className="!w-auto !h-auto !p-0 !bg-transparent !text-[var(--theme-text)] group-hover:!text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Icon name="delete" size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <Button 
                    variant="primary" 
                    className="w-full mx-auto flex py-4 text-lg rounded-xl shadow-md"
                    onClick={() => setIsAssigning(true)}
                    disabled={Math.max(people.length, tasks.length) < 2 || isAssigning}
                    icon={isAssigning ? <Icon name="refresh" className="animate-spin" size={20} /> : <Icon name="play_arrow" size={20} />}
                  >
                    {isAssigning ? "DRAWING" : "START GHOST LEG"}
                  </Button>
                </div>

                <div className="w-full">
                   <GhostLegMaze 
                      people={people} 
                      tasks={tasks} 
                      isAssigning={isAssigning} 
                      setIsAssigning={setIsAssigning}
                      onPathStart={handleGhostLegPathStart}
                      onComplete={handleGhostLegComplete}
                   />
                </div>
              </div>
            )}
          </ModernTabContent>
        </div>
      </div>
      </>
    </div>
  );
}
