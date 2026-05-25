import { useState } from 'react';
import { FileText, AlertTriangle, CheckCircle, Wrench, Zap, Settings, Droplets, Package, Info } from 'lucide-react';
import { camoTasks, camoTotalHours, camoTasksTotal, camoGanttData, camoPartsAlert } from '../mock/data';

const CATEGORIES = {
  Strukturalne: { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Wrench,   label: 'Structural' },
  Mechanika:    { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Settings, label: 'Mechanical' },
  Hydraulika:   { color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', icon: Droplets, label: 'Hydraulics' },
  Silnik:       { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: Settings, label: 'Engine'     },
  Awionika:     { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: Zap,      label: 'Avionics'   },
  Wyposażenie:  { color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0', icon: Package,  label: 'Equipment'  },
};

const FILTER_TABS = [
  { key: 'all',          label: 'All',        count: camoTasksTotal },
  { key: 'Strukturalne', label: 'Structural', count: 234 },
  { key: 'Awionika',     label: 'Avionics',   count: 189 },
  { key: 'Silnik',       label: 'Engine',     count: 156 },
  { key: 'Hydraulika',   label: 'Hydraulics', count: 98  },
  { key: 'Mechanika',    label: 'Other',      count: 170 },
];

const RISK = {
  high:   { label: 'Critical', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  medium: { label: 'Warning',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  low:    { label: 'Monitor',  color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' },
};

function TaskItem({ task, index }) {
  const cat  = CATEGORIES[task.category] || CATEGORIES.Wyposażenie;
  const Icon = cat.icon;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0">
      <span className="text-[10px] text-slate-300 pt-0.5 w-5 flex-shrink-0 text-right tabular-nums">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {task.code}
          </span>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border inline-flex items-center gap-1"
            style={{ background: cat.bg, color: cat.color, borderColor: cat.border }}
          >
            <Icon size={7} />{cat.label}
          </span>
        </div>
        <div className="text-[12px] text-slate-600 leading-snug">{task.description}</div>
      </div>
      <div className="text-[12px] font-bold text-slate-800 flex-shrink-0">{task.hours}h</div>
    </div>
  );
}

function GanttChart({ data }) {
  const totalDays = 34;
  return (
    <div className="mb-4">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">
        Work Schedule — Critical Path
      </div>
      <div className="bg-slate-900 rounded-xl p-4">
        {data.map((phase, i) => {
          const leftPct  = (phase.startDay / totalDays) * 100;
          const widthPct = ((phase.endDay - phase.startDay) / totalDays) * 100;
          return (
            <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
              <div className="text-[9px] text-slate-500 flex-shrink-0 text-right leading-tight" style={{ width: 116, fontFamily: 'IBM Plex Sans, sans-serif' }}>
                {phase.phase}
              </div>
              <div className="flex-1 h-4 bg-slate-800 rounded-sm relative">
                <div
                  className="absolute h-full rounded-sm"
                  style={{
                    left: `${leftPct}%`, width: `${widthPct}%`,
                    background: phase.color,
                    border: phase.critical ? '1.5px solid #FF6B6B' : 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div className="w-8 text-[9px] text-slate-500 text-center flex-shrink-0">
                {phase.startDay + 1}–{phase.endDay}d
              </div>
            </div>
          );
        })}
        <div className="flex mt-2" style={{ marginLeft: 124 }}>
          {[1, 7, 14, 21, 28, 34].map(d => (
            <div key={d} className="text-[8px] text-slate-600" style={{ flex: d === 1 ? d : d - (d === 7 ? 1 : 7) }}>
              {d}d
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-red-600 border border-red-400 rounded-sm" />
          <span className="text-[10px] text-slate-400">Critical path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-emerald-600 rounded-sm" />
          <span className="text-[10px] text-slate-400">Final / CRS</span>
        </div>
      </div>
    </div>
  );
}

export default function CAMO() {
  const [activeFilter, setActiveFilter] = useState('all');

  const visibleTasks = activeFilter === 'all'
    ? camoTasks
    : camoTasks.filter(t => t.category === activeFilter);

  const categoryTotals = Object.entries(CATEGORIES).map(([key, cat]) => {
    const tasks = camoTasks.filter(t => t.category === key);
    return { key, cat, hours: tasks.reduce((s, t) => s + t.hours, 0) };
  });

  const CARD = 'bg-white rounded-2xl border border-slate-200';
  const SHADOW = { boxShadow: '0 1px 4px rgba(15,23,42,0.06)' };

  return (
    <div className="px-6 lg:px-7 py-6 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-slate-900 mb-1">CAMO Task Analysis</h1>
        <p className="text-[13px] text-slate-400" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Upload an airline CAMO task list → receive schedule and preliminary quote
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-5 flex gap-2.5 items-start">
        <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-blue-700 leading-relaxed" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          <strong>CAMO</strong> (Continuing Airworthiness Management Organization) is the airline's airworthiness department.
          It submits task lists which LOTAMS prices and executes.{' '}
          <strong>MEL</strong> and <strong>CRS</strong> (Certificate of Release to Service) are issued on completion.
        </p>
      </div>

      {/* Upload zone */}
      <div
        className={`${CARD} p-5 mb-5 flex items-center gap-4 border-dashed`}
        style={SHADOW}
      >
        <div className="w-11 h-11 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <FileText size={20} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-slate-900 mb-0.5 truncate">
            LOT_SP-LVB_CCHECK_2026.pdf — {camoTasksTotal.toLocaleString()} tasks
          </div>
          <div className="text-[12px] text-emerald-600 flex items-center gap-1.5">
            <CheckCircle size={12} />
            Uploaded and analysed automatically
          </div>
        </div>
        <label className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-500 cursor-pointer hover:border-slate-300 hover:bg-white transition-colors whitespace-nowrap flex-shrink-0">
          <input type="file" className="sr-only" accept=".pdf,.doc,.xlsx" />
          Change file
        </label>
      </div>

      {/* Main 3-col layout */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.2fr 1.1fr 0.9fr', alignItems: 'start' }}>

        {/* Col 1 — task list */}
        <div className={`${CARD} overflow-hidden`} style={SHADOW}>
          <div className="flex border-b border-slate-100 overflow-x-auto" role="tablist">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeFilter === tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className="px-3 py-3 border-b-2 cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors text-[11px] bg-transparent"
                style={{
                  borderBottomColor: activeFilter === tab.key ? '#2563EB' : 'transparent',
                  fontWeight: activeFilter === tab.key ? 600 : 400,
                  color: activeFilter === tab.key ? '#2563EB' : '#94A3B8',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                {tab.label}
                <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="max-h-[480px] overflow-y-auto px-4" role="tabpanel">
            {visibleTasks.map((task, i) => <TaskItem key={task.code} task={task} index={i} />)}
            {activeFilter === 'all' && (
              <div className="py-3 text-center text-[11px] text-slate-400 border-t border-slate-100">
                + {camoTasksTotal - camoTasks.length} more tasks in full CAMO file…
              </div>
            )}
          </div>

          <div className="border-t-2 border-slate-100 px-4 py-3.5 flex items-center justify-between">
            <span className="text-[12px] text-slate-400">Total labour hours</span>
            <span className="text-[18px] font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              {camoTotalHours.toLocaleString()}{' '}
              <span className="text-[11px] text-slate-400 font-normal">MHrs</span>
            </span>
          </div>
        </div>

        {/* Col 2 — schedule */}
        <div className="flex flex-col gap-4">
          <div className={`${CARD} px-5 py-4`} style={SHADOW}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Schedule Summary</div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <div className="text-[11px] text-slate-400 mb-1">Duration</div>
                <div className="text-[26px] font-bold text-slate-900 leading-none" style={{ fontFamily: 'DM Sans, sans-serif' }}>28–34</div>
                <div className="text-[11px] text-slate-400 mt-0.5">working days</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 mb-1">Labour hours</div>
                <div className="text-[26px] font-bold text-slate-900 leading-none" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {(camoTotalHours / 1000).toFixed(1)}k
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">MHrs</div>
              </div>
            </div>
            {categoryTotals.filter(c => c.hours > 0).map(({ key, cat, hours }) => (
              <div key={key} className="mb-2.5">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-500">{cat.label}</span>
                  <span className="text-slate-700 font-medium">{hours}h</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${(hours / camoTotalHours) * 100}%`, background: cat.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className={`${CARD} px-5 py-4`} style={SHADOW}>
            <GanttChart data={camoGanttData} />
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 flex gap-2.5 items-start">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-[12px] text-amber-800 leading-relaxed">
                <strong>Bottleneck:</strong> part{' '}
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>32-41-12</span>{' '}
                (landing gear pin) — verify stock. Lead time 21 days.
              </div>
            </div>
          </div>

          <div className={`${CARD} overflow-hidden`} style={SHADOW}>
            <div className="px-4 py-3.5 border-b border-slate-100 text-[13px] font-semibold text-slate-900">
              Parts Alerts — Stock verification required
            </div>
            {camoPartsAlert.map((part, i) => {
              const rb = RISK[part.risk];
              return (
                <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-slate-50 last:border-b-0">
                  <span className="text-[10px] text-slate-400 flex-shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {part.part}
                  </span>
                  <span className="text-[12px] text-slate-700 flex-1 min-w-0 truncate">{part.name}</span>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: rb.bg, color: rb.color, borderColor: rb.border }}>
                      {rb.label}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Lead: {part.leadTime}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Col 3 — aircraft context */}
        <div className="flex flex-col gap-4">
          <div className={`${CARD} px-5 py-4`} style={SHADOW}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Aircraft Context</div>
            <div className="mb-4">
              <div className="text-[22px] font-bold text-slate-900 tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                SP-LVB
              </div>
              <div className="text-[12px] text-slate-400 mt-1">LOT Polish Airlines · B737-800</div>
            </div>
            <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3.5">
              {[
                { k: 'Last C-check',   v: 'Nov 2023 (34d, WAW)' },
                { k: 'Status',         v: <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }}>URGENT</span> },
                { k: 'Days to window', v: '95 days' },
                { k: 'Home base',      v: 'WAW — Warsaw' },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between items-center text-[12px]">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-slate-700 font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`${CARD} px-5 py-4`} style={SHADOW}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Should We Bid?</div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4">
              <div className="text-[14px] font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
                <CheckCircle size={14} /> Yes — high priority
              </div>
              <ul className="flex flex-col gap-1">
                {[
                  'Aircraft in decision window (95d)',
                  'LOT is an existing LOTAMS client',
                  'Location: WAW — optimal base',
                  'Winter season: ideal hangar slot',
                ].map((item, i) => (
                  <li key={i} className="text-[12px] text-emerald-700 flex gap-1.5">
                    <span className="flex-shrink-0">·</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            {[
              { label: 'Fleet compatibility', score: 95 },
              { label: 'Timing window',       score: 93 },
              { label: 'Revenue potential',   score: 78 },
              { label: 'Hangar availability', score: 84 },
            ].map(({ label, score }) => (
              <div key={label} className="mb-3">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-slate-700 font-semibold">{score}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${score}%`, background: score >= 85 ? '#10B981' : score >= 65 ? '#F59E0B' : '#EF4444' }} />
                </div>
              </div>
            ))}
          </div>

          <button
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[13px] font-semibold transition-colors"
            style={{ fontFamily: 'DM Sans, sans-serif', boxShadow: '0 1px 4px rgba(37,99,235,0.3)' }}
          >
            Generate Preliminary Quote
          </button>
          <button className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl text-[13px] font-medium transition-colors">
            Add to CRM
          </button>
        </div>
      </div>
    </div>
  );
}
