'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeContextType = {
  isCyberpunk: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isCyberpunk, setIsCyberpunk] = useState(false);

  // Read initial preference, could come from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('socmaster-theme-cyberpunk');
    if (saved === 'true') {
      setIsCyberpunk(true);
    }
  }, []);

  const toggleTheme = () => {
    setIsCyberpunk(prev => {
      const next = !prev;
      localStorage.setItem('socmaster-theme-cyberpunk', String(next));
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isCyberpunk, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
