import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  {
    id: 'light',
    name: 'Light Civic',
    icon: '☀️',
    desc: 'Crisp municipal blue & clean daylight slate',
    colors: ['#1e3a8a', '#0284c7', '#f8fafc']
  },
  {
    id: 'dark',
    name: 'Midnight Dark',
    icon: '🌙',
    desc: 'Deep obsidian blue & radiant sky highlights',
    colors: ['#38bdf8', '#60a5fa', '#0b0f19']
  },
  {
    id: 'emerald',
    name: 'Eco Emerald',
    icon: '🌲',
    desc: 'Sustainable green & refreshing mint tones',
    colors: ['#065f46', '#059669', '#f0fdf4']
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    icon: '🌆',
    desc: 'Warm terracotta, copper & civic stone',
    colors: ['#9a3412', '#d97706', '#fffbf5']
  },
  {
    id: 'cyber',
    name: 'Cyber Violet',
    icon: '🌌',
    desc: 'High-contrast neon purple & electric cyan',
    colors: ['#a855f7', '#06b6d4', '#09090b']
  },
  {
    id: 'parchment',
    name: 'Gov Parchment',
    icon: '📜',
    desc: 'Classic archival paper & warm bronze ink',
    colors: ['#451a03', '#b45309', '#fcfaf4']
  }
];

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  themes: THEMES
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('civiclens_theme') || 'light';
    } catch (_e) {
      return 'light';
    }
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('civiclens_theme', newTheme);
    } catch (_e) {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
