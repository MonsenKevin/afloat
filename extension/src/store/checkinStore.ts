import { create } from 'zustand';
import { CheckIn, RoutingResult, PeerReview } from '../types/index';
import apiClient from '../api/client';

interface CheckInState {
  pendingCheckin: CheckIn | null;
  currentResponses: string[];
  routingResult: RoutingResult | null;
  submittedScore: number | null;
  isLoading: boolean;
  isSubmitting: boolean;
  pendingPeerReviews: PeerReview[];
  fetchPending: () => Promise<void>;
  startCheckin: () => Promise<void>;
  submitResponses: (responses: string[]) => Promise<void>;
  clearCheckin: () => void;
  fetchPeerReviews: () => Promise<void>;
  submitPeerReview: (id: string, responses: string[]) => Promise<void>;
}

export const useCheckinStore = create<CheckInState>((set, get) => ({
  pendingCheckin: null,
  currentResponses: [],
  routingResult: null,
  submittedScore: null,
  isLoading: false,
  isSubmitting: false,
  pendingPeerReviews: [],

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

  startCheckin: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/api/checkins/generate', {});
      // Fetch the newly created pending check-in
      const pending = await apiClient.get('/api/checkins/pending');
      set({ pendingCheckin: (pending.data.pending as CheckIn) || null, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  submitResponses: async (responses) => {
    const { pendingCheckin } = get();
    if (!pendingCheckin) return;
    set({ isSubmitting: true });
    try {
      const res = await apiClient.post(
        `/api/checkins/${pendingCheckin.id}/submit`,
        { responses },
        { timeout: 30000 } // 30s — Claude classification can take a few seconds
      );
      set({
        routingResult: res.data.routing as RoutingResult,
        submittedScore: res.data.sentimentScore as number,
        isSubmitting: false,
      });
      chrome.storage.local.remove(['afloat_checkin_responses']);
      try { chrome.runtime.sendMessage({ type: 'CLEAR_BADGE' }); } catch { /* ignore */ }
    } catch (err) {
      set({ isSubmitting: false });
      throw err;
    }
  },

  clearCheckin: () => {
    set({ pendingCheckin: null, currentResponses: [], routingResult: null, submittedScore: null });
    chrome.storage.local.remove(['afloat_checkin_responses']);
  },

  fetchPeerReviews: async () => {
    try {
      const res = await apiClient.get('/api/checkins/peer-reviews/pending');
      set({ pendingPeerReviews: (res.data.peerReviews as PeerReview[]) || [] });
    } catch {
      // ignore
    }
  },

  submitPeerReview: async (id: string, responses: string[]) => {
    await apiClient.post(`/api/checkins/peer-reviews/${id}/submit`, { responses });
    // Remove the submitted review from pending list
    set(state => ({
      pendingPeerReviews: state.pendingPeerReviews.filter(pr => pr.id !== id),
    }));
  },
}));
