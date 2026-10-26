/**
 * Sample data so every page has something real-looking before NetSuite and Fleetio are connected.
 * Customers are made up on purpose. Today's routes advance with the clock so the portal feels live.
 */
import { addDays, hhmmOf, minutesOf, nextWorkday, nyInstant, nyMinutesNow, todayISO } from "@/lib/dates";
import type { DeliveryEvent, Driver, Order, Route, Stop, Truck } from "@/lib/types";

export const YARD = {
  name: "TSS Yard",
  lat: Number(process.env.YARD_LAT ?? 40.6301),
  lon: Number(process.env.YARD_LON ?? -74.4074),
};

const ITEMS = {
  cone: { sku: "CONE-28", name: '28" Traffic Cone w/ Reflective Collar', lbs: 7 },
  drum: { sku: "DRUM-RB", name: "Channelizer Drum w/ Rubber Base", lbs: 35 },
  t3: { sku: "BARR-T3-8", name: "Type III Barricade, 8 ft", lbs: 95 },
  arrow: { sku: "AB-TRL", name: "Arrow Board, Solar Trailer", lbs: 1600 },
  vms: { sku: "VMS-3L", name: "VMS Message Board, 3-Line", lbs: 2400 },
  stand: { sku: "STD-SP", name: "Spring Sign Stand", lbs: 28 },
  sign: { sku: "SGN-RU48", name: '48" Roll-Up Sign, ROAD WORK AHEAD', lbs: 6 },
  wc: { sku: "WC-6", name: "WATERCADE Barrier, 6 ft", lbs: 110 },
  bag: { sku: "SB-25", name: "Sandbag, 25 lb", lbs: 25 },
  post: { sku: "DEL-36", name: '36" Delineator Post w/ Base', lbs: 12 },
} as const;

type ItemKey = keyof typeof ITEMS;

const SITES: Array<{
  customer: string;
  contact: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
}> = [
  { customer: "Garden State Paving Co.", contact: "Mike R.", address: "Rt 22 W & Chimney Rock Rd", city: "Bridgewater", state: "NJ", lat: 40.5946, lon: -74.5629 },
  { customer: "Raritan Highway Group", contact: "Dana P.", address: "1200 US-1 South", city: "Edison", state: "NJ", lat: 40.5187, lon: -74.4121 },
  { customer: "Township of Millbrook DPW", contact: "Supt. Alvarez", address: "45 Municipal Plaza", city: "Morristown", state: "NJ", lat: 40.7968, lon: -74.4815 },
  { customer: "Meridian Bridge Constructors", contact: "Tom K.", address: "Goethals Bridge Approach", city: "Elizabeth", state: "NJ", lat: 40.6342, lon: -74.1879 },
  { customer: "Hudson Valley Utility Contractors", contact: "Jen S.", address: "Rt 9W at Exit 11", city: "Nyack", state: "NY", lat: 41.0907, lon: -73.9179 },
  { customer: "Palisade Site Works", contact: "Chris D.", address: "88 River Rd", city: "Edgewater", state: "NJ", lat: 40.8271, lon: -73.9757 },
  { customer: "Bayshore Festival Productions", contact: "Amy L.", address: "Pier Village Boardwalk", city: "Long Branch", state: "NJ", lat: 40.3043, lon: -73.9924 },
  { customer: "Northfield Police Department", contact: "Sgt. Morris", address: "300 Center St", city: "Clinton", state: "NJ", lat: 40.6368, lon: -74.9099 },
  { customer: "Keystone Earthworks", contact: "Luis G.", address: "Rt 22 at 15th St Interchange", city: "Allentown", state: "PA", lat: 40.6247, lon: -75.4889 },
  { customer: "Liberty Stadium Events", contact: "Ops Desk", address: "1 Stadium Way, Lot G", city: "East Rutherford", state: "NJ", lat: 40.8128, lon: -74.0742 },
  { customer: "Five Boroughs Utility Corp.", contact: "Ray T.", address: "Atlantic Ave & Bond St", city: "Brooklyn", state: "NY", lat: 40.6866, lon: -73.9848 },
  { customer: "Shoreline Electric", contact: "Pat W.", address: "Rt 35 & Allaire Rd", city: "Wall Township", state: "NJ", lat: 40.1716, lon: -74.0693 },
  { customer: "Delaware Valley Gas", contact: "Kim H.", address: "Rt 202 & Old York Rd", city: "Flemington", state: "NJ", lat: 40.5123, lon: -74.8593 },
  { customer: "Passaic County Roads Dept.", contact: "Gary F.", address: "401 Grand St", city: "Paterson", state: "NJ", lat: 40.9168, lon: -74.1718 },
  { customer: "Metro Fiber Builders", contact: "Nina O.", address: "Northern Blvd & 82nd St", city: "Queens", state: "NY", lat: 40.7559, lon: -73.8857 },
  { customer: "Westfield Downtown Alliance", contact: "Events Office", address: "Elm St & Broad St", city: "Westfield", state: "NJ", lat: 40.6501, lon: -74.3471 },
  { customer: "Princeton Ridge Contractors", contact: "Ben C.", address: "US-1 & Alexander Rd", city: "West Windsor", state: "NJ", lat: 40.3271, lon: -74.6299 },
  { customer: "Stamford Paving & Sealing", contact: "Joe V.", address: "I-95 Exit 7 Staging", city: "Stamford", state: "CT", lat: 41.0473, lon: -73.5387 },
  { customer: "Somerset County Engineering", contact: "Office", address: "20 Grove St", city: "Somerville", state: "NJ", lat: 40.5743, lon: -74.6099 },
  { customer: "Tri-State Water Main Co.", contact: "Sal M.", address: "Rt 17 N at Paramus Rd", city: "Paramus", state: "NJ", lat: 40.9445, lon: -74.0712 },
  { customer: "Lehigh Valley Line Striping", contact: "Dave B.", address: "Rt 33 & William Penn Hwy", city: "Easton", state: "PA", lat: 40.6884, lon: -75.2621 },
  { customer: "Brick Township Public Works", contact: "Dispatch", address: "401 Chambers Bridge Rd", city: "Brick", state: "NJ", lat: 40.0623, lon: -74.1311 },
];

const REPS = ["Joe M.", "Lisa K.", "Steve P.", "Dylan K."];

function order(
  n: number,
  site: number,
  kind: Order["kind"],
  shipDate: string,
  lines: Array<[ItemKey, number]>,
  window = "",
  notes = "",
): Order {
  const s = SITES[site];
  const items = lines.map(([key, qty]) => ({ sku: ITEMS[key].sku, name: ITEMS[key].name, qty }));
  const weightLbs = lines.reduce((sum, [key, qty]) => sum + ITEMS[key].lbs * qty, 0);
  const slug = s.customer.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 12);
  return {
    id: String(880000 + n),
    number: `${kind === "sale" ? "SO" : kind === "pickup" ? "RP" : "RA"}-${48000 + n}`,
    kind,
    customer: s.customer,
    contact: s.contact,
    contactEmail: `orders@${slug}.example.com`,
    contactPhone: `732555${String(1000 + n).slice(-4)}`,
    address: s.address,
    city: s.city,
    state: s.state,
    lat: s.lat,
    lon: s.lon,
    shipDate,
    window,
    items,
    weightLbs,
    salesRep: REPS[n % REPS.length],
    notes,
    needsCdl: lines.some(([key]) => key === "vms" || key === "arrow") || weightLbs > 9000,
  };
}

export const SAMPLE_DRIVERS: Driver[] = [
  { id: "d1", name: "Marcus Bell", phone: "9085550141", email: "", license: "CDL-A", smsOptIn: true, defaultTruckId: "t1" },
  { id: "d2", name: "Anthony Russo", phone: "9085550177", email: "", license: "CDL-B", smsOptIn: true, defaultTruckId: "t2" },
  { id: "d3", name: "Kevin Ortiz", phone: "9085550118", email: "", license: "Non-CDL", smsOptIn: true, defaultTruckId: "t3" },
  { id: "d4", name: "Ray Thompson", phone: "9085550163", email: "", license: "CDL-A", smsOptIn: false, defaultTruckId: "t4" },
  { id: "d5", name: "Jose Martinez", phone: "9085550109", email: "", license: "CDL-B", smsOptIn: true, defaultTruckId: "t5" },
];

const TRUCK_BASE: Array<Omit<Truck, "lat" | "lon" | "speedMph" | "heading" | "status" | "lastPing" | "address">> = [
  { id: "t1", unit: "Unit 21", type: "Tractor + 48 ft Flatbed", plate: "AN 412K", capacityLbs: 44000, cdl: true, odometer: 184220, nextServiceMiles: 186000, fleetioId: null },
  { id: "t2", unit: "Unit 14", type: "26 ft Box Truck w/ Liftgate", plate: "AM 731P", capacityLbs: 12000, cdl: true, odometer: 96410, nextServiceMiles: 96900, fleetioId: null },
  { id: "t3", unit: "Unit 9", type: "F-550 Stake Body", plate: "AK 228R", capacityLbs: 6500, cdl: false, odometer: 71855, nextServiceMiles: 75000, fleetioId: null },
  { id: "t4", unit: "Unit 23", type: "Tractor + Lowboy", plate: "AP 119T", capacityLbs: 40000, cdl: true, odometer: 212034, nextServiceMiles: 215000, fleetioId: null },
  { id: "t5", unit: "Unit 17", type: "24 ft Flatbed w/ Moffett", plate: "AL 604M", capacityLbs: 12000, cdl: true, odometer: 128760, nextServiceMiles: 129000, fleetioId: null },
];

export function sampleOrders(today: string = todayISO()): Order[] {
  const tomorrow = nextWorkday(today);
  const after = nextWorkday(tomorrow);
  return [
    // Today, already on routes
    order(1, 0, "rental", today, [["drum", 60], ["t3", 12], ["sign", 8], ["stand", 8]], "06:30-08:00", "Drop at staging lot behind the diner."),
    order(2, 1, "sale", today, [["cone", 200], ["post", 40]], "", ""),
    order(3, 2, "rental", today, [["arrow", 2], ["vms", 1]], "07:00-09:00", "Call Supt. before unhooking."),
    order(4, 3, "rental", today, [["wc", 40], ["t3", 6]], "", "Gate 3. Hard hat and vest required."),
    order(5, 4, "sale", today, [["cone", 150], ["sign", 12], ["stand", 12]], "", ""),
    order(6, 5, "pickup", today, [["drum", 40], ["t3", 10]], "", "Pick up from rental RA-47710."),
    order(7, 6, "rental", today, [["wc", 40], ["bag", 20]], "08:00-12:00", "Festival setup. Ask for Amy at the boardwalk office."),
    order(8, 7, "sale", today, [["cone", 50], ["t3", 4], ["sign", 6]], "", ""),
    order(9, 9, "rental", today, [["wc", 80]], "", "Lot G, north entrance."),
    order(10, 11, "sale", today, [["drum", 30], ["post", 30]], "", ""),
    order(11, 12, "rental", today, [["vms", 2]], "", ""),
    order(12, 15, "rental", today, [["t3", 20], ["cone", 100], ["sign", 10]], "", "Street fair Saturday."),
    order(13, 19, "sale", today, [["cone", 120], ["drum", 20]], "", ""),
    // Tomorrow, mostly routed already
    order(14, 8, "rental", tomorrow, [["arrow", 1], ["drum", 50], ["sign", 6], ["stand", 6]], "06:00-07:30", ""),
    order(15, 20, "sale", tomorrow, [["cone", 300]], "", ""),
    order(16, 10, "rental", tomorrow, [["drum", 40], ["t3", 8]], "06:00-08:00", "NYC DOT permit on file. No trucks on Atlantic before 7."),
    order(17, 14, "rental", tomorrow, [["vms", 1], ["arrow", 1]], "", ""),
    order(18, 13, "sale", tomorrow, [["sign", 24], ["stand", 24], ["post", 50]], "", ""),
    order(19, 16, "rental", tomorrow, [["wc", 30], ["t3", 6]], "", ""),
    order(20, 18, "sale", tomorrow, [["cone", 80], ["sign", 4]], "", "Deliver to County garage, bay 2."),
    order(21, 21, "rental", tomorrow, [["drum", 60], ["arrow", 1]], "", ""),
    order(22, 17, "rental", tomorrow, [["wc", 50], ["bag", 30]], "", "CT delivery. Driver needs TWIC? No."),
    order(23, 3, "pickup", tomorrow, [["wc", 20]], "", ""),
    // Ready to ship, not yet on a route
    order(24, 2, "sale", tomorrow, [["cone", 60], ["sign", 4], ["stand", 4]], "", ""),
    order(25, 11, "rental", tomorrow, [["arrow", 1]], "07:00-09:00", ""),
    order(26, 5, "sale", tomorrow, [["post", 80]], "", ""),
    order(27, 9, "rental", after, [["wc", 100], ["t3", 10]], "", "Concert load-in. Coordinate with stadium ops."),
    order(28, 0, "rental", after, [["vms", 2], ["drum", 30]], "", ""),
    order(29, 6, "pickup", after, [["wc", 60], ["bag", 40]], "", "Pick up after festival."),
    order(30, 14, "sale", after, [["cone", 200], ["drum", 25]], "", ""),
    order(31, 19, "rental", addDays(after, 1), [["t3", 15], ["sign", 10], ["stand", 10]], "", ""),
  ];
}

type RoutePlan = { id: string; name: string; driverId: string; truckId: string; departure: string; orders: number[]; miles: number };

function plansFor(day: "today" | "tomorrow"): RoutePlan[] {
  if (day === "today") {
    return [
      { id: "r1", name: "North Jersey / Hudson", driverId: "d1", truckId: "t1", departure: "05:45", orders: [4, 9, 6, 5], miles: 118 },
      { id: "r2", name: "Central / Shore", driverId: "d2", truckId: "t2", departure: "06:00", orders: [2, 12, 10, 7], miles: 96 },
      { id: "r3", name: "Somerset / Morris", driverId: "d3", truckId: "t3", departure: "06:15", orders: [1, 13, 3], miles: 74 },
      { id: "r4", name: "Western NJ", driverId: "d5", truckId: "t5", departure: "06:30", orders: [8, 11], miles: 88 },
    ];
  }
  return [
    { id: "r5", name: "Lehigh Valley", driverId: "d1", truckId: "t1", departure: "05:00", orders: [14, 21], miles: 132 },
    { id: "r6", name: "NYC Boroughs", driverId: "d2", truckId: "t2", departure: "05:15", orders: [16, 17], miles: 64 },
    { id: "r7", name: "North Jersey", driverId: "d3", truckId: "t3", departure: "06:00", orders: [18, 23, 15], miles: 81 },
    { id: "r8", name: "Central / CT Run", driverId: "d5", truckId: "t5", departure: "05:30", orders: [20, 19, 22], miles: 176 },
  ];
}

/** Drive time between stops, in minutes. Rough: straight-line miles at highway-ish speed. */
function legMinutes(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const miles = Math.hypot((a.lat - b.lat) * 69, (a.lon - b.lon) * 53) * 1.3;
  return Math.max(15, Math.round(miles / 32 * 60));
}

const UNLOAD_MIN = 35;

function buildRoute(plan: RoutePlan, date: string, orders: Map<string, Order>, nowMin: number | null): Route {
  let clock = minutesOf(plan.departure) + 20; // load-out
  let prev: { lat: number; lon: number } = YARD;
  const stops: Stop[] = [];
  for (const n of plan.orders) {
    const o = orders.get(String(880000 + n));
    if (!o) continue;
    clock += legMinutes(prev, o);
    const eta = hhmmOf(clock);
    let status: Stop["status"] = "pending";
    let doneAt: string | undefined;
    if (nowMin != null) {
      if (nowMin >= clock + UNLOAD_MIN) {
        status = "delivered";
        doneAt = nyInstant(date, hhmmOf(clock + UNLOAD_MIN - 4));
      } else if (nowMin >= clock) status = "arrived";
      else if (stops.every((s) => s.status === "delivered") && nowMin >= minutesOf(plan.departure)) status = "en-route";
    }
    stops.push({ orderId: o.id, eta, status, doneAt });
    clock += UNLOAD_MIN;
    prev = o;
  }
  const done = stops.filter((s) => s.status === "delivered").length;
  let status: Route["status"] = "planned";
  if (nowMin != null) {
    if (done === stops.length && stops.length) status = "complete";
    else if (nowMin >= minutesOf(plan.departure)) status = "out";
    else if (nowMin >= minutesOf(plan.departure) - 60) status = "loading";
  }
  return { id: plan.id, date, name: plan.name, driverId: plan.driverId, truckId: plan.truckId, departure: plan.departure, status, stops, miles: plan.miles };
}

/**
 * The sample day runs on a clock that stops mid-morning, so routes are always partway done
 * whenever someone opens the demo. Real routes use the real clock.
 */
export function sampleMinutes(now: Date = new Date()): number {
  return Math.min(nyMinutesNow(now), DEMO_PAUSE);
}

const DEMO_PAUSE = 10 * 60 + 25;

export function sampleRoutes(orders: Order[], today: string = todayISO(), now: Date = new Date()): Route[] {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const nowMin = sampleMinutes(now);
  return [
    ...plansFor("today").map((plan) => buildRoute(plan, today, byId, nowMin)),
    ...plansFor("tomorrow").map((plan) => buildRoute(plan, nextWorkday(today), byId, null)),
  ];
}

/** Where each truck is right now, worked out from its route. */
export function sampleTrucks(routes: Route[], orders: Order[], today: string = todayISO(), now: Date = new Date()): Truck[] {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const nowMin = sampleMinutes(now);
  return TRUCK_BASE.map((base, index) => {
    const route = routes.find((r) => r.date === today && r.truckId === base.id);
    const ping = new Date(now.getTime() - (index * 37 % 90) * 1000).toISOString();
    if (!route || route.status === "planned" || route.status === "loading") {
      return { ...base, lat: YARD.lat + index * 0.0006, lon: YARD.lon - index * 0.0008, speedMph: 0, heading: 0, status: base.id === "t4" ? "offline" : "yard", lastPing: base.id === "t4" ? new Date(now.getTime() - 3 * 3600_000).toISOString() : ping, address: YARD.name };
    }
    const delivered = route.stops.filter((s) => s.status === "delivered");
    const current = route.stops.find((s) => s.status !== "delivered");
    if (!current) {
      // Heading back to the yard.
      const last = byId.get(delivered[delivered.length - 1]?.orderId ?? "") ?? YARD;
      const t = Math.min(1, (nowMin - minutesOf(route.stops[route.stops.length - 1].eta) - UNLOAD_MIN) / 70);
      if (t >= 1) return { ...base, lat: YARD.lat, lon: YARD.lon, speedMph: 0, heading: 0, status: "yard", lastPing: ping, address: YARD.name };
      return { ...base, lat: last.lat + (YARD.lat - last.lat) * t, lon: last.lon + (YARD.lon - last.lon) * t, speedMph: 47, heading: 220, status: "moving", lastPing: ping, address: "Returning to yard" };
    }
    const dest = byId.get(current.orderId)!;
    if (current.status === "arrived") {
      return { ...base, lat: dest.lat, lon: dest.lon, speedMph: 0, heading: 0, status: "at-stop", lastPing: ping, address: `${dest.address}, ${dest.city}` };
    }
    const from = delivered.length ? byId.get(delivered[delivered.length - 1].orderId)! : YARD;
    const leaveMin = delivered.length ? minutesOf(route.stops[delivered.length - 1].eta) + UNLOAD_MIN : minutesOf(route.departure) + 20;
    const t = Math.max(0, Math.min(1, (nowMin - leaveMin) / Math.max(1, minutesOf(current.eta) - leaveMin)));
    const heading = (Math.atan2(dest.lon - from.lon, dest.lat - from.lat) * 180) / Math.PI;
    const stopped = index === 2 && t > 0.4 && t < 0.55;
    return {
      ...base,
      lat: from.lat + (dest.lat - from.lat) * t,
      lon: from.lon + (dest.lon - from.lon) * t,
      speedMph: stopped ? 0 : 38 + ((index * 7) % 20),
      heading: (heading + 360) % 360,
      status: stopped ? "stopped" : "moving",
      lastPing: ping,
      address: `En route to ${dest.city}, ${dest.state}`,
    };
  });
}

/** Driver log entries that match where today's routes are. */
export function sampleEvents(routes: Route[], orders: Order[], today: string = todayISO()): DeliveryEvent[] {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const events: DeliveryEvent[] = [];
  const names = ["J. Ramirez", "Site super", "T. Walsh", "Gate guard", "M. Chen", "Foreman on site"];
  const nowMin = sampleMinutes();
  for (const route of routes.filter((r) => r.date === today)) {
    if (route.status === "planned" || route.status === "loading") continue;
    events.push({ id: `${route.id}-dep`, at: nyInstant(today, hhmmOf(minutesOf(route.departure) + 18)), type: "departed", routeId: route.id, orderId: null, driverId: route.driverId, note: `Left the yard with ${route.stops.length} stops loaded.` });
    route.stops.forEach((stop, i) => {
      const o = byId.get(stop.orderId)!;
      if (stop.status === "arrived" || stop.status === "delivered") {
        events.push({ id: `${route.id}-${i}-arr`, at: nyInstant(today, stop.eta), type: "arrived", routeId: route.id, orderId: o.id, driverId: route.driverId, note: `Arrived at ${o.address}.`, lat: o.lat, lon: o.lon });
      }
      if (stop.status === "delivered" && stop.doneAt) {
        events.push({
          id: `${route.id}-${i}-del`,
          at: stop.doneAt,
          type: o.kind === "pickup" ? "returned" : "delivered",
          routeId: route.id,
          orderId: o.id,
          driverId: route.driverId,
          note: o.kind === "pickup" ? "All rental items picked up and strapped." : i % 3 === 1 ? "Placed along the fence line as requested." : "Unloaded and counted with the customer.",
          receivedBy: names[(i + route.id.length) % names.length],
          photos: [],
          lat: o.lat,
          lon: o.lon,
          customerEmailed: o.kind !== "pickup",
        });
      }
    });
  }
  // One problem stop so the exception styling shows.
  const r3 = routes.find((r) => r.id === "r3" && r.date === today);
  if (r3 && r3.stops[0]?.status === "delivered" && nowMin > minutesOf(r3.stops[0].eta) + 20) {
    events.push({ id: "r3-x", at: nyInstant(today, hhmmOf(minutesOf(r3.stops[0].eta) + 12)), type: "note", routeId: "r3", orderId: r3.stops[0].orderId, driverId: r3.driverId, note: "Staging lot was blocked. Customer moved drop 200 ft north, no issue." });
  }
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
