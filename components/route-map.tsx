"use client";

import dynamic from "next/dynamic";
import type { MapStop, MapTruck } from "@/components/fleet-leaflet";

const FleetLeaflet = dynamic(() => import("./fleet-leaflet").then((m) => m.FleetLeaflet), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#1b1f24]" />,
});

export function RouteMap({ truck, stops, yard }: { truck: MapTruck | null; stops: MapStop[]; yard: { lat: number; lon: number } }) {
  return (
    <div className="h-full min-h-[360px] overflow-hidden rounded-2xl border border-stone-300 bg-[#15181b]">
      <FleetLeaflet trucks={truck ? [truck] : []} stops={stops} yard={yard} selected={truck?.id ?? stops[0]?.truckId ?? null} onSelect={() => {}} />
    </div>
  );
}
