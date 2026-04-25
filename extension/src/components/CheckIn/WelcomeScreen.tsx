import React, { useEffect, useRef, useState } from 'react';

interface WelcomeScreenProps {
  firstName: string;
  userName?: string;
  userEmail?: string;
  onCheckIn: () => void;
  onAskAnything: () => void;
  onLogout: () => void;
  hasPendingCheckin?: boolean;
}

function WaterBackground() {
  return (
    <>
      <svg
        viewBox="0 0 446 485"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          bottom: -2,
          left: -45,
          width: 'calc(100% + 45px)',
          height: '62%',
          pointerEvents: 'none',
        }}
        preserveAspectRatio="none"
      >
        <path
          d="M0 80 C60 40, 130 120, 200 80 C270 40, 340 100, 500 60 L500 485 L0 485 Z"
          fill="#c7eaf0"
          opacity="0.55"
        />
      </svg>
      <svg
        viewBox="0 0 446 485"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          bottom: -2,
          left: 0,
          width: '100%',
          height: '60%',
          pointerEvents: 'none',
        }}
        preserveAspectRatio="none"
      >
        <path
          d="M0 100 C70 55, 150 140, 230 95 C310 50, 390 120, 446 80 L446 485 L0 485 Z"
          fill="#a8d8e0"
          opacity="0.45"
        />
      </svg>
    </>
  );
}

function AvatarIllustration() {
  return (
    <img
      src="/icons/Frame 3.svg"
      alt="Afloat mascot"
      style={{ width: 110, height: 110 }}
    />
  );
}

export default function WelcomeScreen({
  firstName,
  userName,
  userEmail,
  onCheckIn,
  onAskAnything,
  onLogout,
  hasPendingCheckin = true,
}: WelcomeScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#ffffff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <WaterBackground />

      {/* ── Hamburger menu — top right ── */}
      <div ref={menuRef} style={{ position: 'absolute', top: 12, right: 14, zIndex: 10 }}>
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
            {(userName || userEmail) && (
              <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #f3f4f6' }}>
                {userName && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{userName}</p>}
                {userEmail && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{userEmail}</p>}
              </div>
            )}
            <button
              onClick={() => { setMenuOpen(false); onLogout(); }}
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

      {/* ── Main centered content ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginTop: '28%',
          width: '100%',
          padding: '0 24px',
          boxSizing: 'border-box',
        }}
      >
        <AvatarIllustration />

        <div style={{ marginTop: 28 }}>
          <p style={{
            fontSize: 32, fontWeight: 700, color: '#111827',
            lineHeight: 1.15, margin: 0,
            fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em',
          }}>
            Hey {firstName},
          </p>
          <p style={{
            fontSize: 24, fontWeight: 400, color: '#111827',
            lineHeight: 1.3, margin: '6px 0 0',
            fontFamily: 'Inter, sans-serif',
          }}>
            how's it going?
          </p>
        </div>

        {hasPendingCheckin && (
          <button
            onClick={onCheckIn}
            style={{
              marginTop: 32, padding: '16px 36px',
              background: '#ef6b1a', color: '#ffffff',
              border: 'none', borderRadius: 40,
              fontSize: 22, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em',
              boxShadow: '0 6px 20px rgba(239,107,26,0.4)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#d95f10'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#ef6b1a'; }}
          >
            check in
          </button>
        )}
      </div>

      {/* ── Ask anything card ── */}
      <div style={{ position: 'absolute', bottom: 16, left: 15, right: 15, zIndex: 3 }}>
        <button
          onClick={onAskAnything}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 18px', height: 68,
            background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
            border: '1.5px solid #4498a1', borderRadius: 10,
            cursor: 'pointer', textAlign: 'left',
            boxShadow: '0 2px 12px rgba(68,152,161,0.12)',
          }}
        >
          <span style={{
            fontSize: 20, color: '#4498a1',
            fontFamily: 'Inter, sans-serif', fontWeight: 400, letterSpacing: '-0.01em',
          }}>
            ask anything.
          </span>
          <div style={{
            width: 28, height: 28, background: '#ef6b1a', borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 2px 6px rgba(239,107,26,0.3)',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 12L12 2M12 2H5M12 2V9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}
