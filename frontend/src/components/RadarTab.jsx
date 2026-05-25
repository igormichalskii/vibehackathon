import { useEffect, useRef, useState, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';

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

const SECTION_TITLE = {
  fontFamily: "'Syne', sans-serif",
  fontSize: 11, fontWeight: 700,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: C.textMuted, marginBottom: 10,
};

const ISO_TO_AIRSPACE = { RU: 'AS001', UA: 'AS002', BY: 'AS003', IR: 'AS004' };
const ISO_PROP = 'ISO3166-1-Alpha-2';
const ISO_STYLE = {
  RU: { fillColor: '#DC2626', fillOpacity: 0.35, color: '#DC2626', weight: 2, opacity: 0.8 },
  UA: { fillColor: '#DC2626', fillOpacity: 0.35, color: '#DC2626', weight: 2, opacity: 0.8 },
  BY: { fillColor: '#DC2626', fillOpacity: 0.35, color: '#DC2626', weight: 2, opacity: 0.8 },
  IR: { fillColor: '#F59E0B', fillOpacity: 0.30, color: '#F59E0B', weight: 2, opacity: 0.8 },
};

const TIMELINE_STEPS = [
  { key: 'today', label: 'Dziś', cutoff: null, showAirspaces: true },
];

const REMOTE_AIRPORTS = [
  { icao: 'RJAA', name: 'Tokio Narita',   lat: 35.77, lon: 140.39 },
  { icao: 'RJTT', name: 'Tokio Haneda',   lat: 35.55, lon: 139.78 },
  { icao: 'RKSI', name: 'Seul Incheon',   lat: 37.46, lon: 126.44 },
  { icao: 'OMDB', name: 'Dubaj',          lat: 25.25, lon: 55.36  },
  { icao: 'LLBG', name: 'Tel Awiw',       lat: 32.01, lon: 34.89  },
  { icao: 'HESH', name: 'Szarm el-Szejk', lat: 27.98, lon: 34.40  },
  { icao: 'OJAI', name: 'Amman',          lat: 31.72, lon: 35.99  },
  { icao: 'ZBAA', name: 'Pekin',          lat: 40.08, lon: 116.58 },
  { icao: 'UBBB', name: 'Baku Heydar Aliyev', lat: 40.47, lon: 49.85 },
];

const ROUTE_PATHS = {
  RT001: {
    old: [[52.17,20.97],[32.01,34.89]],
    new: [[52.17,20.97],[50.45,19.00],[48.00,17.00],[46.00,16.00],[44.50,20.00],[41.00,24.00],[38.50,26.50],[35.00,30.00],[32.01,34.89]],
  },
  RT002: {
    old: [[52.17,20.97],[40.47,49.85]],
    new: [[52.17,20.97],[50.45,19.00],[48.00,17.00],[46.00,16.00],[44.00,20.00],[41.00,24.00],[40.98,28.82],[41.50,35.00],[41.80,40.00],[41.50,44.00],[40.47,49.85]],
  },
  RT003: {
    old: [[60.19,11.10],[35.77,140.39]],
    new: [[60.19,11.10],[56.00,12.00],[52.00,16.00],[48.00,17.00],[44.00,20.00],[40.98,28.82],[36.00,36.00],[28.00,48.00],[22.00,58.00],[18.00,72.00],[20.00,90.00],[28.00,110.00],[32.00,125.00],[35.77,140.39]],
  },
  RT004: {
    old: [[60.19,11.10],[37.46,126.44]],
    new: [[60.19,11.10],[56.00,12.00],[52.00,16.00],[48.00,17.00],[44.00,20.00],[40.98,28.82],[36.00,36.00],[28.00,48.00],[22.00,60.00],[20.00,80.00],[25.00,100.00],[32.00,115.00],[37.46,126.44]],
  },
  RT005: {
    old: [[52.31,4.76],[35.55,139.78]],
    new: [[52.31,4.76],[50.00,8.00],[48.00,14.00],[46.00,16.00],[44.00,20.00],[40.98,28.82],[36.00,36.00],[27.00,50.00],[20.00,65.00],[18.00,80.00],[22.00,100.00],[30.00,118.00],[35.55,139.78]],
  },
  RT006: {
    old: [[52.31,4.76],[40.08,116.58]],
    new: [[52.31,4.76],[50.00,8.00],[48.00,14.00],[46.00,16.00],[44.00,20.00],[40.98,28.82],[36.50,35.50],[32.50,35.00],[28.50,34.50],[24.00,37.00],[20.00,48.00],[18.00,62.00],[20.00,78.00],[28.00,95.00],[34.00,108.00],[40.08,116.58]],
  },
  RT007: {
    old: [[40.90,29.31],[25.25,55.36]],
    new: [[40.90,29.31],[36.50,35.50],[32.50,35.00],[28.50,34.50],[24.00,37.00],[22.00,42.00],[22.50,50.00],[24.00,54.00],[25.25,55.36]],
  },
  RT008: {
    old: [[40.90,29.31],[31.72,35.99]],
    new: [[40.90,29.31],[36.50,35.50],[33.00,35.80],[31.72,35.99]],
  },
  RT009: {
    old: [[41.26,28.74],[25.25,55.36]],
    new: [[41.26,28.74],[36.50,35.50],[32.50,35.00],[28.50,34.50],[24.00,37.00],[22.00,42.00],[22.50,50.00],[24.00,54.00],[25.25,55.36]],
  },
  RT010: {
    old: [[52.17,20.97],[27.98,34.40]],
    new: [[52.17,20.97],[50.45,19.00],[48.00,17.00],[46.00,16.00],[44.00,20.00],[41.00,24.00],[38.00,27.00],[34.00,30.00],[30.00,32.50],[27.98,34.40]],
  },
  RT011: {
    old: [[50.10,14.26],[32.01,34.89]],
    new: [[50.10,14.26],[48.00,16.00],[46.00,17.00],[44.50,20.00],[41.00,24.00],[38.00,27.00],[35.00,30.00],[32.01,34.89]],
  },
  RT012: {
    old: [[50.90,4.48],[25.25,55.36]],
    new: [[50.90,4.48],[47.00,10.00],[44.00,16.00],[40.98,28.82],[36.50,35.50],[32.50,35.00],[28.50,34.50],[24.00,37.00],[22.00,42.00],[22.50,50.00],[24.00,54.00],[25.25,55.36]],
  },
};

function fmtFH(h) {
  if (h == null) return '–';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm}min`;
}

function offsetGeometry(geometry, lngOffset) {
  const offsetRing = ring => ring.map(([lon, lat]) => [lon + lngOffset, lat]);
  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(offsetRing) };
  }
  if (geometry.type === 'MultiPolygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(poly => poly.map(offsetRing)) };
  }
  return geometry;
}

function opColor(op) {
  const COLORS = {
    'Ryanair': '#073590', 'LOT Polish': '#003F8A', 'Enter Air': '#C8202D',
    'Lufthansa': '#05164D', 'Wizz Air': '#C6007E', 'easyJet': '#FF6600',
    'Norwegian': '#D40E14', 'Transavia': '#00873E', 'Eurowings': '#8B0000',
    'airBaltic': '#00A651', 'Aegean': '#003DA5', 'KLM': '#00A1DE',
    'SunExpress': '#E8251F', 'Corendon': '#FF6B35', 'Smartwings': '#E31F26',
    'TUI fly': '#E2001A',
  };
  for (const [k, v] of Object.entries(COLORS)) {
    if (op === k || op.startsWith(k) || k.startsWith(op)) return v;
  }
  let hash = 0;
  for (let i = 0; i < op.length; i++) hash = (hash * 31 + op.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 55%, 35%)`;
}

export default function RadarTab({ onNavigate }) {
  const mapRef           = useRef(null);
  const mapInst          = useRef(null);
  const lgBorders        = useRef(null);
  const lgAirspaces      = useRef(null);
  const lgRoutes         = useRef(null);
  const lgAirports       = useRef(null);
  const lgRemoteAirports = useRef(null);

  const [mapReady, setMapReady]           = useState(false);
  const [geoJson, setGeoJson]             = useState(null);
  const [worldGeoJson, setWorldGeoJson]   = useState(null);
  const [airspacesData, setAirspacesData] = useState([]);
  const [airportsData, setAirportsData]   = useState([]);
  const [routesData, setRoutesData]       = useState([]);
  const [impactData, setImpactData]       = useState([]);

  const [timelineStep, setTimelineStep]   = useState('today');
  const [layerVis, setLayerVis]           = useState({ airspaces: true, routes: true, airports: true });
  const [activeOperator, setActiveOperator]   = useState(null); // sidebar expand (click)
  const [hoveredOperator, setHoveredOperator] = useState(null); // route highlight (hover)

  // Initialize Leaflet map
  useEffect(() => {
    if (mapInst.current || !mapRef.current) return;
    let cancelled = false;

    import('leaflet').then(({ default: L }) => {
      if (cancelled || !mapRef.current) return;

      delete L.Icon.Default.prototype._getIconUrl;

      const map = L.map(mapRef.current, {
        center: [48.0, 20.0], zoom: 3,
        minZoom: 3, maxZoom: 8,
        zoomControl: false, attributionControl: false,
        worldCopyJump: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      lgBorders.current        = L.layerGroup().addTo(map);
      lgAirspaces.current      = L.layerGroup().addTo(map);
      lgRoutes.current         = L.layerGroup().addTo(map);
      lgAirports.current       = L.layerGroup().addTo(map);
      lgRemoteAirports.current = L.layerGroup().addTo(map);

      mapInst.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }
      setMapReady(false);
    };
  }, []);

  // Load Europe GeoJSON (for country border layer)
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/leakyMirror/map-of-europe/master/GeoJSON/europe.geojson')
      .then(r => r.json())
      .then(setGeoJson)
      .catch(console.error);
  }, []);

  // Load world countries GeoJSON (for accurate airspace polygons)
  useEffect(() => {
    fetch('/airspace-countries.geojson')
      .then(r => r.json())
      .then(setWorldGeoJson)
      .catch(console.error);
  }, []);

  // Fetch API data
  useEffect(() => {
    Promise.all([
      fetch('/api/radar/airspaces').then(r => r.json()).catch(() => []),
      fetch('/api/radar/airports').then(r => r.json()).catch(() => []),
      fetch('/api/radar/routes').then(r => r.json()).catch(() => []),
      fetch('/api/radar/impact').then(r => r.json()).catch(() => []),
    ]).then(([airspaces, airports, routes, impact]) => {
      setAirspacesData(airspaces);
      setAirportsData(airports);
      setRoutesData(routes);
      setImpactData(impact);
    });
  }, []);

  // Draw country borders
  useEffect(() => {
    if (!mapReady || !geoJson) return;
    import('leaflet').then(({ default: L }) => {
      lgBorders.current.clearLayers();
      const AIRSPACE_ISO2 = new Set(['RU', 'UA', 'BY']);
      L.geoJSON(geoJson, {
        filter: f => !AIRSPACE_ISO2.has(f.properties?.ISO2),
        style: {
          fillColor: '#1e293b', fillOpacity: 0.3,
          color: '#334155', weight: 1, opacity: 0.8,
        },
      }).addTo(lgBorders.current);
    });
  }, [mapReady, geoJson]);

  // Draw airspace overlays using world country GeoJSON filtered by ISO_A2
  useEffect(() => {
    if (!mapReady || !worldGeoJson) return;
    import('leaflet').then(({ default: L }) => {
      lgAirspaces.current.clearLayers();
      const step = TIMELINE_STEPS.find(s => s.key === timelineStep);
      if (!step?.showAirspaces || !layerVis.airspaces) return;

      const airspaceByCode = {};
      airspacesData.forEach(as => { airspaceByCode[as.airspace_id] = as; });

      const airspaceFeatures = worldGeoJson.features.filter(
        f => ISO_TO_AIRSPACE[f.properties?.[ISO_PROP]] !== undefined
      );

      [-360, 0, 360].forEach(offset => {
        airspaceFeatures.forEach(feature => {
          const iso  = feature.properties?.[ISO_PROP];
          const asId = ISO_TO_AIRSPACE[iso];
          const as   = asId ? airspaceByCode[asId] : null;
          const offsetFeature = { ...feature, geometry: offsetGeometry(feature.geometry, offset) };
          const layer = L.geoJSON(offsetFeature, { style: ISO_STYLE[iso] || {} });
          if (as) {
            layer.bindPopup(
              `<div style="font-family:'IBM Plex Sans',sans-serif;min-width:200px;padding:10px 4px 4px">
                <div style="font-weight:700;font-size:14px;color:#0B1C34;margin-bottom:6px">${as.name}</div>
                <div style="font-size:11px;color:#6B7A90;margin-bottom:3px">Status: <b style="color:#0B1C34">${as.status || '–'}</b></div>
                <div style="font-size:11px;color:#6B7A90;margin-bottom:3px">Przyczyna: ${as.reason || '–'}</div>
                <div style="font-size:11px;color:#6B7A90;margin-bottom:3px">Od: ${as.closed_since || '–'} · Do: ${as.closed_until || '–'}</div>
                <div style="font-size:10px;color:#6B7A90;font-family:'IBM Plex Mono',monospace;margin-top:6px">${as.notam_ref || ''}</div>
              </div>`
            );
          }
          layer.addTo(lgAirspaces.current);
        });
      });
    });
  }, [mapReady, worldGeoJson, airspacesData, timelineStep, layerVis.airspaces]);

  // Draw routes — all routes on hover, highlighting hovered operator; hidden by default
  useEffect(() => {
    if (!mapReady) return;
    import('leaflet').then(({ default: L }) => {
      lgRoutes.current.clearLayers();

      const step = TIMELINE_STEPS.find(s => s.key === timelineStep);
      // activeOperator (click) takes priority over hoveredOperator (hover)
      const displayOperator = activeOperator || hoveredOperator;
      if (!displayOperator || !layerVis.routes || !step?.showAirspaces) return;

      routesData.forEach(route => {
        if (step.cutoff && route.active_since && route.active_since > step.cutoff) return;

        const paths = ROUTE_PATHS[route.route_id];
        const isActive = route.operator === displayOperator;
        const newOpacity = isActive ? 0.9 : 0.05;

        let oldPath, newPath;
        if (paths) {
          oldPath = paths.old;
          newPath = paths.new;
        } else {
          const o = route.origin;
          const d = route.destination;
          if (!o?.lat || !o?.lon || !d?.lat || !d?.lon) return;
          oldPath = [[parseFloat(o.lat), parseFloat(o.lon)], [parseFloat(d.lat), parseFloat(d.lon)]];
          newPath = oldPath;
        }

        if (isActive) {
          L.polyline(oldPath, {
            color: '#F97316', dashArray: '10 6', weight: 4, opacity: 0.85,
          }).addTo(lgRoutes.current);
        }

        const tooltip = isActive
          ? `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:11px;padding:6px 8px;line-height:1.7">
              <b>${route.operator}</b> &nbsp;|&nbsp; ${route.origin?.icao || '?'} → ${route.destination?.icao || '?'}<br/>
              Przed: ${fmtFH(route.old_flight_hours)} &nbsp;→&nbsp; Teraz: ${fmtFH(route.new_flight_hours)}<br/>
              ${route.delta_fh_per_flight != null ? `+${route.delta_fh_per_flight.toFixed(1)} FH/lot` : ''}
              ${route.extra_fh_monthly    != null ? ` · +${route.extra_fh_monthly.toFixed(0)} FH/mies` : ''}
              ${route.ccheck_acceleration_days != null ? `<br/>Przyspieszenie C-check: <b>${route.ccheck_acceleration_days} dni</b>` : ''}
            </div>`
          : null;

        const poly = L.polyline(newPath, { color: '#3B82F6', weight: 2.5, opacity: newOpacity });
        if (tooltip) poly.bindTooltip(tooltip, { sticky: true });
        poly.addTo(lgRoutes.current);
      });
    });
  }, [mapReady, routesData, timelineStep, layerVis.routes, hoveredOperator, activeOperator]);

  // Draw European airports from API
  useEffect(() => {
    if (!mapReady || !airportsData.length) return;
    import('leaflet').then(({ default: L }) => {
      lgAirports.current.clearLayers();
      if (!layerVis.airports) return;

      airportsData.forEach(ap => {
        if (!ap.lat || !ap.lon) return;

        const color  = ap.trend === 'up' ? '#16A34A' : ap.trend === 'down' ? '#DC2626' : '#64748B';
        const radius = 8;
        const delta  = ap.traffic_delta_pct != null
          ? `${ap.traffic_delta_pct > 0 ? '+' : ''}${ap.traffic_delta_pct.toFixed(1)}%` : '–';
        const ops = (ap.top_operators || []).join(', ');

        L.circleMarker([parseFloat(ap.lat), parseFloat(ap.lon)], {
          radius, fillColor: color, color: 'white',
          weight: 1, opacity: 0.3, fillOpacity: 0.8,
        }).bindPopup(
          `<div style="font-family:'IBM Plex Sans',sans-serif;min-width:220px;padding:10px 4px 4px">
            <div style="font-weight:700;font-size:16px;color:#fff;font-family:'IBM Plex Mono',monospace">${ap.icao}</div>
            <div style="font-size:12px;color:#94A3B8;margin-bottom:10px">${ap.name} · ${ap.country}</div>
            <div style="font-size:12px;color:#94A3B8;margin-bottom:4px">Zmiana ruchu: <b style="color:${color}">${delta}</b></div>
            <div style="font-size:12px;color:#94A3B8;margin-bottom:4px">Loty/dzień: ${ap.current_flights_day ?? '–'}</div>
            <div style="font-size:11px;color:#64748B">${ops || '–'}</div>
          </div>`
        ).addTo(lgAirports.current);
      });
    });
  }, [mapReady, airportsData, layerVis.airports]);

  // Draw static remote destination airports (always visible)
  useEffect(() => {
    if (!mapReady) return;
    import('leaflet').then(({ default: L }) => {
      lgRemoteAirports.current.clearLayers();
      REMOTE_AIRPORTS.forEach(ap => {
        L.circleMarker([ap.lat, ap.lon], {
          radius: 5,
          fillColor: '#334155',
          color: '#64748B',
          weight: 1,
          fillOpacity: 0.8,
        }).bindPopup(
          `<div style="font-family:'IBM Plex Sans',sans-serif;padding:6px 4px 4px;white-space:nowrap">
            <b style="font-family:'IBM Plex Mono',monospace">${ap.icao}</b> · ${ap.name}
          </div>`
        ).addTo(lgRemoteAirports.current);
      });
    });
  }, [mapReady]);

  // Build operator groups for sidebar
  const operatorGroups = useMemo(() => {
    const routeMap = {};
    routesData.forEach(r => { routeMap[r.route_id] = r; });

    const grouped = {};
    impactData.forEach(item => {
      const op = item.operator || 'Unknown';
      if (!grouped[op]) grouped[op] = {};
      const rid = item.route_id;
      if (!grouped[op][rid]) grouped[op][rid] = [];
      grouped[op][rid].push(item.registration);
    });

    return Object.entries(grouped)
      .sort((a, b) => {
        const totalA = Object.values(a[1]).flat().length;
        const totalB = Object.values(b[1]).flat().length;
        return totalB - totalA;
      })
      .map(([op, routeGroups]) => ({
        operator: op,
        totalAircraft: Object.values(routeGroups).flat().length,
        routes: Object.entries(routeGroups).map(([rid, regs]) => ({
          route_id: rid,
          registrations: regs,
          details: routeMap[rid] || null,
        })),
      }));
  }, [impactData, routesData]);

  const stepConfig = TIMELINE_STEPS.find(s => s.key === timelineStep);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Map + Sidebar */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* Map */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', background: '#060f1e' }}>
          <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />

          {/* Layer toggles */}
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, display: 'flex', gap: 6 }}>
            {[
              { key: 'airspaces', label: 'STREFY'   },
              { key: 'routes',    label: 'TRASY'    },
              { key: 'airports',  label: 'LOTNISKA' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setLayerVis(v => ({ ...v, [key]: !v[key] }))}
                style={{
                  padding: '5px 12px',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  border: `1px solid ${layerVis[key] ? C.blue : 'rgba(255,255,255,0.25)'}`,
                  background: layerVis[key] ? C.blue : 'rgba(11,28,52,0.75)',
                  color: layerVis[key] ? '#fff' : 'rgba(255,255,255,0.55)',
                  borderRadius: 4, cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                  transition: 'all 0.15s',
                }}
              >{label}</button>
            ))}
          </div>

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 44, left: 12, zIndex: 1000,
            background: 'rgba(11,28,52,0.82)', backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, padding: '8px 12px',
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {[
              { color: '#DC2626', label: 'Zamknięta (critical)', desc: 'no-fly, zakaz przelotu' },
              { color: '#F59E0B', label: 'Ograniczona (warning)', desc: 'NOTAM, ruch ograniczony' },
              { color: '#3B82F6', label: 'Nowa trasa',            desc: 'aktualne wydłużenie' },
              { color: '#F97316', label: 'Stara trasa',           desc: 'trasa przed zmianą', dashed: true },
              { color: '#16A34A', label: 'Lotnisko ↑',            desc: 'wzrost ruchu' },
              { color: '#DC2626', label: 'Lotnisko ↓',            desc: 'spadek ruchu' },
            ].map(({ color, label, desc, dashed }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {dashed
                  ? <div style={{ width: 14, height: 2, borderTop: `2px dashed ${color}`, flexShrink: 0 }} />
                  : <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                }
                <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                  {label}
                </span>
                <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                  — {desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{
          width: 340, background: C.white,
          borderLeft: `1px solid ${C.grayBorder}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{
            padding: '16px 20px 13px',
            borderBottom: `1px solid ${C.grayBorder}`,
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: C.textPrimary }}>
              Radar geopolityczny
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.textMuted }}>
              {stepConfig?.label}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 22 }}>
              {[
                { label: 'Zamknięte strefy',   value: airspacesData.length },
                { label: 'Zmienione trasy',    value: routesData.length    },
                { label: 'Dotknięte samoloty', value: impactData.length    },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: C.grayBg, border: `1px solid ${C.grayBorder}`,
                  borderRadius: 6, padding: '10px 10px 8px',
                }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: C.textPrimary, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10, color: C.textMuted, marginTop: 5, lineHeight: 1.35 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Operator groups */}
            <div style={{ marginBottom: 22 }}>
              <div style={SECTION_TITLE}>Dotknięci operatorzy</div>
              {operatorGroups.length === 0 && (
                <div style={{ fontSize: 12, color: C.textMuted }}>Ładowanie…</div>
              )}
              {operatorGroups.map(({ operator: op, totalAircraft, routes }) => {
                const isExpanded = activeOperator === op;
                const isHovered  = hoveredOperator === op;
                const dot = opColor(op);
                return (
                  <div
                    key={op}
                    style={{ marginBottom: 6 }}
                    onMouseEnter={() => setHoveredOperator(op)}
                    onMouseLeave={() => setHoveredOperator(null)}
                  >
                    {/* Operator header — click to expand, hover to show routes */}
                    <div
                      onClick={() => setActiveOperator(isExpanded ? null : op)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px',
                        background: isHovered ? C.blueLight : (isExpanded ? '#F0F5FF' : C.grayBg),
                        border: `1px solid ${isHovered || isExpanded ? C.blue + '66' : C.grayBorder}`,
                        borderRadius: isExpanded ? '4px 4px 0 0' : 4,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                      <span style={{
                        fontFamily: "'IBM Plex Sans', sans-serif",
                        fontSize: 12, fontWeight: 600, color: C.textPrimary, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{op}</span>
                      {isHovered && (
                        <span style={{
                          fontSize: 9, color: C.blue, fontWeight: 700,
                          fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em',
                          background: C.blueLight, border: `1px solid ${C.blue}33`,
                          padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                        }}>TRASY</span>
                      )}
                      <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>
                        {totalAircraft} sam.
                      </span>
                      <span style={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div style={{
                        border: `1px solid ${C.blue}66`, borderTop: 'none',
                        background: C.white, borderRadius: '0 0 4px 4px',
                        padding: '10px 12px',
                      }}>
                        {routes.map((route, ri) => {
                          const d = route.details;
                          const originIcao = d?.origin?.icao;
                          const destIcao   = d?.destination?.icao;
                          return (
                            <div key={route.route_id} style={{
                              marginBottom: ri < routes.length - 1 ? 12 : 0,
                              paddingBottom: ri < routes.length - 1 ? 12 : 0,
                              borderBottom: ri < routes.length - 1 ? `1px solid ${C.grayBorder}` : 'none',
                            }}>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>
                                {originIcao} → {destIcao}
                              </div>
                              {d && (
                                <>
                                  {/* Przed → Teraz highlight */}
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                                    padding: '6px 10px', background: C.grayBg, borderRadius: 5,
                                    border: `1px solid ${C.grayBorder}`,
                                  }}>
                                    <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }}>Przed:</span>
                                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.textMuted, textDecoration: 'line-through' }}>{fmtFH(d.old_flight_hours)}</span>
                                    <span style={{ color: C.textMuted }}>→</span>
                                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 700, color: C.red }}>{fmtFH(d.new_flight_hours)}</span>
                                  </div>
                                  {/* Stats row */}
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                    {d.delta_fh_per_flight != null && (
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: C.amber, background: '#FEF3C7', border: '1px solid #FDE68A', padding: '2px 7px', borderRadius: 4 }}>
                                        +{d.delta_fh_per_flight.toFixed(1)}h/lot
                                      </span>
                                    )}
                                    {d.frequency_weekly != null && (
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.textMuted, background: C.grayBg, border: `1px solid ${C.grayBorder}`, padding: '2px 7px', borderRadius: 4 }}>
                                        {d.frequency_weekly}x/tydz
                                      </span>
                                    )}
                                    {d.extra_fh_monthly != null && (
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: C.red, background: '#FEF2F2', border: '1px solid #FECACA', padding: '2px 7px', borderRadius: 4 }}>
                                        +{d.extra_fh_monthly.toFixed(0)} FH/mies
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                {route.registrations.map(reg => (
                                  <button
                                    key={reg}
                                    onClick={() => onNavigate && onNavigate('checks', reg)}
                                    title="Pokaż w Checks"
                                    style={{
                                      fontFamily: "'IBM Plex Mono', monospace",
                                      fontSize: 10, fontWeight: 700, padding: '2px 7px',
                                      background: C.blueLight, color: C.blue,
                                      border: `1px solid ${C.blue}44`,
                                      borderRadius: 3, cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#cde4f7'}
                                    onMouseLeave={e => e.currentTarget.style.background = C.blueLight}
                                  >{reg}</button>
                                ))}
                              </div>
                              <button
                                onClick={() => onNavigate && onNavigate('checks', null, op)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: C.blue, fontSize: 11, padding: 0,
                                  fontFamily: "'IBM Plex Sans', sans-serif",
                                  fontWeight: 500, textDecoration: 'underline',
                                }}
                              >Zobacz wszystkie w Checks →</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Active No-Fly Zones */}
            <div>
              <div style={SECTION_TITLE}>Aktywne No-Fly Zones</div>
              <div style={{ background: C.white, border: `1px solid ${C.grayBorder}`, borderRadius: 6, overflow: 'hidden' }}>
                {airspacesData.filter(as => as.status === 'closed').map((as, i, arr) => (
                  <div key={as.airspace_id} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
                    borderTop: i > 0 ? `1px solid ${C.grayBorder}` : 'none',
                  }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.textMuted, flex: '0 0 auto' }}>{as.notam_ref}</span>
                    <span style={{ fontSize: 11, color: C.textPrimary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{as.name}</span>
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', flex: '0 0 auto',
                      background: '#FEE2E2', color: C.red, border: '1px solid #FECACA',
                    }}>{as.status}</span>
                    <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace", flex: '0 0 auto', whiteSpace: 'nowrap' }}>{as.closed_since}</span>
                  </div>
                ))}
                {airspacesData.filter(as => as.status === 'closed').length === 0 && (
                  <div style={{ padding: '10px', fontSize: 12, color: C.textMuted }}>Brak aktywnych stref</div>
                )}
              </div>
            </div>

            {/* Active NOTAMs */}
            <div>
              <div style={SECTION_TITLE}>Aktywne NOTAM</div>
              <div style={{ background: C.white, border: `1px solid ${C.grayBorder}`, borderRadius: 6, overflow: 'hidden' }}>
                {airspacesData.filter(as => as.status !== 'closed').map((as, i) => (
                  <div key={as.airspace_id} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
                    borderTop: i > 0 ? `1px solid ${C.grayBorder}` : 'none',
                  }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.textMuted, flex: '0 0 auto' }}>{as.notam_ref}</span>
                    <span style={{ fontSize: 11, color: C.textPrimary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{as.name}</span>
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', flex: '0 0 auto',
                      background: '#FEF3C7', color: C.amber, border: '1px solid #FDE68A',
                    }}>{as.status}</span>
                    <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace", flex: '0 0 auto', whiteSpace: 'nowrap' }}>{as.closed_since}</span>
                  </div>
                ))}
                {airspacesData.filter(as => as.status !== 'closed').length === 0 && (
                  <div style={{ padding: '10px', fontSize: 12, color: C.textMuted }}>Brak aktywnych NOTAM</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
