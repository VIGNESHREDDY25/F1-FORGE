import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: false,
      toggle: () => {
        const next = !get().dark;
        set({ dark: next });
        document.documentElement.classList.toggle('dark', next);
      },
    }),
    { name: 'f1forge-theme' }
  )
);

// Apply on load
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('f1forge-theme');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.dark) document.documentElement.classList.add('dark');
    } catch {}
  }
}
