import { useState, useMemo, useEffect, Fragment } from 'react';

const C = {
  navy:        '#0B1C34',
  blue:        '#005BAC',
  blueLight:   '#E8F0FA',
  white:       '#FFFFFF',
  grayBg:      '#F5F7FA',
  grayBorder:  '#DDE3ED',
  textPrimary: '#0B1C34',
  textMuted:   '#6B7A90',
  red:         '#C8202D',
  amber:       '#C97B00',
  green:       '#15803D',
};

const PRIORITY_STYLE = {
  HIGH:   { bg: '#C8202D', fg: '#FFFFFF', label: 'HIGH' },
  MEDIUM: { bg: '#C97B00', fg: '#FFFFFF', label: 'MEDIUM' },
  LOW:    { bg: '#DDE3ED', fg: '#6B7A90', label: 'LOW' },
};

const SEVERITY_STYLE = {
  Major:    { bg: '#FEE2E2', fg: '#B91C1C', border: '#FECACA' },
  Moderate: { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A' },
  Minor:    { bg: '#E8F0FA', fg: '#005BAC', border: '#BFDBFE' },
  None:     { bg: '#F5F7FA', fg: '#6B7A90', border: '#DDE3ED' },
};

const SYSTEM_COLORS = {
  'Landing Gear':    '#C8202D',
  'Flight Controls': '#005BAC',
  'Electrical':      '#C97B00',
  'Structure':       '#6D28D9',
  'Fuel System':     '#0891B2',
  'Powerplant':      '#7C3AED',
  'Ice Protection':  '#0284C7',
  'Hydraulic':       '#15803D',
  'Air Conditioning':'#D97706',
  'Pneumatic':       '#0369A1',
  'Water/Waste':     '#64748B',
  'Equipment':       '#475569',
};

const SECTION_TITLE = {
  fontFamily: "'Syne', sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: C.textMuted,
};

// Best model per task (from output CSVs)
const ML_SUMMARY = [
  {
    task: 'Task 1',
    name: 'Wykrywanie uszkodzeń',
    type: 'Klasyfikacja binarna',
    best: 'Logistic Regression',
    metric: 'ROC-AUC',
    value: '0.639',
    color: C.red,
  },
  {
    task: 'Task 2',
    name: 'Predykcja dotkliwości',
    type: 'Klasyfikacja wieloklasowa',
    best: 'KNN',
    metric: 'F1 (weighted)',
    value: '0.302',
    color: C.amber,
  },
  {
    task: 'Task 3',
    name: 'Estymacja RUL',
    type: 'Regresja',
    best: 'Random Forest',
    metric: 'R²',
    value: '0.852',
    color: C.green,
  },
];

function SortArrow({ dir }) {
  if (!dir) return <span style={{ opacity: 0.35, marginLeft: 6, fontSize: 9 }}>▲▼</span>;
  return <span style={{ marginLeft: 6, fontSize: 10 }}>{dir === 'asc' ? '▲' : '▼'}</span>;
}

function ColTooltip({ desc, children }) {
  const [show, setShow] = useState(false);
  if (!desc) return <>{children}</>;
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          marginTop: 8, zIndex: 9999,
          background: '#1E293B', color: '#E2E8F0',
          padding: '8px 12px', borderRadius: 4,
          fontSize: 11, fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: 400, letterSpacing: 0, textTransform: 'none',
          whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderBottom: '5px solid #1E293B',
          }} />
          {desc}
        </div>
      )}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLE[priority] || PRIORITY_STYLE.LOW;
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px',
      fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      background: s.bg, color: s.fg, borderRadius: 2,
    }}>{s.label}</span>
  );
}

function SeverityBadge({ severity }) {
  const s = SEVERITY_STYLE[severity] || SEVERITY_STYLE.None;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px',
      fontSize: 11, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600,
      background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 999,
    }}>{severity || 'irrelevant'}</span>
  );
}

function DamageBar({ value }) {
  const pct = value ?? 0;
  const color = pct >= 90 ? C.red : pct >= 60 ? C.amber : C.blue;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: C.grayBorder, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.textPrimary, minWidth: 42, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function CorrosionDots({ value }) {
  const v = value ?? 0;
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: 1,
          background: i < v ? (v >= 8 ? C.red : v >= 5 ? C.amber : C.blue) : C.grayBorder,
        }} />
      ))}
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.textMuted, marginLeft: 4 }}>
        {v}/10
      </span>
    </div>
  );
}

function RulCell({ value }) {
  if (value === 0) {
    return (
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.red, fontWeight: 700 }}>
        WYCZERPANY
      </span>
    );
  }
  const color = value < 2000 ? C.red : value < 5000 ? C.amber : C.textPrimary;
  return (
    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color, fontWeight: value < 2000 ? 700 : 400 }}>
      {value != null ? value.toLocaleString('pl-PL') + ' h' : '—'}
    </span>
  );
}

function MetricCard({ accent, label, number, sub }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, background: '#FFFFFF',
      border: `1px solid ${C.grayBorder}`, borderLeft: `4px solid ${accent}`,
      padding: '20px 24px', boxShadow: '0 1px 3px rgba(11,28,52,0.04)',
    }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textMuted }}>{label}</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 52, lineHeight: 1.05, color: accent, marginTop: 8, letterSpacing: '-0.02em' }}>{number}</div>
      <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6, fontFamily: "'IBM Plex Sans', sans-serif" }}>{sub}</div>
    </div>
  );
}

function MlModelCard({ item }) {
  return (
    <div style={{
      flex: 1, minWidth: 180,
      background: '#FFFFFF', border: `1px solid ${C.grayBorder}`,
      padding: '14px 18px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 3, bottom: 0,
        background: item.color,
      }} />
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textMuted, marginBottom: 4 }}>
        {item.task} · {item.type}
      </div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>
        {item.name}
      </div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
        Najlepszy: <span style={{ color: C.textPrimary, fontWeight: 600 }}>{item.best}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 700, color: item.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {item.value}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.textMuted }}>
          {item.metric}
        </span>
      </div>
    </div>
  );
}

function SystemBadge({ system }) {
  const color = SYSTEM_COLORS[system] || C.textMuted;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: C.textPrimary }}>{system}</span>
    </div>
  );
}

function ExpandedPartRow({ part }) {
  const dmgColor = (part.damage_probability ?? 0) >= 90 ? C.red
    : (part.damage_probability ?? 0) >= 60 ? C.amber : C.blue;

  const insights = [];
  if ((part.rul_fh ?? 1) === 0) insights.push({ level: 'critical', text: 'RUL wyczerpany — część wymaga natychmiastowej wymiany przed C-checkiem.' });
  if ((part.rul_fh ?? 9999) < 2000 && (part.rul_fh ?? 1) > 0) insights.push({ level: 'warning', text: `Niskie RFH (${part.rul_fh?.toLocaleString('pl-PL')} h) — zarezerwuj część z wyprzedzeniem.` });
  if (part.corrosion_risk >= 8) insights.push({ level: 'warning', text: `Wysoki wskaźnik korozji (${part.corrosion_risk}/10) — wymagana inspekcja powłok.` });
  if (part.predicted_severity === 'Major') insights.push({ level: 'critical', text: 'Prognozowana dotkliwość: Major — przewidywalna wymiana podzespołu.' });
  if (insights.length === 0) insights.push({ level: 'info', text: 'Brak krytycznych alarmów. Monitoruj wskaźniki w kolejnym cyklu.' });

  const INSIGHT_STYLE = {
    critical: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', dot: C.red },
    warning:  { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: C.amber },
    info:     { bg: C.blueLight, border: '#BFDBFE', text: '#005BAC', dot: C.blue },
  };

  return (
    <tr>
      <td colSpan={8} style={{ padding: 0, background: C.grayBg, borderBottom: `1px solid ${C.grayBorder}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: 24, gap: 0 }}>

          {/* Col 1 — techniczne */}
          <div style={{ padding: '0 24px 0 0', borderRight: `1px solid ${C.grayBorder}` }}>
            <div style={SECTION_TITLE}>Parametry techniczne</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginTop: 14 }}>
              {[
                ['System',        part.system,              false],
                ['Rozdział ATA',  `ATA ${part.ata_chapter}`, true],
                ['Korozja',       `${part.corrosion_risk}/10`, true],
                ['Dotkliwość',    part.predicted_severity,   false],
              ].map(([k, v, mono], i) => (
                <div key={i}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>
                    {k}
                  </div>
                  <div style={{ fontFamily: mono ? "'IBM Plex Mono', monospace" : "'IBM Plex Sans', sans-serif", fontSize: 13, color: C.textPrimary, fontWeight: mono ? 500 : 400 }}>
                    {v || '—'}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.grayBorder}` }}>
              <div style={{ ...SECTION_TITLE, marginBottom: 10 }}>Prawdopodobieństwo uszkodzenia</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ flex: 1, height: 8, background: C.grayBorder, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${part.damage_probability ?? 0}%`, height: '100%', background: dmgColor, borderRadius: 4 }} />
                </div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: dmgColor, letterSpacing: '-0.01em' }}>
                  {(part.damage_probability ?? 0).toFixed(1)}%
                </span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: C.textMuted }}>
                Na podstawie modelu Random Forest (R²=0.852)
              </div>
            </div>
          </div>

          {/* Col 2 — RUL */}
          <div style={{ padding: '0 24px', borderRight: `1px solid ${C.grayBorder}` }}>
            <div style={SECTION_TITLE}>Pozostały czas eksploatacji (RUL)</div>
            <div style={{ marginTop: 14 }}>
              {(part.rul_fh ?? 1) === 0 ? (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: C.red, letterSpacing: '-0.01em' }}>
                    WYCZERPANY
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: '#B91C1C', marginTop: 4 }}>
                    Część wymaga wymiany podczas C-checku
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 700, color: (part.rul_fh ?? 0) < 2000 ? C.red : (part.rul_fh ?? 0) < 5000 ? C.amber : C.textPrimary, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {(part.rul_fh ?? 0).toLocaleString('pl-PL')}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                    godz. do granicznego przeglądu
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Próg wymiany',     value: '0 FH',      mono: true },
                  { label: 'Strefa alarmowa',   value: '< 2 000 FH', mono: true },
                  { label: 'Strefa obserwacji', value: '< 5 000 FH', mono: true },
                  { label: 'Priorytet modelu',  value: part.priority, mono: false },
                ].map(({ label, value, mono }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: C.textMuted }}>{label}</span>
                    <span style={{ fontFamily: mono ? "'IBM Plex Mono', monospace" : "'IBM Plex Sans', sans-serif", fontSize: 12, color: C.textPrimary, fontWeight: 500 }}>{value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Col 3 — wnioski */}
          <div style={{ padding: '0 0 0 24px' }}>
            <div style={SECTION_TITLE}>Wnioski i rekomendacje</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {insights.map((ins, i) => {
                const s = INSIGHT_STYLE[ins.level];
                return (
                  <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 3 }} />
                    <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: s.text, lineHeight: 1.5 }}>
                      {ins.text}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.grayBorder}` }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                Predykcja oparta o dane historyczne CAMO (<strong style={{ color: C.textPrimary }}>CAMO_DANE_TRAIN.csv</strong>) oraz katalog magazynowy LOT (<strong style={{ color: C.textPrimary }}>LOT_AWS_B737_MAGAZYN_CZESCI.xlsx</strong>).
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function StyledSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '9px 32px 9px 12px', fontSize: 13,
        border: `1px solid ${C.grayBorder}`,
        background: `#FFFFFF url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%236B7A90' d='M0 0l5 6 5-6z'/></svg>") no-repeat right 12px center`,
        WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
        borderRadius: 2, color: C.textPrimary, outline: 'none',
        fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'pointer', minWidth: 160,
      }}
    >
      {options.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const COLS = [
  { key: 'part',               label: 'CZĘŚĆ / KOMPONENT', desc: 'Nazwa części lub podzespołu samolotu B737' },
  { key: 'system',             label: 'SYSTEM',            desc: 'Układ funkcjonalny, do którego należy część' },
  { key: 'ata_chapter',        label: 'ATA',               desc: 'Numer rozdziału wg standardu ATA 100 (klasyfikacja komponentów lotniczych)' },
  { key: 'damage_probability', label: 'USZKODZENIE %',     desc: 'Prawdopodobieństwo uszkodzenia wg modelu ML (Logistic Regression, Task 1)' },
  { key: 'corrosion_risk',     label: 'KOROZJA',           desc: 'Wskaźnik ryzyka korozji w skali 0–10 (10 = najwyższe ryzyko)' },
  { key: 'predicted_severity', label: 'DOTKLIWOŚĆ',        desc: 'Prognozowana dotkliwość uszkodzenia: Minor / Moderate / Major (Task 2)' },
  { key: 'rul_fh',             label: 'RFH',               desc: 'Remaining Flight Hours — szacowana liczba godz. lotu do granicznego przeglądu (Task 3)' },
  { key: 'priority',           label: 'PRIORYTET',         desc: 'Ogólny priorytet interwencji technicznej wg modelu ML: HIGH / MEDIUM / LOW' },
];

export default function RiskReport() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [search,   setSearch]   = useState('');
  const [priority, setPriority] = useState('ALL');
  const [system,   setSystem]   = useState('Wszystkie systemy');
  const [severity, setSeverity] = useState('Wszystkie');
  const [sortKey,  setSortKey]  = useState('damage_probability');
  const [sortDir,  setSortDir]  = useState('desc');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetch('/api/camo/risk-report')
      .then(r => { if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  const systems = useMemo(() => {
    const s = [...new Set(data.map(d => d.system).filter(Boolean))].sort();
    return [{ value: 'Wszystkie systemy', label: 'Wszystkie systemy' }, ...s.map(v => ({ value: v, label: v }))];
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data.filter(d => {
      if (search) {
        const q = search.toLowerCase();
        if (!d.part?.toLowerCase().includes(q) && !d.system?.toLowerCase().includes(q)) return false;
      }
      if (priority !== 'ALL' && d.priority !== priority) return false;
      if (system !== 'Wszystkie systemy' && d.system !== system) return false;
      if (severity !== 'Wszystkie' && d.predicted_severity !== severity) return false;
      return true;
    });

    const SEV_ORD = { Major: 0, Moderate: 1, Minor: 2, None: 3 };
    const PRI_ORD = { HIGH: 0, MEDIUM: 1, LOW: 2 };

    rows = [...rows].sort((a, b) => {
      let av, bv;
      if (sortKey === 'priority')           { av = PRI_ORD[a.priority] ?? 9; bv = PRI_ORD[b.priority] ?? 9; }
      else if (sortKey === 'predicted_severity') { av = SEV_ORD[a.predicted_severity] ?? 9; bv = SEV_ORD[b.predicted_severity] ?? 9; }
      else { av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity); bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity); }
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv ?? '').toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data, search, priority, system, severity, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'damage_probability' || key === 'rul_fh' || key === 'corrosion_risk' ? 'desc' : 'asc'); }
  }

  const highCount   = data.filter(d => d.priority === 'HIGH').length;
  const medCount    = data.filter(d => d.priority === 'MEDIUM').length;
  const lowCount    = data.filter(d => d.priority === 'LOW').length;
  const avgDmgHigh  = data.filter(d => d.priority === 'HIGH').reduce((s, d) => s + (d.damage_probability ?? 0), 0) / (highCount || 1);
  const zeroRulCount = data.filter(d => (d.rul_fh ?? 1) === 0).length;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 256, gap: 12 }}>
      <div style={{ width: 32, height: 32, border: `2px solid ${C.blue}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: C.textMuted, fontFamily: "'IBM Plex Sans', sans-serif" }}>Ładowanie danych ML…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: '40px 40px', maxWidth: 560 }}>
      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '16px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#B91C1C', marginBottom: 4 }}>Błąd ładowania danych</div>
        <div style={{ fontSize: 12, color: '#DC2626', fontFamily: 'monospace' }}>{error}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 12 }}>
          Upewnij się, że backend API działa:<br />
          <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 2, color: C.textPrimary }}>cd backend && uvicorn api:app --reload</code>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '32px 40px 80px', background: '#FFFFFF', minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textMuted }}>
            LOTAMS · CAMO ML Analysis
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: C.navy, margin: '6px 0 0' }}>
            C-Check Risk Report
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            Predykcja uszkodzeń i RUL dla {data.length} komponentów B737 · model Random Forest + Logistic Regression
          </div>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.textMuted }}>
          Ref: 22.05.2026
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
        <MetricCard accent={C.red}   label="Priorytet HIGH"   number={highCount}  sub={`śr. uszkodzenie ${avgDmgHigh.toFixed(1)}%`} />
        <MetricCard accent={C.amber} label="Priorytet MEDIUM" number={medCount}   sub="wymaga obserwacji" />
        <MetricCard accent={C.blue}  label="Priorytet LOW"    number={lowCount}   sub="monitoruj cyklicznie" />
      </div>

      {/* Filter bar */}
      <div style={{
        background: C.grayBg,
        borderTop: `1px solid ${C.grayBorder}`, borderBottom: `1px solid ${C.grayBorder}`,
        padding: '14px 40px', marginLeft: -40, marginRight: -40,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 0,
      }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 320 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj części lub systemu..."
            style={{
              width: '100%', padding: '9px 12px 9px 34px', fontSize: 13,
              border: `1px solid ${C.grayBorder}`, background: '#FFFFFF', borderRadius: 2,
              color: C.textPrimary, outline: 'none', fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2"
               style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
        </div>

        <StyledSelect value={priority} onChange={v => setPriority(v)} options={[
          { value: 'ALL',    label: 'Wszystkie priorytety' },
          { value: 'HIGH',   label: 'HIGH' },
          { value: 'MEDIUM', label: 'MEDIUM' },
          { value: 'LOW',    label: 'LOW' },
        ]} />

        <StyledSelect value={system} onChange={v => setSystem(v)} options={systems} />

        <StyledSelect value={severity} onChange={v => setSeverity(v)} options={[
          { value: 'Wszystkie', label: 'Wszystkie dotkliwości' },
          { value: 'Major',     label: 'Major' },
          { value: 'Moderate',  label: 'Moderate' },
          { value: 'Minor',     label: 'Minor' },
          { value: 'None',      label: 'None' },
        ]} />

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: C.textMuted }}>
          Wyświetlono <strong style={{ color: C.textPrimary, fontWeight: 600 }}>{filtered.length}</strong> z {data.length} komponentów
        </div>
      </div>

      {/* Table */}
      <div style={{ marginLeft: -40, marginRight: -40 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: C.navy }}>
              {COLS.map((c, i) => (
                <th key={i}
                  onClick={() => toggleSort(c.key)}
                  style={{
                    padding: i === 0 ? '14px 16px 14px 40px' : (i === COLS.length - 1 ? '14px 40px 14px 16px' : '14px 16px'),
                    color: '#FFFFFF', fontFamily: "'Syne', sans-serif", fontWeight: 600,
                    fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                    textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                  }}>
                  <ColTooltip desc={c.desc}>
                    {c.label}
                    <SortArrow dir={sortKey === c.key ? sortDir : null} />
                  </ColTooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((part, idx) => {
              const key = `${part.part}-${idx}`;
              const isOpen = expanded === key;
              return (
                <Fragment key={key}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : key)}
                    style={{
                      cursor: 'pointer',
                      background: isOpen ? C.blueLight : '#FFFFFF',
                      borderBottom: `1px solid ${C.grayBorder}`,
                      borderLeft: isOpen ? `3px solid ${C.blue}` : '3px solid transparent',
                      transition: 'background 120ms ease',
                    }}
                    onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = C.blueLight; }}
                    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = '#FFFFFF'; }}
                  >
                    {/* Część */}
                    <td style={{ padding: '14px 16px 14px 40px', verticalAlign: 'middle' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
                        {part.part}
                      </span>
                    </td>
                    {/* System */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <SystemBadge system={part.system || '—'} />
                    </td>
                    {/* ATA */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.textMuted }}>
                        {part.ata_chapter != null ? String(part.ata_chapter).padStart(2, '0') : '—'}
                      </span>
                    </td>
                    {/* Damage % */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <DamageBar value={part.damage_probability} />
                    </td>
                    {/* Corrosion */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <CorrosionDots value={part.corrosion_risk} />
                    </td>
                    {/* Severity */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <SeverityBadge severity={part.predicted_severity} />
                    </td>
                    {/* RUL */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <RulCell value={part.rul_fh} />
                    </td>
                    {/* Priority */}
                    <td style={{ padding: '14px 40px 14px 16px', verticalAlign: 'middle' }}>
                      <PriorityBadge priority={part.priority} />
                    </td>
                  </tr>
                  {isOpen && <ExpandedPartRow part={part} />}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '60px 40px', textAlign: 'center', color: C.textMuted, fontSize: 14, background: C.grayBg }}>
                  Brak komponentów spełniających kryteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 32, padding: '16px 20px', background: C.grayBg, border: `1px solid ${C.grayBorder}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
          Raport wygenerowany przez pipeline ML trenowany na danych CAMO historycznych.<br />
          <strong style={{ color: C.textPrimary }}>Task 1</strong> (wykrywanie uszkodzeń): Logistic Regression · ROC-AUC 0.639 &nbsp;·&nbsp;
          <strong style={{ color: C.textPrimary }}>Task 2</strong> (dotkliwość): KNN · F1w 0.302 &nbsp;·&nbsp;
          <strong style={{ color: C.textPrimary }}>Task 3</strong> (RUL): Random Forest · R²=0.852, MAE~2 313 FH
        </div>
      </div>
    </div>
  );
}
