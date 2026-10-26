import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Mail, MessageSquareText, PackageCheck, Radar, RefreshCw, Satellite, Truck } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { ScheduleChart } from "@/components/charts";
import { CountUp } from "@/components/count-up";
import { EventFeed } from "@/components/event-feed";
import { Card, CardHead, Kpi, Page, PageHeader, Road, RoutePill, SourceBadge } from "@/components/kit";
import { indexBy, loadPortal, orderStatus } from "@/lib/data";
import { addDays, ago, clock12, formatLong, formatShort, parseISO } from "@/lib/dates";
import { fleetioConfigured } from "@/lib/fleetio";
import { mailConfigured } from "@/lib/mail";
import { twilioConfig } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard · TSS Deliveries" };

function Automation({
  icon: Icon,
  title,
  when,
  ready,
  readyText,
  setupText,
}: {
  icon: typeof Mail;
  title: string;
  when: string;
  ready: boolean;
  readyText: string;
  setupText: string;
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-600">
        <Icon className="size-[1.1rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-stone-900">{title}</span>
          <span className={`pill ${ready ? "pill-done" : "pill-ready"}`}>{ready ? "On" : "Preview"}</span>
        </div>
        <p className="mt-0.5 text-xs text-stone-500">
          {when} · {ready ? readyText : setupText}
        </p>
      </div>
    </li>
  );
}

export default async function DashboardPage() {
  const portal = await loadPortal();
  const { today, tomorrow, routes, orders, events, trucks, drivers } = portal;
  const orderMap = indexBy(orders);
  const driverMap = indexBy(drivers);
  const truckMap = indexBy(trucks);
  const routeMap = indexBy(routes);

  const todays = routes.filter((r) => r.date === today);
  const stopsToday = todays.flatMap((r) => r.stops);
  const delivered = stopsToday.filter((s) => s.status === "delivered").length;
  const remaining = stopsToday.length - delivered;
  const ready = orders.filter((o) => orderStatus(o, routes).status === "ready");
  const readySoon = ready.filter((o) => o.shipDate <= tomorrow).length;
  const onRoad = trucks.filter((t) => t.status === "moving" || t.status === "stopped" || t.status === "at-stop").length;
  const tomorrowRoutes = routes.filter((r) => r.date === tomorrow);
  const tomorrowStops = tomorrowRoutes.reduce((n, r) => n + r.stops.length, 0);
  const deliveredShare = stopsToday.length ? Math.round((delivered / stopsToday.length) * 100) : 0;

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) => ![0, 6].includes(parseISO(d).getUTCDay()));
  const chart = week.map((date) => {
    const list = orders.filter((o) => o.shipDate === date);
    return {
      label: formatShort(date).split(",")[0] + " " + Number(date.slice(8)),
      full: formatLong(date),
      sales: list.filter((o) => o.kind === "sale").length,
      rentals: list.filter((o) => o.kind === "rental").length,
      pickups: list.filter((o) => o.kind === "pickup").length,
      today: date === today,
    };
  });

  const recent = events.slice(0, 7);
  const smsReady = Boolean(twilioConfig());

  return (
    <Page>
      <AutoRefresh seconds={45} />
      <PageHeader
        title="Delivery Operations Hub"
        lead={<>{formatLong(today)}. {todays.length} routes and {stopsToday.length} stops today.</>}
        aside={
          <>
            <SourceBadge mode={portal.mode} uploadedAt={portal.uploadedAt} />
            <Link href="/routes" className="btn-ink inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold">
              Plan tomorrow <ArrowRight className="size-4" />
            </Link>
          </>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ready to ship" icon={PackageCheck} value={String(ready.length)} note={`${readySoon} due by ${formatShort(tomorrow).split(",")[0]}, not on a route yet`} href="/orders?status=ready" />
        <Kpi label="Out for delivery" icon={Truck} tone="dark" value={String(remaining)} note={`Stops left on ${todays.filter((r) => r.status !== "complete").length} active routes`} href="/fleet" />
        <Kpi label="Delivered today" icon={CheckCircle2} tone="yellow" value={String(delivered)} note={`${deliveredShare}% of today's stops`} href="/log" />
        <Kpi label="Trucks on the road" icon={Radar} value={`${onRoad}/${trucks.length}`} note={portal.truckSource === "fleetio" ? "Live from Fleetio GPS" : "Fleetio not connected · sample positions"} href="/fleet" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card flush className="overflow-hidden xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div>
              <h2 className="text-lg font-bold text-stone-950">Today&apos;s routes</h2>
              <p className="mt-0.5 text-sm text-stone-500">Progress updates as drivers log each stop.</p>
            </div>
            <Link href={`/routes?date=${today}`} className="text-sm font-semibold text-stone-600 hover:text-tss-red">
              All routes →
            </Link>
          </div>
          <ul className="divide-y divide-stone-100 border-t border-stone-100">
            {todays.map((route) => {
              const driver = driverMap.get(route.driverId);
              const truck = truckMap.get(route.truckId);
              const done = route.stops.filter((s) => s.status === "delivered").length;
              const next = route.stops.find((s) => s.status !== "delivered");
              const nextOrder = next ? orderMap.get(next.orderId) : undefined;
              return (
                <li key={route.id}>
                  <Link href={`/routes/${route.id}`} className="grid gap-3 px-5 py-4 hover:bg-stone-50 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="figure flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-asphalt leading-none text-white">
                        <span className="text-[0.6rem] font-semibold tracking-wider text-[#8a949c] uppercase">Unit</span>
                        <span className="text-base font-extrabold text-sheeting">{truck?.unit.replace(/\D/g, "") ?? "—"}</span>
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold text-stone-950">{route.name}</span>
                          <RoutePill status={route.status} />
                        </div>
                        <p className="truncate text-sm text-stone-500">
                          {driver?.name} · {truck?.type}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate text-stone-600">
                          {nextOrder ? (
                            <>
                              Next: <span className="font-medium text-stone-900">{nextOrder.city}</span> · ETA {clock12(next!.eta)}
                            </>
                          ) : (
                            <span className="font-medium text-[#15803d]">All stops done</span>
                          )}
                        </span>
                        <span className="figure shrink-0 font-bold text-stone-950">
                          {done}/{route.stops.length}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Road done={done} total={route.stops.length} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card flush className="flex flex-col overflow-hidden xl:col-span-2">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-lg font-bold text-stone-950">Today at a glance</h2>
            <p className="mt-0.5 text-sm text-stone-500">Delivered stops against what is still on the trucks.</p>
          </div>
          <div className="grid min-h-48 flex-1 grid-cols-2">
            <div className="flex flex-col justify-center bg-sheeting px-5 py-6">
              <div className="text-sm font-semibold text-stone-950/75">Delivered</div>
              <div className="figure mt-2 text-[3.25rem] leading-none font-extrabold text-stone-950">
                <CountUp value={String(delivered)} />
              </div>
              <div className="mt-3 text-sm font-medium text-stone-950/70">{deliveredShare}% complete</div>
            </div>
            <div className="flex flex-col justify-center bg-asphalt px-5 py-6">
              <div className="text-sm font-semibold text-sheeting">Still to go</div>
              <div className="figure mt-2 text-[3.25rem] leading-none font-extrabold text-white">
                <CountUp value={String(remaining)} />
              </div>
              <div className="mt-3 text-sm font-medium text-[#b7bec5]">across {todays.filter((r) => r.status !== "complete").length} trucks</div>
            </div>
          </div>
          <div className="hazard h-1.5" aria-hidden />
          <div className="grid grid-cols-2 divide-x divide-stone-100 border-t border-stone-100">
            <Link href="/routes" className="px-5 py-4 hover:bg-stone-50">
              <div className="text-xs font-medium text-stone-500">Tomorrow</div>
              <div className="figure mt-1 text-2xl font-extrabold text-stone-950">{tomorrowStops} stops</div>
              <div className="text-xs text-stone-500">{tomorrowRoutes.length} routes planned</div>
            </Link>
            <Link href="/orders?status=ready" className="px-5 py-4 hover:bg-stone-50">
              <div className="text-xs font-medium text-stone-500">Needs a route</div>
              <div className="figure mt-1 text-2xl font-extrabold text-tss-red">{readySoon} orders</div>
              <div className="text-xs text-stone-500">Shipping by tomorrow</div>
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHead
            title="Live delivery log"
            note={
              <span className="inline-flex items-center gap-2">
                <span className="live-dot" /> Updates every 45 seconds
              </span>
            }
            aside={
              <Link href="/log" className="text-sm font-semibold text-stone-600 hover:text-tss-red">
                Full log →
              </Link>
            }
          />
          <div className="mt-5">
            <EventFeed events={recent} orders={orderMap} drivers={driverMap} routes={routeMap} compact />
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHead title="Automations" note="What the portal sends on its own." aside={<Link href="/messages" className="text-sm font-semibold text-stone-600 hover:text-tss-red">Messages →</Link>} />
            <ul className="mt-2 divide-y divide-stone-100">
              <Automation icon={MessageSquareText} title="Driver route texts" when="Weekdays 5:00 PM" ready={smsReady} readyText="Each driver gets tomorrow's stops" setupText="Add Twilio keys to send" />
              <Automation icon={Mail} title="Company route email" when="Weekdays 5:30 PM" ready={mailConfigured()} readyText="All routes to the company list" setupText="Add SMTP settings to send" />
              <Automation icon={CheckCircle2} title="Customer delivered email" when="Each drop-off" ready={mailConfigured()} readyText="With driver note and photos" setupText="Add SMTP settings to send" />
              <Automation
                icon={RefreshCw}
                title="NetSuite orders"
                when={portal.uploadedAt ? `Last sync ${ago(portal.uploadedAt)}` : "Not synced yet"}
                ready={portal.mode === "live"}
                readyText="Grok bot uploads ready-to-ship orders"
                setupText="Point the Grok bot at /api/data-upload"
              />
              <Automation icon={Satellite} title="Fleetio GPS" when="Every page load" ready={fleetioConfigured()} readyText="Live truck positions" setupText="Add Fleetio API key" />
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHead
          title="Deliveries by day"
          note="Every order with a ship date in the next week, by type."
          aside={
            <div className="flex items-center gap-4 text-xs text-stone-600">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-asphalt" /> Rentals</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sheeting" /> Sales</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-stone-300" /> Pickups</span>
              <span className="flex items-center gap-1.5"><Clock3 className="size-3.5 text-tss-red" /> Today</span>
            </div>
          }
        />
        <div className="mt-3">
          <ScheduleChart rows={chart} />
        </div>
      </Card>
    </Page>
  );
}
