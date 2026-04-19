"use client";

import React from "react";
import { useTheme } from "./ThemeProvider";

interface InTheWildSimProps {
  headline?: string;
  onClose: () => void;
}

export default function InTheWildSim({ headline, onClose }: InTheWildSimProps) {
  const { isCyberpunk } = useTheme();


  return (
    <div className={`flex-1 flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in duration-500 min-h-[400px] ${isCyberpunk ? 'bg-[#080010]' : 'bg-neutral-900/20'
      }`}>
      <div className="text-center max-w-2xl">
        <div className={`text-[10px] font-bold uppercase tracking-[0.4em] mb-4 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-emerald-500'
          }`}>
          System Status: Analyzing Threat Intelligence
        </div>

        <h1 className="text-2xl font-bold hm-logo-text tracking-widest uppercase mb-6">
          In-the-Wild Simulation
        </h1>

        <div className={`p-8 border font-mono text-sm space-y-4 mb-8 ${isCyberpunk
            ? 'hm-border-cyan bg-[rgba(26,11,46,0.95)] shadow-[0_0_20px_rgba(0,212,255,0.1)]'
            : 'border-neutral-800 bg-neutral-950/80 rounded-2xl'
          }`}>
          <p className={isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-400'}>
            GENERATING SCENARIO BASED ON:
          </p>
          <p className={`text-lg font-bold ${isCyberpunk ? 'text-white' : 'text-neutral-100'}`}>
            "{headline || 'Generic Zero-Day Threat'}"
          </p>
          <div className="flex items-center justify-center gap-2 pt-4">
            <span className={`w-2 h-2 rounded-full animate-pulse ${isCyberpunk ? 'bg-[#ff00ff]' : 'bg-emerald-500'}`} />
            <span className={`text-[10px] uppercase tracking-tighter ${isCyberpunk ? 'text-[#9060d0]' : 'text-neutral-500'}`}>
              TTP Extraction in Progress...
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className={`px-12 py-3 border font-bold uppercase tracking-[0.2em] transition-all ${isCyberpunk
              ? 'border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff] hover:text-black shadow-[0_0_15px_rgba(255,0,255,0.2)]'
              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-xl'
            }`}
          className="text-[#9060d0]"
        >
          [ ABORT_SIMULATION ]
        </button>
      </div>

      {/* Decorative scanline overlay for consistency */}
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
    </div>
  );
}
