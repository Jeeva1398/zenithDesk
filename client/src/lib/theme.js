import { useEffect, useState } from 'react';

// The chosen theme lives in localStorage; with no choice saved we follow the OS.
// index.html applies the same rule in an inline script before first paint, so
// a dark-mode user never sees a white flash while the bundle loads.
const STORAGE_KEY = 'zenithdesk_theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function resolve() {
  return readStored() || (media.matches ? 'dark' : 'light');
}

function apply(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function useTheme() {
  const [theme, setTheme] = useState(resolve);

  useEffect(() => {
    // Follow the OS live until the person picks a theme themselves.
    const onChange = () => {
      if (!readStored()) {
        const next = resolve();
        apply(next);
        setTheme(next);
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the switch still works for this page view.
    }
    apply(next);
    setTheme(next);
  };

  return { theme, toggle };
}
