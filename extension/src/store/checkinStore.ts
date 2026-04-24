import { create } from 'zustand';
import { CheckIn, RoutingResult } from '../types/index';
import apiClient from '../api/client';

interface CheckInState {
  pendingCheckin: CheckIn | null;
  currentResponses: string[];
  routingResult: RoutingResult | null;
  isLoading: boolean;
  isSubmitting: boolean;
  fetchPending: () => Promise<void>;
  submitResponses: (responses: string[]) => Promise<void>;
  clearCheckin: () => void;
}

export const useCheckinStore = create<CheckInState>((set, get) => ({
  pendingCheckin: null,
  currentResponses: [],
  routingResult: null,
  isLoading: false,
  isSubmitting: false,

  fetchPending: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get('/api/checkins/pending');
      set({ pendingCheckin: (res.data.pending as CheckIn) || null, isLoading: false });
      if (res.data.pending) {
        const stored = await chrome.storage.local.get(['afloat_checkin_responses']);
        if (stored.afloat_checkin_responses) {
          set({ currentResponses: JSON.parse(stored.afloat_checkin_responses as string) as string[] });
        }
      }
    } catch {
      set({ isLoading: false });
    }
  },

  submitResponses: async (responses) => {
    const { pendingCheckin } = get();
    if (!pendingCheckin) return;
    set({ isSubmitting: true });
    try {
      const res = await apiClient.post(`/api/checkins/${pendingCheckin.id}/submit`, { responses });
      set({ routingResult: res.data.routing as RoutingResult, isSubmitting: false });
      chrome.storage.local.remove(['afloat_checkin_responses']);
      chrome.runtime.sendMessage({ type: 'CLEAR_BADGE' });
    } catch (err) {
      set({ isSubmitting: false });
      throw err;
    }
  },

  clearCheckin: () => {
    set({ pendingCheckin: null, currentResponses: [], routingResult: null });
    chrome.storage.local.remove(['afloat_checkin_responses']);
  },
}));
