import { create } from 'zustand';
import { User } from '../types/index';
import apiClient from '../api/client';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post('/api/auth/login', { email, password });
      const { token, user } = res.data;
      await chrome.storage.local.set({ afloat_token: token, afloat_user: JSON.stringify(user) });
      set({ token, user, isLoading: false });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg = axiosErr.response?.data?.error || 'Login failed. Check your credentials.';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  logout: () => {
    chrome.storage.local.remove(['afloat_token', 'afloat_user']);
    set({ token: null, user: null, error: null });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const result = await chrome.storage.local.get(['afloat_token', 'afloat_user']);
      if (result.afloat_token && result.afloat_user) {
        const user = JSON.parse(result.afloat_user as string) as User;
        set({ token: result.afloat_token as string, user, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
