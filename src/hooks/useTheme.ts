import { useEffect, useState } from 'react';
import type { ThemeSetting } from '../types';

const STORAGE_KEY = 'einsteigen-theme';

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const [setting, setSetting] = useState<ThemeSetting>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
    } catch {}
    return 'auto';
  });

  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = setting === 'dark' || (setting === 'auto' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#09090b' : '#ffffff');
    try {
      localStorage.setItem(STORAGE_KEY, setting);
    } catch {}
  }, [isDark, setting]);

  const cycleTheme = () => {
    setSetting(isDark ? 'light' : 'dark');
  };

  return { setting, setSetting, isDark, cycleTheme };
}
