import { useState, useMemo, useEffect, useRef, Fragment } from 'react';

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
  purple:      '#6D28D9',
};

const PRIORITY_STYLE = {
  NOW:  { bg: '#C8202D', fg: '#FFFFFF', label: 'TERAZ' },
  '6M': { bg: '#C97B00', fg: '#FFFFFF', label: '6 MIES.' },
  '12M':{ bg: '#005BAC', fg: '#FFFFFF', label: '12 MIES.' },
  FAR:  { bg: '#DDE3ED', fg: '#6B7A90', label: 'DALEKO' },
};

const CHECK_STYLE = {
  'C-check': { bg: '#E8F0FA', fg: '#005BAC', border: '#005BAC' },
  'A-check': { bg: '#F1F5F9', fg: '#64748B', border: '#E2E8F0' },
  'B-check': { bg: '#FEF3C7', fg: '#C97B00', border: '#FDE68A' },
  'D-check': { bg: '#EDE9FE', fg: '#6D28D9', border: '#DDD6FE' },
};

const SECTION_TITLE = {
  fontFamily: "'Syne', sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: C.textMuted,
};

const OP_COLORS = {
  'Ryanair':           '#073590',
  'LOT Polish':        '#003F8A',
  'Enter Air':         '#C8202D',
  'Lufthansa':         '#05164D',
  'Wizz Air':          '#C6007E',
  'easyJet':           '#FF6600',
  'Jet2':              '#FF6900',
  'TUI Fly':           '#E2001A',
  'SunExpress':        '#E8251F',
  'Aegean':            '#003DA5',
  'airBaltic':         '#00A651',
  'Norwegian':         '#D40E14',
  'Vueling':           '#FFD700',
  'Transavia':         '#00873E',
  'Eurowings':         '#8B0000',
};

function getOpColor(op) {
  for (const [k, v] of Object.entries(OP_COLORS)) {
    if (op === k || op.startsWith(k) || k.startsWith(op)) return v;
  }
  let hash = 0;
  for (let i = 0; i < op.length; i++) hash = (hash * 31 + op.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 55%, 35%)`;
}

const opInitials = (op) =>
  op.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

function activityFor(reg, durDays, lastGapLabel) {
  const MONTH_LABELS = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
  let seed = 0;
  for (let i = 0; i < reg.length; i++) seed = (seed * 31 + reg.charCodeAt(i)) >>> 0;
  function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; }

  // Jan 2022 → May 2026 = 53 months
  const totalMonths = 53;
  const months = [];
  for (let i = 0; i < totalMonths; i++) {
    const y = 2022 + Math.floor(i / 12);
    const m = i % 12;
    months.push({ year: y, month: m, label: `${MONTH_LABELS[m]} ${y}`, active: 1, gap: 0 });
  }

  // Mark the real last C-check window based on lastGapLabel (e.g. "Sep 2025")
  if (lastGapLabel) {
    const numStr = monthNumPL(lastGapLabel); // "09.2025"
    const [mm, yyyy] = numStr.split('.');
    const gapYear = parseInt(yyyy), gapMonth = parseInt(mm) - 1;
    // compute exact end month from real dates
    const startDate = new Date(gapYear, gapMonth, 1);
    const endDate   = new Date(startDate);
    endDate.setDate(endDate.getDate() + durDays - 1);
    months.forEach((cell, i) => {
      const cellDate = new Date(cell.year, cell.month, 1);
      const cellEnd  = new Date(cell.year, cell.month + 1, 0); // last day of month
      if (cellEnd >= startDate && cellDate <= endDate) {
        months[i].active = 0;
        months[i].gap = durDays;
      }
    });
  }

  // A-check gaps hardcoded to match windowsFor: Jul 2022 (idx=6) and Nov 2022 (idx=10)
  months[6].active  = 0; months[6].gap  = 2;  // 14–16.07.2022
  months[10].active = 0; months[10].gap = 3;  // 03–06.11.2022
  return months;
}

function monthNumPL(s) {
  const map = {
    // Polish
    Sty:'01',Lut:'02',Mar:'03',Kwi:'04',Maj:'05',Cze:'06',Lip:'07',Sie:'08',Wrz:'09','Paź':'10',Lis:'11',Gru:'12',
    // English (backend sends these)
    Jan:'01',Feb:'02',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12',
  };
  const [mm, yyyy] = s.split(' ');
  return `${map[mm] || '01'}.${yyyy}`;
}

function rangeString(lastGap, dur) {
  const numStr = monthNumPL(lastGap);
  const [mm, yyyy] = numStr.split('.');
  const start = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
  const end   = new Date(start);
  end.setDate(end.getDate() + dur - 1);
  const pad = n => String(n).padStart(2, '0');
  return `01.${pad(start.getMonth()+1)}.${start.getFullYear()} – ${pad(end.getDate())}.${pad(end.getMonth()+1)}.${end.getFullYear()}`;
}

function windowsFor(a) {
  return [
    { range: '14.07.2022 – 16.07.2022', dur: 2,    check: 'A-check' },
    { range: '03.11.2022 – 06.11.2022', dur: 3,    check: 'A-check' },
    { range: rangeString(a.lastGap, a.dur),         dur: a.dur, check: a.check },
  ];
}

function CheckBadge({ type }) {
  const s = CHECK_STYLE[type] || CHECK_STYLE['A-check'];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px',
      fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 600, letterSpacing: '0.02em',
      background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 999,
    }}>{type}</span>
  );
}

function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLE[priority] || PRIORITY_STYLE.FAR;
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px',
      fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      background: s.bg, color: s.fg, borderRadius: 2,
    }}>{s.label}</span>
  );
}

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

function ContactButton() {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={e => e.stopPropagation()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 11,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '6px 14px', border: `1px solid ${C.blue}`,
        background: hover ? C.blue : 'transparent',
        color: hover ? '#FFFFFF' : C.blue,
        cursor: 'pointer', borderRadius: 2,
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >Kontakt</button>
  );
}

function ActivityChart({ data }) {
  const MONTHS_ABB = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
  const [hoverIdx, setHoverIdx] = useState(null);

  const byYear = {};
  data.forEach((m, i) => {
    if (!byYear[m.year]) byYear[m.year] = {};
    byYear[m.year][m.month] = { ...m, idx: i };
  });
  const years = Object.keys(byYear).map(Number).sort();
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Month header */}
      <div style={{ display: 'flex', marginLeft: 38, gap: 3, marginBottom: 6 }}>
        {MONTHS_ABB.map((abbr, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: C.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
            {abbr}
          </div>
        ))}
      </div>

      {/* Year rows — flex:1 so they fill available height */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {years.map(year => (
          <div key={year} style={{ display: 'flex', alignItems: 'stretch', gap: 3, flex: 1 }}>
            <div style={{ width: 34, fontSize: 10, color: C.textMuted, fontFamily: "'IBM Plex Mono',monospace", textAlign: 'right', paddingRight: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {year}
            </div>
            {Array.from({ length: 12 }, (_, mo) => {
              const cell = byYear[year]?.[mo];
              if (!cell) return <div key={mo} style={{ flex: 1, minHeight: 18, borderRadius: 3 }} />;
              const isH = hoverIdx === cell.idx;
              return (
                <div
                  key={mo}
                  onMouseEnter={() => setHoverIdx(cell.idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{
                    flex: 1, minHeight: 18, borderRadius: 3, cursor: 'default',
                    background: cell.active ? C.blue : '#CBD5E1',
                    opacity: cell.active ? (isH ? 1 : 0.75) : (isH ? 0.7 : 0.3),
                    outline: isH ? `1px solid ${C.navy}` : 'none',
                    transition: 'opacity 0.1s',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Tooltip + Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.textMuted }}>
            <span style={{ width: 10, height: 6, background: C.blue, borderRadius: 1, display: 'inline-block', opacity: 0.75 }} /> Aktywny
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.textMuted }}>
            <span style={{ width: 10, height: 6, background: '#CBD5E1', borderRadius: 1, display: 'inline-block', opacity: 0.3 }} /> Przerwa
          </span>
        </div>
        {hovered && (
          <div style={{ padding: '2px 8px', background: C.navy, color: '#fff', fontSize: 10, fontFamily: "'IBM Plex Sans',sans-serif", borderRadius: 3 }}>
            {hovered.label} · {hovered.active ? 'aktywny' : `przerwa ${hovered.gap} dni`}
          </div>
        )}
      </div>
    </div>
  );
}

const AIRSPACE_NAMES = {
  AS001: 'Rosja',
  AS002: 'Ukraina',
  AS003: 'Białoruś',
  AS004: 'Iran',
};

function fmtIsoDate(iso) {
  if (!iso) return '–';
  const parts = iso.split('-');
  if (parts.length < 2) return iso;
  const month = parseInt(parts[1]);
  const q = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  return `${q} ${parts[0]}`;
}

function GeoImpactCol({ data }) {
  const fhMonthly = data.extra_fh_monthly;
  const fhYearly  = fhMonthly != null ? Math.round(fhMonthly * 12) : null;
  const pctFaster = fhYearly != null ? (fhYearly / 4500 * 100).toFixed(1) : null;
  const airspaceName = AIRSPACE_NAMES[data.airspace_affected] || data.airspace_affected || '–';
  const accel = data.ccheck_acceleration_days;

  const Row = ({ label, value, mono, bold, accent, valueSize }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
      <span style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 12, color: C.textMuted,
      }}>{label}</span>
      <span style={{
        fontFamily: mono ? "'IBM Plex Mono', monospace" : "'IBM Plex Sans', sans-serif",
        fontSize: valueSize || 13, fontWeight: bold ? 700 : 500,
        color: accent || C.textPrimary,
      }}>{value}</span>
    </div>
  );

  const Divider = () => (
    <div style={{ borderTop: `1px solid ${C.grayBorder}`, margin: '10px 0' }} />
  );

  return (
    <div style={{ padding: '0 0 0 28px', borderLeft: `2px solid ${C.grayBorder}` }}>
      <div style={SECTION_TITLE}>Wpływ geo</div>
      <div style={{ marginTop: 16 }}>
        <Row label="Trasa" value={data.route_label || '–'} mono />
        <Row label="Zamknięta strefa" value={airspaceName} />

        <Divider />

        {fhMonthly != null && (
          <Row label="Dodatkowe FH/mies" value={`+${fhMonthly.toFixed(0)} FH`} mono bold valueSize={15} />
        )}
        {fhYearly != null && (
          <Row label="× 12 mies." value={`+${fhYearly} FH/rok`} mono valueSize={13} />
        )}
        {pctFaster != null && (
          <div style={{
            margin: '10px 0 6px', padding: '8px 12px',
            background: '#FEF2F2', border: `1px solid #FECACA`, borderRadius: 6,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>÷ 4500 FH (próg)</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: C.red }}>
              {pctFaster}% szybciej
            </span>
          </div>
        )}

        <Divider />

        <Row label="Prognoza bez geo" value={fmtIsoDate(data.original_predicted_date)} mono />
        <Row label="Prognoza z geo" value={fmtIsoDate(data.adjusted_predicted_date)} mono bold accent={C.amber} valueSize={14} />
        {accel != null && (
          <div style={{
            marginTop: 8, padding: '8px 12px',
            background: '#FFF7ED', border: `1px solid #FED7AA`, borderRadius: 6,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>Przyspieszenie C-check</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: C.amber }}>
              -{accel} dni
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandedRow({ a }) {
  const activity = useMemo(() => activityFor(a.reg, a.dur, a.lastGap), [a.reg, a.dur, a.lastGap]);
  const windows  = useMemo(() => windowsFor(a), [a.reg]);
  const [geoImpact, setGeoImpact] = useState(null);
  const [geoLoaded, setGeoLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/radar/impact?registration=${encodeURIComponent(a.reg)}`)
      .then(r => r.json())
      .then(data => { setGeoImpact(data.length > 0 ? data[0] : null); setGeoLoaded(true); })
      .catch(() => setGeoLoaded(true));
  }, [a.reg]);

  const hasGeo = geoLoaded && geoImpact !== null;
  const gridCols = hasGeo ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr';

  return (
    <tr>
      <td colSpan={7} style={{ padding: 0, background: C.grayBg, borderBottom: `1px solid ${C.grayBorder}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: 24, gap: 0 }}>

          {/* Col 1: Service windows */}
          <div style={{ padding: '0 24px 0 0', borderRight: `1px solid ${C.grayBorder}` }}>
            <div style={SECTION_TITLE}>Wykryte okna serwisowe</div>
            <div style={{ marginTop: 14 }}>
              {windows.map((w, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: i < windows.length - 1 ? `1px solid ${C.grayBorder}` : 'none' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.textPrimary, marginBottom: 6 }}>
                    {w.range}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace" }}>· {w.dur} dni</span>
                    <CheckBadge type={w.check} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: '10px 0 0', borderTop: `1px solid ${C.grayBorder}`, fontFamily: "'IBM Plex Sans', sans-serif", color: C.blue, fontSize: 13, fontWeight: 500 }}>
              Prognoza: <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{a.forecast}</span> · za {a.days} dni
            </div>
          </div>

          {/* Col 2: Activity chart */}
          <div style={{ padding: '0 24px', borderRight: `1px solid ${C.grayBorder}`, display: 'flex', flexDirection: 'column' }}>
            <div style={SECTION_TITLE}>Historia aktywności (2022–2026)</div>
            <div style={{ marginTop: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <ActivityChart data={activity} />
            </div>
          </div>

          {/* Col 3: Details */}
          <div style={{ padding: '0 0 0 24px', borderRight: hasGeo ? `1px solid ${C.grayBorder}` : 'none' }}>
            <div style={SECTION_TITLE}>Szczegóły</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <div style={{
                width: 32, height: 32, background: a.opColor, color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.02em',
              }}>{opInitials(a.op)}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, fontWeight: 600, color: C.textPrimary }}>
                {a.op}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginTop: 18 }}>
              {[
                ['Numer ogonowy', a.reg,         true],
                ['Operator',    a.op,          false],
                ['Wiek',        `${a.age} lat`, false],
                ['Wariant',     'B737-800',     false],
                ['Ostatni C-check', a.lastGap, false],
                ['Czas trwania', `${a.dur} dni`, false],
                ['Godziny/mies.', `${a.fhMonth} FH`, true],
                ['Prognoza',    a.forecast,    true],
              ].map(([k, v, mono], i) => (
                <div key={i}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>
                    {k}
                  </div>
                  <div style={{ fontFamily: mono ? "'IBM Plex Mono', monospace" : "'IBM Plex Sans', sans-serif", fontSize: 13, color: C.textPrimary, fontWeight: mono ? 500 : 400 }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Col 4: Geo impact (conditional) */}
          {hasGeo && <GeoImpactCol data={geoImpact} />}
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

function MetricCard({ accent, label, number, sub }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, background: '#FFFFFF',
      border: `1px solid ${C.grayBorder}`, borderLeft: `4px solid ${accent}`,
      padding: '20px 24px', boxShadow: '0 1px 3px rgba(11,28,52,0.04)',
    }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textMuted }}>{label}</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 52, lineHeight: 1.05, color: accent, marginTop: 8, letterSpacing: '-0.02em' }}>{number}</div>
      <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function cellStyle(first = false, last = false) {
  return {
    padding: `16px ${last ? 40 : 16}px 16px ${first ? 40 : 16}px`,
    fontFamily: "'IBM Plex Sans', sans-serif",
    color: C.textPrimary, verticalAlign: 'middle',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  };
}

const COLS = [
  { key: 'reg',      label: 'NUMER OGONOWY', desc: 'Unikalny identyfikator samolotu (np. SP-LSA)' },
  { key: 'op',       label: 'OPERATOR',       desc: 'Linia lotnicza eksploatująca dany statek powietrzny' },
  { key: 'age',      label: 'WIEK',           desc: 'Wiek samolotu liczony od daty produkcji' },
  { key: 'lastGap',  label: 'OSTATNI SERWIS', desc: 'Data ostatniego przeprowadzonego C-checku' },
  { key: 'dur',      label: 'CZAS TRWANIA',   desc: 'Czas trwania ostatniego C-checku (w dniach)' },
  { key: 'forecast', label: 'PROGNOZA C-CHECK', desc: 'Prognozowany termin kolejnego C-checku wg modelu ML' },
  { key: 'priority', label: 'PRIORYTET',      desc: 'Pilność wykonania C-checku: NOW / 6M / 12M / FAR' },
];

const PRIORITY_OPTIONS = [
  { value: 'ALL',  label: 'Wszystkie priorytety' },
  { value: 'NOW',  label: 'TERAZ' },
  { value: '6M',   label: '6 mies.' },
  { value: '12M',  label: '12 mies.' },
  { value: 'FAR',  label: 'Daleko' },
];

export default function Checks({ stats, selectedReg, onClearSelectedReg, selectedOperator, onClearSelectedOperator }) {
  const [raw, setRaw]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [search,   setSearch]   = useState('');
  const [operator, setOperator] = useState('Wszyscy operatorzy');
  const [priority, setPriority] = useState('ALL');
  const [check,    setCheck]    = useState('Wszystkie checki');
  const [expanded, setExpanded] = useState(null);
  const [sortKey,  setSortKey]  = useState('days');
  const [sortDir,  setSortDir]  = useState('asc');
  const [page,     setPage]     = useState(0);
  const PAGE_SIZE = 50;

  // All useMemo BEFORE useEffect so they're initialized before being referenced in dep arrays
  const aircraft = useMemo(() => raw.map(a => ({
    reg:      a.registration,
    op:       a.operator,
    opColor:  getOpColor(a.operator),
    age:      a.age,
    lastGap:  a.lastGapDateLabel,
    dur:      a.lastGapDays,
    check:    a.checkType,
    forecast: a.predictedCCheck,
    days:     a.daysRemaining,
    priority: a.priority,
    fhMonth:  a.flightHoursMonth,
    cycles:   a.cycles,
    confidence: a.confidence,
    winter:   a.winterSeason,
  })), [raw]);

  const operators = useMemo(() => {
    const ops = [...new Set(aircraft.map(a => a.op))].sort();
    return [{ value: 'Wszyscy operatorzy', label: 'Wszyscy operatorzy' }, ...ops.map(o => ({ value: o, label: o }))];
  }, [aircraft]);

  const checkTypes = useMemo(() => {
    const types = [...new Set(aircraft.map(a => a.check))].sort();
    return [{ value: 'Wszystkie checki', label: 'Wszystkie checki' }, ...types.map(t => ({ value: t, label: t }))];
  }, [aircraft]);

  const filtered = useMemo(() => {
    let rows = aircraft.filter(a => {
      if (search) { const q = search.toLowerCase(); if (!a.reg.toLowerCase().includes(q) && !a.op.toLowerCase().includes(q)) return false; }
      if (operator !== 'Wszyscy operatorzy' && a.op !== operator) return false;
      if (priority !== 'ALL' && a.priority !== priority) return false;
      if (check !== 'Wszystkie checki' && a.check !== check) return false;
      return true;
    });
    const PORD = { NOW: 0, '6M': 1, '12M': 2, FAR: 3 };
    rows = [...rows].sort((x, y) => {
      let xv, yv;
      if (sortKey === 'priority') {
        xv = PORD[x.priority]; yv = PORD[y.priority];
      } else if (sortKey === 'forecast') {
        xv = x.days; yv = y.days;
      } else {
        xv = x[sortKey]; yv = y[sortKey];
        if (typeof xv === 'string') { xv = xv.toLowerCase(); yv = yv.toLowerCase(); }
      }
      if (xv < yv) return sortDir === 'asc' ? -1 : 1;
      if (xv > yv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [aircraft, search, operator, priority, check, sortKey, sortDir]);

  useEffect(() => {
    fetch('/api/aircraft')
      .then(r => { if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
      .then(data => { setRaw(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  // Handle navigation from Radar tab — single registration
  useEffect(() => {
    if (!selectedReg) return;
    setSearch(selectedReg);
    setOperator('Wszyscy operatorzy');
    setPriority('ALL');
    setCheck('Wszystkie checki');
    setExpanded(selectedReg);
    setPage(0);
    onClearSelectedReg?.();
  }, [selectedReg]);

  // Handle navigation from Radar tab — operator filter
  useEffect(() => {
    if (!selectedOperator) return;
    setSearch('');
    setOperator(selectedOperator);
    setPriority('ALL');
    setCheck('Wszystkie checki');
    setExpanded(null);
    setPage(0);
    onClearSelectedOperator?.();
  }, [selectedOperator]);

  // Scroll to expanded row — filtered in deps so it re-runs after data loads
  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`row-${expanded}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => clearTimeout(timer);
  }, [expanded, filtered]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(0);
  }

  function handleFilterChange(setter) {
    return v => { setter(v); setPage(0); setExpanded(null); };
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const nowCount = stats ? stats.now_count     : aircraft.filter(a => a.priority === 'NOW').length;
  const obsCount = stats ? stats.observe_count : aircraft.filter(a => a.priority === '6M' || a.priority === '12M').length;
  const totalFleet = stats ? stats.total_fleet : raw.length;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 256, gap: 12 }}>
      <div style={{ width: 32, height: 32, border: `2px solid ${C.blue}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: C.textMuted, fontFamily: "'IBM Plex Sans', sans-serif" }}>Ładowanie danych…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: '40px 40px', maxWidth: 560 }}>
      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '16px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#B91C1C', marginBottom: 4 }}>Błąd ładowania danych</div>
        <div style={{ fontSize: 12, color: '#DC2626', fontFamily: 'monospace' }}>{error}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 12 }}>
          Uruchom backend API:<br />
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
            LOTAMS · MRO Intelligence
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: C.navy, margin: '6px 0 0' }}>
            Checks
          </h1>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.textMuted }}>
          Aktualizacja: {new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '.').replace(/\.$/, '')} · {new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
        <MetricCard accent={C.red}   label="Wymaga kontaktu" number={nowCount}    sub="samolotów w oknie 0–6 mies." />
        <MetricCard accent={C.amber} label="Obserwuj"        number={obsCount}    sub="samolotów w oknie 6–12 mies." />
        <MetricCard accent={C.blue}  label="Śledzone"        number={totalFleet}  sub="Boeing 737 w Europie" />
      </div>

      {/* Filter bar */}
      <div style={{
        background: C.grayBg,
        borderTop: `1px solid ${C.grayBorder}`, borderBottom: `1px solid ${C.grayBorder}`,
        padding: '14px 40px', marginLeft: -40, marginRight: -40,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 360 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj rejestracji lub operatora..."
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

        <StyledSelect value={operator} onChange={handleFilterChange(setOperator)} options={operators} />
        <StyledSelect value={priority} onChange={handleFilterChange(setPriority)} options={PRIORITY_OPTIONS} />
        <StyledSelect value={check}    onChange={handleFilterChange(setCheck)}    options={checkTypes} />

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          Wyświetlono <strong style={{ color: C.textPrimary, fontWeight: 600 }}>{filtered.length}</strong> z {aircraft.length} samolotów
          {totalPages > 1 && <span style={{ color: C.textMuted }}> · str. {page + 1}/{totalPages}</span>}
        </div>
      </div>

      {/* Table */}
      <div style={{ marginLeft: -40, marginRight: -40 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: C.navy }}>
              {COLS.map((c, i) => (
                <th key={i}
                  onClick={() => c.key && toggleSort(c.key)}
                  style={{
                    padding: i === 0 ? '14px 16px 14px 40px' : (i === COLS.length - 1 ? '14px 40px 14px 16px' : '14px 16px'),
                    color: '#FFFFFF', fontFamily: "'Syne', sans-serif", fontWeight: 600,
                    fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                    textAlign: 'left', cursor: c.key ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap',
                  }}>
                  <ColTooltip desc={c.desc}>
                    {c.label}
                    {c.key && <SortArrow dir={sortKey === c.key ? sortDir : null} />}
                  </ColTooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(a => {
              const isOpen = expanded === a.reg;
              return (
                <Fragment key={a.reg}>
                  <tr
                    id={`row-${a.reg}`}
                    onClick={() => setExpanded(isOpen ? null : a.reg)}
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
                    <td style={cellStyle(true)}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 600, color: C.textPrimary }}>
                        {a.reg}
                      </span>
                    </td>
                    <td style={cellStyle()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.opColor, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 13 }}>{a.op}</span>
                      </div>
                    </td>
                    <td style={{ ...cellStyle(), color: C.textMuted, fontSize: 13 }}>{a.age} lat</td>
                    <td style={{ ...cellStyle(), color: C.textMuted, fontSize: 13 }}>{a.lastGap}</td>
                    <td style={{ ...cellStyle(), fontSize: 13 }}>{a.dur} dni</td>
                    <td style={{ ...cellStyle(), color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{a.forecast}</td>
                    <td style={cellStyle(false, true)}><PriorityBadge priority={a.priority} /></td>
                  </tr>
                  {isOpen && <ExpandedRow a={a} />}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '60px 40px', textAlign: 'center', color: C.textMuted, fontSize: 14, background: C.grayBg }}>
                  Brak samolotów spełniających kryteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '24px 0 8px',
        }}>
          <PagBtn label="←" onClick={() => setPage(p => p - 1)} disabled={page === 0} />
          {Array.from({ length: totalPages }, (_, i) => (
            <PagBtn key={i} label={i + 1} onClick={() => setPage(i)} active={i === page} />
          ))}
          <PagBtn label="→" onClick={() => setPage(p => p + 1)} disabled={page === totalPages - 1} />
        </div>
      )}
    </div>
  );
}

function PagBtn({ label, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 34, height: 34, padding: '0 10px',
        fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 600,
        border: `1px solid ${active ? C.blue : C.grayBorder}`,
        background: active ? C.blue : 'transparent',
        color: active ? '#FFFFFF' : disabled ? C.grayBorder : C.textMuted,
        cursor: disabled ? 'default' : 'pointer',
        borderRadius: 2,
      }}
    >{label}</button>
  );
}
