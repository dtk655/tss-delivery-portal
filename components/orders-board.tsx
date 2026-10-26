"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { ChevronDown, MapPin, Phone, Search, StickyNote, Truck, User } from "lucide-react";
import { assignOrder } from "@/app/actions";
import { KindTag, OrderPill, lbs, phoneOf } from "@/components/kit";
import { clock12, formatShort, windowLabel } from "@/lib/dates";
import type { Order, OrderStatus } from "@/lib/types";

export type OrderRow = { order: Order; status: OrderStatus; routeId: string; routeLabel: string; eta: string };
type RouteOption = { id: string; date: string; name: string; driver: string; truck: string; capacity: number; stops: number };

const TABS: Array<{ id: string; label: string; match: (s: OrderStatus) => boolean }> = [
  { id: "ready", label: "Needs a route", match: (s) => s === "ready" },
  { id: "routed", label: "On a route", match: (s) => s === "routed" || s === "out" },
  { id: "delivered", label: "Delivered", match: (s) => s === "delivered" },
  { id: "all", label: "All", match: () => true },
];

function itemSummary(order: Order): string {
  const [first, ...rest] = order.items;
  if (!first) return "";
  const short = first.name.replace(/ w\/.*$/, "").replace(/,.*$/, "");
  return `${first.qty} × ${short}${rest.length ? ` +${rest.length} more` : ""}`;
}

export function OrdersBoard({
  rows,
  routes,
  today,
  tomorrow,
  initialQuery,
  initialStatus,
}: {
  rows: OrderRow[];
  routes: RouteOption[];
  today: string;
  tomorrow: string;
  initialQuery: string;
  initialStatus: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState(TABS.some((t) => t.id === initialStatus) ? initialStatus : "ready");
  const [day, setDay] = useState<"all" | "today" | "tomorrow" | "later">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, rows.filter((r) => t.match(r.status)).length])), [rows]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = TABS.find((t) => t.id === tab)!.match;
    return rows.filter((row) => {
      if (!match(row.status)) return false;
      const d = row.order.shipDate;
      if (day === "today" && d !== today) return false;
      if (day === "tomorrow" && d !== tomorrow) return false;
      if (day === "later" && d <= tomorrow) return false;
      if (!needle) return true;
      const o = row.order;
      return [o.number, o.customer, o.city, o.state, o.address, o.salesRep, ...o.items.map((i) => i.name)].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, tab, day, query, today, tomorrow]);

  const assign = (orderId: string, routeId: string, label: string) => {
    setBusy(orderId);
    startTransition(async () => {
      await assignOrder(orderId, routeId);
      setBusy(null);
      setFlash(routeId ? `Added to ${label}.` : "Taken off the route.");
      window.setTimeout(() => setFlash(null), 3500);
    });
  };

  return (
    <div className="mt-8">
      <div className="app-sticky -mx-4 border-b border-stone-200 bg-canvas/95 px-4 pt-1 pb-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${tab === t.id ? "bg-asphalt text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {t.label}
                <span className={`figure rounded-md px-1.5 text-xs leading-5 ${tab === t.id ? "bg-white/15 text-sheeting" : "bg-stone-100 text-stone-500"}`}>{counts[t.id]}</span>
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
            {(["all", "today", "tomorrow", "later"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                className={`h-9 rounded-lg px-3 text-sm font-medium capitalize ${day === d ? "bg-stone-100 text-stone-950" : "text-stone-500 hover:text-stone-900"}`}
              >
                {d === "all" ? "Any date" : d}
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Customer, order #, town, item"
              className="h-11 w-full rounded-xl border border-stone-200 bg-white pr-3 pl-9 text-sm shadow-sm"
            />
          </label>
        </div>
      </div>

      {flash ? (
        <div className="fixed right-6 bottom-6 z-50 rounded-xl bg-asphalt px-4 py-3 text-sm font-semibold text-white shadow-lg">
          <span className="text-sheeting">✓</span> {flash}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                <th className="py-3 pr-3 pl-5">Order</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Ship to</th>
                <th className="px-3 py-3">Ship date</th>
                <th className="px-3 py-3">Load</th>
                <th className="px-3 py-3">Status</th>
                <th className="py-3 pr-5 pl-3 text-right">Route</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-sm text-stone-500">
                    {tab === "ready" ? "Every order is on a route. Nice work." : "No orders match these filters."}
                  </td>
                </tr>
              ) : null}
              {shown.map((row) => {
                const o = row.order;
                const options = routes.filter((r) => r.date === o.shipDate);
                const isOpen = open === o.id;
                const late = o.shipDate < today && row.status !== "delivered";
                return (
                  <Fragment key={o.id}>
                    <tr className={`cursor-pointer ${isOpen ? "bg-stone-50" : ""}`} onClick={() => setOpen(isOpen ? null : o.id)}>
                      <td className="py-3.5 pr-3 pl-5">
                        <div className="flex items-start gap-2">
                          <ChevronDown className={`mt-0.5 size-4 shrink-0 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          <div>
                            <div className="figure font-bold whitespace-nowrap text-stone-950">{o.number}</div>
                            <div className="mt-1">
                              <KindTag kind={o.kind} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="max-w-[15rem] truncate font-semibold text-stone-900" title={o.customer}>{o.customer}</div>
                        <div className="text-xs text-stone-500">Rep {o.salesRep}</div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="text-stone-900">
                          {o.city}, {o.state}
                        </div>
                        <div className="max-w-[13rem] truncate text-xs text-stone-500">{o.address}</div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <div className={`font-medium ${late ? "text-tss-red" : o.shipDate === today ? "text-stone-950" : "text-stone-700"}`}>
                          {o.shipDate === today ? "Today" : o.shipDate === tomorrow ? "Tomorrow" : formatShort(o.shipDate)}
                        </div>
                        <div className="text-xs text-stone-500">{o.window ? `Window ${windowLabel(o.window)}` : "Any time"}</div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="max-w-[13rem] truncate text-stone-800" title={o.items.map((i) => `${i.qty} × ${i.name}`).join("\n")}>{itemSummary(o)}</div>
                        <div className="flex items-center gap-1.5 text-xs text-stone-500">
                          {lbs(o.weightLbs)}
                          {o.needsCdl ? <span className="rounded bg-stone-200 px-1 text-[0.65rem] font-bold text-stone-700">CDL</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <OrderPill status={row.status} />
                        {row.eta ? <div className="mt-1 text-xs text-stone-500">ETA {clock12(row.eta)}</div> : null}
                      </td>
                      <td className="py-3.5 pr-5 pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {row.status === "delivered" || row.status === "out" ? (
                          <span className="text-xs text-stone-500">{row.routeLabel}</span>
                        ) : (
                          <select
                            value={row.routeId}
                            disabled={(pending && busy === o.id) || (!options.length && !row.routeId)}
                            onChange={(e) => {
                              const target = options.find((r) => r.id === e.target.value);
                              assign(o.id, e.target.value, target ? target.name : "");
                            }}
                            className={`h-9 w-44 rounded-lg border px-2.5 text-sm font-medium disabled:opacity-60 ${
                              row.routeId ? "border-stone-200 bg-white text-stone-800" : options.length ? "border-asphalt bg-asphalt text-white" : "border-stone-200 bg-stone-50 text-stone-400"
                            }`}
                            aria-label={`Route for ${o.number}`}
                          >
                            <option value="">{row.routeId ? "Take off route" : options.length ? "Add to route…" : "No routes that day"}</option>
                            {options.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} · {r.driver} · {r.stops} stops
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="bg-stone-50">
                        <td colSpan={7} className="px-5 pt-1 pb-5">
                          <div className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                            <div>
                              <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Items</div>
                              <ul className="mt-2 divide-y divide-stone-100">
                                {o.items.map((item) => (
                                  <li key={item.sku} className="flex items-center justify-between gap-3 py-1.5">
                                    <span className="text-stone-800">
                                      {item.name} <span className="text-xs text-stone-400">{item.sku}</span>
                                    </span>
                                    <span className="figure font-bold text-stone-950">{item.qty}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="space-y-2.5 text-sm">
                              <div className="flex gap-2 text-stone-700">
                                <MapPin className="mt-0.5 size-4 shrink-0 text-stone-400" />
                                <a className="hover:text-tss-red hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lon}`}>
                                  {o.address}, {o.city}, {o.state}
                                </a>
                              </div>
                              <div className="flex gap-2 text-stone-700">
                                <User className="mt-0.5 size-4 shrink-0 text-stone-400" /> {o.contact} · {o.contactEmail}
                              </div>
                              <div className="flex gap-2 text-stone-700">
                                <Phone className="mt-0.5 size-4 shrink-0 text-stone-400" /> {phoneOf(o.contactPhone)}
                              </div>
                              {o.notes ? (
                                <div className="flex gap-2 rounded-lg bg-[#fffbeb] p-2.5 text-[#8a5a00]">
                                  <StickyNote className="mt-0.5 size-4 shrink-0" /> {o.notes}
                                </div>
                              ) : null}
                              {row.routeLabel ? (
                                <div className="flex gap-2 text-stone-700">
                                  <Truck className="mt-0.5 size-4 shrink-0 text-stone-400" /> {row.routeLabel}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
