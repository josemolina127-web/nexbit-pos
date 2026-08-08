import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const glassBackdrop = { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' };

const darkVars = {
  '--bg': '#050505', '--surface': '#161616', '--surfaceHover': '#1f1f1f',
  '--border': '#2a2a2a', '--text': '#ffffff', '--textSecondary': '#e6e6e6',
  '--textMuted': '#b3b3b3', '--primary': '#FF4B00', '--primaryHover': '#e04400',
  '--primaryLight': 'rgba(255,75,0,0.12)', '--primaryDark': '#cc3d00',
  '--danger': '#dc2626', '--dangerLight': 'rgba(220,38,38,0.12)',
  '--warning': '#d97706', '--warningLight': 'rgba(217,119,6,0.12)',
  '--info': '#3b82f6', '--infoLight': 'rgba(59,130,246,0.12)',
  '--sidebarBg': '#050505', '--sidebarText': '#d9d9d9', '--sidebarHover': '#2a2a2a',
  '--sidebarActive': '#FF4B00', '--sidebarActiveBg': 'rgba(255,75,0,0.1)',
  '--shadowSm': '0 1px 2px rgba(0,0,0,0.3)',
  '--shadowMd': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
  '--shadowLg': '0 4px 6px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
  '--shadowXl': '0 10px 15px rgba(0,0,0,0.4), 0 4px 6px rgba(0,0,0,0.3)',
  '--blur': 'none',
};

const lightVars = {
  '--bg': 'linear-gradient(135deg, #f0f2f5 0%, #e2e6ef 50%, #e8e4f0 100%)',
  '--surface': 'rgba(248,249,252,0.75)',
  '--surfaceHover': 'rgba(255,255,255,0.9)',
  '--border': 'rgba(0,0,0,0.08)',
  '--text': '#1a1a2e', '--textSecondary': '#0d0d1a', '--textMuted': '#3d3d4a',
  '--primary': '#FF4B00', '--primaryHover': '#e04400',
  '--primaryLight': 'rgba(255,75,0,0.08)', '--primaryDark': '#cc3d00',
  '--danger': '#dc2626', '--dangerLight': 'rgba(220,38,38,0.08)',
  '--warning': '#d97706', '--warningLight': 'rgba(217,119,6,0.08)',
  '--info': '#5558e6', '--infoLight': 'rgba(85,88,230,0.08)',
  '--sidebarBg': 'rgba(248,249,252,0.85)',
  '--sidebarText': '#0d0d1a', '--sidebarActive': '#FF4B00',
  '--sidebarActiveBg': 'rgba(255,75,0,0.06)',
  '--sidebarHover': 'rgba(0,0,0,0.15)',
  '--shadowSm': '0 1px 3px rgba(0,0,0,0.06)',
  '--shadowMd': '0 4px 16px rgba(0,0,0,0.08)',
  '--shadowLg': '0 8px 32px rgba(0,0,0,0.1)',
  '--shadowXl': '0 12px 48px rgba(0,0,0,0.12)',
  '--blur': 'blur(12px)',
};

export const theme = {
  colors: {
    background: 'var(--bg)', surface: 'var(--surface)', surfaceHover: 'var(--surfaceHover)',
    border: 'var(--border)', text: 'var(--text)', textSecondary: 'var(--textSecondary)',
    textMuted: 'var(--textMuted)', primary: 'var(--primary)', primaryHover: 'var(--primaryHover)',
    primaryLight: 'var(--primaryLight)', primaryDark: 'var(--primaryDark)',
    danger: 'var(--danger)', dangerLight: 'var(--dangerLight)',
    warning: 'var(--warning)', warningLight: 'var(--warningLight)',
    info: 'var(--info)', infoLight: 'var(--infoLight)',
    sidebarBg: 'var(--sidebarBg)', sidebarText: 'var(--sidebarText)',
    sidebarActive: 'var(--sidebarActive)', sidebarActiveBg: 'var(--sidebarActiveBg)',
    sidebarHover: 'var(--sidebarHover)',
    success: 'var(--primary)', chart1: 'var(--primary)', chart2: 'var(--info)',
    chart3: 'var(--warning)', chart4: 'var(--danger)',
  },
  radius: { sm: '6px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
  shadow: { sm: 'var(--shadowSm)', md: 'var(--shadowMd)', lg: 'var(--shadowLg)', xl: 'var(--shadowXl)' },
  font: {
    sans: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'Consolas', monospace",
    sizeXs: '0.875rem', sizeSm: '0.9375rem', sizeBase: '1rem',
    sizeLg: '1.125rem', sizeXl: '1.375rem', size2xl: '1.625rem', size3xl: '2rem',
  },
  spacing: (n) => `${n * 4}px`,
};

export const card = {
  background: 'var(--surface)', borderRadius: theme.radius.lg,
  boxShadow: 'var(--shadowMd)', border: '1px solid var(--border)',
  backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
  color: 'var(--text)',
};

export const cardHeader = {
  padding: '16px 20px', borderBottom: '1px solid var(--border)',
};

export const cardBody = { padding: '20px' };

export const btn = {
  base: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', padding: '10px 18px', borderRadius: theme.radius.md,
    fontSize: theme.font.sizeSm, fontWeight: 500, border: 'none',
    cursor: 'pointer', transition: 'all 0.15s ease', lineHeight: 1.4,
  },
  primary: { background: 'var(--primary)', color: '#fff' },
  secondary: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
  danger: { background: 'var(--danger)', color: '#fff' },
  ghost: { background: 'transparent', color: 'var(--textSecondary)' },
  icon: { padding: '6px', borderRadius: theme.radius.md, background: 'transparent', color: 'var(--textSecondary)', border: 'none', cursor: 'pointer' },
};

export const input = {
  base: {
    width: '100%', padding: '10px 14px', borderRadius: theme.radius.md,
    border: '1px solid var(--border)', fontSize: theme.font.sizeSm,
    background: 'var(--surface)', color: 'var(--text)', outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  focus: { borderColor: 'var(--primary)', boxShadow: '0 0 0 2px var(--primaryLight)' },
};

export const badge = (variant = 'default') => {
  const vars = {
    default: { background: 'var(--surfaceHover)', color: 'var(--textSecondary)' },
    success: { background: 'var(--primaryLight)', color: 'var(--primary)' },
    danger: { background: 'var(--dangerLight)', color: 'var(--danger)' },
    warning: { background: 'var(--warningLight)', color: 'var(--warning)' },
    info: { background: 'var(--infoLight)', color: 'var(--info)' },
  };
  return {
    display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
    borderRadius: theme.radius.full, fontSize: theme.font.sizeXs,
    fontWeight: 500, ...(vars[variant] || vars.default),
  };
};

export const table = {
  wrapper: { ...card, overflow: 'auto' },
  th: {
    padding: '12px 16px', textAlign: 'left', fontWeight: 600,
    color: 'var(--textSecondary)', fontSize: theme.font.sizeXs,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    background: 'var(--surfaceHover)',
  },
  td: { padding: '12px 16px', fontSize: theme.font.sizeSm, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text)' },
  trHover: { transition: 'background 0.1s' },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('nexbit-theme') !== 'light');

  useEffect(() => {
    const vars = isDark ? darkVars : lightVars;
    const root = document.documentElement;
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val);
    }
    localStorage.setItem('nexbit-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = useCallback(() => setIsDark(p => !p), []);

  return React.createElement(ThemeContext.Provider, { value: { isDark, toggleTheme } }, children);
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}