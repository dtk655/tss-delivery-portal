"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Gauge, MapPin, Radio, Satellite, Truck as TruckIcon, User } from "lucide-react";
import type { MapStop, MapTruck } from "@/components/fleet-leaflet";

const FleetLeaflet = dynamic(() => import("./fleet-leaflet").then((m) => m.FleetLeaflet), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#1b1f24]" />,
});

export type FleetRow = MapTruck & {
  type: string;
  plate: string;
  done: number;
  total: number;
  phone: string;
};

const ORDER = ["moving", "at-stop", "stopped", "yard", "offline"] as const;
const LABEL: Record<(typeof ORDER)[number], string> = { moving: "Driving", "at-stop": "At a stop", stopped: "Stopped", yard: "Yard", offline: "No signal" };
const SWATCH: Record<(typeof ORDER)[number], string> = { moving: "bg-sheeting", "at-stop": "bg-[#22c55e]", stopped: "bg-[#ff8c00]", yard: "bg-stone-300", offline: "bg-stone-600" };

function TruckList({ rows, selected, onPick }: { rows: FleetRow[]; selected: string | null; onPick: (id: string) => void }) {
  return (
    <ul className="divide-y divide-white/5">
      {rows.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onPick(t.id)}
            className={`flex w-full gap-3 px-4 py-3.5 text-left transition hover:bg-white/5 ${selected === t.id ? "bg-sheeting/10 shadow-[inset_3px_0_0_#ffd100]" : ""}`}
          >
            <span className={`figure flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-[#15181b] text-sm font-extrabold text-[#15181b] ${SWATCH[t.status as keyof typeof SWATCH] ?? "bg-stone-300"}`}>
              {t.unit.replace(/\D/g, "") || "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-bold text-white">{t.unit}</span>
                <span className="shrink-0 text-xs text-stone-400">{t.ping}</span>
              </span>
              <span className="flex items-center gap-1.5 truncate text-xs text-stone-400">
                <User className="size-3" /> {t.driver || "No driver today"}
                {t.route ? ` · ${t.route}` : ""}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-stone-200">
                <MapPin className="size-3 text-sheeting" />
                <span className="truncate">{t.next || t.statusLabel}</span>
              </span>
              {t.total ? (
                <span className="mt-2 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-sheeting" style={{ width: `${(t.done / t.total) * 100}%` }} />
                  </span>
                  <span className="font-mono text-[11px] text-stone-400">
                    {t.done}/{t.total}
                  </span>
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function FleetView({
  rows,
  stops,
  yard,
  updated,
  source,
}: {
  rows: FleetRow[];
  stops: MapStop[];
  yard: { lat: number; lon: number };
  updated: string;
  source: "fleetio" | "sample";
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const counts = useMemo(() => Object.fromEntries(ORDER.map((s) => [s, rows.filter((r) => r.status === s).length])), [rows]);
  const shown = useMemo(() => rows.filter((r) => !hidden.has(r.status)), [rows, hidden]);
  const pick = (id: string) => {
    setSelected((cur) => (cur === id ? null : id));
    if (window.matchMedia("(max-width: 1023px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const current = rows.find((r) => r.id === selected);

  return (
    <div className="bg-[#15181b] text-stone-100">
      <div className="flex h-[calc(100dvh-4rem)] flex-col md:h-[calc(100dvh-var(--topbar-h))]">
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-asphalt px-3 py-2 sm:px-4">
          <div className="hidden items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-sheeting uppercase sm:flex">
            <Radio className="size-3.5 animate-pulse" /> Live · {updated}
          </div>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto sm:justify-center [&::-webkit-scrollbar]:hidden">
            {ORDER.map((status) => {
              const off = hidden.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={!off}
                  onClick={() =>
                    setHidden((cur) => {
                      const next = new Set(cur);
                      if (next.has(status)) next.delete(status);
                      else next.add(status);
                      return next;
                    })
                  }
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition ${off ? "border-white/5 opacity-40" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                >
                  <span className={`size-2.5 rounded-sm ${SWATCH[status]}`} />
                  <span className="font-mono text-base font-bold tabular-nums">{counts[status]}</span>
                  <span className="text-xs text-stone-400">{LABEL[status]}</span>
                </button>
              );
            })}
          </div>
          <span
            className={`hidden shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold md:inline-flex ${source === "fleetio" ? "border-[#22c55e]/40 text-[#86efac]" : "border-sheeting/40 text-sheeting"}`}
            title={source === "fleetio" ? "Positions from Fleetio" : "Add FLEETIO_API_KEY and FLEETIO_ACCOUNT_TOKEN to show real GPS."}
          >
            <Satellite className="size-3.5" /> {source === "fleetio" ? "Fleetio GPS" : "Sample GPS"}
          </span>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="relative min-h-0">
            <FleetLeaflet trucks={shown} stops={stops} yard={yard} selected={selected} onSelect={setSelected} />
            {current ? (
              <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-[500] sm:left-auto sm:w-80">
                <div className="pointer-events-auto rounded-xl border border-sheeting/40 border-t-4 border-t-sheeting bg-asphalt/95 p-4 shadow-2xl backdrop-blur">
                  <div className="text-[11px] font-extrabold tracking-[0.12em] text-sheeting uppercase">{current.statusLabel}</div>
                  <div className="font-display mt-0.5 text-lg font-extrabold text-white">
                    {current.unit} · {current.type}
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-stone-300">
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 text-stone-500" /> {current.driver || "No driver"} {current.phone ? `· ${current.phone}` : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <TruckIcon className="size-3.5 text-stone-500" /> {current.route || "No route today"} {current.total ? `· ${current.done}/${current.total} stops` : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <Gauge className="size-3.5 text-stone-500" /> {current.speed} mph · plate {current.plate}
                    </div>
                    {current.next ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 text-sheeting" /> {current.next}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <aside className="hidden min-h-0 overflow-y-auto border-l border-white/10 bg-asphalt lg:block">
            <TruckList rows={shown} selected={selected} onPick={pick} />
          </aside>
        </div>
      </div>
      <section className="border-t border-white/10 bg-asphalt lg:hidden">
        <h2 className="px-4 pt-4 pb-1 text-[11px] font-bold tracking-[0.18em] text-sheeting uppercase">Trucks · {updated}</h2>
        <TruckList rows={shown} selected={selected} onPick={pick} />
      </section>
    </div>
  );
}
