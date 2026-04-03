import { create } from 'zustand';
import type { Theme, AISettings, DisplayPreferences } from '../types';

interface SettingsState {
  theme: Theme;
  ai: AISettings;
  display: DisplayPreferences;
  settingsOpen: boolean;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setAI: (ai: Partial<AISettings>) => void;
  setDisplay: (prefs: Partial<DisplayPreferences>) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  ai: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4',
    temperature: 0.7,
  },
  display: {
    compactMode: false,
    showPreview: true,
    showAvatars: true,
  },
  settingsOpen: false,

  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setAI: (ai) =>
    set((state) => ({ ai: { ...state.ai, ...ai } })),
  setDisplay: (prefs) =>
    set((state) => ({ display: { ...state.display, ...prefs } })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
