import { useEffect, useRef, useState } from 'react';
import { airports, geoEvents, routeImpact } from '../mock/data';
import { AlertTriangle, X } from 'lucide-react';

function LeafletMap({ onNavigate }) {
  const mapRef      = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (instanceRef.current) return;

    import('leaflet').then(({ default: L }) => {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, {
        center: [48, 18], zoom: 4,
        zoomControl: true, attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map);

      airports.forEach(ap => {
        const change     = ap.trafficChange;
        const fillColor  = change > 20 ? '#10B981' : change < -20 ? '#EF4444' : '#2563EB';
        const ringColor  = change > 20 ? '#6EE7B7' : change < -20 ? '#FCA5A5' : '#93C5FD';
        const radius     = Math.min(7 + Math.abs(ap.volume) / 80, 22);
        const trendColor = change > 20 ? '#6EE7B7' : change < -20 ? '#FCA5A5' : '#94A3B8';

        const circle = L.circleMarker([ap.lat, ap.lon], {
          radius, fillColor, color: ringColor,
          weight: ap.alert ? 2.5 : 1.5,
          opacity: 1, fillOpacity: ap.alert ? 0.7 : 0.5,
          className: ap.alert ? 'pulse-marker' : '',
        }).addTo(map);

        const changeStr  = change > 0 ? `+${change}%` : `${change}%`;
        const trendIcon  = change > 20 ? '↑' : change < -20 ? '↓' : '→';
        const airlinesHtml = ap.topAirlines.map(a =>
          `<span style="display:inline-block;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);padding:1px 7px;border-radius:4px;font-size:10px;margin:1px 2px 1px 0;color:#94A3B8">${a}</span>`
        ).join('');

        circle.bindPopup(`
          <div style="min-width:230px;padding:14px;font-family:'IBM Plex Sans',sans-serif">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <div>
                <div style="font-size:18px;font-weight:700;color:#fff;font-family:'DM Sans',sans-serif">${ap.icao}</div>
                <div style="font-size:12px;color:#64748B;margin-top:1px">${ap.name} · ${ap.country}</div>
              </div>
              <div style="background:${fillColor}22;border:1px solid ${fillColor}55;padding:4px 10px;border-radius:20px;font-size:13px;font-weight:700;color:${trendColor}">
                ${trendIcon} ${changeStr}
              </div>
            </div>
            <div style="font-size:10px;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px;font-weight:600">Traffic 30-day vs avg</div>
            <div style="margin-bottom:10px">${airlinesHtml}</div>
            <div style="border-top:1px solid #112240;padding-top:10px">
              <div style="font-size:10px;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px;font-weight:600">MRO Implication</div>
              <div style="font-size:12px;color:#94A3B8;line-height:1.5">${ap.mroNote}</div>
            </div>
            ${ap.alert ? `<button onclick="window._lotams_navigate&&window._lotams_navigate()" style="margin-top:10px;width:100%;padding:8px;background:#2563EB;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">
              View aircraft in Checks →
            </button>` : ''}
          </div>
        `, { maxWidth: 280 });

        const lbl = L.divIcon({
          className: '',
          html: `<div style="color:rgba(255,255,255,0.45);font-size:9px;font-weight:700;font-family:'JetBrains Mono',monospace;white-space:nowrap;margin-top:${radius + 3}px;margin-left:-14px;text-shadow:0 1px 4px rgba(0,0,0,1)">${ap.icao}</div>`,
          iconSize: [0, 0],
        });
        L.marker([ap.lat, ap.lon], { icon: lbl }).addTo(map);
      });

      window._lotams_navigate = () => onNavigate && onNavigate('checks');
      instanceRef.current = map;
    });

    return () => {
      if (instanceRef.current) { instanceRef.current.remove(); instanceRef.current = null; }
      delete window._lotams_navigate;
    };
  }, []);

  return <div ref={mapRef} className="w-full h-full" />;
}

function EventCard({ event }) {
  const accent = { red: '#EF4444', amber: '#F59E0B', blue: '#2563EB' }[event.level];
  const region = {
    red:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
    amber: { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
    blue:  { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  }[event.level];

  return (
    <article
      className="bg-white rounded-2xl border border-slate-200 px-4 py-4 mb-3"
      style={{ borderLeft: `3px solid ${accent}`, boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400 mb-0.5">{event.date}</div>
          <div className="text-[13px] font-semibold text-slate-900 leading-snug">{event.title}</div>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap ml-2"
          style={{ background: region.bg, color: region.color, borderColor: region.border }}
        >
          {event.region}
        </span>
      </div>

      <p className="text-[12px] text-slate-500 leading-relaxed mb-2.5">{event.description}</p>

      <div className="flex gap-1.5 flex-wrap mb-2.5">
        {event.airlines.map(a => (
          <span key={a} className="text-[10px] bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded">
            {a}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] border-t border-slate-100 pt-2.5">
        <span className="text-slate-400">
          +{event.extraFHMonth.toLocaleString()} FH/mo ·{' '}
          <strong className="text-slate-600">{event.aircraftCount} aircraft</strong>
        </span>
        <div className="flex gap-1">
          {event.relatedRegs.map(r => (
            <span
              key={r}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded border"
              style={{ fontFamily: 'JetBrains Mono, monospace', background: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }}
            >
              {r}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function Radar({ onNavigate }) {
  const [alertDismissed, setAlertDismissed] = useState(false);

  return (
    <div className="px-6 lg:px-7 py-6 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-slate-900 mb-1">Geopolitical Radar</h1>
        <p className="text-[13px] text-slate-400" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Air traffic anomalies as early signals of accelerated fleet utilisation
        </p>
      </div>

      {/* Explanation */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex gap-2.5 items-start">
        <span className="text-[14px] flex-shrink-0 mt-0.5" aria-hidden="true">💡</span>
        <p className="text-[12px] text-amber-800 leading-relaxed" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          When airspace closes or routes change, airlines fly longer — more flight hours = faster C-check cycle.{' '}
          <strong>The system detects these changes and updates priorities in Checks automatically.</strong>
        </p>
      </div>

      {/* Active alert */}
      {!alertDismissed && (
        <div
          className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 flex gap-2.5 items-start"
          role="alert"
        >
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-red-800 leading-relaxed flex-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            <strong>ACTIVE ALERT:</strong> Middle East airspace restrictions — European route traffic{' '}
            <strong>+18%</strong>. Affecting: Turkish Airlines, SunExpress, Aegean.{' '}
            Priorities updated for <strong>12 aircraft</strong>.{' '}
            <button
              onClick={() => onNavigate('checks')}
              className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
            >
              View in Checks →
            </button>
          </p>
          <button
            onClick={() => setAlertDismissed(true)}
            className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 p-0.5"
            aria-label="Dismiss alert"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="text-[11px] text-slate-500 font-medium">Legend:</span>
        {[
          { color: '#10B981', label: 'Surge >20%' },
          { color: '#EF4444', label: 'Drop >20%'  },
          { color: '#2563EB', label: 'Normal'      },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[11px] text-slate-500">{label}</span>
          </div>
        ))}
        <span className="text-[11px] text-slate-400">· Size = volume · Click to inspect</span>
      </div>

      {/* Map + events */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 360px', alignItems: 'start' }}>
        <div
          className="rounded-2xl overflow-hidden border border-slate-200"
          style={{ background: '#060f1e', height: 520, boxShadow: '0 1px 4px rgba(15,23,42,0.08)' }}
          role="img"
          aria-label="European airport traffic map"
        >
          <LeafletMap onNavigate={onNavigate} />
        </div>

        <div className="max-h-[520px] overflow-y-auto pr-0.5">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">
            Active Geopolitical Signals
          </div>
          {geoEvents.map(ev => <EventCard key={ev.id} event={ev} />)}

          <div className="mt-5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">
              Route Trend Analysis
            </div>
            <div
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}
            >
              <table className="w-full border-collapse" aria-label="Route impact analysis">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Route', 'Change', 'FH/mo', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[9px] font-semibold text-slate-400 uppercase tracking-[0.06em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {routeImpact.map((row, i) => {
                    const dot = { red: '#EF4444', amber: '#F59E0B', blue: '#94A3B8' }[row.level];
                    return (
                      <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-800">{row.route}</td>
                        <td className="px-3 py-2.5 text-[11px] font-bold text-red-500">{row.change}</td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-500">+{row.fhMonth}</td>
                        <td className="px-3 py-2.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: dot }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
