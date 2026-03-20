import { create } from 'zustand';

interface SettingsStore {
    theme: 'dark' | 'light';
    model: string;
    setTheme: (theme: 'dark' | 'light') => void;
    setModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
    theme: 'dark',
    model: 'gemini-2.0-flash',
    setTheme: (theme) => set({ theme }),
    setModel: (model) => set({ model })
}));
