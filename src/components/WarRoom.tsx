'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { Scenario, scenarios } from '../lib/scenarioData';

interface WarRoomProps {
  onClose?: () => void;
  injectedScenario?: Scenario | null;
  onClearInjected?: () => void;
}

const BOOT_MESSAGES = [
  '>> ALLOCATING SECURE MEMORY... [OK]',
  '>> LOADING NIST SP 800-61 REV 2 PLAYBOOKS... [OK]',
  '>> INJECTING MITRE ATT&CK MATRIX... [OK]',
  '>> CONNECTING TO SOC MASTERMIND AI...',
];

const IR_PHASES = [
  'Preparation',
  'Detection',
  'Containment',
  'Eradication',
  'Recovery',
];



export default function WarRoom({ onClose, injectedScenario, onClearInjected }: WarRoomProps) {
  const { isCyberpunk } = useTheme();
  const router = useRouter();
  const abortController = useRef<AbortController | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [bootIndex, setBootIndex] = useState(0);
  const [displayedBootMessages, setDisplayedBootMessages] = useState<string[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  
  const [chatLog, setChatLog] = useState<{ role: 'dm' | 'analyst'; text: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentPhase, setCurrentPhase] = useState('Detection');
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [impact, setImpact] = useState(1);
  const [mitreTechnique, setMitreTechnique] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Character-by-character typewriter logic
  useEffect(() => {
    if (isInitializing) {
      if (bootIndex < BOOT_MESSAGES.length) {
        const fullMsg = BOOT_MESSAGES[bootIndex];
        if (charIndex < fullMsg.length) {
          const charTimer = setTimeout(() => {
            setCurrentMessage(prev => prev + fullMsg[charIndex]);
            setCharIndex(prev => prev + 1);
          }, 5); // Faster typing
          return () => clearTimeout(charTimer);
        } else {
          // Pause between messages
          const msgTimer = setTimeout(() => {
            setDisplayedBootMessages(prev => [...prev, fullMsg]);
            setCurrentMessage('');
            setCharIndex(0);
            setBootIndex(prev => prev + 1);
          }, 75);
          return () => clearTimeout(msgTimer);
        }
      } else {
        const finalizeTimer = setTimeout(() => {
          // Select random scenario or use injected one
          let scenarioToUse: Scenario;
          
          if (injectedScenario) {
            scenarioToUse = injectedScenario;
            // We keep it as is, but we might want to clear it from the parent later 
            // if we want 'New Simulation' to pick a random one
          } else {
            const randomIdx = Math.floor(Math.random() * scenarios.length);
            scenarioToUse = scenarios[randomIdx];
          }

          setActiveScenario(scenarioToUse);
          
          setIsInitializing(false);
          setChatLog([
            { 
              role: 'dm', 
              text: `>> SYSTEM: SECURE CONNECTION ESTABLISHED. INITIALIZING ${injectedScenario ? 'REAL-TIME ' : ''}INCIDENT RESPONSE SIMULATION...` 
            },
            {
              role: 'dm',
              text: scenarioToUse.initialAlert
            }
          ]);
        }, 125);
        return () => clearTimeout(finalizeTimer);
      }
    }
  }, [bootIndex, charIndex, isInitializing]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatLog, isInitializing]);

  // JSON Parser & State Updater
  const parseStateUpdate = (text: string) => {
    const regex = /\[STATE_UPDATE:\s*({[\s\S]*?})\]/;
    const match = text.match(regex);
    
    if (match) {
      try {
        const update = JSON.parse(match[1]);
        if (update.phase) setCurrentPhase(update.phase);
        if (update.impact) setImpact(update.impact);
        if (update.mitre_technique) setMitreTechnique(update.mitre_technique);
        
        // Remove the block from the text
        return text.replace(regex, '').trim();
      } catch (e) {
        console.error("Failed to parse state update:", e);
      }
    }
    return text;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeScenario || isLoading) return;

    const userMsg = { role: 'analyst' as const, text: inputValue };
    const newLog = [...chatLog, userMsg];
    setChatLog(newLog);
    
    // Update command history
    const newHistory = [...commandHistory, inputValue];
    setCommandHistory(newHistory);
    setHistoryIndex(newHistory.length);

    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    abortController.current?.abort();
    abortController.current = new AbortController();

    try {
      const response = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.current.signal,
        body: JSON.stringify({
          messages: newLog,
          scenarioContext: activeScenario.systemContext,
          isFalsePositive: activeScenario.isFalsePositive,
          currentPhase: currentPhase
        }),
      });

      if (!response.ok) throw new Error('API Request Failed');

      const data = await response.json();
      
      // Update state if the server provided a parsed block
      if (data.stateUpdate) {
        const update = data.stateUpdate;
        if (update.phase) setCurrentPhase(update.phase);
        if (update.impact) setImpact(update.impact);
        if (update.mitre_technique) setMitreTechnique(update.mitre_technique);
      }

      // Clean the text (strip [STATE_UPDATE: ...])
      const cleanedMessage = parseStateUpdate(data.text);
      setChatLog(prev => [...prev, { role: 'dm', text: cleanedMessage }]);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("DM Error:", err);
      setChatLog(prev => [...prev, { 
        role: 'dm', 
        text: '>> [SYSTEM ERROR]: CONNECTION TO SIMULATION ENGINE LOST. RETRY COMMAND.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSimulation = () => {
    if (onClearInjected) onClearInjected();
    
    let nextScenario: Scenario;
    if (scenarios.length >= 2) {
      let currentIndex = scenarios.findIndex(s => s.id === activeScenario?.id);
      let newIndex = currentIndex;
      
      while (newIndex === currentIndex) {
        newIndex = Math.floor(Math.random() * scenarios.length);
      }
      nextScenario = scenarios[newIndex];
    } else {
      nextScenario = scenarios[0];
    }
    
    // Reset simulation state
    setActiveScenario(nextScenario);
    setCurrentPhase('Detection');
    setImpact(1);
    setMitreTechnique(null);
    setChatLog([
      { 
        role: 'dm', 
        text: '>> SYSTEM: SIMULATION RESET. INITIALIZING NEW INCIDENT RESPONSE SCENARIO...' 
      },
      {
        role: 'dm',
        text: nextScenario.initialAlert
      }
    ]);
  };

  if (isInitializing) {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-8 bg-[#060010] text-[#00ffff] font-mono`}>
        <div className="max-w-xl w-full space-y-4">
          {displayedBootMessages.map((msg, i) => (
            <div key={i} className={`text-lg animate-in fade-in slide-in-from-left-4 duration-300 ${
              isCyberpunk ? 'hm-logo-text' : 'text-emerald-500'
            }`} style={isCyberpunk ? { textShadow: '0 0 10px rgba(0, 255, 255, 0.5)' } : {}}>
              {msg}
            </div>
          ))}
          {currentMessage && (
            <div className={`text-lg transition-all ${
              isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-400'
            }`} style={isCyberpunk ? { textShadow: '0 0 10px rgba(0, 255, 255, 0.8)' } : {}}>
              {currentMessage}
              <span className="animate-pulse ml-1">_</span>
            </div>
          )}
          {bootIndex === BOOT_MESSAGES.length && (
            <div className="mt-8 flex items-center gap-2">
              <div className="w-2 h-2 bg-[#ff00ff] animate-ping" />
              <span className="text-xs uppercase tracking-[0.2em] text-[#ff00ff]">Establishing Neural link...</span>
            </div>
          )}
        </div>
        
        {/* Scanlines for the boot sequence */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-row overflow-hidden ${
      isCyberpunk ? 'text-[#00ffff]' : 'text-neutral-200'
    }`}>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#ff00ff]/20">
        {/* Terminal Header */}
        <div className={`h-10 shrink-0 flex items-center px-4 justify-between border-b border-[#ff00ff]/20 ${
          isCyberpunk ? 'bg-[rgba(12,0,28,0.97)]' : 'bg-neutral-900/40'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-bold opacity-70">Valhöll Session: Alpha-01</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleNewSimulation}
              className={`text-[9px] uppercase tracking-tighter transition-colors ${
                isCyberpunk ? 'hover:text-[#00ffff] text-[#00ffff]/60' : 'hover:text-emerald-500 text-neutral-400'
              }`}
            >
              [ NEW SIMULATION ]
            </button>
            <button 
              onClick={() => {
                try {
                  // 1. Abort background requests
                  abortController.current?.abort();

                  // 2. Kill active data
                  setActiveScenario(null);
                  setChatLog([]);
                  setCommandHistory([]);
                  
                  // 3. Reset UI flags
                  setIsLoading(false);
                  setIsInitializing(true); // reset boot sequence just in case
                  
                  // 4. Reset internal tracking metrics
                  setCurrentPhase('Detection');
                  setImpact(1);
                  setMitreTechnique(null);
                  setBootIndex(0);
                  setDisplayedBootMessages([]);
                  setCurrentMessage('');
                  setCharIndex(0);

                  // 5. Force parent events and perform smooth router push
                  if (onClearInjected) onClearInjected();
                  if (onClose) onClose();
                  router.push('/dashboard');
                } catch (error) {
                  console.error("Failed to disconnect cleanly:", error);
                }
              }}
              className="text-[9px] uppercase tracking-tighter hover:text-[#ff00ff] transition-colors"
            >
              [ DISCONNECT ]
            </button>
          </div>
        </div>

        {/* Chat Log */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm scrollbar-hide"
        >
          {chatLog.map((entry, i) => (
            <div key={i} className={`flex flex-col ${entry.role === 'analyst' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-lg ${
                entry.role === 'analyst' 
                  ? (isCyberpunk ? 'bg-[#ff00ff]/10 border border-[#ff00ff]/30 text-[#e8d5ff]' : 'bg-blue-900/20 border border-blue-500/30 text-blue-100')
                  : (isCyberpunk ? 'bg-[#00ffff]/5 border border-[#00ffff]/20 text-[#00ffff]' : 'bg-neutral-800/40 border border-neutral-700 text-neutral-300')
              }`}>
                <div className="text-[10px] uppercase font-bold mb-1 opacity-50">
                  {entry.role === 'dm' ? 'System Console' : 'Analyst'}
                </div>
                <div className="whitespace-pre-wrap">{entry.text}</div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex flex-col items-start">
              <div className={`max-w-[85%] p-3 rounded-lg ${
                isCyberpunk ? 'bg-[#00ffff]/5 border border-[#00ffff]/20 text-[#00ffff]' : 'bg-neutral-800/40 border border-neutral-700 text-neutral-300'
              }`}>
                <div className="text-[10px] uppercase font-bold mb-1 opacity-50">System Console</div>
                <div className="font-mono flex items-center">
                  {">> "}SYSTEM: AWAITING SIMULATION ENGINE<span className="animate-pulse ml-0.5">...</span>
                  <span className="w-2 h-4 bg-[#00ffff] ml-1 animate-pulse" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Command Input Area */}
        <form 
          onSubmit={handleSubmit}
          className={`p-3 border-t border-[#ff00ff]/20 ${
            isCyberpunk ? 'bg-[rgba(12,0,28,0.97)]' : 'bg-neutral-900/80'
          }`}
        >
          <div className="relative flex items-center">
            <span className={`absolute left-3 font-mono font-bold text-sm select-none ${isCyberpunk ? 'text-[#ff00ff]' : 'text-emerald-500'}`}>
              {'>_'}
            </span>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Auto-resize logic
                const target = e.target;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                } else if (e.key === 'ArrowUp') {
                  if (historyIndex > 0) {
                    e.preventDefault();
                    const newIndex = historyIndex - 1;
                    setHistoryIndex(newIndex);
                    setInputValue(commandHistory[newIndex]);
                  }
                } else if (e.key === 'ArrowDown') {
                  if (historyIndex < commandHistory.length - 1) {
                    e.preventDefault();
                    const newIndex = historyIndex + 1;
                    setHistoryIndex(newIndex);
                    setInputValue(commandHistory[newIndex]);
                  } else if (historyIndex === commandHistory.length - 1) {
                    e.preventDefault();
                    setHistoryIndex(commandHistory.length);
                    setInputValue('');
                  }
                }
              }}
              placeholder=">> ENTER COMMAND OR ESCALATE..."
              className={`w-full pl-10 pr-4 py-2 text-sm font-mono focus:outline-none transition-all border shadow-inner resize-none max-h-32 overflow-y-auto ${
                isCyberpunk
                  ? 'bg-transparent text-[#00ffff] border-[#ff00ff]/40 placeholder-[#4a2070] focus:border-[#ff00ff]'
                  : 'bg-neutral-950 border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:border-emerald-500/50'
              }`}
            />
          </div>
        </form>
      </div>

      {/* Right Sidebar - NIST IR Phases */}
      <div className={`hidden md:flex w-64 flex-col p-4 gap-4 shrink-0 ${
        isCyberpunk ? 'bg-[rgba(12,0,28,0.97)]' : 'bg-neutral-900/20'
      }`}>
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase border-b border-[#00ffff]/20 pb-2 mb-2">
          Valhöll Phase Tracker
        </div>
        <div className="space-y-4">
          {IR_PHASES.map((phase) => {
            const isActive = currentPhase === phase;
            return (
              <div 
                key={phase}
                className={`p-3 border transition-all relative overflow-hidden ${
                  isActive 
                    ? (isCyberpunk ? 'border-[#ff00ff] bg-[#ff00ff]/10 shadow-[0_0_15px_rgba(255,0,255,0.1)]' : 'border-emerald-500 bg-emerald-500/10')
                    : (isCyberpunk ? 'border-[#00ffff]/10 bg-transparent opacity-40 hover:opacity-100' : 'border-neutral-800 bg-neutral-900/40 opacity-40')
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 right-0 p-1">
                    <span className="flex h-1.5 w-1.5 bg-[#ff00ff] rounded-full animate-ping" />
                  </div>
                )}
                <div className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-white' : 'text-neutral-500'}`}>
                  {phase}
                </div>
                <div className={`text-[9px] mt-1 font-mono ${isActive ? 'text-emerald-400' : 'text-neutral-600'}`}>
                  {isActive ? 'STATUS: IN_PROGRESS' : 'STATUS: PENDING'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Impact Meter */}
        <div className="mt-4 p-3 border border-[#ff00ff]/20 bg-black/40">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3">Impact Severity</div>
          <div className="flex gap-1 h-2">
            {[...Array(10)].map((_, i) => {
              const level = i + 1;
              const isActive = level <= impact;
              let color = 'bg-neutral-800';
              if (isActive) {
                if (level <= 3) color = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
                else if (level <= 7) color = 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]';
                else color = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
              }
              return <div key={i} className={`flex-1 ${color} transition-all duration-500`} />;
            })}
          </div>
          <div className="flex justify-between mt-2 text-[8px] font-mono opacity-50 uppercase tracking-tighter">
            <span>Low</span>
            <span className={impact > 7 ? 'text-red-500 font-bold' : ''}>{impact}/10</span>
            <span>High</span>
          </div>
        </div>

        {/* MITRE Technique */}
        {mitreTechnique && (
          <div className="mt-4 p-3 border border-[#00ffff]/20 bg-[#00ffff]/5 animate-in zoom-in-95 duration-300">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-[#00ffff]">MITRE Technique</div>
            <div className="text-sm font-mono font-bold tracking-tighter">{mitreTechnique}</div>
          </div>
        )}

        {/* NIST Quick Reference */}
        <div className="mt-auto p-3 border border-[#00ffff]/10 bg-black/20 rounded">
          <div className="text-[8px] uppercase tracking-widest text-[#9060d0] mb-2">NIST SP 800-61 R2</div>
          <p className="text-[9px] leading-relaxed text-[#00ffff]/60 font-mono">
            "Preparation is key. Ensure all tools and contacts are validated before escalation."
          </p>
        </div>
      </div>

      {/* Scanline Effect Overlay (Global within component) */}
      {isCyberpunk && (
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      )}
    </div>
  );
}
