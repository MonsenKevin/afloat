import React, { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useCheckinStore } from '../store/checkinStore';
import LoginScreen from './LoginScreen';
import MainShell from './MainShell';

export default function App() {
  const { token, isLoading, restoreSession } = useAuthStore();
  const { restoreMessages } = useChatStore();
  const { fetchPending } = useCheckinStore();

  useEffect(() => {
    const init = async () => {
      await restoreSession();
    };
    void init();
  }, [restoreSession]);

  useEffect(() => {
    if (token) {
      void restoreMessages();
      void fetchPending();
    }
  }, [token, restoreMessages, fetchPending]);

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
      <div className="w-[400px] h-[600px] bg-white flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <svg className="animate-spin h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-[400px] h-[600px] bg-white">
        <LoginScreen />
      </div>
    );
  }

  return <MainShell />;
}
