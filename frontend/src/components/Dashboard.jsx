import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell, ReferenceLine,
} from 'recharts';
import { aircraft, ccheckActivity, seasonalityData, dashboardAlerts } from '../mock/data';
import { TrendingUp, AlertTriangle, Clock, Snowflake, ExternalLink, Bell } from 'lucide-react';

const PRI = {
  NOW:  { label: 'URGENT',  bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  '6M': { label: '6 mo.',   bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  '12M':{ label: '12 mo.',  bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  FAR:  { label: 'Far',     bg: '#F8FAFC', color: '#94A3B8', border: '#E2E8F0' },
};

const BADGE = {
  red:   { background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' },
  amber: { background: '#FFFBEB', color: '#D97706', borderColor: '#FDE68A' },
  blue:  { background: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' },
  green: { background: '#F0FDF4', color: '#16A34A', borderColor: '#BBF7D0' },
};

const ACCENT_ICON_BG = (color) => ({
  background: `${color}14`,
  color,
});

const ALERT_LEFT = { red: '#EF4444', amber: '#F59E0B', blue: '#2563EB' };

function MetricCard({ title, value, subtitle, badge, badgeColor, accentColor, icon: Icon }) {
  const badgeStyle = BADGE[badgeColor] || BADGE.blue;
  return (
    <article
      className="bg-white rounded-2xl border border-slate-200 px-5 pt-5 pb-4 flex-1 min-w-[150px]"
      style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <div
          className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em] flex items-center gap-1.5"
          style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          {accentColor && (
            <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: accentColor }} />
          )}
          {title}
        </div>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={ACCENT_ICON_BG(accentColor || '#94A3B8')}>
            <Icon size={15} style={{ color: accentColor || '#94A3B8' }} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2.5 flex-wrap mb-1.5">
        <span
          className="text-[36px] font-bold text-slate-900 leading-none"
          style={{ fontFamily: 'DM Sans, sans-serif', letterSpacing: '-1px' }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {badge && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
            style={badgeStyle}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="text-[12px] text-slate-400" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
        {subtitle}
      </div>
    </article>
  );
}

const ChartTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[12px] text-white shadow-xl">
      <div className="text-slate-400 text-[11px] mb-0.5">{label}</div>
      <div className="font-semibold">{payload[0].value}{unit}</div>
      {payload[0].payload.peak && (
        <div className="text-amber-400 text-[10px] mt-0.5">Peak winter season</div>
      )}
    </div>
  );
};

export default function Dashboard({ onNavigate }) {
  const nowCount    = aircraft.filter(a => a.priority === 'NOW').length;
  const winterCount = aircraft.filter(a => a.winterSeason).length;
  const top10       = [...aircraft].sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 10);

  return (
    <div className="px-6 lg:px-7 py-6 max-w-[1400px]">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-slate-900 mb-1">Fleet Overview</h1>
        <p className="text-[13px] text-slate-400" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Data as of 22 May 2025 · 847 Boeing 737 aircraft tracked across Europe &amp; Middle East
        </p>
      </div>

      {/* Metric cards */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <MetricCard
          title="Aircraft Tracked"
          value={847}
          subtitle="Boeing 737, Europe"
          icon={TrendingUp}
          accentColor="#2563EB"
        />
        <MetricCard
          title="Window 0–6 Months"
          value={34}
          badge="Contact now"
          badgeColor="red"
          subtitle={`${nowCount} require immediate outreach`}
          icon={AlertTriangle}
          accentColor="#EF4444"
        />
        <MetricCard
          title="Window 6–12 Months"
          value={89}
          badge="Plan contact"
          badgeColor="amber"
          subtitle="Next planning phase"
          icon={Clock}
          accentColor="#F59E0B"
        />
        <MetricCard
          title="Winter Season 25/26"
          value={156}
          badge="Oct–Mar"
          badgeColor="blue"
          subtitle={`${winterCount} aircraft in window`}
          icon={Snowflake}
          accentColor="#7C3AED"
        />
      </div>

      {/* Row 2 — top 10 + bar chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Top 10 priorities */}
        <div
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
        >
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Top 10 Priorities</h2>
              <p className="text-[11px] text-slate-400 mt-0.5" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Sorted by C-check urgency
              </p>
            </div>
            <button
              onClick={() => onNavigate('checks')}
              className="text-[12px] text-blue-600 hover:text-blue-700 font-medium transition-colors flex items-center gap-1"
            >
              View all →
            </button>
          </div>

          <table className="w-full border-collapse" aria-label="Top 10 aircraft by priority">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Registration', 'Operator', 'Days', 'Priority'].map((h, i) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em] whitespace-nowrap"
                    style={{ textAlign: i === 3 ? 'right' : 'left' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top10.map((a, i) => {
                const pc = PRI[a.priority] || PRI.FAR;
                return (
                  <tr
                    key={a.id}
                    className="row-hover border-t border-slate-50 cursor-pointer transition-colors"
                    onClick={() => onNavigate('checks')}
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[12px] font-semibold text-slate-800"
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {a.registration}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-600">{a.operator}</td>
                    <td
                      className="px-4 py-2.5 text-[12px] font-medium"
                      style={{ color: a.daysRemaining <= 60 ? '#EF4444' : '#475569' }}
                    >
                      {a.daysRemaining < 0 ? `OVERDUE` : `${a.daysRemaining}d`}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{ background: pc.bg, color: pc.color, borderColor: pc.border }}
                      >
                        {pc.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* C-check bar chart */}
        <div
          className="bg-white rounded-2xl border border-slate-200 px-5 py-4"
          style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
        >
          <h2 className="text-[14px] font-semibold text-slate-900 mb-0.5">Detected C-checks</h2>
          <p className="text-[11px] text-slate-400 mb-4" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Service windows per month — last 24 months
          </p>
          <ResponsiveContainer width="100%" height={238}>
            <BarChart data={ccheckActivity} margin={{ top: 2, right: 4, left: -22, bottom: 36 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#CBD5E1', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} angle={-40} textAnchor="end" dy={4} />
              <YAxis tick={{ fill: '#CBD5E1', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip unit=" checks" />} cursor={{ fill: '#F8FAFC' }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {ccheckActivity.map((_, i) => (
                  <Cell key={i} fill={i === ccheckActivity.length - 1 ? '#2563EB' : '#DBEAFE'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3 — alerts + seasonality */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Active alerts */}
        <div
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
        >
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
            <Bell size={14} className="text-slate-600 flex-shrink-0" />
            <h2 className="text-[14px] font-semibold text-slate-900">Active Alerts</h2>
            <span
              className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{ background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }}
            >
              {dashboardAlerts.length} new
            </span>
          </div>

          <div className="px-4 py-3.5 flex flex-col gap-2.5">
            {dashboardAlerts.map(alert => (
              <div
                key={alert.id}
                className="rounded-xl px-3.5 py-3 bg-slate-50 border-l-[3px]"
                style={{ borderLeftColor: ALERT_LEFT[alert.level] }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-slate-700 font-medium leading-snug mb-1">
                      {alert.registration && (
                        <span
                          className="font-bold text-slate-900 mr-1"
                          style={{ fontFamily: 'JetBrains Mono, monospace' }}
                        >
                          {alert.registration}
                        </span>
                      )}
                      {alert.operator && (
                        <span className="text-slate-400 text-[12px] mr-1">({alert.operator})</span>
                      )}
                      — {alert.message}
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">{alert.detail}</div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-[10px] text-slate-300">{alert.timestamp}</span>
                    <button className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors">
                      View <ExternalLink size={9} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seasonality chart */}
        <div
          className="bg-white rounded-2xl border border-slate-200 px-5 py-4"
          style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
        >
          <h2 className="text-[14px] font-semibold text-slate-900 mb-0.5">MRO Seasonality</h2>
          <p className="text-[11px] text-slate-400 mb-4" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Workshop load by month — 24 months
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={seasonalityData} margin={{ top: 2, right: 4, left: -22, bottom: 36 }}>
              <defs>
                <linearGradient id="wlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#CBD5E1', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} angle={-40} textAnchor="end" dy={4} />
              <YAxis tick={{ fill: '#CBD5E1', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <ReferenceLine
                y={75}
                stroke="#F59E0B"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: 'Peak — hangars full', position: 'right', fontSize: 9, fill: '#F59E0B' }}
              />
              <Area type="monotone" dataKey="workload" stroke="#2563EB" strokeWidth={2} fill="url(#wlGrad)" dot={false} activeDot={{ r: 4, fill: '#2563EB' }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-amber-400 rounded-full" />
              <span className="text-[10px] text-slate-400">Peak season (Oct–Mar)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-blue-600 rounded-full" />
              <span className="text-[10px] text-slate-400">Hangar load</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
