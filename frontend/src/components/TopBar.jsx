import { useState } from 'react';

const C = {
  navy:       '#0B1C34',
  blue:       '#005BAC',
  grayBorder: '#DDE3ED',
  textMuted:  '#6B7A90',
  textPrimary:'#0B1C34',
  white:      '#FFFFFF',
};

export default function TopBar({ onMenuToggle, activeTab, onTabChange }) {
  const [hoverMenu, setHoverMenu] = useState(false);

  return (
    <header style={{
      height: 56, background: C.white,
      borderBottom: `1px solid ${C.grayBorder}`,
      display: 'flex', alignItems: 'center',
      padding: '0 40px 0 24px', gap: 8, flexShrink: 0,
    }}>
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        onMouseEnter={() => setHoverMenu(true)}
        onMouseLeave={() => setHoverMenu(false)}
        style={{
          display: 'none', padding: 8, marginLeft: -8, marginRight: 4,
          background: hoverMenu ? '#F5F7FA' : 'transparent',
          border: 'none', cursor: 'pointer', color: C.textMuted,
        }}
        className="topbar-menu-btn"
        aria-label="Otwórz nawigację"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <style>{`@media (max-width: 1023px) { .topbar-menu-btn { display: block !important; } }`}</style>

      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }} aria-label="Ścieżka nawigacji">
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: C.textMuted }}>
          LOTAMS
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grayBorder} strokeWidth="2" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
          {activeTab === 'radar' ? 'Radar geopolityczny' : activeTab === 'risk' ? 'C-Check Risk Report' : 'C-Check Priorities'}
        </span>
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Ref date badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#F5F7FA', border: `1px solid ${C.grayBorder}`,
          padding: '5px 12px',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }}>
            22.05.2026
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: C.grayBorder }} />

        {/* Pipeline status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0, boxShadow: '0 0 0 2px rgba(34,197,94,0.2)' }} />
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }}>
            Pipeline aktywny
          </span>
        </div>
      </div>
    </header>
  );
}
