import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useCheckinStore } from '../store/checkinStore';
import Chat from './Chat/Chat';
import Dashboard from './Dashboard/Dashboard';
import ManagerView from './Manager/ManagerView';
import IntegrationDashboard from './Integrations/IntegrationDashboard';
import CheckInFlow from './CheckIn/CheckInFlow';
import WelcomeScreen from './CheckIn/WelcomeScreen';
import ProactiveOutreachBanner from './ProactiveOutreachBanner';

const TAB_HEIGHT = 64;
const HEADER_HEIGHT = 56;

export default function MainShell() {
  const { user, logout } = useAuthStore();
  const { activeTab, setActiveTab } = useUIStore();
  const { pendingCheckin, routingResult, pendingPeerReviews, fetchPeerReviews } = useCheckinStore();
  const [chatUnlocked, setChatUnlocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isManager = user?.role === 'Manager';
  const isAtRisk = user?.isAtRisk === true;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isManager) void fetchPeerReviews();
  }, [isManager, fetchPeerReviews]);

  useEffect(() => {
    if (activeTab === 'chat' && !isManager) {
      void fetchPeerReviews();
      setChatUnlocked(false);
    }
  }, [activeTab, isManager, fetchPeerReviews]);

  const tabs = [
    {
      id: 'chat' as const,
      label: 'Chat',
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    ...(isManager ? [
      {
        id: 'manager' as const,
        label: 'Manager',
        icon: (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        id: 'integrations' as const,
        label: 'Integrations',
        icon: (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        ),
      },
    ] : []),
  ];

  const renderContent = () => {
    const hasPendingCheckin = pendingCheckin && !routingResult;
    const hasPeerReviews = pendingPeerReviews.length > 0;

    if (activeTab === 'chat' && !isManager) {
      if (chatUnlocked) return <Chat />;
      if (hasPendingCheckin || hasPeerReviews) {
        return <CheckInFlow firstName={firstName} userName={user?.name} userEmail={user?.email} onAskAnything={() => setChatUnlocked(true)} onLogout={logout} />;
      }
      return (
        <WelcomeScreen
          firstName={firstName}
          userName={user?.name}
          userEmail={user?.email}
          onCheckIn={() => {}}
          onAskAnything={() => setChatUnlocked(true)}
          onLogout={logout}
          hasPendingCheckin={false}
        />
      );
    }

    switch (activeTab) {
      case 'chat': return <Chat />;
      case 'dashboard': return <Dashboard />;
      case 'manager': return isManager ? <ManagerView /> : <Chat />;
      case 'integrations': return isManager ? <IntegrationDashboard /> : <Chat />;
      default: return <Chat />;
    }
  };

  const isWelcomeScreen =
    !isManager && activeTab === 'chat' && !chatUnlocked &&
    !(pendingCheckin && !routingResult) && pendingPeerReviews.length === 0;
  const isCheckinWelcome =
    !isManager && activeTab === 'chat' && !chatUnlocked &&
    ((pendingCheckin && !routingResult) || pendingPeerReviews.length > 0);
  const hideHeader = isWelcomeScreen || isCheckinWelcome;

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>

      {/* ── Header — matches Figma ── */}
      {!hideHeader && (
        <div style={{
          height: HEADER_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid #e9e9e9',
          background: '#fff',
          position: 'relative',
          zIndex: 10,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: '#ef6b1a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17,
            }}>
              ⚡
            </div>
            <span style={{ fontWeight: 700, color: '#ef6b1a', fontSize: 19, letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
              Afloat
            </span>
          </div>

          {/* Hamburger menu — sign-out lives here */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 4px', display: 'flex', flexDirection: 'column',
                gap: 5, alignItems: 'flex-end',
              }}
              aria-label="Menu"
            >
              <span style={{ display: 'block', width: 20, height: 2, background: '#151515', borderRadius: 1 }} />
              <span style={{ display: 'block', width: 20, height: 2, background: '#151515', borderRadius: 1 }} />
              <span style={{ display: 'block', width: 20, height: 2, background: '#151515', borderRadius: 1 }} />
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: '#fff', border: '1px solid #e9e9e9', borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                minWidth: 160, zIndex: 100, overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{user?.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{user?.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#ef4444',
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* At-risk banner */}
      {isAtRisk && <ProactiveOutreachBanner />}

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>

      {/* ── Tab bar — matches Figma ── */}
      <div style={{
        height: TAB_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        borderTop: '1px solid #e9e9e9',
        background: '#fff',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 11, fontWeight: 500,
                color: isActive ? '#ef6b1a' : '#8b8b8b',
                position: 'relative', fontFamily: 'Inter, sans-serif',
              }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute', top: 0,
                  left: '50%', transform: 'translateX(-50%)',
                  width: 48, height: 3,
                  background: '#ef6b1a',
                  borderRadius: '0 0 3px 3px',
                }} />
              )}
              <span style={{ color: isActive ? '#ef6b1a' : '#8b8b8b' }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
