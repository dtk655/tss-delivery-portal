/**
 * One place that assembles what the pages show.
 *  - Orders: the NetSuite snapshot the Grok bot uploads (POST /api/data-upload), else sample orders.
 *  - Routes: routes.json once dispatch starts saving its own, else sample routes.
 *  - Edits made in the portal (assigning orders, stop status from drivers) layer on top.
 *  - Trucks: Fleetio when configured, else positions worked out from the sample routes.
 */
import { addDays, formatLong, nextWorkday, nyInstant, todayISO } from "@/lib/dates";
import { liveTrucks } from "@/lib/fleetio";
import { SAMPLE_DRIVERS, sampleEvents, sampleOrders, sampleRoutes, sampleTrucks } from "@/lib/sample";
import { readJSON } from "@/lib/store";
import { customerDeliveredEmail, driverRouteText } from "@/lib/templates";
import type { DeliveryEvent, Driver, Message, Order, OrderStatus, Route, Stop, Truck } from "@/lib/types";

export type Snapshot = { uploadedAt: string; orders: Order[]; drivers?: Driver[] };

export type Edits = {
  /** orderId -> routeId, or "" to take it off any route. */
  assign: Record<string, string>;
  /** "routeId:orderId" -> stop progress reported by the driver. */
  stops: Record<string, Pick<Stop, "status" | "doneAt">>;
};

export const EMPTY_EDITS: Edits = { assign: {}, stops: {} };

export type Portal = {
  mode: "sample" | "live";
  today: string;
  tomorrow: string;
  uploadedAt: string | null;
  orders: Order[];
  drivers: Driver[];
  trucks: Truck[];
  routes: Route[];
  events: DeliveryEvent[];
  messages: Message[];
  truckSource: "fleetio" | "sample";
};

function applyEdits(routes: Route[], orders: Order[], edits: Edits): Route[] {
  const next = routes.map((r) => ({ ...r, stops: r.stops.filter((s) => !(s.orderId in edits.assign) || edits.assign[s.orderId] === r.id) }));
  const byOrder = new Map(orders.map((o) => [o.id, o]));
  for (const [orderId, routeId] of Object.entries(edits.assign)) {
    if (!routeId) continue;
    const route = next.find((r) => r.id === routeId);
    if (!route || route.stops.some((s) => s.orderId === orderId) || !byOrder.has(orderId)) continue;
    const last = route.stops[route.stops.length - 1];
    const [h, m] = (last?.eta ?? route.departure).split(":").map(Number);
    const mins = h * 60 + m + 75;
    route.stops.push({ orderId, eta: `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`, status: "pending" });
  }
  for (const route of next) {
    route.stops = route.stops.map((s) => ({ ...s, ...(edits.stops[`${route.id}:${s.orderId}`] ?? {}) }));
    if (route.stops.length && route.stops.every((s) => s.status === "delivered")) route.status = "complete";
    else if (route.stops.some((s) => s.status !== "pending") && route.status !== "complete") route.status = "out";
  }
  return next;
}

function seedMessages(routes: Route[], orders: Order[], drivers: Driver[], events: DeliveryEvent[], today: string): Message[] {
  const byOrder = new Map(orders.map((o) => [o.id, o]));
  const out: Message[] = [];
  const yesterdayEvening = nyInstant(addDays(today, -1), "17:00");
  for (const route of routes.filter((r) => r.date === today)) {
    const driver = drivers.find((d) => d.id === route.driverId);
    if (!driver) continue;
    out.push({
      id: `seed-sms-${route.id}`,
      at: yesterdayEvening,
      channel: "sms",
      kind: "driver-route",
      to: driver.phone,
      toName: driver.name,
      subject: "",
      body: driverRouteText(route, driver, orders, "https://tss-delivery.example/d/…"),
      status: driver.smsOptIn ? "dry-run" : "failed",
      error: driver.smsOptIn ? "Sample message. Nothing was sent." : "Driver has not opted in to texts.",
    });
  }
  out.push({
    id: "seed-company",
    at: nyInstant(addDays(today, -1), "17:30"),
    channel: "email",
    kind: "company-routes",
    to: "operations@trafficsafetyservice.com",
    toName: "Company distribution list",
    subject: `Delivery routes for ${formatLong(today)}`,
    body: "",
    status: "dry-run",
    error: "Sample message. Nothing was sent.",
  });
  for (const event of events.filter((e) => e.type === "delivered" && e.customerEmailed)) {
    const o = byOrder.get(event.orderId ?? "");
    if (!o) continue;
    const mail = customerDeliveredEmail(o, event, drivers.find((d) => d.id === event.driverId));
    out.push({ id: `seed-cust-${event.id}`, at: new Date(new Date(event.at).getTime() + 40_000).toISOString(), channel: "email", kind: "customer-delivered", to: o.contactEmail, toName: o.customer, subject: mail.subject, body: mail.text, status: "dry-run", error: "Sample message. Nothing was sent." });
  }
  return out;
}

export async function loadPortal(): Promise<Portal> {
  const today = todayISO();
  const tomorrow = nextWorkday(today);
  const [snapshot, edits, savedRoutes, storedEvents, storedMessages] = await Promise.all([
    readJSON<Snapshot | null>("orders.json", null),
    readJSON<Edits>("edits.json", EMPTY_EDITS),
    readJSON<Route[] | null>("routes.json", null),
    readJSON<DeliveryEvent[]>("events.json", []),
    readJSON<Message[]>("messages.json", []),
  ]);
  const live = Boolean(snapshot?.orders?.length);
  const orders = live ? snapshot!.orders : sampleOrders(today);
  const drivers = snapshot?.drivers?.length ? snapshot.drivers : SAMPLE_DRIVERS;
  const baseRoutes = savedRoutes ?? (live ? [] : sampleRoutes(orders, today));
  const routes = applyEdits(baseRoutes, orders, { ...EMPTY_EDITS, ...edits });

  const sampleTruckList = sampleTrucks(routes, orders, today);
  let trucks = sampleTruckList;
  let truckSource: Portal["truckSource"] = "sample";
  try {
    const fromFleetio = await liveTrucks(sampleTruckList);
    if (fromFleetio !== sampleTruckList) {
      trucks = fromFleetio;
      truckSource = "fleetio";
    }
  } catch {
    trucks = sampleTruckList;
  }

  const events = [...storedEvents, ...(live ? [] : sampleEvents(routes, orders, today))].sort((a, b) => b.at.localeCompare(a.at));
  const messages = [...storedMessages, ...(live ? [] : seedMessages(routes, orders, drivers, events, today))].sort((a, b) =>
    b.at.localeCompare(a.at),
  );

  return { mode: live ? "live" : "sample", today, tomorrow, uploadedAt: snapshot?.uploadedAt ?? null, orders, drivers, trucks, routes, events, messages, truckSource };
}

/** Where an order stands, from the routes it is on. */
export function orderStatus(order: Order, routes: Route[]): { status: OrderStatus; route?: Route; stop?: Stop } {
  for (const route of routes) {
    const stop = route.stops.find((s) => s.orderId === order.id);
    if (!stop) continue;
    if (stop.status === "delivered") return { status: "delivered", route, stop };
    if (stop.status === "exception") return { status: "exception", route, stop };
    if (route.status === "out" || stop.status !== "pending") return { status: "out", route, stop };
    return { status: "routed", route, stop };
  }
  return { status: "ready" };
}

export function indexBy<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((item) => [item.id, item]));
}

export function routeLoad(route: Route, orders: Map<string, Order>): number {
  return route.stops.reduce((sum, s) => sum + (orders.get(s.orderId)?.weightLbs ?? 0), 0);
}
