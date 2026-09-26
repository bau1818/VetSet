import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import clsx from 'clsx';
import type { GeoPoint } from '../data/types';
import { getRouteGeometry } from '../lib/travel';

export interface MapStop {
  id: string;
  point: GeoPoint;
  label: string;
  title: string;
  subtitle?: string;
  done?: boolean;
  late?: boolean;
}

export interface MapRoute {
  id: string;
  color: string;
  base: GeoPoint;
  baseLabel?: string;
  stops: MapStop[];
  dashed?: boolean;
  faded?: boolean;
}

const HOUSE = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/></svg>`;

const pinIcon = (label: string, color: string, extra = '') =>
  L.divIcon({ className: '', html: `<div class="vs-pin ${extra}" style="background:${color}">${label}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
const baseIcon = L.divIcon({ className: '', html: `<div class="vs-base">${HOUSE}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
const newIcon = L.divIcon({ className: '', html: `<div class="vs-pin is-new">★</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });

function FitBounds({ points, fitKey }: { points: GeoPoint[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  useEffect(() => {
    // Leaflet needs a nudge when its container is resized by layout changes.
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function RouteLine({ route }: { route: MapRoute }) {
  const pts = useMemo(() => [route.base, ...route.stops.map((s) => s.point), route.base], [route]);
  const key = pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
  const [line, setLine] = useState<[number, number][]>(() => pts.map((p) => [p.lat, p.lng]));
  useEffect(() => {
    let alive = true;
    setLine(pts.map((p) => [p.lat, p.lng]));
    if (pts.length > 2)
      void getRouteGeometry(pts).then((g) => {
        if (alive) setLine(g);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (route.stops.length === 0) return null;
  return (
    <>
      <Polyline positions={line} pathOptions={{ color: '#fff', weight: 7, opacity: route.faded ? 0.3 : 0.8 }} />
      <Polyline positions={line} pathOptions={{ color: route.color, weight: 4, opacity: route.faded ? 0.35 : 0.9, dashArray: route.dashed ? '6 8' : undefined }} />
    </>
  );
}

export function RouteMap({
  routes,
  highlight,
  onStopClick,
  className,
  extraPoints = [],
}: {
  routes: MapRoute[];
  highlight?: { point: GeoPoint; title: string };
  onStopClick?: (id: string) => void;
  className?: string;
  extraPoints?: GeoPoint[];
}) {
  const allPoints = useMemo(
    () => [...routes.flatMap((r) => [r.base, ...r.stops.map((s) => s.point)]), ...(highlight ? [highlight.point] : []), ...extraPoints],
    [routes, highlight, extraPoints],
  );
  const fitKey = allPoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  const center = allPoints[0] ?? { lat: 30.5, lng: -97.75 };
  const bases = useMemo(() => {
    const seen = new Map<string, { point: GeoPoint; label: string }>();
    routes.forEach((r) => seen.set(`${r.base.lat},${r.base.lng}`, { point: r.base, label: r.baseLabel ?? 'Base' }));
    return [...seen.values()];
  }, [routes]);

  return (
    <div className={clsx('relative isolate overflow-hidden rounded-xl border border-slate-200 bg-slate-100', className)}>
      <MapContainer center={[center.lat, center.lng]} zoom={11} scrollWheelZoom className="h-full w-full" zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          className="vs-tiles"
        />
        <FitBounds points={allPoints} fitKey={fitKey} />
        {routes.map((r) => (
          <RouteLine key={r.id + r.stops.map((s) => s.id).join()} route={r} />
        ))}
        {bases.map((b) => (
          <Marker key={`${b.point.lat},${b.point.lng}`} position={[b.point.lat, b.point.lng]} icon={baseIcon} zIndexOffset={-100}>
            <Tooltip className="vs-tip" direction="top" offset={[0, -14]}>
              <strong>{b.label}</strong>
            </Tooltip>
          </Marker>
        ))}
        {routes.flatMap((r) =>
          r.stops.map((s) => (
            <Marker
              key={`${r.id}-${s.id}`}
              position={[s.point.lat, s.point.lng]}
              icon={pinIcon(s.label, r.color, clsx(s.done && 'is-done', s.late && 'is-late'))}
              eventHandlers={onStopClick ? { click: () => onStopClick(s.id) } : undefined}
              opacity={r.faded ? 0.55 : 1}
            >
              <Tooltip className="vs-tip" direction="top" offset={[0, -14]}>
                <div className="font-semibold text-slate-900">{s.title}</div>
                {s.subtitle && <div className="text-slate-500">{s.subtitle}</div>}
              </Tooltip>
            </Marker>
          )),
        )}
        {highlight && (
          <Marker position={[highlight.point.lat, highlight.point.lng]} icon={newIcon} zIndexOffset={1000}>
            <Tooltip className="vs-tip" direction="top" offset={[0, -16]} permanent>
              <strong>{highlight.title}</strong>
            </Tooltip>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
