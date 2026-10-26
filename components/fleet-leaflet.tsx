"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapTruck = {
  id: string;
  unit: string;
  lat: number;
  lon: number;
  heading: number;
  status: string;
  statusLabel: string;
  driver: string;
  route: string;
  next: string;
  speed: number;
  ping: string;
};

export type MapStop = { truckId: string; n: number; lat: number; lon: number; label: string; state: "delivered" | "next" | "later" };

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function popup(t: MapTruck): string {
  return `<div>
    <div class="ops-pop-status ops-c-${t.status === "moving" ? "active" : t.status === "at-stop" ? "done" : t.status === "offline" ? "tailgate" : "upcoming"}">${esc(t.statusLabel)}</div>
    <div class="ops-pop-title">${esc(t.unit)}</div>
    <div class="ops-pop-sub">${esc(t.driver)}${t.route ? ` · ${esc(t.route)}` : ""}</div>
    ${t.next ? `<div class="ops-pop-row">${esc(t.next)}</div>` : ""}
    <div class="ops-pop-row">${t.speed ? `${t.speed} mph · ` : ""}GPS ${esc(t.ping)}</div>
    <div class="ops-pop-links"><a href="https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lon}" target="_blank" rel="noreferrer">Open in Maps</a></div>
  </div>`;
}

export function FleetLeaflet({
  trucks,
  stops,
  yard,
  selected,
  onSelect,
}: {
  trucks: MapTruck[];
  stops: MapStop[];
  yard: { lat: number; lon: number };
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const truckLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const fitted = useRef(false);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!box.current || map.current) return;
    const pins = markers.current;
    const m = L.map(box.current, { zoomControl: true }).setView([yard.lat, yard.lon], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: "ops-tiles",
    }).addTo(m);
    routeLayer.current = L.layerGroup().addTo(m);
    truckLayer.current = L.layerGroup().addTo(m);
    L.marker([yard.lat, yard.lon], {
      icon: L.divIcon({ className: "truck-pin-wrap", html: '<span class="yard-pin">TSS</span>', iconSize: [30, 30], iconAnchor: [15, 15] }),
      title: "TSS Yard",
      zIndexOffset: -100,
    }).addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      pins.clear();
    };
  }, [yard.lat, yard.lon]);

  // Trucks
  useEffect(() => {
    const m = map.current;
    const group = truckLayer.current;
    if (!m || !group) return;
    const seen = new Set<string>();
    for (const t of trucks) {
      if (!Number.isFinite(t.lat) || !Number.isFinite(t.lon)) continue;
      seen.add(t.id);
      const arrow = t.status === "moving" ? `<span class="truck-arrow" style="transform:rotate(${t.heading}deg)"></span>` : "";
      const icon = L.divIcon({
        className: "truck-pin-wrap",
        html: `<span class="truck-pin is-${t.status}${selected === t.id ? " is-selected" : ""}" style="${selected === t.id ? "outline:3px solid #e10600;outline-offset:2px" : ""}">${arrow}${esc(t.unit.replace(/\D/g, "") || t.unit.slice(0, 3))}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });
      const existing = markers.current.get(t.id);
      if (existing) {
        existing.setLatLng([t.lat, t.lon]);
        existing.setIcon(icon);
        existing.setPopupContent(popup(t));
      } else {
        const marker = L.marker([t.lat, t.lon], { icon, riseOnHover: true, title: t.unit })
          .bindPopup(popup(t), { className: "ops-popup", maxWidth: 280 })
          .on("click", () => select.current(t.id))
          .addTo(group);
        markers.current.set(t.id, marker);
      }
      markers.current.get(t.id)?.setZIndexOffset(selected === t.id ? 1000 : t.status === "moving" ? 500 : 0);
    }
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        group.removeLayer(marker);
        markers.current.delete(id);
      }
    }
    if (!fitted.current) {
      const points = [...trucks.filter((t) => Number.isFinite(t.lat)).map((t) => [t.lat, t.lon] as L.LatLngTuple), ...stops.map((s) => [s.lat, s.lon] as L.LatLngTuple)];
      if (points.length) {
        m.fitBounds(L.latLngBounds(points).pad(0.12), { maxZoom: 11 });
        fitted.current = true;
      }
    }
  }, [trucks, stops, selected]);

  // Route for the selected truck
  useEffect(() => {
    const group = routeLayer.current;
    const m = map.current;
    if (!group || !m) return;
    group.clearLayers();
    const mine = stops.filter((s) => s.truckId === selected);
    if (!selected || !mine.length) return;
    const truck = trucks.find((t) => t.id === selected);
    const path: L.LatLngTuple[] = [[yard.lat, yard.lon], ...mine.map((s) => [s.lat, s.lon] as L.LatLngTuple)];
    L.polyline(path, { color: "#ffd100", weight: 3, opacity: 0.85, dashArray: "8 8" }).addTo(group);
    for (const s of mine) {
      L.marker([s.lat, s.lon], {
        icon: L.divIcon({ className: "truck-pin-wrap", html: `<span class="stop-pin is-${s.state}">${s.n}</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: s.label,
      })
        .bindTooltip(esc(s.label), { direction: "top", offset: [0, -10] })
        .addTo(group);
    }
    const bounds = L.latLngBounds(path);
    if (truck && Number.isFinite(truck.lat)) bounds.extend([truck.lat, truck.lon]);
    m.flyToBounds(bounds.pad(0.2), { duration: 0.6, maxZoom: 12 });
  }, [selected, stops, trucks, yard.lat, yard.lon]);

  return (
    <div className="ops-map h-full w-full">
      <div ref={box} className="h-full min-h-[420px] w-full" />
    </div>
  );
}
