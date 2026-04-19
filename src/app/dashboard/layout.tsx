'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface WeatherData {
  city: string;
  current: {
    temperature: number;
    weathercode: number;
    time: string;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weathercode: number[];
  };
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
  status: 'Active' | 'Offline' | 'Loading';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { isCyberpunk, toggleTheme } = useTheme();

  const [leaderboard, setLeaderboard] = useState<{ id: string; name: string; nickname?: string; score: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Weather state
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [weatherTab, setWeatherTab] = useState<'forecast' | 'outlook'>('forecast');

  // Nickname state
  const [nickname, setNickname] = useState<string>('');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setIsLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // Fetch leaderboard (top 50)
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('xp', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const topUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().email?.split('@')[0] || 'Anonymous',
        nickname: doc.data().nickname || '',
        score: doc.data().xp || 0
      }));
      setLeaderboard(topUsers);
    });

    return () => unsubscribe();
  }, []);

  // Fetch current user nickname from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, 'users', user.uid);
    getDoc(userRef).then(snap => {
      if (snap.exists()) {
        setNickname(snap.data().nickname || '');
      }
    }).catch(err => console.error('Failed to fetch user profile:', err));
  }, [user?.uid]);

  // Fetch Bulletproof Local Weather via Proxy
  useEffect(() => {
    const fetchWeather = (lat: number, lon: number) => {
      setIsWeatherLoading(true);
      fetch(`/api/weather?lat=${lat}&lon=${lon}`)
        .then(res => res.json())
        .then(data => {
          if (data.current) {
            setWeather({ ...data, status: 'Active' });
          } else {
            throw new Error("Invalid weather payload");
          }
        })
        .catch(err => {
          console.error("Weather fetch failed:", err);
          setWeather(prev => prev ? { ...prev, status: 'Offline' } : null);
        })
        .finally(() => setIsWeatherLoading(false));
    };

    const handleGeolocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log(`[Weather] Location found: ${pos.coords.latitude}, ${pos.coords.longitude}`);
            fetchWeather(pos.coords.latitude, pos.coords.longitude);
          },
          (err) => {
            console.warn(`[Weather] Geolocation error (${err.code}): ${err.message}. Falling back to SOC HQ.`);
            fetchWeather(32.08, 34.78); // Fallback to SOC HQ
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } else {
        fetchWeather(32.08, 34.78);
      }
    };

    handleGeolocation();
    const interval = setInterval(handleGeolocation, 600000); // Update every 10 mins
    
    return () => clearInterval(interval);
  }, []);

  const getWeatherIcon = (code: number, isCyber: boolean) => {
    // 0: Sunny, 1-3: Partly Cloudy, 45-48: Haze/Sand, 51-67, 80-82: Rain, 71-77: Snow, 95-99: Storm
    if (code === 0) return { 
      label: 'Sunny', 
      icon: <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg> 
    };
    if (code <= 3) return { 
      label: 'Partly Cloudy', 
      icon: <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg> 
    };
    if (code <= 48) return { 
      label: isCyber ? 'Radiation Mist' : 'Haze/Sand', 
      icon: <svg className={`${isCyber ? 'text-fuchsia-400' : 'text-orange-300'} w-4 h-4`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> 
    };
    if (code <= 67 || (code >= 80 && code <= 82)) return { 
      label: 'Rain', 
      icon: <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 13l-2 5M10 13l-2 5M12 18v-5M8 10a5 5 0 011-9 7 7 0 1113 2 5 5 0 01-1 7H8" /></svg> 
    };
    if (code <= 77) return { 
      label: 'Snow', 
      icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707" /></svg> 
    };
    return { 
      label: 'Storm', 
      icon: <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> 
    };
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleSaveNickname = async () => {
    if (!user?.uid) return;
    setIsSavingNickname(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { nickname: nicknameInput.trim() }, { merge: true });
      setNickname(nicknameInput.trim());
      setShowNicknameModal(false);
    } catch (err) {
      console.error('Failed to save nickname:', err);
    } finally {
      setIsSavingNickname(false);
    }
  };

  // Focus nickname input when modal opens
  useEffect(() => {
    if (showNicknameModal) {
      setNicknameInput(nickname);
      setTimeout(() => nicknameInputRef.current?.focus(), 50);
    }
  }, [showNicknameModal]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-emerald-500 font-mono text-xl animate-pulse">
        AUTHENTICATING SECURE CONNECTION...
      </div>
    );
  }

  // Inline style helpers — avoids Tailwind purging arbitrary values


  // Display name logic: nickname ? "nickname (name)" : name
  const userName = user?.email ? user.email.split('@')[0] : 'User';
  const displayName = nickname ? `${nickname} (${userName})` : userName;

  const getLeaderboardDisplayName = (u: { name: string; nickname?: string }) => {
    return u.nickname ? `${u.nickname} (${u.name})` : u.name;
  };

  return (
    <div className={`h-[100dvh] w-full flex flex-col overflow-hidden ${
      isCyberpunk ? 'bg-[#080010] text-[#00ffff]' : 'bg-neutral-950 text-neutral-200'
    }`}>

      {/* ── Top Navigation ── */}
      <header className={`h-14 shrink-0 flex items-center justify-between px-5 z-50 ${
        isCyberpunk
          ? 'bg-[rgba(26,11,46,0.95)] border-b border-[#ff00ff]'
          : 'border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md'
      }`}>

        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 flex items-center justify-center ${
            isCyberpunk
              ? 'hm-border-magenta bg-[rgba(26,11,46,0.95)]'
              : 'rounded border border-emerald-500/50 bg-emerald-500/10'
          }`}>
            <span className={`text-xs font-bold ${isCyberpunk ? 'text-[#ff00ff]' : 'text-emerald-400'}`}>SM</span>
          </div>
          {isCyberpunk
            ? <span className="hm-logo-text text-base">SOCMASTER</span>
            : <h1 className="text-lg font-semibold text-white tracking-widest">SOCMASTER</h1>
          }
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">

          {/* Weather Center Upgrade */}
          <div className="relative group hidden lg:block">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono transition-all cursor-help ${
              isCyberpunk
                ? 'hm-border-cyan bg-[rgba(26,11,46,0.95)] text-[#00ffff] hover:border-[#ff00ff] hover:shadow-[0_0_10px_rgba(255,0,255,0.2)]'
                : 'rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:border-neutral-500'
            }`}>
              {weather && weather.status === 'Active' ? (
                <>
                  <div className="animate-pulse-slow">
                    {getWeatherIcon(weather.current.weathercode, isCyberpunk).icon}
                  </div>
                  <span className="font-bold tracking-tighter uppercase min-w-[120px]">
                    {weather.city} W/X: {weather.current.temperature}°C
                  </span>
                </>
              ) : (
                <span className="font-bold opacity-50 uppercase tracking-widest px-2">
                  {isWeatherLoading ? '🛰️ Scanning Atmos...' : 'W/X: Offline'}
                </span>
              )}
            </div>

            {/* Weather Popover */}
            <div className={`absolute top-full left-0 mt-2 w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-0 translate-y-2 z-50 border shadow-2xl overflow-hidden ${
              isCyberpunk ? 'hm-card-magenta bg-[#080010]' : 'bg-neutral-900 border-neutral-700 rounded-xl'
            }`}>
              {/* Popover Header / Tabs */}
              <div className={`flex border-b text-[10px] font-bold uppercase ${isCyberpunk ? 'border-[#ff00ff]/20' : 'border-neutral-800'}`}>
                <button 
                  onClick={() => setWeatherTab('forecast')}
                  className={`flex-1 py-2 transition-colors ${weatherTab === 'forecast' 
                    ? (isCyberpunk ? 'bg-[#ff00ff]/10 text-[#ff00ff]' : 'bg-neutral-800 text-white') 
                    : (isCyberpunk ? 'text-[#ff00ff]/40 hover:text-[#ff00ff]/60' : 'text-neutral-500 hover:text-neutral-300')}`}
                >
                  Hourly Forecast
                </button>
                <button 
                  onClick={() => setWeatherTab('outlook')}
                  className={`flex-1 py-2 transition-colors ${weatherTab === 'outlook' 
                    ? (isCyberpunk ? 'bg-[#ff00ff]/10 text-[#ff00ff]' : 'bg-neutral-800 text-white') 
                    : (isCyberpunk ? 'text-[#ff00ff]/40 hover:text-[#ff00ff]/60' : 'text-neutral-500 hover:text-neutral-300')}`}
                >
                  3-Day Outlook
                </button>
              </div>

              <div className="p-3">
                {weather && weather.status === 'Active' ? (
                  weatherTab === 'forecast' ? (
                    /* Hourly Forecast (3h increments) */
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 3, 6, 9].map((idx) => {
                        const timeStr = weather.hourly.time[idx];
                        const time = new Date(timeStr).getHours() + ':00';
                        const temp = weather.hourly.temperature_2m[idx];
                        const code = weather.hourly.weathercode[idx];
                        return (
                          <div key={idx} className="flex flex-col items-center">
                            <span className="text-[8px] opacity-50 mb-1">{time}</span>
                            <div className="scale-75 mb-1">{getWeatherIcon(code, isCyberpunk).icon}</div>
                            <span className="text-[10px] font-bold">{temp}°C</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* 3-Day Outlook */
                    <div className="space-y-2">
                      {weather.daily.time.slice(1, 4).map((timeStr, idx) => {
                        const actualIdx = idx + 1;
                        const date = new Date(timeStr);
                        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
                        const max = weather.daily.temperature_2m_max[actualIdx];
                        const min = weather.daily.temperature_2m_min[actualIdx];
                        const code = weather.daily.weathercode[actualIdx];
                        return (
                          <div key={actualIdx} className="flex items-center justify-between text-[10px]">
                            <span className="w-8 font-bold text-neutral-500">{day}</span>
                            <div className="flex items-center gap-2">
                              {getWeatherIcon(code, isCyberpunk).icon}
                              <span className="opacity-50 tracking-tighter capitalize">{getWeatherIcon(code, isCyberpunk).label}</span>
                            </div>
                            <span className="font-mono">
                              <span className={isCyberpunk ? 'text-[#00ffff]' : 'text-emerald-400'}>{max}°</span>
                              <span className="mx-1 opacity-30">/</span>
                              <span className="opacity-50">{min}°</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="py-4 text-center text-[10px] opacity-50 italic">
                    {isWeatherLoading ? 'ACQUIRING_SATELLITE_LOCK...' : 'ATMOS_SCAN_OFFLINE'}
                  </div>
                )}
              </div>
              
              <div className={`px-3 py-1.5 border-t flex items-center justify-between opacity-50 ${isCyberpunk ? 'border-[#ff00ff]/20' : 'border-neutral-800'}`}>
                <span className="text-[8px] uppercase tracking-widest">Atmos System v2.1</span>
                <span className="text-[8px] uppercase">{weather?.city || 'Local Sector'}</span>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="relative group hidden md:block">
            <button className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 ${
              isCyberpunk
                ? 'hm-border-magenta bg-[rgba(26,11,46,0.95)] text-[#fcee0a]'
                : 'text-amber-400 bg-amber-500/10 rounded-lg border border-amber-500/30 px-3 py-1.5'
            }`}>
              <span>🏆</span><span>{displayName}</span><span className="opacity-50">▼</span>
            </button>
            <div className={`absolute right-0 mt-1 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50 overflow-hidden ${
              isCyberpunk
                ? 'hm-card-cyan'
                : 'bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl backdrop-blur-xl'
            }`}>
              <div className={`px-3 py-1.5 border-b flex items-center justify-between ${isCyberpunk ? 'border-[#00ffff]' : 'border-neutral-800 bg-neutral-800/30'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isCyberpunk ? 'text-[#9060d0]' : 'text-neutral-500'}`}>Global Leaderboard</span>
                <span className={`text-[8px] uppercase px-1.5 py-0.5 border font-bold ${isCyberpunk ? 'border-[#ff00ff] text-[#ff00ff]' : 'border-red-500/20 text-red-400 rounded'}`}>Live</span>
              </div>
              <div className="p-2 space-y-px max-h-72 overflow-y-auto">
                {leaderboard.length === 0 ? (
                  <div className="text-center p-2 text-xs opacity-50 font-mono">LOADING ROSTER...</div>
                ) : leaderboard.map((u, idx) => {
                  const me = user?.uid === u.id;
                  const rank = idx + 1;
                  return (
                  <div key={u.id} className={`flex items-center justify-between px-2 py-1 text-xs font-mono ${
                    isCyberpunk
                      ? me ? 'border border-[#ff00ff] bg-[rgba(255,0,255,0.08)]' : 'border border-transparent hover:bg-[rgba(255,0,255,0.06)]'
                      : me ? 'bg-emerald-500/10 rounded-lg' : 'hover:bg-neutral-800/50 rounded-lg'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-bold text-[10px] shrink-0 ${isCyberpunk ? (rank === 1 ? 'text-[#fcee0a]' : 'text-[#9060d0]') : (rank === 1 ? 'text-amber-400' : 'text-neutral-500')}`}>
                        {rank < 10 ? `0${rank}` : rank}
                      </span>
                      <span className={`truncate ${isCyberpunk ? (me ? 'text-[#ff00ff] font-bold' : 'text-[#00ffff]') : (me ? 'text-emerald-400 font-medium' : 'text-neutral-300')}`}>
                        {getLeaderboardDisplayName(u)}
                      </span>
                    </div>
                    <span className={`text-[10px] shrink-0 ml-2 ${isCyberpunk ? 'text-[#9060d0]' : 'text-neutral-500'}`}>{u.score}xp</span>
                  </div>
                )})}</div>
            </div>
          </div>

          <div className={`h-5 w-px ${isCyberpunk ? 'bg-[#ff00ff] opacity-30' : 'bg-neutral-700'}`} />

          {/* Theme Toggle */}
          <button onClick={toggleTheme} title="Toggle Theme"
            className={`p-1.5 flex items-center justify-center ${
              isCyberpunk
                ? 'hm-border-magenta bg-[rgba(26,11,46,0.95)] text-[#ff00ff] hover:bg-[rgba(255,0,255,0.12)]'
                : 'border border-neutral-700 bg-neutral-800 rounded-lg text-amber-400 hover:bg-neutral-700'
            }`}>
            {isCyberpunk
              ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            }
          </button>

          {/* User display — no redundant initial letter, just name + settings icon */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono hidden sm:block ${isCyberpunk ? 'text-[#00ffff]' : 'text-neutral-300'}`}>
              {displayName}
            </span>
            {/* Settings / Nickname icon */}
            <button
              onClick={() => setShowNicknameModal(true)}
              title="Set Nickname"
              className={`p-1.5 flex items-center justify-center transition-colors ${
                isCyberpunk
                  ? 'text-[#9060d0] hover:text-[#ff00ff]'
                  : 'text-neutral-500 hover:text-neutral-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          <button onClick={handleLogout}
            className={`text-xs font-bold uppercase px-3 py-1 border transition-colors ${
              isCyberpunk
                ? 'border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff] hover:text-[#060010]'
                : 'border-red-500/50 text-red-400 rounded-lg hover:bg-red-500 hover:text-white'
            }`} >
            [ SYSTEM LOGOUT ]
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Main content */}
        <main className="flex-1 min-h-0 overflow-hidden p-3 z-10">
          <div className="w-full h-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── Nickname Modal ── */}
      {showNicknameModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNicknameModal(false); }}
        >
          <div className={`w-full max-w-sm p-6 space-y-4 border ${
            isCyberpunk
              ? 'bg-[#080010] border-[#ff00ff] shadow-[0_0_40px_rgba(255,0,255,0.2)]'
              : 'bg-neutral-900 border-neutral-700 rounded-2xl shadow-2xl'
          }`}>
            <div>
              <h2 className={`text-xs uppercase font-bold tracking-widest mb-1 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-neutral-200'}`}>Set Operator Nickname</h2>
              <p className="text-[11px] font-mono opacity-50">
                Display as: {nicknameInput.trim() ? `${nicknameInput.trim()} (${userName})` : userName}
              </p>
            </div>
            <input
              ref={nicknameInputRef}
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNickname(); if (e.key === 'Escape') setShowNicknameModal(false); }}
              placeholder="Enter callsign..."
              maxLength={20}
              className={`w-full px-3 py-2 text-sm font-mono focus:outline-none transition-colors border ${
                isCyberpunk
                  ? 'bg-black border-[#00ffff]/40 text-[#00ffff] placeholder-[#00ffff]/30 focus:border-[#ff00ff]'
                  : 'bg-neutral-800 border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:border-emerald-500'
              }`}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveNickname}
                disabled={isSavingNickname}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest border transition-all ${
                  isCyberpunk
                    ? 'border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff] hover:text-black'
                    : 'border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg'
                }`}
              >
                {isSavingNickname ? 'Saving...' : 'Save Callsign'}
              </button>
              <button
                onClick={() => setShowNicknameModal(false)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-all ${
                  isCyberpunk
                    ? 'border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300'
                    : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300 rounded-lg'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
