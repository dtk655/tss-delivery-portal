import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Gauge, MapPin, Navigation, Phone, StickyNote, Truck, User } from "lucide-react";
import { CopyLink } from "@/components/copy-link";
import { EventFeed } from "@/components/event-feed";
import { Card, CardHead, Empty, KindTag, Page, Road, RoutePill, StopPill, TRUCK_LABEL, lbs, phoneOf } from "@/components/kit";
import { PrintButton } from "@/components/print-button";
import { RouteMap } from "@/components/route-map";
import { indexBy, loadPortal, routeLoad } from "@/lib/data";
import { clock12, formatLong, timeOf, windowLabel } from "@/lib/dates";
import { driverToken } from "@/lib/driver-link";
import { YARD } from "@/lib/sample";
import { siteUrl } from "@/lib/templates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Route sheet · TSS Deliveries" };

export default async function RouteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const portal = await loadPortal();
  const route = portal.routes.find((r) => r.id === id);
  if (!route) notFound();
  const orders = indexBy(portal.orders);
  const driver = portal.drivers.find((d) => d.id === route.driverId);
  const truck = portal.trucks.find((t) => t.id === route.truckId);
  const done = route.stops.filter((s) => s.status === "delivered").length;
  const load = routeLoad(route, orders);
  const events = portal.events.filter((e) => e.routeId === route.id);
  const isToday = route.date === portal.today;
  const firstOpen = route.stops.findIndex((s) => s.status !== "delivered");

  const stops = route.stops.flatMap((s, i) => {
    const o = orders.get(s.orderId);
    return o
      ? [{ truckId: route.truckId, n: i + 1, lat: o.lat, lon: o.lon, label: `${i + 1}. ${o.customer} · ${clock12(s.eta)}`, state: (s.status === "delivered" ? "delivered" : i === firstOpen ? "next" : "later") as "delivered" | "next" | "later" }]
      : [];
  });
  const mapTruck =
    truck && isToday
      ? { id: truck.id, unit: truck.unit, lat: truck.lat, lon: truck.lon, heading: truck.heading, status: truck.status, statusLabel: TRUCK_LABEL[truck.status], driver: driver?.name ?? "", route: route.name, next: "", speed: truck.speedMph, ping: timeOf(truck.lastPing) }
      : null;

  return (
    <Page>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/routes?date=${route.date}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-tss-red">
          <ArrowLeft className="size-4" /> All routes for {formatLong(route.date)}
        </Link>
        <div className="flex flex-wrap gap-2">
          {driver ? <CopyLink url={`${siteUrl()}/d/${driverToken(driver.id)}`} /> : null}
          <PrintButton />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl bg-asphalt text-white shadow-md">
        <div className="flex flex-wrap items-end justify-between gap-6 px-6 py-6 lg:px-8">
          <div>
            <div className="text-sm font-semibold text-sheeting">{formatLong(route.date)}</div>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{route.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#d5dade]">
              <span className="inline-flex items-center gap-1.5">
                <User className="size-4 text-[#8a949c]" /> {driver?.name} · {driver?.license}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4 text-[#8a949c]" /> {driver ? phoneOf(driver.phone) : "—"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="size-4 text-[#8a949c]" /> {truck?.unit} · {truck?.type}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-[#8a949c]">
                <Clock className="size-3.5" /> Load out
              </div>
              <div className="figure mt-1 text-2xl font-extrabold text-sheeting">{clock12(route.departure)}</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-[#8a949c]">
                <MapPin className="size-3.5" /> Stops
              </div>
              <div className="figure mt-1 text-2xl font-extrabold">
                {done}/{route.stops.length}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-[#8a949c]">
                <Gauge className="size-3.5" /> Miles
              </div>
              <div className="figure mt-1 text-2xl font-extrabold">~{route.miles}</div>
            </div>
          </div>
        </div>
        <div className="hazard h-2" aria-hidden />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card flush className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-stone-950">Stops</h2>
              <RoutePill status={route.status} />
            </div>
            <span className="text-sm text-stone-500">Load {lbs(load)} of {lbs(truck?.capacityLbs ?? 0)}</span>
          </div>
          <div className="px-5 pb-3">
            <Road done={done} total={route.stops.length} />
          </div>
          <ol className="divide-y divide-stone-100 border-t border-stone-100">
            {route.stops.map((stop, i) => {
              const o = orders.get(stop.orderId);
              if (!o) return null;
              return (
                <li key={stop.orderId} className="flex gap-4 px-5 py-4">
                  <span className={`stop-dot is-${stop.status}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-display truncate text-lg font-bold text-stone-950">{o.customer}</span>
                        <KindTag kind={o.kind} />
                      </div>
                      <div className="flex items-center gap-2">
                        <StopPill status={stop.status} />
                        <span className="figure text-base font-extrabold text-stone-950">{stop.doneAt ? timeOf(stop.doneAt) : clock12(stop.eta)}</span>
                      </div>
                    </div>
                    <p className="mt-0.5 text-sm text-stone-600">
                      {o.address}, {o.city}, {o.state} · {o.number}
                      {o.window ? <span className="font-semibold text-[#8a5a00]"> · Window {windowLabel(o.window)}</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      {o.contact} · {phoneOf(o.contactPhone)}
                    </p>
                    <p className="mt-2 text-sm text-stone-800">{o.items.map((it) => `${it.qty} × ${it.name}`).join(" · ")}</p>
                    {o.notes ? (
                      <p className="mt-2 flex gap-2 rounded-lg bg-[#fffbeb] px-3 py-2 text-sm text-[#8a5a00]">
                        <StickyNote className="mt-0.5 size-4 shrink-0" /> {o.notes}
                      </p>
                    ) : null}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="no-print mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-tss-red"
                    >
                      <Navigation className="size-3.5" /> Directions
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="space-y-4">
          <div className="no-print h-[26rem]">
            <RouteMap truck={mapTruck} stops={stops} yard={{ lat: YARD.lat, lon: YARD.lon }} />
          </div>
          <Card className="no-print">
            <CardHead title="Driver updates" note="From the driver's phone, newest first." />
            <div className="mt-5">{events.length ? <EventFeed events={events} orders={orders} drivers={indexBy(portal.drivers)} routes={indexBy(portal.routes)} /> : <Empty>No updates yet.</Empty>}</div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
