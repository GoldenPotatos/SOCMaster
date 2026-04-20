'use client';

import { useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import RapidFireDrill from '@/components/RapidFireDrill';
import InTheWildSim from '@/components/InTheWildSim';
import WarRoom from '@/components/WarRoom';
import CICenter from '@/components/CICenter';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const [activeTab, setActiveTab] = useState('in-the-wild');
  const [injectedScenario, setInjectedScenario] = useState<any>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // CICenter lifted state — controlled from the header bar (Frame 13)
  const [ciActiveTab, setCiActiveTab] = useState<'feed' | 'assistant'>('feed');
  const [showSettings, setShowSettings] = useState(false);
  const [sensorsCount, setSensorsCount] = useState(0);
  const handleSensorsCountChange = useCallback((count: number) => setSensorsCount(count), []);
  
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
    { 
      id: 'in-the-wild', 
      label: 'Mimir (intel center)', 
      badge: 'FLAGSHIP', 
      desc: "Defended against today’s real-world attack TTPs.",
      badgeBg: 'bg-[#9500ff]/10',
      badgeBorder: 'border-[#9500ff]/50',
      badgeText: 'text-[#AD85FF]'
    },
    { 
      id: 'war-room', 
      label: 'Valhöll (war room)', 
      badge: 'CORE MODE', 
      desc: "Investigate a live alert using your org's playbooks.",
      badgeBg: 'bg-[#ff00ff]/10',
      badgeBorder: 'border-[#ff00ff]/50',
      badgeText: 'text-[#ffb3ff]'
    },
    { 
      id: 'drill', 
      label: 'Ragnarök (quick drill)', 
      badge: 'QUICK XP', 
      desc: 'Timed trivia — ports, Event IDs, Linux commands.',
      badgeBg: 'bg-[#fcee0a]/10',
      badgeBorder: 'border-[#fcee0a]/50',
      badgeText: 'text-[#fdf685]'
    },
  ];

  return (
    <div className="h-full flex flex-row overflow-hidden bg-[#0F0F0F] p-6 gap-4 font-sans text-white">
      {/* Sidebar Navigation */}
      <nav className={`transition-all duration-300 ease-in-out shrink-0 flex flex-col bg-white/[0.01] border border-white/10 rounded-[20px] relative ${
        isSidebarExpanded ? 'w-full max-w-[427px] p-4 lg:py-4 lg:px-6' : 'w-[80px] p-2 items-center'
      }`}>
        <div className="flex items-center justify-between w-full mb-4">
          {isSidebarExpanded && (
            <div className="text-[12px] text-white/35 font-orbitron uppercase tracking-widest pl-2">
              Operations Hub
            </div>
          )}
          <button 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="p-1 rounded-md hover:bg-white/10 text-white/50 transition-colors"
            title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isSidebarExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              )}
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto w-full">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`group flex flex-col text-left transition-all border outline-none ${
                isSidebarExpanded ? 'h-[102px] p-4 rounded-[10px]' : 'h-[60px] w-full items-center justify-center rounded-lg p-2'
              } ${
                activeTab === item.id
                  ? 'bg-white/5 border-white/20'
                  : 'border-white/10 bg-transparent hover:bg-white/5'
              }`}
            >
              {isSidebarExpanded ? (
                <div className="flex flex-col gap-2 w-full h-full justify-between">
                  <div className="flex justify-between items-start w-full">
                    <div className={`px-3 py-0.5 rounded-[5px] border ${item.badgeBg} ${item.badgeBorder}`}>
                      <span className={`text-[12px] font-roboto font-medium ${item.badgeText}`}>
                        {item.badge}
                      </span>
                    </div>
                    <h3 className="text-[16px] font-orbitron font-semibold text-white">
                      {item.label}
                    </h3>
                  </div>
                  <p className="text-[14px] font-roboto text-white">
                    {item.desc}
                  </p>
                </div>
              ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center border ${item.badgeBorder} rounded-lg ${item.badgeBg}`}>
                  <span className={`text-[8px] font-roboto font-bold ${item.badgeText} text-center`}>
                    {item.badge.split(' ')[0]}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content Area */}
      <div className="flex-1 flex flex-col overflow-hidden gap-4 min-w-0">
        {/* Top Header - Frame 11 */}
        <div className="h-[144px] shrink-0 flex flex-col border border-white/10 rounded-[20px] overflow-hidden">
          {/* Top Section - Frame 12 */}
          <div className="h-[80px] bg-white/[0.07] border-b border-white/10 relative flex items-center px-6">
            <h2 className="text-[24px] font-orbitron font-semibold text-white">
              {activeTab === 'in-the-wild' ? 'Mímir (intel center)' : 
               activeTab === 'war-room' ? 'Valhöll (war room)' : 
               activeTab === 'drill' ? 'Ragnarök (quick drill)' : 'Command & Operational Hub'}
            </h2>
            <div className="absolute right-8 w-3 h-3 bg-[#00FF67] rounded-full shadow-[0_0_20.8px_0_rgba(0,255,103,1)]"></div>
          </div>
          
          {/* Bottom Section - Frame 13 (Tabs + Controls) */}
          <div className="h-[64px] bg-white/5 flex items-center justify-between px-6">
            {/* Left: Himinbjörg / Heimdall tab switchers — only visible when on Mímir module */}
            <div className="flex items-center gap-5">
              {activeTab === 'in-the-wild' ? (
                <>
                  <button
                    onClick={() => { setCiActiveTab('feed'); setShowSettings(false); }}
                    className={`text-[18px] font-orbitron font-semibold transition-all duration-200 relative group ${
                      ciActiveTab === 'feed'
                        ? 'text-[#D8FE52] drop-shadow-[0_2px_16px_rgba(216,254,82,0.34)]'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Himinbjörg
                    {ciActiveTab === 'feed' && (
                      <span className="absolute -bottom-[22px] left-0 w-full h-[2px] bg-[#D8FE52] rounded-full shadow-[0_0_8px_rgba(216,254,82,0.6)]" />
                    )}
                  </button>
                  <button
                    onClick={() => { setCiActiveTab('assistant'); setShowSettings(false); }}
                    className={`text-[16px] font-orbitron transition-all duration-200 relative ${
                      ciActiveTab === 'assistant'
                        ? 'text-[#D8FE52] drop-shadow-[0_2px_16px_rgba(216,254,82,0.34)]'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Heimdall
                    {ciActiveTab === 'assistant' && (
                      <span className="absolute -bottom-[22px] left-0 w-full h-[2px] bg-[#D8FE52] rounded-full shadow-[0_0_8px_rgba(216,254,82,0.6)]" />
                    )}
                  </button>
                </>
              ) : (
                <span className="text-[16px] font-orbitron text-white/30 uppercase tracking-widest">
                  {activeTab === 'war-room' ? 'Valhöll' : activeTab === 'drill' ? 'Ragnarök' : ''}
                </span>
              )}
            </div>

            {/* Right: Manage Sources + Sensors count — only visible on Mímir + Himinbjörg feed */}
            <div className="flex items-center gap-4">
              {activeTab === 'in-the-wild' && ciActiveTab === 'feed' && (
                <>
                  <button
                    onClick={() => setShowSettings(v => !v)}
                    className={`flex items-center gap-2.5 border rounded-[10px] px-3 py-1 transition-all duration-200 ${
                      showSettings
                        ? 'border-[#D8FE52]/50 bg-[#D8FE52]/5 text-[#D8FE52]'
                        : 'border-white/10 hover:border-white/25 hover:bg-white/5 text-white/50 hover:text-white/80'
                    }`}
                  >
                    <span className="text-[14px] font-roboto">
                      {showSettings ? 'Close Settings' : 'Manage Sources'}
                    </span>
                    <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13.3333 5.5L18.3333 10.5L13.3333 15.5" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6.66667 5.5L1.66667 10.5L6.66667 15.5" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M11.6667 3.83331L8.33333 17.1666" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <span className="text-[14px] font-roboto text-white/35 whitespace-nowrap">
                    Sensors: <span className="text-white/60 font-semibold">{sensorsCount}</span> Active
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-hidden flex flex-col rounded-[20px]">
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
            <CICenter
              showSettings={showSettings}
              setShowSettings={setShowSettings}
              ciActiveTab={ciActiveTab}
              setCiActiveTab={setCiActiveTab}
              onSensorsCountChange={handleSensorsCountChange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
