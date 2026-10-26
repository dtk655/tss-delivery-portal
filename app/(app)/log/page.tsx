import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EventFeed } from "@/components/event-feed";
import { Card, CardHead, Empty, Page, PageHeader } from "@/components/kit";
import { indexBy, loadPortal } from "@/lib/data";
import { addDays, formatLong, todayISO } from "@/lib/dates";
import type { EventType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Delivery Log · TSS Deliveries" };

const TYPES: Array<{ id: string; label: string; match: (t: EventType) => boolean }> = [
  { id: "all", label: "Everything", match: () => true },
  { id: "delivered", label: "Deliveries", match: (t) => t === "delivered" || t === "returned" },
  { id: "arrived", label: "Arrivals", match: (t) => t === "arrived" || t === "departed" },
  { id: "issues", label: "Notes & problems", match: (t) => t === "note" || t === "exception" },
];

const dayOf = (iso: string) => todayISO(new Date(iso));

export default async function LogPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; driver?: string; range?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal();
  const orders = indexBy(portal.orders);
  const drivers = indexBy(portal.drivers);
  const routes = indexBy(portal.routes);
  const type = TYPES.find((t) => t.id === params.type) ?? TYPES[0];
  const range = params.range === "week" ? "week" : params.range === "yesterday" ? "yesterday" : "today";
  const from = range === "week" ? addDays(portal.today, -6) : range === "yesterday" ? addDays(portal.today, -1) : portal.today;
  const to = range === "yesterday" ? from : portal.today;
  const q = (params.q ?? "").trim().toLowerCase();

  const inRange = portal.events.filter((e) => {
    const d = dayOf(e.at);
    return d >= from && d <= to;
  });
  const events = inRange.filter((e) => {
    if (!type.match(e.type)) return false;
    if (params.driver && e.driverId !== params.driver) return false;
    if (!q) return true;
    const o = e.orderId ? orders.get(e.orderId) : undefined;
    return [e.note, e.receivedBy, drivers.get(e.driverId)?.name, o?.customer, o?.number, o?.city].join(" ").toLowerCase().includes(q);
  });

  const delivered = inRange.filter((e) => e.type === "delivered" || e.type === "returned");
  const emailed = delivered.filter((e) => e.customerEmailed).length;
  const issues = inRange.filter((e) => e.type === "exception" || e.type === "note").length;
  const byDriver = portal.drivers
    .map((d) => ({ driver: d, count: delivered.filter((e) => e.driverId === d.id).length }))
    .filter((x) => x.count)
    .sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...byDriver.map((x) => x.count));

  const link = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q: params.q, type: params.type, driver: params.driver, range: params.range, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/log?${s}` : "/log";
  };

  return (
    <Page>
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Delivery Log"
        lead="Every update drivers send from the road: leaving the yard, arriving, drop-offs with who signed and photos, and notes."
        aside={
          <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700">
            <span className="live-dot" /> Live
          </span>
        }
      />

      <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            {(["today", "yesterday", "week"] as const).map((r) => (
              <Link
                key={r}
                href={link({ range: r === "today" ? undefined : r })}
                className={`h-9 rounded-lg px-3 text-sm leading-9 font-semibold ${range === r ? "bg-asphalt text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {r === "today" ? "Today" : r === "yesterday" ? "Yesterday" : "Last 7 days"}
              </Link>
            ))}
            <span className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" aria-hidden />
            {TYPES.map((t) => (
              <Link
                key={t.id}
                href={link({ type: t.id === "all" ? undefined : t.id })}
                className={`h-9 rounded-lg px-3 text-sm leading-9 font-medium ${type.id === t.id ? "bg-stone-100 text-stone-950" : "text-stone-500 hover:text-stone-900"}`}
              >
                {t.label}
              </Link>
            ))}
            <form action="/log" className="relative ml-auto w-full sm:w-64">
              {params.type ? <input type="hidden" name="type" value={params.type} /> : null}
              {params.range ? <input type="hidden" name="range" value={params.range} /> : null}
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
              <input name="q" defaultValue={params.q} placeholder="Customer, driver, note" className="h-10 w-full rounded-lg border border-stone-200 bg-white pr-3 pl-9 text-sm" />
            </form>
          </div>
          {params.driver ? (
            <p className="mt-3 text-sm text-stone-600">
              Showing {drivers.get(params.driver)?.name ?? "one driver"} only.{" "}
              <Link href={link({ driver: undefined })} className="font-semibold text-tss-red hover:underline">
                Show all drivers
              </Link>
            </p>
          ) : null}
          <div className="mt-6">
            {events.length ? (
              <EventFeed events={events} orders={orders} drivers={drivers} routes={routes} />
            ) : (
              <Empty>No driver updates match. {range === "today" ? "Updates show up here the moment a driver sends them." : ""}</Empty>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card flush className="overflow-hidden">
            <div className="grid grid-cols-2">
              <div className="bg-sheeting px-5 py-5">
                <div className="text-sm font-semibold text-stone-950/75">Drop-offs</div>
                <div className="figure mt-1 text-4xl font-extrabold text-stone-950">{delivered.length}</div>
              </div>
              <div className="bg-asphalt px-5 py-5">
                <div className="text-sm font-semibold text-sheeting">Customers emailed</div>
                <div className="figure mt-1 text-4xl font-extrabold text-white">{emailed}</div>
              </div>
            </div>
            <div className="hazard h-1.5" aria-hidden />
            <div className="px-5 py-3 text-sm text-stone-600">
              {issues} driver note{issues === 1 ? "" : "s"} or problem{issues === 1 ? "" : "s"} · {range === "today" ? formatLong(portal.today) : range === "yesterday" ? formatLong(from) : "last 7 days"}
            </div>
          </Card>
          <Card>
            <CardHead title="By driver" note="Drop-offs in this period." />
            <ul className="mt-4 space-y-3">
              {byDriver.map(({ driver, count }) => (
                <li key={driver.id}>
                  <Link href={link({ driver: params.driver === driver.id ? undefined : driver.id })} className="group block">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium group-hover:text-tss-red ${params.driver === driver.id ? "text-tss-red" : "text-stone-800"}`}>{driver.name}</span>
                      <span className="figure font-bold text-stone-950">{count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-asphalt" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
              {byDriver.length === 0 ? <li className="text-sm text-stone-500">No drop-offs yet.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
    </Page>
  );
}
