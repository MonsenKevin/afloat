import React, { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useCheckinStore } from '../store/checkinStore';
import LoginScreen from './LoginScreen';
import MainShell from './MainShell';

export default function App() {
  const { token, isLoading, restoreSession, user } = useAuthStore();
  const { restoreMessages } = useChatStore();
  const { fetchPending, fetchPeerReviews } = useCheckinStore();

  useEffect(() => {
    const init = async () => {
      await restoreSession();
    };
    void init();
  }, [restoreSession]);

  useEffect(() => {
    if (token && user) {
      void restoreMessages(user.id);
      void fetchPending();
      void fetchPeerReviews();
    }
  }, [token, user?.id, restoreMessages, fetchPending, fetchPeerReviews]);

  useEffect(() => {
    // Listen for badge/notification events from the service worker
    const handler = (msg: { type: string }) => {
      if (msg.type === 'CHECK_IN_DUE') {
        void fetchPending();
      }
    };
    try {
      chrome.runtime.onMessage.addListener(handler);
      return () => {
        chrome.runtime.onMessage.removeListener(handler);
      };
    } catch {
      // not in extension context
      return undefined;
    }
  }, [fetchPending]);

  if (isLoading) {
    return (
      <div style={{ width: 400, height: 600, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ width: 20, height: 20, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <svg style={{ width: 20, height: 20, color: '#fb923c', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ width: 400, height: 600, background: '#fff' }}>
        <LoginScreen />
      </div>
    );
  }

  return <MainShell />;
}
