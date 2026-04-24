import React from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useCheckinStore } from '../store/checkinStore';
import ProactiveOutreachBanner from './ProactiveOutreachBanner';
import Chat from './Chat/Chat';
import Dashboard from './Dashboard/Dashboard';
import ManagerView from './Manager/ManagerView';
import CheckInFlow from './CheckIn/CheckInFlow';

export default function MainShell() {
  const { user, logout } = useAuthStore();
  const { activeTab, setActiveTab, displayMode, setDisplayMode } = useUIStore();
  const { pendingCheckin, routingResult } = useCheckinStore();

  const isManager = user?.role === 'Manager';
  const isAtRisk = user?.isAtRisk === true;

  const handlePinToSidePanel = () => {
    setDisplayMode('sidepanel');
    try {
      chrome.sidePanel.open({ windowId: undefined as unknown as number });
    } catch {
      // not available in all contexts
    }
  };

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    )},
    { id: 'dashboard' as const, label: 'Dashboard', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    ...(isManager ? [{ id: 'manager' as const, label: 'Manager', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )}] : []),
  ];

  const containerClass = displayMode === 'popup'
    ? 'w-[400px] h-[600px]'
    : 'w-full min-h-screen';

  const renderContent = () => {
    // Show check-in flow if there's a pending check-in and no routing result yet
    if (pendingCheckin && !routingResult && activeTab === 'chat') {
      return <CheckInFlow />;
    }
    switch (activeTab) {
      case 'chat': return <Chat />;
      case 'dashboard': return <Dashboard />;
      case 'manager': return isManager ? <ManagerView /> : <Chat />;
      default: return <Chat />;
    }
  };

  return (
    <div className={`${containerClass} bg-white flex flex-col overflow-hidden`}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-orange-500 text-base tracking-tight">Afloat</span>
          <span className="text-sky-400 text-xs font-medium hidden sm:inline">Mission Control</span>
        </div>
        <div className="flex items-center gap-2">
          {displayMode === 'popup' && (
            <button
              onClick={handlePinToSidePanel}
              title="Pin to Side Panel"
              className="text-gray-400 hover:text-sky-500 transition p-1 rounded"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          )}
          <button
            onClick={logout}
            title="Sign out"
            className="text-gray-400 hover:text-gray-600 transition p-1 rounded text-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* At-risk banner */}
      {isAtRisk && <ProactiveOutreachBanner />}

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>

      {/* Tab bar */}
      <nav className="flex border-t border-gray-100 bg-white flex-shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition relative ${
                isActive
                  ? 'text-orange-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-b" />
              )}
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
