'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeProvider';
import { AVAILABLE_SOURCES, NewsItem } from '@/lib/rssFetcher';
import { Scenario } from '../lib/scenarioData';

interface CICenterProps {
  onInitializeSimulation?: (headline: string, scenario?: any) => void;
}



export default function CICenter({ onInitializeSimulation }: CICenterProps) {
  const { isCyberpunk } = useTheme();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'feed' | 'assistant'>('feed');

  // Chat History / Arrow Keys
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Settings / Source Toggles
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [customSources, setCustomSources] = useState<{ id: string; name: string; url: string }[]>([]);
  const [isSimulatingId, setIsSimulatingId] = useState<string | null>(null);
  
  // Custom Source Form State
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');

  // News Feed
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, number>>({});
  const [isFeedLoading, setIsFeedLoading] = useState(true);

  // AI Intel per article
  const [articleIntel, setArticleIntel] = useState<Record<string, string>>({});
  const [intelLoading, setIntelLoading] = useState<Record<string, boolean>>({});
  const [intelErrors, setIntelErrors] = useState<Record<string, boolean>>({});
  
  // Chat / Analyst
  const [terminalInput, setTerminalInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'analyst' | 'user'; text: string }[]>([]);
  const [isAnalystLoading, setIsAnalystLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // In-the-Wild Simulation State
  const [activeSimArticle, setActiveSimArticle] = useState<Scenario | null>(null);
  const [activeSimArticleUrl, setActiveSimArticleUrl] = useState<string>('');
  const [simChatLog, setSimChatLog] = useState<{ role: 'dm' | 'analyst'; text: string }[]>([]);
  const [simInput, setSimInput] = useState('');
  const [isSimLoading, setIsSimLoading] = useState(false);
  const simScrollRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const simAbortController = useRef<AbortController | null>(null);

  // Load sources from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ci_selected_sources');
    const savedCustom = localStorage.getItem('ci_custom_sources');
    
    if (saved) {
      try {
        setSelectedSources(JSON.parse(saved));
      } catch (e) {
        setSelectedSources(AVAILABLE_SOURCES.map(s => s.id));
      }
    } else {
      setSelectedSources(AVAILABLE_SOURCES.map(s => s.id));
    }

    if (savedCustom) {
      try {
        setCustomSources(JSON.parse(savedCustom));
      } catch (e) {
        setCustomSources([]);
      }
    }
  }, []);

  // Save sources to localStorage
  useEffect(() => {
    if (selectedSources.length > 0) {
      localStorage.setItem('ci_selected_sources', JSON.stringify(selectedSources));
    }
    localStorage.setItem('ci_custom_sources', JSON.stringify(customSources));
    fetchNews();
  }, [selectedSources, customSources]);

  const fetchNews = async () => {
    setIsFeedLoading(true);
    try {
      const sourcesQuery = selectedSources.join(',');
      const customQuery = encodeURIComponent(JSON.stringify(customSources));
      const response = await fetch(`/api/news?sources=${sourcesQuery}&customSources=${customQuery}`);
      if (!response.ok) throw new Error('Failed to fetch from proxy');
      const data = await response.json();
      setNews(data.items || []);
      setSourceStatuses(data.sourceStatuses || {});
    } catch (err) {
      console.error("Failed to fetch news:", err);
    } finally {
      setIsFeedLoading(false);
    }
  };

  const handleToggleSource = (id: string) => {
    setSelectedSources(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleAddCustomSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;

    let url = newSourceUrl.trim();
    // Auto-detect Reddit shorthand
    if (url.toLowerCase().startsWith('r/')) {
      url = `reddit:${url.slice(2)}`;
    } else if (url.includes('reddit.com/r/')) {
      const match = url.match(/\/r\/([^/]+)/);
      if (match) url = `reddit:${match[1]}`;
    }

    const newId = `custom_${Math.random().toString(36).substr(2, 9)}`;
    const newSource = { id: newId, name: newSourceName.trim(), url };
    
    setCustomSources(prev => [...prev, newSource]);
    setSelectedSources(prev => [...prev, newId]);
    setNewSourceName('');
    setNewSourceUrl('');
  };

  const handleRemoveCustomSource = (id: string) => {
    setCustomSources(prev => prev.filter(s => s.id !== id));
    setSelectedSources(prev => prev.filter(s => s !== id));
  };

  const handleGenerateIntel = async (article: NewsItem) => {
    if (intelLoading[article.id] || articleIntel[article.id]) return;
    setIntelLoading(prev => ({ ...prev, [article.id]: true }));
    setIntelErrors(prev => ({ ...prev, [article.id]: false }));
    try {
      const response = await fetch('/api/intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: article.title, url: article.link }),
      });
      if (!response.ok) throw new Error('Intel API failed');
      const data = await response.json();
      setArticleIntel(prev => ({ ...prev, [article.id]: data.text }));
    } catch (err) {
      console.error("Intel Error:", err);
      setIntelErrors(prev => ({ ...prev, [article.id]: true }));
    } finally {
      setIntelLoading(prev => ({ ...prev, [article.id]: false }));
    }
  };

  const handleSimulate = async (article: NewsItem) => {
    setIsSimulatingId(article.id);
    setActiveSimArticleUrl(article.link);
    simAbortController.current?.abort();
    simAbortController.current = new AbortController();
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: simAbortController.current.signal,
        body: JSON.stringify({
          title: article.title,
          summary: article.summary,
          url: article.link
        }),
      });
      
      if (!response.ok) throw new Error('Failed to generate simulation');
      
      const scenario: Scenario = await response.json();
      setActiveSimArticle(scenario);
      setSimChatLog([]);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Simulation error:", err);
    } finally {
      setIsSimulatingId(null);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim() || isAnalystLoading) return;

    const userMsg = { role: 'user' as const, text: terminalInput };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    
    // Add to command history
    const newCmdHistory = [...commandHistory, terminalInput];
    setCommandHistory(newCmdHistory);
    setHistoryIndex(newCmdHistory.length);

    setTerminalInput('');
    setIsAnalystLoading(true);

    // Auto-switch to Assistant tab if not already there
    if (activeTab !== 'assistant') {
      setActiveTab('assistant');
    }

    try {
      const response = await fetch('/api/ci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          selectedSources,
          chatHistory: newHistory
        }),
      });

      if (!response.ok) throw new Error('Intelligence Database Offline');

      const data = await response.json();
      setChatHistory(prev => [...prev, { role: 'analyst', text: data.text }]);
    } catch (err) {
      console.error("Analyst Error:", err);
      setChatHistory(prev => [...prev, { 
        role: 'analyst', 
        text: '>> [SYSTEM ERROR]: INTELLIGENCE DATABASE OFFLINE. RETRY QUERY.' 
      }]);
    } finally {
      setIsAnalystLoading(false);
    }
  };

  const handleSimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simInput.trim() || !activeSimArticle || isSimLoading) return;

    const userMsg = { role: 'analyst' as const, text: simInput };
    const newLog = [...simChatLog, userMsg];
    setSimChatLog(newLog);
    setSimInput('');
    setIsSimLoading(true);

    simAbortController.current?.abort();
    simAbortController.current = new AbortController();

    try {
      const response = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: simAbortController.current.signal,
        body: JSON.stringify({
          messages: newLog,
          scenarioContext: activeSimArticle.systemContext,
          isFalsePositive: activeSimArticle.isFalsePositive,
          currentPhase: 'Detection'
        }),
      });

      if (!response.ok) throw new Error('API Request Failed');

      const data = await response.json();
      const cleanedMessage = data.text.replace(/\[STATE_UPDATE:\s*({[\s\S]*?})\]/, '').trim();
      setSimChatLog(prev => [...prev, { role: 'dm', text: cleanedMessage }]);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Sim Error:", err);
      setSimChatLog(prev => [...prev, { 
        role: 'dm', 
        text: '>> [SYSTEM ERROR]: SIMULATION CONNECTION LOST.' 
      }]);
    } finally {
      setIsSimLoading(false);
    }
  };

  // Auto-scroll analyst chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Auto-scroll simulation chat
  useEffect(() => {
    if (simScrollRef.current) {
      simScrollRef.current.scrollTop = simScrollRef.current.scrollHeight;
    }
  }, [simChatLog]);

  // Trigger Gemini API on mount for the inline simulation
  useEffect(() => {
    if (activeSimArticle && simChatLog.length === 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      const initialLogs = [
        { role: 'dm' as const, text: `>> SYSTEM: SECURE CONNECTION ESTABLISHED. INITIALIZING REAL-TIME INCIDENT RESPONSE SIMULATION...` },
        { role: 'dm' as const, text: activeSimArticle.initialAlert }
      ];
      setSimChatLog(initialLogs);
      setIsSimLoading(true);

      const triggerPayload = [...initialLogs, { role: 'analyst', text: 'Initialize incident response protocol and provide immediate situation report.' }];

      simAbortController.current?.abort();
      simAbortController.current = new AbortController();

      fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: simAbortController.current.signal,
        body: JSON.stringify({
          messages: triggerPayload,
          scenarioContext: activeSimArticle.systemContext,
          isFalsePositive: activeSimArticle.isFalsePositive,
          currentPhase: 'Detection'
        }),
      }).then(res => res.json()).then(data => {
        const cleanedMessage = data.text.replace(/\[STATE_UPDATE:\s*({[\s\S]*?})\]/, '').trim();
        setSimChatLog(prev => [...prev, { role: 'dm', text: cleanedMessage }]);
      }).catch(err => {
        if (err.name === 'AbortError') return;
        console.error("Auto trigger error:", err);
      }).finally(() => {
        setIsSimLoading(false);
      });
    }
  }, [activeSimArticle, simChatLog.length]);


  // ── SIMULATION VIEW ──────────────────────────────────────────────────────────
  if (activeSimArticle) {
    return (
      <div className="flex flex-col h-full w-full">
        {/* Retro Terminal Header */}
        <div className={`p-4 flex items-center justify-between border-b ${
          isCyberpunk ? 'border-[#ff00ff]/30 bg-[rgba(12,0,28,0.97)]' : 'border-neutral-800 bg-neutral-900'
        }`}>
          <div className="flex items-center gap-2">
             <span className={`text-[12px] uppercase font-bold tracking-[0.2em] animate-pulse ${
               isCyberpunk ? 'text-[#ff00ff]' : 'text-emerald-500'
             }`}>{'>_'} IN-THE-WILD SIMULATION INITIALIZED</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Read Source button */}
            {activeSimArticleUrl && (
              <a
                href={activeSimArticleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-[9px] uppercase font-bold tracking-widest px-4 py-1.5 border transition-all ${
                  isCyberpunk
                    ? 'border-[#00ffff]/40 text-[#00ffff]/70 hover:text-[#00ffff] hover:border-[#00ffff]'
                    : 'border-neutral-700 text-neutral-400 hover:bg-neutral-700 hover:text-white rounded-lg'
                }`}
              >
                [ READ SOURCE ]
              </a>
            )}
            <button 
              onClick={() => {
                try {
                  simAbortController.current?.abort();
                  setActiveSimArticle(null);
                  setActiveSimArticleUrl('');
                  setSimChatLog([]);
                  setIsSimLoading(false);
                  setSimInput('');
                  hasInitialized.current = false;
                } catch (error) {
                  console.error("Failed to disconnect cleanly:", error);
                }
              }}
              className={`text-[9px] uppercase font-bold tracking-widest px-4 py-1.5 border transition-all ${
                isCyberpunk
                  ? 'border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff] hover:text-[#060010]'
                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg'
              }`}
            >
              [ ABORT / BACK TO Himinbjörg ]
            </button>
          </div>
        </div>

        <div className={`p-4 border-b ${isCyberpunk ? 'border-[#00ffff]/20 bg-black/40' : 'border-neutral-800 bg-neutral-900/50'}`}>
          <div className={`text-[10px] uppercase font-bold mb-1 opacity-60 ${isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-400'}`}>TTP Extraction Complete</div>
          <div className={`text-sm font-bold ${isCyberpunk ? 'text-[#e8d5ff]' : 'text-neutral-200'}`}>{activeSimArticle.title}</div>
        </div>

        {/* Sim Chat Log */}
        <div 
          ref={simScrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm scrollbar-hide"
        >
          {simChatLog.map((entry, i) => (
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
          
          {isSimLoading && (
            <div className={`flex items-center text-sm font-mono ${isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-400'}`}>
              {'>> '}SYSTEM: AWAITING SIMULATION ENGINE<span className="animate-pulse ml-0.5">...</span>
            </div>
          )}
        </div>

        {/* Sim Terminal Input */}
        <div className={`shrink-0 p-3 ${
          isCyberpunk
            ? 'border-t border-[#ff00ff] bg-[rgba(12,0,28,0.97)]'
            : 'border-t border-neutral-800 bg-neutral-900/80'
        }`}>
          <form onSubmit={handleSimSubmit} className="relative flex items-center">
            <span className={`absolute left-3 font-mono font-bold text-sm select-none ${isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-500'}`}>
              {'>_'}
            </span>
            <input
              type="text"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              placeholder="Enter command or escalate..."
              disabled={isSimLoading}
              className={`w-full pl-8 pr-10 py-2 pt-2.5 text-sm font-mono focus:outline-none transition-colors border ${
                isCyberpunk
                  ? 'bg-transparent border-[#00ffff]/40 text-[#00ffff] placeholder-[#00ffff]/40 focus:border-[#00ffff]'
                  : 'bg-neutral-950/80 border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-emerald-500/50'
              }`}
            />
          </form>
        </div>
      </div>
    );
  }

  // ── TAB UI (main Himinbjörg view) ──────────────────────────────────────────
  const tabBase = `text-[10px] uppercase font-bold tracking-widest px-4 py-2 transition-all border-b-2`;
  const tabActive = isCyberpunk
    ? 'border-[#ff00ff] text-[#ff00ff]'
    : 'border-emerald-500 text-emerald-400';
  const tabInactive = isCyberpunk
    ? 'border-transparent text-[#9060d0] hover:text-[#e8d5ff]'
    : 'border-transparent text-neutral-500 hover:text-neutral-300';

  return (
    <div className="flex flex-col h-full w-full">

      {/* ── Tab Bar ── */}
      <div className={`shrink-0 flex items-center justify-between px-2 border-b ${
        isCyberpunk ? 'border-[#ff00ff]/30 bg-black/40' : 'border-neutral-800 bg-neutral-900/40'
      }`}>
        <div className="flex">
          <button
            onClick={() => setActiveTab('feed')}
            className={`${tabBase} ${activeTab === 'feed' ? tabActive : tabInactive}`}
          >
            Himinbjörg
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`${tabBase} ${activeTab === 'assistant' ? tabActive : tabInactive}`}
          >
            Heimdall
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab === 'feed' && (
            <>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`text-[9px] uppercase font-bold px-3 py-1 transition-colors ${
                  isCyberpunk 
                    ? 'text-[#00ffff] hover:text-[#ff00ff]' 
                    : 'text-neutral-400 hover:text-emerald-500'
                }`}
              >
                [ {showSettings ? 'CLOSE SETTINGS' : 'MANAGE SOURCES'} ]
              </button>
              <span className="text-[9px] uppercase tracking-widest opacity-60 px-2 font-mono whitespace-nowrap">
                Sensors: {selectedSources.length} Active
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Settings Panel (feed tab only) ── */}
      {activeTab === 'feed' && showSettings && (
        <div className={`p-4 border-b shrink-0 animate-in fade-in slide-in-from-top-2 duration-300 ${
          isCyberpunk ? 'border-[#ff00ff]/30 bg-[#060010]' : 'border-neutral-800 bg-neutral-950/90'
        }`}>
          {/* Default Sources */}
          <div className="mb-4">
            <div className={`text-[10px] uppercase font-bold mb-2 opacity-50 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-emerald-500'}`}>Official Sensors</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {AVAILABLE_SOURCES.map(source => (
                <label key={source.id} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={() => handleToggleSource(source.id)}
                    className="hidden"
                  />
                  <div className={`w-3 h-3 border flex items-center justify-center transition-all ${
                    selectedSources.includes(source.id)
                      ? (isCyberpunk ? 'border-[#ff00ff] bg-[#ff00ff]/20' : 'border-emerald-500 bg-emerald-500/20')
                      : (isCyberpunk ? 'border-neutral-700' : 'border-neutral-800')
                  }`}>
                    {selectedSources.includes(source.id) && (
                      <div className={`w-1.5 h-1.5 ${isCyberpunk ? 'bg-[#ff00ff]' : 'bg-emerald-500'}`} />
                    )}
                  </div>
                  <span className={`text-[10px] uppercase tracking-tighter truncate ${
                    selectedSources.includes(source.id)
                      ? (isCyberpunk ? 'text-[#e8d5ff]' : 'text-neutral-200')
                      : 'text-neutral-600'
                  }`}>
                    {source.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className={`h-px w-full mb-4 ${isCyberpunk ? 'bg-[#ff00ff]/10' : 'bg-neutral-800'}`} />

          {/* Custom Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className={`text-[10px] uppercase font-bold mb-2 opacity-50 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-emerald-500'}`}>Custom Signals</div>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                {customSources.length === 0 ? (
                  <div className="text-[10px] text-neutral-600 italic">No custom sensors deployed.</div>
                ) : customSources.map(source => (
                  <div key={source.id} className="flex items-center justify-between group">
                    <label className="flex items-center gap-2 cursor-pointer overflow-hidden">
                      <input 
                        type="checkbox"
                        checked={selectedSources.includes(source.id)}
                        onChange={() => handleToggleSource(source.id)}
                        className="hidden"
                      />
                      <div className={`w-3 h-3 shrink-0 border flex items-center justify-center transition-all ${
                        selectedSources.includes(source.id)
                          ? (isCyberpunk ? 'border-[#ff00ff] bg-[#ff00ff]/20' : 'border-emerald-500 bg-emerald-500/20')
                          : (isCyberpunk ? 'border-neutral-700' : 'border-neutral-800')
                      }`}>
                        {selectedSources.includes(source.id) && (
                          <div className={`w-1.5 h-1.5 ${isCyberpunk ? 'bg-[#ff00ff]' : 'bg-emerald-500'}`} />
                        )}
                      </div>
                      <span className={`text-[10px] uppercase tracking-tighter truncate ${
                        selectedSources.includes(source.id)
                          ? (isCyberpunk ? 'text-[#e8d5ff]' : 'text-neutral-200')
                          : 'text-neutral-600'
                      }`}>
                        {source.name} <span className="opacity-40 text-[8px]">({source.url.startsWith('reddit:') ? `r/${source.url.split(':')[1]}` : 'RSS'})</span>
                      </span>
                    </label>
                    <button 
                      onClick={() => handleRemoveCustomSource(source.id)}
                      className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className={`text-[10px] uppercase font-bold mb-2 opacity-50 ${isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-500'}`}>Add Neural Link</div>
              <form onSubmit={handleAddCustomSource} className="space-y-2">
                <input 
                  type="text" 
                  placeholder="Source Name (e.g. My Subreddit)"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className={`w-full px-2 py-1.5 text-[10px] font-mono border focus:outline-none ${
                    isCyberpunk ? 'bg-black border-[#ff00ff]/30 text-[#e8d5ff]' : 'bg-neutral-900 border-neutral-700 text-white rounded'
                  }`}
                />
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="URL or r/subreddit"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-mono border focus:outline-none ${
                      isCyberpunk ? 'bg-black border-[#00ffff]/30 text-[#e8d5ff]' : 'bg-neutral-900 border-neutral-700 text-white rounded'
                    }`}
                  />
                  <button 
                    type="submit"
                    className={`px-3 py-1.5 text-[9px] font-bold uppercase border transition-all ${
                      isCyberpunk ? 'border-[#00ffff] text-[#00ffff] hover:bg-[#00ffff] hover:text-[#060010]' : 'border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded'
                    }`}
                  >
                    Deploy
                  </button>
                </div>
              </form>
              <div className="mt-2 text-[8px] opacity-40 italic">Supports RSS Feed URLs or 'r/subreddit' shorthand.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: Intelligence Feed ── */}
      {activeTab === 'feed' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 relative">
          {isFeedLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-xs font-mono opacity-40 animate-pulse py-20">
              <span className={isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-500'}>
                {'>> SCANNING GLOBAL SENSORS...'}
              </span>
            </div>
          ) : news.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-xs font-mono opacity-30 py-20">
              {'>> NO ACTIVE SIGNALS DETECTED.'}
            </div>
          ) : (
            news.map((n) => (
              <div key={n.id}
                className={`relative overflow-hidden transition-colors p-4 ${
                  isCyberpunk
                    ? 'bg-[rgba(12,0,28,0.97)]'
                    : 'border border-neutral-800 bg-neutral-950/50 hover:bg-neutral-900/60 rounded-xl'
                }`}
                style={isCyberpunk ? {
                  borderLeft: `3px solid ${isCyberpunk ? '#00ffff' : '#10b981'}`,
                  borderTop: '1px solid rgba(255,0,255,0.25)',
                  borderRight: '1px solid rgba(255,0,255,0.25)',
                  borderBottom: '1px solid rgba(255,0,255,0.25)',
                } : {}}>

                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-mono ${isCyberpunk ? 'text-[#9060d0]' : 'text-neutral-500'}`}>
                    {n.sourceName}
                  </span>
                  <span className={`text-[9px] font-bold tracking-widest px-1.5 py-0.5 border ${
                    isCyberpunk 
                      ? 'border-[#00ffff]/40 text-[#00ffff]' 
                      : 'border-emerald-500/20 text-emerald-400 rounded'
                  }`}>
                    LIVE
                  </span>
                </div>

                 <h3 className="font-bold mb-1.5"
                  style={isCyberpunk ? { fontSize: '11px', letterSpacing: '0.04em', color: '#e8d5ff' } : { color: '#e5e5e5', fontSize: '14px' }}>
                  {n.title}
                </h3>

                <p className={`text-xs leading-relaxed mb-3 font-mono line-clamp-2 ${isCyberpunk ? 'text-[#9060d0]' : 'text-neutral-400'}`}>
                  {n.summary}
                </p>

                {/* AI Intel Section */}
                {articleIntel[n.id] ? (
                  <div className={`mb-3 p-2.5 text-[11px] font-mono leading-relaxed whitespace-pre-wrap border ${
                    isCyberpunk
                      ? 'border-[#00ffff]/30 bg-[#00ffff]/5 text-[#b0f0f0]'
                      : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-300 rounded-lg'
                  }`}>
                    <div className={`text-[9px] uppercase font-bold mb-1.5 opacity-60 ${isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-400'}`}>
                      ⚡ AI Intel Analysis
                    </div>
                    {articleIntel[n.id]}
                  </div>
                ) : intelErrors[n.id] ? (
                  <button
                    onClick={() => handleGenerateIntel(n)}
                    className={`mb-3 text-[9px] font-bold uppercase tracking-wider px-3 py-1 border transition-all ${
                      isCyberpunk 
                        ? 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white' 
                        : 'border-red-500/50 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    ⚠️ Retry AI Intel
                  </button>
                ) : (
                  <button
                    onClick={() => handleGenerateIntel(n)}
                    disabled={!!intelLoading[n.id]}
                    className={`mb-3 text-[9px] font-bold uppercase tracking-wider px-3 py-1 border transition-all ${
                      intelLoading[n.id]
                        ? (isCyberpunk ? 'border-[#00ffff]/30 text-[#00ffff]/40 animate-pulse' : 'border-emerald-500/20 text-emerald-500/40 animate-pulse')
                        : (isCyberpunk ? 'border-[#00ffff]/40 text-[#00ffff]/70 hover:border-[#00ffff] hover:text-[#00ffff]' : 'border-emerald-500/20 text-emerald-500/60 hover:border-emerald-500 hover:text-emerald-400 rounded')
                    }`}
                  >
                    {intelLoading[n.id] ? '⚡ Extracting Intel...' : '⚡ Generate AI Intel'}
                  </button>
                )}

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleSimulate(n)}
                    disabled={isSimulatingId !== null}
                    className={`text-[9px] font-bold uppercase tracking-wider px-3 py-1 border transition-all ${
                      isSimulatingId === n.id
                        ? (isCyberpunk ? 'border-[#00ffff] bg-[#00ffff]/20 animate-pulse' : 'border-emerald-500 bg-emerald-500/20')
                        : (isCyberpunk ? 'border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff] hover:text-[#060010]' : 'border-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-600/20')
                    }`}
                  >
                    {isSimulatingId === n.id ? 'Generating Scenario...' : 'Initialize Simulation'}
                  </button>
                  <a 
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-[9px] font-bold uppercase tracking-wider px-3 py-1 border transition-colors ${
                    isCyberpunk
                      ? 'border-[#00ffff]/40 text-[#00ffff]/60 hover:text-[#00ffff] hover:border-[#00ffff]'
                      : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
                  }`}>
                    Read Source
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Feed Quick Chat Input ── */}
      {activeTab === 'feed' && !isFeedLoading && (
        <div className={`shrink-0 p-3 border-t ${
          isCyberpunk ? 'border-[#ff00ff]/30 bg-black/40' : 'border-neutral-800 bg-neutral-900/40'
        }`}>
          <form onSubmit={handleChatSubmit} className="relative flex items-center">
            <span className={`absolute left-3 font-mono font-bold text-sm select-none ${isCyberpunk ? 'text-[#ff00ff]' : 'text-emerald-500'}`}>
              {isCyberpunk ? '>' : '$'}
            </span>
            <input
              type="text"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              placeholder="Quick query to Heimdall..."
              className={`w-full pl-8 pr-10 py-1.5 text-xs font-mono focus:outline-none transition-colors ${
                isCyberpunk
                  ? 'bg-transparent text-[#00ffff] border-[#ff00ff]/40'
                  : 'bg-neutral-950/80 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500'
              }`}
            />
          </form>
        </div>
      )}

      {/* ── TAB 2: Heimdall (Assistant) ── */}
      {activeTab === 'assistant' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat history */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm"
          >
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40 py-20">
                <div className={`text-[10px] uppercase font-bold tracking-widest ${isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-500'}`}>
                  Heimdall Online
                </div>
                <div className="text-xs font-mono text-center max-w-xs opacity-70">
                  Query current threat intel, ask about active TTPs, or request a situation report.
                </div>
              </div>
            ) : (
              chatHistory.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[90%] p-3 rounded-lg text-[12px] ${
                    msg.role === 'user'
                      ? (isCyberpunk ? 'bg-[#ff00ff]/10 border border-[#ff00ff]/30 text-[#e8d5ff]' : 'bg-blue-900/20 border border-blue-500/30 text-blue-100')
                      : (isCyberpunk ? 'bg-[#00ffff]/5 border border-[#00ffff]/20 text-[#00ffff]' : 'bg-neutral-800/40 border border-neutral-700 text-neutral-300')
                  }`}>
                    <div className="text-[9px] uppercase font-bold mb-1 opacity-50">
                      {msg.role === 'user' ? 'Analyst' : '>> Intel Feed'}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  </div>
                </div>
              ))
            )}
            {isAnalystLoading && (
              <div className={`flex items-center text-xs font-mono ${isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-400'}`}>
                <span className="animate-pulse">{">> "} ANALYZING THREAT DATABASE...</span>
              </div>
            )}
          </div>

          {/* Terminal input */}
          <div className={`shrink-0 p-3 ${
            isCyberpunk
              ? 'border-t border-[#ff00ff] bg-[rgba(12,0,28,0.97)]'
              : 'border-t border-neutral-800 bg-neutral-900/80'
          }`}>
            <form onSubmit={handleChatSubmit} className="relative flex items-center">
              <span className={`absolute left-3 font-mono font-bold text-sm select-none ${isCyberpunk ? 'text-[#ff00ff]' : 'text-emerald-500'}`}>
                {isCyberpunk ? '>' : '$'}
              </span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    if (historyIndex > 0) {
                      e.preventDefault();
                      const newIndex = historyIndex - 1;
                      setHistoryIndex(newIndex);
                      setTerminalInput(commandHistory[newIndex]);
                    }
                  } else if (e.key === 'ArrowDown') {
                    if (historyIndex < commandHistory.length - 1) {
                      e.preventDefault();
                      const newIndex = historyIndex + 1;
                      setHistoryIndex(newIndex);
                      setTerminalInput(commandHistory[newIndex]);
                    } else if (historyIndex === commandHistory.length - 1) {
                      e.preventDefault();
                      setHistoryIndex(commandHistory.length);
                      setTerminalInput('');
                    }
                  }
                }}
                placeholder="Query Heimdall..."
                className={`w-full pl-8 pr-10 py-2 text-sm font-mono focus:outline-none transition-colors ${
                  isCyberpunk
                    ? 'bg-transparent text-[#00ffff] placeholder-[#4a2070]'
                    : 'bg-neutral-950/80 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-emerald-500/50'
                }`}
                style={isCyberpunk ? { border: '1px solid rgba(255,0,255,0.4)' } : {}}
              />
              <button 
                type="submit"
                className={`absolute right-2.5 transition-colors ${
                  isCyberpunk ? 'text-[#9060d0] hover:text-[#ff00ff]' : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
