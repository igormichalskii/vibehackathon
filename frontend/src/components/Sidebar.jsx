import { useState } from 'react';

const C = {
  navy:       '#0B1C34',
  navyLight:  '#122440',
  navyBorder: '#1E3352',
  blue:       '#005BAC',
  blueLight:  '#E8F0FA',
  textMuted:  '#8BA3C1',
  white:      '#FFFFFF',
};

const NAV_ITEMS = [
  {
    key: 'checks',
    label: 'Checks',
    badge: 'NOW',
    badgeColor: '#C8202D',
    icon: (color) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    key: 'radar',
    label: 'Radar',
    badge: 'GEO',
    badgeColor: '#0369A1',
    icon: (color) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 6a6 6 0 0 1 6 6"/><path d="M12 10a2 2 0 0 1 2 2"/>
      </svg>
    ),
  },
  {
    key: 'risk',
    label: 'Risk Report',
    badge: 'ML',
    badgeColor: '#6D28D9',
    icon: (color) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
];

export default function Sidebar({ isOpen, onClose, stats, activeTab, onTabChange }) {
  const [hoverClose, setHoverClose] = useState(false);

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        width: 220,
        minWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        background: C.navy,
        borderRight: `1px solid ${C.navyBorder}`,
        zIndex: 30,
        transform: isOpen ? 'translateX(0)' : undefined,
        transition: 'transform 200ms ease-out',
        flexShrink: 0,
      }}
      className={!isOpen ? 'sidebar-hidden' : ''}
      aria-label="Main navigation"
    >
      <style>{`
        @media (min-width: 1024px) { .sidebar-hidden { position: static !important; transform: none !important; } }
        @media (max-width: 1023px) { .sidebar-hidden { transform: translateX(-100%) !important; } }
      `}</style>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 56, borderBottom: `1px solid ${C.navyBorder}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, background: C.blue,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: C.white, lineHeight: 1, letterSpacing: '0.02em' }}>
              LOTAMS
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 9, color: C.textMuted, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 3 }}>
              MRO Intelligence
            </div>
          </div>
        </div>

        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          onMouseEnter={() => setHoverClose(true)}
          onMouseLeave={() => setHoverClose(false)}
          style={{
            display: 'none',
            padding: 6, background: hoverClose ? C.navyLight : 'transparent',
            border: 'none', cursor: 'pointer', color: C.textMuted,
          }}
          className="sidebar-close-btn"
          aria-label="Zamknij nawigację"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <style>{`@media (max-width: 1023px) { .sidebar-close-btn { display: block !important; } }`}</style>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 8px' }} aria-label="Nawigacja główna">
        <div style={{
          fontFamily: "'Syne', sans-serif", fontSize: 10, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textMuted,
          padding: '0 8px', marginBottom: 8,
        }}>
          Moduły
        </div>

        {NAV_ITEMS.map(item => {
          const active = activeTab === item.key;
          return (
            <div
              key={item.key}
              onClick={() => { onTabChange(item.key); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', marginBottom: 2,
                background: active ? 'rgba(0, 91, 172, 0.18)' : 'transparent',
                borderLeft: `3px solid ${active ? C.blue : 'transparent'}`,
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              {item.icon(active ? C.blue : C.textMuted)}
              <span style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? C.white : C.textMuted,
                flex: 1,
              }}>
                {item.label}
              </span>
              {item.badge && (
                <span style={{
                  background: item.badgeColor, color: '#FFFFFF',
                  fontFamily: "'Syne', sans-serif", fontSize: 10, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 2, letterSpacing: '0.04em', lineHeight: 1.4,
                }}>
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px 20px', borderTop: `1px solid ${C.navyBorder}`, flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif", fontSize: 10, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textMuted, marginBottom: 10,
        }}>
          Status systemu
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0, boxShadow: '0 0 0 2px rgba(34,197,94,0.2)' }} />
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: C.textMuted }}>
            Pipeline aktywny
          </span>
        </div>

        <div style={{
          background: C.navyLight, border: `1px solid ${C.navyBorder}`,
          padding: '12px 14px',
        }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 26, color: C.white, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {stats ? stats.total_fleet : '—'}
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: C.textMuted, marginTop: 5, lineHeight: 1.4 }}>
            samolotów śledzonych
            <span style={{ display: 'block', fontSize: 10, color: '#4A6585', marginTop: 2 }}>Boeing 737 · Europa</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
