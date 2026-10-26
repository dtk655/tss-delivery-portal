import type { Metadata } from "next";
import { AutoRefresh } from "@/components/auto-refresh";
import { FleetView, type FleetRow } from "@/components/fleet-view";
import type { MapStop } from "@/components/fleet-leaflet";
import { TRUCK_LABEL, phoneOf } from "@/components/kit";
import { indexBy, loadPortal } from "@/lib/data";
import { ago, clock12, timeOf } from "@/lib/dates";
import { YARD } from "@/lib/sample";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live Fleet · TSS Deliveries" };

const RANK: Record<string, number> = { moving: 0, "at-stop": 1, stopped: 2, yard: 3, offline: 4 };

export default async function FleetPage() {
  const portal = await loadPortal();
  const orders = indexBy(portal.orders);
  const drivers = indexBy(portal.drivers);
  const todays = portal.routes.filter((r) => r.date === portal.today);

  const rows: FleetRow[] = portal.trucks
    .map((truck) => {
      const route = todays.find((r) => r.truckId === truck.id);
      const driver = route ? drivers.get(route.driverId) : portal.drivers.find((d) => d.defaultTruckId === truck.id);
      const next = route?.stops.find((s) => s.status !== "delivered");
      const nextOrder = next ? orders.get(next.orderId) : undefined;
      let nextLabel = "";
      if (truck.status === "at-stop" && nextOrder) nextLabel = `On site at ${nextOrder.customer}, ${nextOrder.city}`;
      else if (nextOrder) nextLabel = `Next: ${nextOrder.city}, ${nextOrder.state} · ETA ${clock12(next!.eta)}`;
      else if (route) nextLabel = truck.status === "yard" ? "Route complete · back at the yard" : "Route complete · heading back";
      return {
        id: truck.id,
        unit: truck.unit,
        type: truck.type,
        plate: truck.plate,
        lat: truck.lat,
        lon: truck.lon,
        heading: truck.heading,
        status: truck.status,
        statusLabel: TRUCK_LABEL[truck.status],
        driver: driver?.name ?? "",
        phone: driver ? phoneOf(driver.phone) : "",
        route: route?.name ?? "",
        next: nextLabel,
        speed: truck.speedMph,
        ping: truck.status === "offline" ? `last seen ${ago(truck.lastPing)}` : timeOf(truck.lastPing),
        done: route?.stops.filter((s) => s.status === "delivered").length ?? 0,
        total: route?.stops.length ?? 0,
      };
    })
    .sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || a.unit.localeCompare(b.unit));

  const stops: MapStop[] = todays.flatMap((route) => {
    const firstOpen = route.stops.findIndex((s) => s.status !== "delivered");
    return route.stops.flatMap((s, i) => {
      const o = orders.get(s.orderId);
      if (!o) return [];
      return [
        {
          truckId: route.truckId,
          n: i + 1,
          lat: o.lat,
          lon: o.lon,
          label: `${i + 1}. ${o.customer} · ${o.city} · ${clock12(s.eta)}`,
          state: s.status === "delivered" ? "delivered" : i === firstOpen ? "next" : "later",
        } satisfies MapStop,
      ];
    });
  });

  return (
    <main aria-label="Live fleet map">
      <AutoRefresh seconds={30} />
      <FleetView rows={rows} stops={stops} yard={{ lat: YARD.lat, lon: YARD.lon }} updated={timeOf(new Date().toISOString())} source={portal.truckSource} />
    </main>
  );
}
