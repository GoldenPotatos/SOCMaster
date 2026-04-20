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
                className={`w-fit h-fit px-[24px] py-[16px] rounded-[10px] flex flex-col gap-4 ${
                  isCyberpunk
                    ? 'bg-[rgba(12,0,28,0.97)] border-l-[3px] border-[#00ffff] border-t border-r border-b border-[#ff00ff]/25'
                    : 'bg-[#141414]'
                }`}
              >
                {/* First div */}
                <div className="w-fit h-fit flex flex-col gap-2">
                  {/* 1st div */}
                  <div className="w-fit h-fit flex items-center gap-2">
                    <div className="text-white/15">
                      <svg width="16" height="13" viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.82014 0.0318365C9.39511 -0.0925519 8.95257 0.158763 8.83006 0.590313L5.62981 11.9629C5.50731 12.3945 5.75482 12.8438 6.17986 12.9682C6.60489 13.0926 7.04742 12.8412 7.16994 12.4097L10.3702 1.03709C10.4927 0.605542 10.2452 0.156225 9.82014 0.0318365ZM11.8353 3.08061C11.5228 3.39792 11.5228 3.91324 11.8353 4.23056L14.068 6.5L11.8328 8.76944C11.5203 9.08676 11.5203 9.60208 11.8328 9.91939C12.1453 10.2367 12.6529 10.2367 12.9654 9.91939L15.7656 7.07624C16.0781 6.75893 16.0781 6.24361 15.7656 5.92629L12.9654 3.08314C12.6529 2.76583 12.1453 2.76583 11.8328 3.08314L11.8353 3.08061ZM4.1672 3.08061C3.85468 2.76329 3.34714 2.76329 3.03461 3.08061L0.234392 5.92376C-0.0781307 6.24107 -0.0781307 6.75639 0.234392 7.07371L3.03461 9.91685C3.34714 10.2342 3.85468 10.2342 4.1672 9.91685C4.47973 9.59954 4.47972 9.08422 4.1672 8.7669L1.93202 6.5L4.1672 4.23056C4.47972 3.91324 4.47972 3.39792 4.1672 3.08061Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <div className="text-white/[0.35] font-roboto font-normal text-sm">
                      {n.sourceName}
                    </div>
                  </div>

                  {/* 2nd div */}
                  <div className="w-fit h-fit flex flex-col gap-1">
                    <div className="w-fit h-fit">
                      <div dir="auto" className={`text-white font-orbitron tracking-[0.05em] leading-snug ${isCyberpunk ? 'text-[#e8d5ff]' : 'text-white'}`}>
                        {n.title}
                      </div>
                    </div>
                    <div className="w-fit h-fit mt-1">
                      <div dir="auto" className={`text-white/50 font-roboto font-normal tracking-[0.01em] line-clamp-2 ${isCyberpunk ? 'text-[#9060d0]' : 'text-white/50'}`}>
                        {n.summary}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Intel Section (preserved) */}
                {articleIntel[n.id] && (
                  <div className={`p-3 text-[12px] font-roboto leading-relaxed whitespace-pre-wrap rounded-[10px] border ${
                    isCyberpunk
                      ? 'border-[#00ffff]/30 bg-[#00ffff]/5 text-[#b0f0f0]'
                      : 'border-[#D8FE52]/20 bg-[#D8FE52]/5 text-[#D8FE52]/80'
                  }`}>
                    <div className="text-[10px] uppercase font-bold mb-1.5 opacity-60 tracking-widest">
                      ⚡ AI Intel Analysis
                    </div>
                    <div dir="auto">{articleIntel[n.id]}</div>
                  </div>
                )}
                {intelErrors[n.id] && (
                  <div className="text-red-500 text-xs">⚠️ AI Intel Error. Try generating again.</div>
                )}

                {/* Second div (Buttons) */}
                <div className="w-fit h-fit flex flex-row gap-3 mt-2">
                  {/* Button 1 */}
                  <button
                    onClick={() => handleSimulate(n)}
                    disabled={isSimulatingId !== null}
                    className={`w-fit h-fit flex items-center gap-[4px] px-[12px] py-[6px] rounded-[6px] transition-all group ${
                      isSimulatingId === n.id
                        ? 'bg-[#D8FE52]/30 text-[#D8FE52] cursor-not-allowed animate-pulse'
                        : isSimulatingId !== null
                          ? 'bg-[#D8FE52]/15 text-[#D8FE52]/40 cursor-not-allowed'
                          : 'bg-[#D8FE52]/50 hover:bg-[#A0B754] shadow-[0_0_10px_rgba(216,254,82,0)] hover:shadow-[0_0_10px_rgba(216,254,82,0.3)]'
                    }`}
                  >
                    <div className={`${isSimulatingId === n.id ? 'text-[#D8FE52]' : 'text-[#EBFFA5] group-hover:text-[#EBFFA5]'} ${isSimulatingId === n.id ? 'animate-spin' : ''}`}>
                      <svg width="9" height="16" viewBox="0 0 9 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.68896 0.509024C5.03361 -0.016145 5.73205 -0.158049 6.24901 0.192064C6.76598 0.542176 6.90567 1.2517 6.56102 1.77686L3.22669 6.85716H7.87498C8.28987 6.85716 8.67127 7.08934 8.86704 7.46094C9.06268 7.8325 9.0411 8.28331 8.81101 8.63392L4.31104 15.491C3.96639 16.0161 3.26795 16.158 2.75099 15.8079C2.23402 15.4578 2.09433 14.7483 2.43898 14.2231L5.77331 9.14284H1.12502C0.710126 9.14284 0.328729 8.91066 0.132959 8.53906C-0.0626784 8.1675 -0.0411032 7.71669 0.188989 7.36608L4.68896 0.509024Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <span className={`font-roboto font-medium text-[14px] ${isSimulatingId === n.id ? 'text-[#D8FE52]' : 'text-[#D8FE52] group-hover:text-white'}`}>
                      {isSimulatingId === n.id ? 'Generating...' : 'Initialize Simulation'}
                    </span>
                  </button>

                  {/* Button 2 */}
                  <button
                    onClick={() => handleGenerateIntel(n)}
                    disabled={!!intelLoading[n.id]}
                    className={`w-fit h-fit flex items-center gap-[4px] px-[12px] py-[6px] rounded-[6px] border border-[#D8FE52]/50 bg-transparent transition-all group ${
                      intelLoading[n.id] ? 'animate-pulse cursor-not-allowed' : 'hover:border-[#D8FE52]/50 hover:bg-[#D8FE52]/10'
                    }`}
                  >
                    <div className={`${intelLoading[n.id] ? 'animate-spin text-[#D8FE52]' : 'text-[#D8FE52]/50 group-hover:text-[#D8FE52]'}`}>
                      <svg width="16" height="14" viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0.744208 10.2057L2.87907 11.1051L3.73049 13.2366C3.91449 13.6983 4.36135 14 4.85849 14C5.35564 14 5.80135 13.6971 5.98649 13.2366L6.83335 11.1177L8.95221 10.2708C9.41392 10.0868 9.71564 9.63999 9.71564 9.14285C9.71564 8.64571 9.41278 8.19999 8.95221 8.01485L6.83335 7.16799L5.98649 5.04913C5.80021 4.58856 5.35335 4.28571 4.85735 4.28571C4.36135 4.28571 3.91449 4.58856 3.72935 5.04913L2.88707 7.15542L0.784208 7.95199C0.320208 8.12799 0.00934957 8.56913 0.000206713 9.06513C-0.00893614 9.56228 0.285923 10.0137 0.743066 10.2068L0.744208 10.2057Z" fill="currentColor"/>
                        <path d="M9.66807 4.17882L11.1748 4.81371L11.7757 6.31825C11.9056 6.64417 12.221 6.85714 12.5719 6.85714C12.9227 6.85714 13.2373 6.64336 13.368 6.31825L13.9657 4.82259L15.4611 4.22481C15.787 4.09492 16 3.7795 16 3.42857C16 3.07765 15.7862 2.76303 15.4611 2.63234L13.9657 2.03455L13.368 0.538891C13.2365 0.213782 12.9211 0 12.5711 0C12.221 0 11.9056 0.213782 11.7749 0.538891L11.1805 2.02568L9.6963 2.58797C9.36882 2.7122 9.14942 3.0236 9.14297 3.37371C9.13652 3.72464 9.34462 4.04329 9.66727 4.17963L9.66807 4.17882Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <span className="font-roboto font-normal text-[14px] text-[#D8FE52]/75">
                      {intelLoading[n.id] ? 'Generating...' : 'Generate AI Intel'}
                    </span>
                  </button>

                  {/* Button 3 */}
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit h-fit flex items-center gap-[4px] px-[12px] py-[6px] rounded-[6px] border border-[#B1B1B1]/50 bg-transparent hover:bg-white/5 transition-all group"
                  >
                    <div className="text-white/25 group-hover:text-white/[0.45]">
                      <svg width="16" height="13" viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.82014 0.0318365C9.39511 -0.0925519 8.95257 0.158763 8.83006 0.590313L5.62981 11.9629C5.50731 12.3945 5.75482 12.8438 6.17986 12.9682C6.60489 13.0926 7.04742 12.8412 7.16994 12.4097L10.3702 1.03709C10.4927 0.605542 10.2452 0.156225 9.82014 0.0318365ZM11.8353 3.08061C11.5228 3.39792 11.5228 3.91324 11.8353 4.23056L14.068 6.5L11.8328 8.76944C11.5203 9.08676 11.5203 9.60208 11.8328 9.91939C12.1453 10.2367 12.6529 10.2367 12.9654 9.91939L15.7656 7.07624C16.0781 6.75893 16.0781 6.24361 15.7656 5.92629L12.9654 3.08314C12.6529 2.76583 12.1453 2.76583 11.8328 3.08314L11.8353 3.08061ZM4.1672 3.08061C3.85468 2.76329 3.34714 2.76329 3.03461 3.08061L0.234392 5.92376C-0.0781307 6.24107 -0.0781307 6.75639 0.234392 7.07371L3.03461 9.91685C3.34714 10.2342 3.85468 10.2342 4.1672 9.91685C4.47973 9.59954 4.47972 9.08422 4.1672 8.7669L1.93202 6.5L4.1672 4.23056C4.47972 3.91324 4.47972 3.39792 4.1672 3.08061Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <span className="font-roboto font-normal text-[14px] text-[#B1B1B1]/50">
                      Read Source
                    </span>
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
