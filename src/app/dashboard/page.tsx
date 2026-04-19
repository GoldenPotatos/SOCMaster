'use client';

import { useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import RapidFireDrill from '@/components/RapidFireDrill';
import InTheWildSim from '@/components/InTheWildSim';
import WarRoom from '@/components/WarRoom';
import CICenter from '@/components/CICenter';





export default function DashboardPage() {
  const { isCyberpunk } = useTheme();
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const [activeTab, setActiveTab] = useState('in-the-wild');
  const [injectedScenario, setInjectedScenario] = useState<any>(null);
  
  const activeModule = searchParams.get('module');
  const headline = searchParams.get('headline');

  const setModule = (module: string | null, headline?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (module) {
      params.set('module', module);
      if (headline) params.set('headline', headline);
    } else {
      params.delete('module');
      params.delete('headline');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const navItems = [
    { id: 'in-the-wild', label: 'Mímir (intel center)', badge: 'Flagship', desc: "Defend against today's real-world attack TTPs.", borderCls: 'hm-border-cyan', hoverBg: 'rgba(0,212,255,0.07)', badgeColor: '#00ffff' },
    { id: 'war-room', label: 'Valhöll (war room)', badge: 'Core Mode', desc: "Investigate a live alert using your org's playbooks.", borderCls: 'hm-border-magenta', hoverBg: 'rgba(255,0,255,0.07)', badgeColor: '#ff00ff' },
    { id: 'drill', label: 'Ragnarök (quick drill)', badge: 'Quick XP', desc: 'Timed trivia — ports, Event IDs, Linux commands.', borderCls: 'hm-border-yellow', hoverBg: 'rgba(252,238,10,0.07)', badgeColor: '#fcee0a' },
  ];

  return (
    <div className="h-full flex flex-row overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className={`w-64 hidden lg:flex flex-col p-4 gap-3 overflow-y-auto shrink-0 z-10 ${
        isCyberpunk
          ? 'bg-[rgba(12,0,28,0.97)] border-r border-[#ff00ff]/20'
          : 'border-r border-neutral-800 bg-neutral-900/20'
      }`}>
        <div className={`text-[9px] font-bold tracking-widest uppercase mb-1 ${isCyberpunk ? 'text-[#9060d0]' : 'text-neutral-500'}`}>
          Operations Hub
        </div>

        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`group text-left p-3 relative transition-all border outline-none ${
              activeTab === item.id
                ? (isCyberpunk ? `${item.borderCls} bg-[rgba(255,0,255,0.05)]` : 'border-emerald-500 bg-emerald-500/5')
                : (isCyberpunk ? 'border-transparent bg-transparent hover:bg-white/5' : 'border-neutral-800 bg-transparent hover:bg-neutral-800/40 rounded-xl')
            } ${!isCyberpunk && 'rounded-xl'}`}
          >
            <div className="absolute top-0 right-0 p-1.5">
              <span className="text-[8px] uppercase font-bold tracking-wider px-1 py-0.5"
                style={isCyberpunk ? { border: `1px solid ${item.badgeColor}`, color: item.badgeColor } : {
                  background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '3px'
                }}>
                {item.badge}
              </span>
            </div>
            <h3 className="text-[10px] font-bold mb-1 pr-16 text-[#e8d5ff]"
              style={!isCyberpunk ? { color: '#e5e5e5', fontSize: '13px', fontWeight: 600 } : {}}>
              {item.label}
            </h3>
            <p className={`text-[11px] leading-relaxed ${isCyberpunk ? 'text-[#9060d0] font-mono' : 'text-neutral-400'}`}>
              {item.desc}
            </p>
          </button>
        ))}
      </nav>

      {/* Main content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden min-h-0 ${
        isCyberpunk
          ? 'bg-[rgba(26,11,46,0.95)]'
          : 'border border-neutral-800 rounded-r-2xl bg-neutral-900/40 backdrop-blur-md shadow-2xl'
      }`}>

        {/* Header bar */}
        <div className={`h-11 shrink-0 flex items-center px-4 justify-between ${
          isCyberpunk
            ? 'border-b border-[#ff00ff]/30 bg-[rgba(12,0,28,0.97)]'
            : 'border-b border-neutral-800 bg-neutral-800/30'
        }`}>
          <div className="flex items-center gap-2">
            <svg className={`w-3.5 h-3.5 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#e8d5ff]' : 'text-neutral-200'}`}>
              {activeTab === 'in-the-wild' ? 'Mímir (intel center)' : 
               activeTab === 'war-room' ? 'Valhöll (war room)' : 
               activeTab === 'drill' ? 'Ragnarök (quick drill)' : 'Command & Operational Hub'}
            </h2>
          </div>
          <span className={`w-2 h-2 ${isCyberpunk ? 'bg-[#ff00ff]' : 'rounded-full bg-emerald-500'}`} />
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeModule === 'wild' ? (
            <InTheWildSim headline={headline || undefined} onClose={() => setModule(null)} />
          ) : activeTab === 'drill' ? (
            <RapidFireDrill onClose={() => setActiveTab('in-the-wild')} />
          ) : activeTab === 'war-room' ? (
            <WarRoom 
              onClose={() => setActiveTab('in-the-wild')} 
              injectedScenario={injectedScenario} 
              onClearInjected={() => setInjectedScenario(null)}
            />
          ) : activeTab === 'in-the-wild' ? (
            <CICenter />
          ) : null}
        </div>
      </div>
    </div>
  );
}
