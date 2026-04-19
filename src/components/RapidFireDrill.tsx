"use client";

import React, { useState, useEffect, useRef } from "react";

import { unifiedDrillBank } from "@/lib/drillData";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { awardXP } from "@/lib/firebase/xpUtils";

// --- UTILITIES ---

/**
 * Normalizes a string by lowercasing, trimming, and stripping non-alphanumeric characters.
 */
const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

/**
 * Full Levenshtein Distance algorithm to calculate the edit distance between two strings.
 */
const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];

  // Increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Checks if the user input is "close enough" to the target answer.
 */
const isCloseEnough = (input: string, target: string): boolean => {
  const nInput = normalize(input);
  const nTarget = normalize(target);
  
  if (nInput === nTarget) return true;
  
  // Strict matching for very short answers (e.g., ports, IDs)
  if (nTarget.length <= 3) return false;
  
  // Allow an edit distance of 1 for longer answers (e.g., "secure" vs "secured")
  const distance = levenshteinDistance(nInput, nTarget);
  return distance <= 1;
};

type Question = {
  id: string;
  type: 'type' | 'choice';
  topic: string;
  prompt: string;
  options: string[];
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  explanation: string;
};

type HistoryItem = {
  text: string;
  type: "command" | "output" | "error" | "success" | "system";
};

interface RapidFireDrillProps {
  onClose?: () => void;
}

export default function RapidFireDrill({ onClose }: RapidFireDrillProps) {
  const { isCyberpunk } = useTheme();
  const { user } = useAuth();
  const [view, setView] = useState<"lobby" | "active" | "results">("lobby");
  const [mode, setMode] = useState<"arcade" | "terminal">("arcade");
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  
  // Game state
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [availableIndices, setAvailableIndices] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  
  const currentQuestion = activeQuestions[currentIdx];
  
  // Difficulty Ladder state
  const [rank, setRank] = useState<'easy' | 'medium' | 'hard' | 'extreme'>('easy');
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  
  // AAR & UX states
  const [missedLog, setMissedLog] = useState<Question[]>([]);
  const [sessionHistory, setSessionHistory] = useState<{
    question: Question;
    userAnswer: string;
    isCorrect: boolean;
    isSkip: boolean;
  }[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [overclock, setOverclock] = useState(0);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-focus and scroll
  useEffect(() => {
    if (view === "active") {
      inputRef.current?.focus();
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [view, history]);

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (view === "active" && timeLeft > 0 && !isPaused) {
      timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    } else if (timeLeft === 0 && view === "active") {
      setView("results");
      // Persist XP to Firestore when session ends
      if (user?.uid && score > 0) {
        awardXP(user.uid, score).catch(err => console.error('XP award failed:', err));
      }
    }
    return () => clearInterval(timer);
  }, [view, timeLeft, isPaused]);

  // Keyboard navigation (Escape key & Arcade Mode hotkeys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape for Pause/Exit
      if (e.key === "Escape") {
        if (view === "active") {
          setIsPaused(!isPaused);
        } else if (onClose) {
          onClose();
        }
        return;
      }
      
      // Arcade Mode Keyboard shortcuts (with transition lock)
      if (view === "active" && mode === "arcade" && !isPaused && !isTransitioning) {
        const key = e.key.toLowerCase();
        
        // Handle a, b, c, d
        if (["a", "b", "c", "d"].includes(key)) {
          processAnswer(key);
        } 
        // Handle 1, 2, 3, 4
        else if (["1", "2", "3", "4"].includes(key)) {
          const mappedKey = String.fromCharCode(96 + parseInt(key)); // 1 -> 'a', 2 -> 'b', etc.
          processAnswer(mappedKey);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, isPaused, onClose, mode]);

  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());

  const getNextQuestion = (currentRank: 'easy' | 'medium' | 'hard' | 'extreme') => {
    const pool = unifiedDrillBank.filter(q => q.difficulty === currentRank && !usedIds.has(q.id));
    // If we run out, reset usedIds for this specifically? Or just pick from all of that rank.
    const finalPool = pool.length > 0 ? pool : unifiedDrillBank.filter(q => q.difficulty === currentRank);
    const randomIndex = Math.floor(Math.random() * finalPool.length);
    const nextQ = finalPool[randomIndex];
    
    setUsedIds(prev => new Set([...prev, nextQ.id]));
    return nextQ;
  };

  const handleInitiate = () => {
    const startRank = 'easy';
    setUsedIds(new Set());
    const firstQ = getNextQuestion(startRank);
    
    setActiveQuestions([firstQ]);
    setCurrentIdx(0);
    setAvailableIndices([]); // Not used in this new model

    setHistory([
      { text: `SIMULATION_INITIATED: POOL=UNIFIED_BANK MODE=${mode.toUpperCase()}`, type: "system" },
      { text: "--------------------------------------------------------", type: "system" },
      { text: `1. ${firstQ.prompt}`, type: "output" },
      ...(mode === 'arcade' && firstQ.options && firstQ.options.length > 0 ? firstQ.options.map(opt => ({ text: opt, type: "output" as const })) : [])
    ]);
    setView("active");
    setTimeLeft(40);
    setScore(0);
    setCombo(0);
    setCorrectCount(0);
    setTotalCount(0);
    setIsPaused(false);
    setIsPaused(false);
    setRank(startRank);
    setConsecutiveCorrect(0);
    setConsecutiveWrong(0);
    setOverclock(0);
    setIsAccessDenied(false);
    setMissedLog([]);
    setSessionHistory([]);
    setIsTransitioning(false);
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputValue.trim().toLowerCase();
    if (!cmd) return;

    processAnswer(cmd);
    setInputValue("");
  };

  const getFallbackOptions = (q: Question | undefined) => {
    if (!q || !q.options) return [];
    if (q.options.length === 4) return q.options;
    
    // Safety net: pull 3 random answers from the bank
    const others = unifiedDrillBank
      .filter(item => item.id !== q.id)
      .map(item => item.answer)
      .filter((v, i, a) => a.indexOf(v) === i); // Unique
    
    const shuffledOthers = others.sort(() => Math.random() - 0.5).slice(0, 3);
    const combined = [q.answer, ...shuffledOthers].sort(() => Math.random() - 0.5);
    
    return combined.map((val, i) => `${String.fromCharCode(65 + i)}) ${val}`);
  };

  const processAnswer = (input: string) => {
    if (isTransitioning) return;
    
    const currentQuestion = activeQuestions[currentIdx];
    if (!currentQuestion) return;
    
    const cmd = input.trim().toLowerCase();
    const isSkip = cmd === "skip" || cmd === "pass";
    
    // Get the full descriptive string for the correct answer
    const options = getFallbackOptions(currentQuestion);
    const correctIdx = currentQuestion.answer.toUpperCase().charCodeAt(0) - 65;
    const fullAnswerStr = options[correctIdx]?.split(') ')[1] || currentQuestion.answer;

    let isActuallyCorrect = false;
    if (!isSkip) {
      if (mode === "terminal") {
        // Fuzzy match against FULL string ONLY (strict for <=3 chars)
        isActuallyCorrect = isCloseEnough(cmd, fullAnswerStr);
      } else {
        // Arcade mode: exact match for shortcut ('a', 'b', etc.)
        isActuallyCorrect = cmd === currentQuestion.answer.toLowerCase();
      }
    }

    const userLogItem = { text: `user@socmaster:~$ ${input}`, type: "command" as const };
    
    if (isSkip || isActuallyCorrect || mode === "terminal" || mode === "arcade") {
      // Logic for new rank
      let newRank = rank;
      let newConsCorrect = consecutiveCorrect;
      let newConsWrong = consecutiveWrong;

      if (isActuallyCorrect && !isSkip) {
        newConsCorrect++;
        newConsWrong = 0;
        if (newConsCorrect >= 2) {
          if (newRank === 'easy') newRank = 'medium';
          else if (newRank === 'medium') newRank = 'hard';
          else if (newRank === 'hard') newRank = 'extreme';
          newConsCorrect = 0;
        }
      } else if (!isSkip) {
        newConsWrong++;
        newConsCorrect = 0;
        if (newConsWrong === 2) {
          if (newRank === 'extreme') newRank = 'hard';
          else if (newRank === 'hard') newRank = 'medium';
          else if (newRank === 'medium') newRank = 'easy';
        } else if (newConsWrong >= 3) {
          if (newRank === 'extreme') newRank = 'medium';
          else if (newRank === 'hard') newRank = 'easy';
          else if (newRank === 'medium') newRank = 'easy';
          newConsWrong = 0;
        }
      } else {
        newConsCorrect = 0;
      }

      setRank(newRank);
      setConsecutiveCorrect(newConsCorrect);
      setConsecutiveWrong(newConsWrong);

      // XP Scaling based on OLD Rank (the one they answered)
      const rankMultiplier = { easy: 10, medium: 25, hard: 50, extreme: 100 };
      const baseXP = (isSkip || !isActuallyCorrect) ? 0 : rankMultiplier[rank];
      const overclockMultiplier = overclock >= 100 ? 2 : 1;
      const xp = baseXP * overclockMultiplier;
      
      if (isActuallyCorrect && !isSkip) {
        setScore(s => s + xp);
        setCombo(c => c + 1);
        setCorrectCount(c => c + 1);
        setTimeLeft(prev => Math.min(120, prev + 4));
        setOverclock(prev => Math.min(100, prev + 20));
      } else {
        setCombo(0);
        if (!isSkip) {
          setOverclock(prev => Math.max(0, prev - 30));
          setIsAccessDenied(true);
          setTimeout(() => setIsAccessDenied(false), 800);
        }
      }
      
      setTotalCount(t => t + 1);
      
      setSessionHistory(prev => [...prev, {
        question: currentQuestion,
        userAnswer: input,
        isCorrect: isActuallyCorrect && !isSkip,
        isSkip: isSkip
      }]);
      
      // Get next question based on NEW Rank
      const nextQ = getNextQuestion(newRank);
      setActiveQuestions(prev => [...prev, nextQ]);
      // Remove sync increment: setCurrentIdx(prev => prev + 1);
        
      let feedback: HistoryItem;
      if (isActuallyCorrect && !isSkip) {
        feedback = { text: `SUCCESS: +${xp} XP ${overclock >= 100 ? '[OVERCLOCK_ACTIVE]' : ''} | RANK: ${newRank.toUpperCase()}`, type: "success" };
      } else if (isSkip) {
        feedback = { text: `>> SYSTEM: BYPASS INITIATED. CORRECT IDENTIFIER WAS: ${currentQuestion.answer}. PROCEEDING...`, type: "system" };
        setMissedLog(prev => [...prev, currentQuestion]);
      } else {
        const correctText = currentQuestion.options?.[currentQuestion.answer.charCodeAt(0) - 65] || currentQuestion.answer;
        feedback = { text: `>> [ACCESS DENIED]: THE ANSWER WAS: ${correctText}.`, type: "error" };
        setMissedLog(prev => [...prev, currentQuestion]);
      }

      setHistory(prev => [...prev, userLogItem, feedback]);

      // Enforce 1-second transition lock for ALL results (prevents index sticking/spam)
      setIsTransitioning(true);
      setTimeout(() => {
        proceed(newRank, nextQ, currentIdx + 1);
        setIsTransitioning(false);
      }, 1000);
    }
  };

  const proceed = (newRank: 'easy' | 'medium' | 'hard' | 'extreme', nextQ: Question, nextIdx: number) => {
    setCurrentIdx(nextIdx);
    setHistory(prev => [
      ...prev,
      { text: "--------------------------------------------------------", type: "system" },
      { text: `${nextIdx + 1}. ${nextQ.prompt}`, type: "output" },
      ...(mode === 'arcade' && nextQ.options && nextQ.options.length > 0 ? nextQ.options.map(opt => ({ text: opt, type: "output" as const })) : [])
    ]);
  };

  // Stage 1: Lobby UI
  if (view === "lobby") {
    return (
      <div className="flex-1 flex flex-col p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold hm-logo-text tracking-widest uppercase mb-2">Ragnarök (triage drill)</h1>
            <p className="text-emerald-500/60 font-mono text-sm uppercase tracking-wider">Configure your simulation parameters</p>
          </div>
          {onClose && (
            <button 
              onClick={onClose} 
              className={`px-4 py-2 border font-mono text-xs transition-all uppercase tracking-tighter ${
                isCyberpunk 
                  ? "border-fuchsia-500 text-fuchsia-500 hover:bg-fuchsia-500 hover:text-black shadow-[0_0_10px_rgba(255,0,255,0.2)]" 
                  : "border-neutral-700 text-neutral-500 hover:border-white hover:text-white"
              }`}
              title="Esc to Exit"
            >
              [ EXIT_SESSION ]
            </button>
          )}
        </div>

        <div className={`border p-4 rounded-lg transition-colors ${
          isCyberpunk ? "border-emerald-500/20 bg-emerald-500/5" : "border-neutral-800 bg-neutral-900/20"
        }`}>
          <p className={`text-[10px] font-mono uppercase leading-relaxed ${
            isCyberpunk ? "text-emerald-400" : "text-neutral-500"
          }`}>
            SYSTEM_MESSAGE: Welcome to SOC Survival. Simulation begins with 40s on the clock.
            <br />
            DRIVE: Questions scale through Easy, Medium, Hard, and Extreme. Correct answers grant +4s and XP multipliers. Accuracy is your lifeblood.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['arcade', 'terminal'] as const).map((m) => (
            <div
              key={m}
              onClick={() => setMode(m)}
              className={`p-6 border transition-all cursor-pointer ${
                mode === m 
                  ? (isCyberpunk ? 'bg-[#00ffff15] border-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.2)]' : 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]')
                  : (isCyberpunk ? 'bg-neutral-900/40 border-neutral-800 opacity-60 hover:opacity-100' : 'bg-neutral-900/40 border-neutral-800/40 opacity-40 hover:opacity-80')
              }`}
            >
              <div className="flex justify-between mb-2">
                <h3 className={`text-sm font-bold uppercase tracking-widest ${isCyberpunk ? "text-white" : "text-neutral-300"}`}>{m === 'arcade' ? 'Arcade Mode' : 'Terminal Mode'}</h3>
                <span className={`text-[10px] font-bold ${isCyberpunk ? "text-cyan-400" : "text-emerald-500"}`}>{m === 'arcade' ? '1x XP' : '2x XP'}</span>
              </div>
              <p className={`text-[10px] uppercase ${isCyberpunk ? "text-cyan-500/60" : "text-neutral-600"}`}>
                {m === 'arcade' ? 'Multiple Choice Interaction' : 'Direct Manual Entry Check'}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={handleInitiate}
          className={`w-full py-4 text-sm font-bold uppercase tracking-[0.4em] transition-all ${
            isCyberpunk 
              ? "bg-fuchsia-600/20 border border-fuchsia-500 text-fuchsia-500 hover:bg-fuchsia-600 hover:text-white shadow-[0_0_30px_rgba(255,0,255,0.2)]"
              : "bg-emerald-600/10 border border-emerald-500/50 text-emerald-500 hover:bg-emerald-600 hover:text-white"
          }`}
        >
          INITIATE SURVIVAL
        </button>
      </div>
    );
  }

  // Stage 3: Results UI
  if (view === "results") {
    const syncRate = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);
    return (
      <div className="flex-1 flex flex-col h-full min-h-0 items-center justify-center p-8 space-y-8 animate-in zoom-in-95 duration-500">
        <div className="text-center shrink-0">
          <h1 className="text-4xl font-bold hm-logo-text tracking-[0.3em] uppercase mb-12">Simulation Complete</h1>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="text-center">
              <div className="text-[10px] text-fuchsia-500 uppercase tracking-widest mb-1">XP Earned</div>
              <div className="text-3xl font-bold text-white">{score}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-cyan-500 uppercase tracking-widest mb-1">Sync Rate</div>
              <div className="text-3xl font-bold text-white">{syncRate}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-yellow-500 uppercase tracking-widest mb-1">Total Hits</div>
              <div className="text-3xl font-bold text-white">{correctCount}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-emerald-500 uppercase tracking-widest mb-1">Best Combo</div>
              <div className="text-3xl font-bold text-white">x{combo}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-12">
          <button
            onClick={() => setView("lobby")}
            className={`px-8 py-3 border text-xs font-bold uppercase tracking-widest transition-all ${
              isCyberpunk 
                ? "border-fuchsia-500 text-fuchsia-500 hover:bg-fuchsia-500 hover:text-white shadow-[0_0_15px_rgba(255,0,255,0.2)]"
                : "border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white"
            }`}
          >
            RE-INITIALIZE
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={`px-8 py-3 border text-xs font-bold uppercase tracking-widest transition-all ${
                isCyberpunk 
                  ? "border-neutral-700 text-neutral-500 hover:border-white hover:text-white"
                  : "border-neutral-800 text-neutral-700 hover:border-neutral-600 hover:text-neutral-400"
              }`}
            >
              EXIT SESSION
            </button>
          )}
        </div>

        {sessionHistory.length > 0 && (
          <div className={`w-full max-w-4xl border p-6 rounded-lg animate-in slide-in-from-bottom-8 duration-700 flex flex-col min-h-0 ${
            isCyberpunk ? "border-emerald-500/20 bg-emerald-500/5" : "border-neutral-800 bg-neutral-900/10"
          }`}>
            <h2 className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-4 border-b pb-2 shrink-0 ${
              isCyberpunk ? "text-emerald-400 border-emerald-500/20" : "text-neutral-500 border-neutral-800"
            }`}>
              [ SESSION_DEBRIEF: FULL_SIGNAL_LOG ]
            </h2>
            <div className="flex-1 mt-6 overflow-y-auto min-h-0 pr-2 scrollbar-thin">
              <div className="space-y-3 pb-16">
                {sessionHistory.map((item, i) => {
                  const q = item.question;
                  const correctText = q.options?.[q.answer.charCodeAt(0) - 65]?.split(') ')[1] || q.answer;
                  const userText = q.options?.[item.userAnswer.toUpperCase().charCodeAt(0) - 65]?.split(') ')[1] || item.userAnswer;
                  
                  return (
                    <div key={i} className={`border p-4 transition-colors ${
                      isCyberpunk 
                        ? (item.isCorrect ? "border-emerald-500/10 bg-emerald-500/5" : "border-red-500/10 bg-red-500/5") 
                        : (item.isCorrect ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-100" : "border-red-500/20 bg-red-500/5 text-red-100")
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold ${isCyberpunk ? "text-[#ff00ff]" : "text-neutral-500"}`}>
                          SIGNAL_ID: #{i + 1}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 border ${
                          item.isCorrect 
                            ? (isCyberpunk ? "border-emerald-500 text-emerald-400" : "border-emerald-500/30 text-emerald-400")
                            : (item.isSkip ? "border-yellow-500 text-yellow-400" : "border-red-500 text-red-400")
                        }`}>
                          {item.isCorrect ? 'SUCCESS' : item.isSkip ? 'BYPASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="text-xs font-mono mb-2">
                        Q: {q.prompt}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                        <div>
                          <span className="opacity-50 uppercase tracking-tighter">Your Entry:</span>
                          <div className={item.isCorrect ? "text-emerald-400" : (item.isSkip ? "text-yellow-400" : "text-red-400")}>
                            {item.isSkip ? '[ SKIPPED ]' : (userText || 'N/A')}
                          </div>
                        </div>
                        <div>
                          <span className="opacity-50 uppercase tracking-tighter">Correct Signal:</span>
                          <div className="text-cyan-400">{correctText}</div>
                        </div>
                      </div>
                      {!item.isCorrect && q.explanation && (
                        <div className={`mt-3 pt-3 border-t text-[10px] italic leading-relaxed ${isCyberpunk ? "border-white/5 text-emerald-500/60" : "text-neutral-500"}`}>
                          RATIONALE: {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Stage 2: Active Drill UI
  // Handled inline for better stability during transitions

  return (
    <div className={`flex-1 flex flex-col p-6 relative overflow-hidden border transition-colors ${
      isCyberpunk ? "bg-gray-950 border-emerald-500/20" : "bg-[#09090b] border-neutral-800"
    } ${overclock >= 100 ? 'overclock-fx' : ''}`}>
      {/* Stats overlay */}
      <div className="flex justify-between items-center mb-6 border-b border-emerald-500/20 pb-4 font-mono">
        <div className="flex gap-8">
          <div className="flex flex-col">
            <span className="text-[9px] text-emerald-500/50 uppercase">Score / XP</span>
            <span className="text-lg text-emerald-400 font-bold">{score.toString().padStart(5, '0')}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-cyan-500/50 uppercase">Combo</span>
            <span className={`text-lg font-bold ${combo > 0 ? 'text-cyan-400' : 'text-neutral-700'}`}>x{combo}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-fuchsia-500/50 uppercase">Sync Rate</span>
            <span className="text-lg text-fuchsia-400 font-bold">{totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100)}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-cyan-400 uppercase font-bold tracking-tighter">Current Rank</span>
            <span className={`text-lg font-bold uppercase ${
              rank === 'easy' ? 'text-emerald-400' : 
              rank === 'medium' ? 'text-cyan-400' : 
              rank === 'hard' ? 'text-yellow-400' : 'text-red-500'
            }`}>{rank}</span>
          </div>
        </div>

        <div className="flex-1 max-w-sm px-12 flex flex-col justify-center">
          <div className="flex justify-between mb-1">
            <span className="text-[8px] text-cyan-400 uppercase font-mono font-bold tracking-widest animate-pulse">
              SYNC STATUS: {timeLeft}s REMAINING
            </span>
            <span className={`text-[8px] uppercase font-mono tracking-widest ${isCyberpunk ? "text-cyan-500/50" : "text-neutral-600"}`}>LIMIT_120</span>
          </div>
          <div className={`h-6 w-full border-2 overflow-hidden relative ${
            isCyberpunk ? "bg-black/80 border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]" : "bg-black/40 border-neutral-800"
          }`}>
            {/* Neon background pulse */}
            <div className={`absolute inset-0 animate-pulse ${isCyberpunk ? "bg-cyan-950 opacity-20" : "bg-neutral-900 opacity-10"}`}></div>
            <div 
              className={`h-full transition-all duration-300 relative z-10 ${
                isCyberpunk ? "bg-cyan-400 shadow-[0_0_20px_#00ffff]" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, (timeLeft / 40) * 100)}%` }}
            >
              {/* Internal glow line */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-white/50 opacity-50"></div>
              {/* End flare */}
              <div className={`absolute top-0 right-0 h-full w-2 bg-white/40 blur-[2px] ${isCyberpunk ? "" : "hidden"}`}></div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="text-[8px] font-bold text-red-500 uppercase tracking-widest animate-pulse">Overclock Status</div>
          <div className="w-32 h-1.5 bg-gray-900 border border-neutral-800 relative">
            <div 
              className={`h-full transition-all duration-350 ${
                overclock >= 100 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-orange-500'
              }`}
              style={{ width: `${overclock}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2 relative">
          <button 
            onClick={() => setIsPaused(true)}
            className="text-[9px] text-emerald-500/50 hover:text-emerald-400 transition-colors uppercase tracking-widest px-2 py-1 border border-emerald-500/20 hover:border-emerald-400"
          >
            [ PAUSE ]
          </button>
          {onClose && (
            <button 
              onClick={() => setView('lobby')} 
              className="text-[9px] text-neutral-700 hover:text-red-500 transition-colors uppercase tracking-widest px-2 py-1 border border-neutral-800 hover:border-red-500/30"
              title="Return to Parameters"
            >
              [ EXIT ]
            </button>
          )}
        </div>
      </div>

      {/* Pause Overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 px-4">
          <div className={`max-w-xs w-full border p-8 text-center space-y-6 bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)] ${
            isCyberpunk ? "border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]" : "border-neutral-800"
          }`}>
            <h2 className="text-2xl font-bold hm-logo-text tracking-[0.2em] uppercase">System Paused</h2>
            <p className={`text-[10px] uppercase tracking-widest ${isCyberpunk ? "text-emerald-500/60" : "text-neutral-600"}`}>Simulation state frozen</p>
            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={() => setIsPaused(false)}
                className={`w-full py-2 border text-xs font-bold uppercase tracking-widest transition-all ${
                  isCyberpunk 
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-black"
                    : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500"
                }`}
              >
                RESUME
              </button>
              <button
                onClick={() => {
                  setIsPaused(false);
                  setView('lobby');
                }}
                className={`w-full py-2 border text-xs font-bold uppercase tracking-widest transition-all ${
                  isCyberpunk
                    ? "border-red-900/50 text-red-500 hover:bg-red-900/20 hover:border-red-500"
                    : "border-neutral-800 text-neutral-700 hover:text-red-900"
                }`}
              >
                ABORT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal View */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto mb-4 scrollbar-hide font-mono text-sm space-y-1"
      >
        {!currentQuestion ? (
          <div className="text-cyan-500 animate-pulse tracking-widest uppercase text-xs mt-4">{" >> "} SYSTEM: FETCHING NEXT DATABLOCK...</div>
        ) : (
          history.map((line, i) => (
            <div key={i} className="break-words">
              {line.type === "command" ? (
                <span className="text-emerald-500/70">{line.text}</span>
              ) : line.type === "error" ? (
                <span className="text-red-500 font-bold tracking-tighter">!! {line.text}</span>
              ) : line.type === "success" ? (
                <span className="text-emerald-400 font-bold shadow-[0_0_10px_rgba(52,211,153,0.3)]">++ {line.text}</span>
              ) : line.type === "system" ? (
                <span className="text-fuchsia-400/80 italic">{line.text}</span>
              ) : (
                <span className="text-emerald-500">{line.text}</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input / Control Area */}
      {mode === 'arcade' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-emerald-500/10 pt-6 animate-in slide-in-from-bottom-4 duration-500">
          {(['A', 'B', 'C', 'D'] as const).map((opt, i) => {
            const displayOptions = getFallbackOptions(currentQuestion);
            const optionText = displayOptions[i] ? displayOptions[i].split(') ')[1] : opt;
            
            return (
              <button
                key={opt}
                onClick={() => processAnswer(opt.toLowerCase())}
                className={`group relative flex flex-col items-center justify-center p-4 border transition-all duration-200 active:scale-95 h-24 overflow-hidden ${
                  isCyberpunk 
                    ? "border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-400" 
                    : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-600 hover:bg-neutral-800"
                }`}
              >
                <div className={`font-black mb-1 group-hover:scale-110 transition-transform text-center break-words px-1 w-full ${
                  isCyberpunk ? "text-cyan-400" : "text-neutral-400 group-hover:text-emerald-500"
                } ${
                  optionText.length > 20 ? 'text-[10px]' : 
                  optionText.length > 12 ? 'text-xs' : 'text-xl'
                }`}>
                  {optionText}
                </div>
                <div className={`absolute top-2 left-2 text-[8px] font-mono uppercase tracking-tighter ${
                  isCyberpunk ? "text-cyan-500/40" : "text-neutral-700"
                }`}>[{opt}] KEY</div>
                
                {/* Option label overlay if it's choice type */}
                {currentQuestion?.type === 'choice' && currentQuestion.options && (
                  <div className={`absolute top-0 right-0 -mt-2 -mr-2 bg-black border px-1 text-[8px] hidden group-hover:block transition-all ${
                    isCyberpunk ? "border-cyan-400 text-cyan-400" : "border-neutral-700 text-neutral-500"
                  }`}>
                    LOGGED
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={handleCommand} className={`flex items-center gap-2 border-t border-emerald-500/10 pt-4 ${isAccessDenied ? 'animate-shake' : ''}`}>
          <label className="text-emerald-500 font-mono text-sm shrink-0">
            {isCyberpunk ? '> ' : '$ '}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isTransitioning}
            className={`flex-1 bg-transparent border-none outline-none caret-emerald-500 font-mono text-sm focus:ring-0 p-0 ${
              isAccessDenied ? 'text-red-500' : 'text-emerald-500'
            }`}
            autoComplete="off"
            spellCheck="false"
            placeholder={isAccessDenied ? "ACCESS_DENIED" : (currentQuestion?.type === 'choice' ? "TYPE ANSWER IDENTIFIER (or 'skip')" : "ENTER MANUAL IDENTIFIER (or 'skip')")}
          />
        </form>
      )}

      {/* Logic Styles */}
      <style jsx>{`
        .animate-shake {
          animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          perspective: 1000px;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        .overclock-fx {
          filter: hue-rotate(${Math.sin(Date.now() / 100) * 20}deg) contrast(1.2);
          animation: glitch 0.3s steps(2) infinite;
        }
        @keyframes glitch {
          0% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
          100% { transform: translate(0); }
        }
      `}</style>
      
      {/* Universal Skip fallback for Arcade if needed, or just keep it simple */}
      {mode === "arcade" && (
        <div className="flex justify-center mt-3">
          <button
            onClick={() => processAnswer("skip")}
            className="font-mono text-[9px] text-neutral-600 hover:text-white transition-colors duration-200 uppercase tracking-[0.4em]"
          >
            [ BYPASS_QUERY ]
          </button>
        </div>
      )}
      
      {/* Background scanline effect */}
      {isCyberpunk && (
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      )}
    </div>
  );
}
