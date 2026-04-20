'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeProvider';
import { AVAILABLE_SOURCES, NewsItem } from '@/lib/rssFetcher';
import { Scenario } from '../lib/scenarioData';

interface CICenterProps {
  onInitializeSimulation?: (headline: string, scenario?: any) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean | ((prev: boolean) => boolean)) => void;
  ciActiveTab: 'feed' | 'assistant';
  setCiActiveTab: (v: 'feed' | 'assistant') => void;
  onSensorsCountChange?: (count: number) => void;
}



export default function CICenter({ onInitializeSimulation, showSettings, setShowSettings, ciActiveTab, setCiActiveTab, onSensorsCountChange }: CICenterProps) {
  const { isCyberpunk } = useTheme();
  
  // Use prop as the active tab
  const activeTab = ciActiveTab;

  // Chat History / Arrow Keys
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Settings / Source Toggles
  // showSettings and selectedSources lifted; only local toggle state remains
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
  // Tracks whether selectedSources has been populated from localStorage yet.
  // Prevents fetchNews from firing on mount with an empty [] before the
  // localStorage useEffect has run and set the real sources.
  const sourcesReady = useRef(false);
  const simAbortController = useRef<AbortController | null>(null);

  // Load sources from localStorage on mount, then mark them ready.
  // We call fetchNews() directly here (not via the second effect) so that the
  // initial fetch always uses the resolved sources, not the empty default state.
  useEffect(() => {
    const saved = localStorage.getItem('ci_selected_sources');
    const savedCustom = localStorage.getItem('ci_custom_sources');

    let resolvedSources: string[];
    if (saved) {
      try {
        resolvedSources = JSON.parse(saved);
      } catch (e) {
        resolvedSources = AVAILABLE_SOURCES.map(s => s.id);
      }
    } else {
      resolvedSources = AVAILABLE_SOURCES.map(s => s.id);
    }

    let resolvedCustom: { id: string; name: string; url: string }[] = [];
    if (savedCustom) {
      try {
        resolvedCustom = JSON.parse(savedCustom);
      } catch (e) {
        resolvedCustom = [];
      }
    }

    setSelectedSources(resolvedSources);
    setCustomSources(resolvedCustom);

    // Mark sources as ready and trigger the initial fetch immediately with
    // the resolved values so we don't wait for a re-render + state update.
    sourcesReady.current = true;
    fetchNewsWithSources(resolvedSources, resolvedCustom);
    // Emit count to parent
    onSensorsCountChange?.(resolvedSources.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch whenever the user toggles sources AFTER the initial load.
  useEffect(() => {
    if (!sourcesReady.current) return; // Skip the effect fired by the initializer above
    localStorage.setItem('ci_selected_sources', JSON.stringify(selectedSources));
    localStorage.setItem('ci_custom_sources', JSON.stringify(customSources));
    fetchNews();
    // Emit updated count to parent
    onSensorsCountChange?.(selectedSources.length);
  }, [selectedSources, customSources]);

  const fetchNewsWithSources = async (sources: string[], custom: { id: string; name: string; url: string }[]) => {
    setIsFeedLoading(true);
    try {
      const sourcesQuery = sources.join(',');
      const customQuery = encodeURIComponent(JSON.stringify(custom));
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
    if (ciActiveTab !== 'assistant') {
      setCiActiveTab('assistant');
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
          <div dir="auto" className={`text-sm font-bold ${isCyberpunk ? 'text-[#e8d5ff]' : 'text-neutral-200'}`}>{activeSimArticle.title}</div>
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
                <div dir="auto" className="whitespace-pre-wrap">{entry.text}</div>
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

  // ── MAIN VIEW ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full">

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
                className={`relative overflow-hidden transition-all duration-300 p-5 group ${
                  isCyberpunk
                    ? 'bg-[rgba(12,0,28,0.97)]'
                    : 'bg-[#141414] border border-white/[0.05] rounded-[20px] hover:border-white/10 hover:bg-[#171717]'
                }`}
                style={isCyberpunk ? {
                  borderLeft: `3px solid #00ffff`,
                  borderTop: '1px solid rgba(255,0,255,0.25)',
                  borderRight: '1px solid rgba(255,0,255,0.25)',
                  borderBottom: '1px solid rgba(255,0,255,0.25)',
                } : {}}>

                {/* Source + Live badge */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-35 shrink-0">
                      <path d="M13.3333 5.5L18.3333 10.5L13.3333 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6.66667 5.5L1.66667 10.5L6.66667 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M11.6667 3.83331L8.33333 17.1666" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className={`text-[12px] font-roboto ${isCyberpunk ? 'text-[#9060d0]' : 'text-white/35'}`}>
                      {n.sourceName}
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-[4px] border ${
                    isCyberpunk
                      ? 'border-[#00ffff]/40 text-[#00ffff] animate-pulse'
                      : 'border-[#00FF67]/40 text-[#00FF67] bg-[#00FF67]/5 animate-pulse'
                  }`}>
                    LIVE
                  </span>
                </div>

                {/* Title */}
                <h3 dir="auto" className={`font-orbitron font-semibold mb-2 leading-snug ${
                  isCyberpunk ? 'text-[11px] text-[#e8d5ff]' : 'text-[16px] text-white'
                }`}>
                  {n.title}
                </h3>

                {/* Summary */}
                <p dir="auto" className={`text-[14px] font-roboto leading-relaxed mb-4 line-clamp-2 ${
                  isCyberpunk ? 'text-[#9060d0]' : 'text-white/50'
                }`}>
                  {n.summary}
                </p>

                {/* AI Intel Section — expanded result */}
                {articleIntel[n.id] ? (
                  <div className={`mb-4 p-3 text-[12px] font-roboto leading-relaxed whitespace-pre-wrap rounded-[10px] border ${
                    isCyberpunk
                      ? 'border-[#00ffff]/30 bg-[#00ffff]/5 text-[#b0f0f0]'
                      : 'border-[#D8FE52]/20 bg-[#D8FE52]/5 text-[#D8FE52]/80'
                  }`}>
                    <div className="text-[10px] uppercase font-bold mb-1.5 opacity-60 tracking-widest">
                      ⚡ AI Intel Analysis
                    </div>
                    <div dir="auto">{articleIntel[n.id]}</div>
                  </div>
                ) : intelErrors[n.id] ? (
                  <button
                    onClick={() => handleGenerateIntel(n)}
                    className="mb-4 flex items-center gap-2 h-[36px] px-4 border border-red-500/50 rounded-[10px] text-[12px] font-roboto text-red-400 hover:bg-red-500/10 hover:border-red-500 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    ⚠️ Retry AI Intel
                  </button>
                ) : (
                  /* Generate AI Intel button — yellow bordered per Figma */
                  <button
                    onClick={() => handleGenerateIntel(n)}
                    disabled={!!intelLoading[n.id]}
                    className={`mb-4 flex items-center gap-2 h-[36px] px-4 border rounded-[10px] text-[12px] font-roboto transition-all duration-200 ${
                      intelLoading[n.id]
                        ? 'border-[rgba(216,254,82,0.5)] text-[rgba(216,254,82,0.75)] animate-pulse cursor-not-allowed'
                        : isCyberpunk
                          ? 'border-[#00ffff]/40 text-[#00ffff]/70 hover:border-[#00ffff] hover:text-[#00ffff]'
                          : 'border-[rgba(216,254,82,0.5)] text-[rgba(216,254,82,0.75)] hover:bg-[rgba(216,254,82,0.08)] hover:border-[rgba(216,254,82,0.8)] hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {/* Sparkle / AI icon */}
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                      className={intelLoading[n.id] ? 'animate-spin' : ''}
                    >
                      <path d="M12 2L13.09 8.26L19 7L14.74 11.26L21 12L14.74 12.74L19 17L13.09 15.74L12 22L10.91 15.74L5 17L9.26 12.74L3 12L9.26 11.26L5 7L10.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                    {intelLoading[n.id] ? 'Generating AI Intel...' : 'Generating AI Intel'}
                  </button>
                )}

                {/* Action Buttons Row */}
                <div className="flex items-center gap-3 flex-wrap">

                  {/* ── Initialize Simulation — Primary yellow filled (Figma spec) ── */}
                  <button
                    onClick={() => handleSimulate(n)}
                    disabled={isSimulatingId !== null}
                    className={`flex items-center gap-2 h-[38px] px-6 rounded-[10px] text-[14px] font-roboto font-medium transition-all duration-200 ${
                      isSimulatingId === n.id
                        ? 'bg-[rgba(216,254,82,0.3)] text-[#D8FE52] cursor-not-allowed animate-pulse'
                        : isSimulatingId !== null
                          ? 'bg-[rgba(216,254,82,0.15)] text-[#D8FE52]/40 cursor-not-allowed'
                          : isCyberpunk
                            ? 'bg-[rgba(255,0,255,0.3)] text-[#ff00ff] border border-[#ff00ff] hover:bg-[rgba(255,0,255,0.5)]'
                            : 'bg-[rgba(216,254,82,0.5)] text-[#D8FE52] hover:bg-[rgba(216,254,82,0.65)] hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_20px_rgba(216,254,82,0.15)] hover:shadow-[0_0_30px_rgba(216,254,82,0.3)]'
                    }`}
                  >
                    {isSimulatingId === n.id ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        Initialize Simulation
                        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </>
                    )}
                  </button>

                  {/* ── Read Source — Gray bordered (Figma spec) ── */}
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 h-[36px] px-4 border rounded-[10px] text-[12px] font-roboto transition-all duration-200 ${
                      isCyberpunk
                        ? 'border-[#00ffff]/40 text-[#00ffff]/60 hover:text-[#00ffff] hover:border-[#00ffff]'
                        : 'border-[rgba(177,177,177,0.5)] text-[rgba(177,177,177,0.5)] hover:text-[rgba(177,177,177,0.9)] hover:border-[rgba(177,177,177,0.8)] hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13.3333 5.5L18.3333 10.5L13.3333 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6.66667 5.5L1.66667 10.5L6.66667 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M11.6667 3.83331L8.33333 17.1666" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
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
