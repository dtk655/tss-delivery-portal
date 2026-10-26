import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock, Gauge, Package, Plus } from "lucide-react";
import { AddToRoute } from "@/components/add-to-route";
import { DispatchActions } from "@/components/dispatch-actions";
import { Card, Empty, KindTag, Page, PageHeader, RoutePill, SourceBadge, StopPill, lbs } from "@/components/kit";
import { indexBy, loadPortal, orderStatus, routeLoad } from "@/lib/data";
import { addDays, clock12, formatLong, formatShort, isISODate, parseISO, windowLabel } from "@/lib/dates";
import { driverToken } from "@/lib/driver-link";
import { companyRecipients } from "@/lib/mail";
import { companyRoutesEmail, driverRouteText, siteUrl } from "@/lib/templates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Route Planner · TSS Deliveries" };

export default async function RoutesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const portal = await loadPortal();
  const params = await searchParams;
  const date = isISODate(params.date) ? params.date : portal.tomorrow;
  const orders = indexBy(portal.orders);
  const drivers = indexBy(portal.drivers);
  const trucks = indexBy(portal.trucks);
  const routes = portal.routes.filter((r) => r.date === date);
  const unrouted = portal.orders.filter((o) => o.shipDate === date && orderStatus(o, portal.routes).status === "ready");
  const stops = routes.reduce((n, r) => n + r.stops.length, 0);
  const miles = routes.reduce((n, r) => n + r.miles, 0);

  const days = Array.from({ length: 9 }, (_, i) => addDays(portal.today, i - 1)).filter((d) => ![0, 6].includes(parseISO(d).getUTCDay()));

  const texts = routes
    .filter((r) => r.stops.length)
    .map((route) => {
      const driver = drivers.get(route.driverId)!;
      return {
        driver: driver.name,
        phone: driver.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3"),
        optIn: driver.smsOptIn,
        body: driverRouteText(route, driver, portal.orders, `${siteUrl()}/d/${driverToken(driver.id)}`),
      };
    });
  const email = companyRoutesEmail(date, routes.filter((r) => r.stops.length), portal.orders, portal.drivers, portal.trucks);
  const recipients = companyRecipients().join(", ") || "the company list (set COMPANY_ROUTES_TO)";
  const routeOptions = routes.map((r) => ({ id: r.id, label: `${r.name} · ${drivers.get(r.driverId)?.name ?? ""}` }));

  return (
    <Page>
      <PageHeader
        title="Route Planner"
        lead={
          <>
            {formatLong(date)}: <b className="text-stone-900">{routes.length} trucks</b>, <b className="text-stone-900">{stops} stops</b>, about {miles} miles.
            {unrouted.length ? <span className="text-tss-red"> {unrouted.length} orders still need a route.</span> : null}
          </>
        }
        aside={
          <>
            <SourceBadge mode={portal.mode} uploadedAt={portal.uploadedAt} />
            <DispatchActions date={date} dateLabel={formatLong(date)} texts={texts} emailHtml={email.html} emailSubject={email.subject} recipients={recipients} />
          </>
        }
      />

      <nav className="mt-7 flex gap-2 overflow-x-auto pb-1" aria-label="Pick a day">
        {days.map((d) => {
          const active = d === date;
          const count = portal.routes.filter((r) => r.date === d).reduce((n, r) => n + r.stops.length, 0);
          return (
            <Link
              key={d}
              href={`/routes?date=${d}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-[6.5rem] shrink-0 flex-col rounded-xl border px-3.5 py-2.5 ${active ? "border-asphalt bg-asphalt text-white shadow-md" : "border-stone-200 bg-white text-stone-700 shadow-sm hover:border-stone-300"}`}
            >
              <span className={`text-xs font-semibold ${active ? "text-sheeting" : "text-stone-500"}`}>
                {d === portal.today ? "Today" : d === portal.tomorrow ? "Tomorrow" : formatShort(d).split(",")[0]}
              </span>
              <span className="figure text-lg font-extrabold">{formatShort(d).split(", ")[1]}</span>
              <span className={`text-xs ${active ? "text-[#b7bec5]" : "text-stone-500"}`}>{count} stops</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-4 lg:grid-cols-2">
          {routes.length === 0 ? (
            <div className="lg:col-span-2">
              <Empty>No routes for {formatLong(date)} yet. Routes are created from NetSuite orders once the sync is connected.</Empty>
            </div>
          ) : null}
          {routes.map((route) => {
            const driver = drivers.get(route.driverId);
            const truck = trucks.get(route.truckId);
            const load = routeLoad(route, orders);
            const pct = truck?.capacityLbs ? Math.round((load / truck.capacityLbs) * 100) : 0;
            const needsCdl = route.stops.some((s) => orders.get(s.orderId)?.needsCdl);
            const cdlProblem = needsCdl && driver?.license === "Non-CDL";
            return (
              <Card key={route.id} flush className="flex flex-col overflow-hidden">
                <div className="bg-asphalt px-5 py-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/routes/${route.id}`} className="font-display block truncate text-xl font-extrabold hover:text-sheeting">
                        {route.name}
                      </Link>
                      <p className="mt-0.5 truncate text-sm text-[#b7bec5]">
                        {driver?.name} · {driver?.license}
                      </p>
                    </div>
                    <RoutePill status={route.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[#8a949c]">
                        <Clock className="size-3.5" /> Load out
                      </div>
                      <div className="figure mt-0.5 font-bold text-sheeting">{clock12(route.departure)}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[#8a949c]">
                        <Package className="size-3.5" /> Truck
                      </div>
                      <div className="mt-0.5 truncate font-semibold">{truck?.unit}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[#8a949c]">
                        <Gauge className="size-3.5" /> Miles
                      </div>
                      <div className="figure mt-0.5 font-bold">~{route.miles}</div>
                    </div>
                  </div>
                </div>
                <div className="hazard h-1" aria-hidden />

                <ol className="flex-1 px-5 pt-4">
                  {route.stops.map((stop, i) => {
                    const o = orders.get(stop.orderId);
                    if (!o) return null;
                    return (
                      <li key={stop.orderId} className="relative flex gap-3 pb-4">
                        {i < route.stops.length - 1 ? <span className="stop-line" aria-hidden /> : null}
                        <span className={`stop-dot is-${stop.status}`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-semibold text-stone-950">{o.customer}</span>
                            <span className="figure shrink-0 text-sm font-bold text-stone-900">{clock12(stop.eta)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                            <KindTag kind={o.kind} />
                            <span>
                              {o.city}, {o.state}
                            </span>
                            <span>· {o.number}</span>
                            {o.window ? <span className="font-semibold text-[#8a5a00]">· Window {windowLabel(o.window)}</span> : null}
                            {stop.status !== "pending" ? <StopPill status={stop.status} /> : null}
                          </div>
                        </div>
                        {route.status === "planned" ? <AddToRoute orderId={o.id} routes={routeOptions.filter((r) => r.id !== route.id)} mode="move" /> : null}
                      </li>
                    );
                  })}
                  {route.stops.length === 0 ? <li className="pb-4 text-sm text-stone-500">No stops yet.</li> : null}
                </ol>

                <div className="border-t border-stone-100 px-5 py-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-stone-600">
                      Load {lbs(load)} of {lbs(truck?.capacityLbs ?? 0)}
                    </span>
                    <span className={`figure font-bold ${pct > 100 ? "text-tss-red" : pct > 85 ? "text-[#b45309]" : "text-stone-700"}`}>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200">
                    <div className={`h-full rounded-full ${pct > 100 ? "bg-tss-red" : pct > 85 ? "bg-[#f59e0b]" : "bg-asphalt"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  {cdlProblem ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-tss-red">
                      <AlertTriangle className="size-3.5" /> A stop needs a CDL driver.
                    </p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>

        <aside className="xl:sticky xl:top-[calc(var(--topbar-h)+1.5rem)] xl:self-start">
          <Card flush className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-stone-950">Needs a route</h2>
                <p className="text-sm text-stone-500">Ready to ship {formatShort(date)}</p>
              </div>
              <span className={`figure flex size-9 items-center justify-center rounded-lg text-lg font-extrabold ${unrouted.length ? "bg-tss-red text-white" : "bg-stone-100 text-stone-500"}`}>{unrouted.length}</span>
            </div>
            <ul className="divide-y divide-stone-100">
              {unrouted.map((o) => (
                <li key={o.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="figure text-sm font-bold text-stone-950">{o.number}</span>
                        <KindTag kind={o.kind} />
                      </div>
                      <div className="truncate text-sm font-medium text-stone-800">{o.customer}</div>
                      <div className="text-xs text-stone-500">
                        {o.city}, {o.state} · {lbs(o.weightLbs)}
                        {o.needsCdl ? " · CDL" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <AddToRoute orderId={o.id} routes={routeOptions} mode="add" />
                  </div>
                </li>
              ))}
              {unrouted.length === 0 ? (
                <li className="flex items-center gap-2 px-5 py-8 text-sm text-stone-500">
                  <Plus className="size-4" /> Every order for this day is on a route.
                </li>
              ) : null}
            </ul>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
