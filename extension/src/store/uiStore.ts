import { create } from 'zustand';

type DisplayMode = 'popup' | 'sidepanel';
type ActiveTab = 'chat' | 'dashboard' | 'manager' | 'integrations';

interface UIState {
  displayMode: DisplayMode;
  activeTab: ActiveTab;
  setDisplayMode: (mode: DisplayMode) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const useUIStore = create<UIState>((set) => ({
  displayMode: 'popup',
  activeTab: 'chat',
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
