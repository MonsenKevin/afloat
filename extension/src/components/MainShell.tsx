import React, { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useCheckinStore } from '../store/checkinStore';
import Chat from './Chat/Chat';
import Dashboard from './Dashboard/Dashboard';
import ManagerView from './Manager/ManagerView';
import CheckInFlow from './CheckIn/CheckInFlow';
import ProactiveOutreachBanner from './ProactiveOutreachBanner';

const TAB_HEIGHT = 56;
const HEADER_HEIGHT = 52;

export default function MainShell() {
  const { user, logout } = useAuthStore();
  const { activeTab, setActiveTab } = useUIStore();
  const { pendingCheckin, routingResult, pendingPeerReviews, fetchPeerReviews } = useCheckinStore();

  const isManager = user?.role === 'Manager';
  const isAtRisk = user?.isAtRisk === true;

  // Fetch peer reviews on mount and whenever the Chat tab becomes active
  useEffect(() => {
    if (!isManager) {
      void fetchPeerReviews();
    }
  }, [isManager, fetchPeerReviews]);

  useEffect(() => {
    if (activeTab === 'chat' && !isManager) {
      void fetchPeerReviews();
    }
  }, [activeTab, isManager, fetchPeerReviews]);

  const tabs = [
    {
      id: 'chat' as const, label: 'Chat',
      icon: <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    },
    {
      id: 'dashboard' as const, label: 'Dashboard',
      icon: <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
    ...(isManager ? [{
      id: 'manager' as const, label: 'Manager',
      icon: <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    }] : []),
  ];

  const renderContent = () => {
    const hasPendingCheckin = pendingCheckin && !routingResult;
    const hasPeerReviews = pendingPeerReviews.length > 0;
    // Show CheckInFlow on Chat tab if there's a pending self check-in OR pending peer reviews
    if ((hasPendingCheckin || hasPeerReviews) && activeTab === 'chat') return <CheckInFlow />;
    switch (activeTab) {
      case 'chat': return <Chat />;
      case 'dashboard': return <Dashboard />;
      case 'manager': return isManager ? <ManagerView /> : <Chat />;
      default: return <Chat />;
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ height: HEADER_HEIGHT, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #f3f4f6', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ width: 15, height: 15, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, color: '#f97316', fontSize: 16, letterSpacing: '-0.02em' }}>Afloat</span>
          <span style={{ color: '#38bdf8', fontSize: 11, fontWeight: 500 }}>Mission Control</span>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#9ca3af', display: 'flex', alignItems: 'center' }}
        >
          <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* At-risk banner */}
      {isAtRisk && <ProactiveOutreachBanner />}

      {/* Main content — takes all remaining space */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>

      {/* Tab bar */}
      <div style={{ height: TAB_HEIGHT, flexShrink: 0, display: 'flex', borderTop: '1px solid #f3f4f6', background: '#fff' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 11, fontWeight: 500,
                color: isActive ? '#f97316' : '#9ca3af',
                position: 'relative',
              }}
            >
              {isActive && (
                <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 32, height: 2, background: '#f97316', borderRadius: '0 0 2px 2px' }} />
              )}
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
