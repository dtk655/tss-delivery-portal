import {
  BOX_ID,
  BOX_VEHICLE,
  FREEFLOW_MPH,
  HADLEY,
  HEAVY_LOAD_LB,
  HOLLYWOOD,
  JUAN_ID,
  JUAN_VEHICLE,
  LOAD_DWELL_MIN,
  LONG_HAUL_MILES,
  READY_RULE,
  ROAD_FACTOR,
  START_HOUR,
  STOP_DWELL_MIN,
  TRAFFIC_FACTOR,
  UNSCHEDULED_ID,
  UNSCHEDULED_VEHICLE,
} from './constants';
import {
  formatClock,
  googleMapsUrl,
  nominalCrashgardLb,
  parseLooseDate,
  round1,
  round2,
  zonedDate,
} from './format';
import { deliverByOf, shipsFromHollywood, stopIsHeavy } from './group';
import type { DispatchBoard, DispatchFlag, RoutePlan, RouteStop, StopDraft } from './types';

interface Leg {
  mi: number;
  min: number;
}

interface Matrix {
  source: 'osrm' | 'haversine';
  leg(from: string, to: string): Leg | null;
}

interface Point {
  id: string;
  lat: number;
  lon: number;
}

const USER_AGENT = 'TSS-Delivery-Portal/0.1 (dispatch board)';

export function haversineMi(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const radius = 3958.7613;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function haversineLeg(a: Point, b: Point): Leg {
  const mi = haversineMi(a, b) * ROAD_FACTOR;
  const min = (mi / FREEFLOW_MPH) * 60 * TRAFFIC_FACTOR;
  return { mi, min };
}

export async function geocodeAddress(
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lat: number; lon: number } | null> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('format', 'json');
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    result?: { addressMatches?: Array<{ coordinates?: { x?: number; y?: number } }> };
  };
  const coordinates = body.result?.addressMatches?.[0]?.coordinates;
  if (coordinates?.x == null || coordinates.y == null) return null;
  return { lon: coordinates.x, lat: coordinates.y };
}

export async function withCoordinates(
  stops: StopDraft[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ stops: StopDraft[]; warnings: string[] }> {
  const warnings: string[] = [];
  const next = stops.map((stop) => ({ ...stop }));
  const queue = next.filter((stop) => stop.lat == null || stop.lon == null);
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      const stop = queue[index];
      if (!stop || !stop.mapsAddress.trim()) continue;
      try {
        const hit = await geocodeAddress(stop.mapsAddress, fetchImpl);
        if (!hit) {
          warnings.push(`No map point for ${stop.town}. The stop stays on the list; miles wait on a cleaner address.`);
          continue;
        }
        stop.lat = hit.lat;
        stop.lon = hit.lon;
      } catch {
        warnings.push(`Geocoding failed for ${stop.town}. The stop stays on the list without a mile estimate.`);
      }
    }
  }
  const workers = Math.min(6, queue.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { stops: next, warnings };
}

async function osrmMatrix(points: Point[], fetchImpl: typeof fetch): Promise<Matrix | null> {
  if (points.length < 2) return null;
  const path = points.map((point) => `${point.lon},${point.lat}`).join(';');
  const url = `https://router.project-osrm.org/table/v1/driving/${path}?annotations=distance,duration`;
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      code?: string;
      distances?: Array<Array<number | null>>;
      durations?: Array<Array<number | null>>;
    };
    if (body.code !== 'Ok' || !body.distances || !body.durations) return null;
    const index = new Map(points.map((point, i) => [point.id, i]));
    return {
      source: 'osrm',
      leg(from, to) {
        const i = index.get(from);
        const j = index.get(to);
        if (i == null || j == null) return null;
        const meters = body.distances?.[i]?.[j];
        const seconds = body.durations?.[i]?.[j];
        if (meters == null || seconds == null) return null;
        return { mi: meters / 1609.344, min: (seconds / 60) * TRAFFIC_FACTOR };
      },
    };
  } catch {
    return null;
  }
}

function haversineMatrix(points: Point[]): Matrix {
  const byId = new Map(points.map((point) => [point.id, point]));
  return {
    source: 'haversine',
    leg(from, to) {
      const a = byId.get(from);
      const b = byId.get(to);
      if (!a || !b) return null;
      return haversineLeg(a, b);
    },
  };
}

async function buildMatrix(stops: StopDraft[], distance: 'auto' | 'haversine', fetchImpl: typeof fetch): Promise<Matrix> {
  const points: Point[] = [
    { id: HADLEY.id, lat: HADLEY.lat, lon: HADLEY.lon },
    { id: HOLLYWOOD.id, lat: HOLLYWOOD.lat, lon: HOLLYWOOD.lon },
  ];
  for (const stop of stops) {
    if (stop.lat == null || stop.lon == null) continue;
    points.push({ id: stop.id, lat: stop.lat, lon: stop.lon });
  }
  if (distance === 'auto') {
    const osrm = await osrmMatrix(points, fetchImpl);
    if (osrm) return osrm;
  }
  return haversineMatrix(points);
}

function nearest(startId: string, stops: StopDraft[], matrix: Matrix): StopDraft[] {
  const remaining = [...stops];
  const ordered: StopDraft[] = [];
  let cursor = startId;
  while (remaining.length) {
    let best = 0;
    let bestMi = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const leg = matrix.leg(cursor, remaining[i]!.id);
      const mi = leg?.mi ?? Number.POSITIVE_INFINITY;
      if (mi < bestMi - 0.01 || (Math.abs(mi - bestMi) <= 0.01 && remaining[i]!.id < remaining[best]!.id)) {
        best = i;
        bestMi = mi;
      }
    }
    const [next] = remaining.splice(best, 1);
    if (!next) break;
    ordered.push(next);
    if (matrix.leg(cursor, next.id)) cursor = next.id;
  }
  return ordered;
}

function depotStop(kind: 'load' | 'return', eta: string, legMi: number | null, dwellMin?: number): RouteStop {
  const yard = kind === 'load';
  return {
    label: yard ? 'Load at Hollywood yard' : 'Return to depot',
    kind,
    customers: [],
    sos: [],
    fulfillments: [],
    items: [],
    address: yard ? HOLLYWOOD.address : HADLEY.address,
    town: 'South Plainfield, NJ',
    shipFrom: [],
    memo: [],
    notes: [],
    eta,
    legMi,
    dwellMin,
  };
}

function deliveryStop(stop: StopDraft, eta: string, legMi: number | null): RouteStop {
  const deliverBy = deliverByOf(stop) ?? undefined;
  return {
    label: stop.customers.join(' / ') || stop.town,
    kind: 'delivery',
    customers: stop.customers,
    sos: stop.sos,
    fulfillments: stop.fulfillments,
    items: stop.items,
    address: stop.address,
    town: stop.town,
    shipFrom: stop.shipFrom,
    memo: stop.memo,
    notes: stop.notes,
    deliverBy,
    eta,
    legMi,
    dwellMin: STOP_DWELL_MIN,
  };
}

function emptyRoute(id: string, kind: RoutePlan['kind'], vehicle: string, driverNote?: string): RoutePlan {
  return {
    id,
    kind,
    role: 'primary',
    vehicle,
    driverNote,
    start: '7:00 AM',
    stops: [],
    totalMi: 0,
    driveMin: 0,
    totalHr: 0,
    backAt: '7:00 AM',
    mapsUrl: null,
  };
}

function buildRoute(
  spec: { id: string; kind: RoutePlan['kind']; vehicle: string; driverNote?: string },
  stops: StopDraft[],
  matrix: Matrix,
  date: string,
): RoutePlan {
  if (!stops.length) return emptyRoute(spec.id, spec.kind, spec.vehicle, spec.driverNote);
  const yard = stops.some((stop) => shipsFromHollywood(stop.shipFrom));
  const ordered = nearest(yard ? HOLLYWOOD.id : HADLEY.id, stops, matrix);
  const start = zonedDate(date, START_HOUR, 0);
  let clock = start;
  let cursor: string = HADLEY.id;
  let knownClock = true;
  let rawMi = 0;
  let rawMin = 0;
  let milesKnown = true;
  const rows: RouteStop[] = [];

  const advance = (to: string): number | null => {
    const leg = matrix.leg(cursor, to);
    cursor = to;
    if (!leg) {
      milesKnown = false;
      knownClock = false;
      return null;
    }
    rawMi += leg.mi;
    rawMin += leg.min;
    if (knownClock) clock = new Date(clock.getTime() + leg.min * 60_000);
    return round1(leg.mi);
  };

  if (yard) {
    const legMi = advance(HOLLYWOOD.id);
    rows.push(depotStop('load', knownClock ? formatClock(clock) : '—', legMi, LOAD_DWELL_MIN));
    if (knownClock) clock = new Date(clock.getTime() + LOAD_DWELL_MIN * 60_000);
  }
  for (const stop of ordered) {
    const legMi = advance(stop.id);
    rows.push(deliveryStop(stop, knownClock ? formatClock(clock) : '—', legMi));
    if (knownClock) clock = new Date(clock.getTime() + STOP_DWELL_MIN * 60_000);
  }
  const backLeg = advance(HADLEY.id);
  rows.push(depotStop('return', knownClock ? formatClock(clock) : '—', backLeg));

  const mapsAddresses: string[] = [HADLEY.address];
  if (yard) mapsAddresses.push(HOLLYWOOD.address);
  for (const stop of ordered) mapsAddresses.push(stop.mapsAddress || stop.address);
  mapsAddresses.push(HADLEY.address);

  const totalHr = knownClock ? round2((clock.getTime() - start.getTime()) / 3_600_000) : null;
  return {
    id: spec.id,
    kind: spec.kind,
    role: 'primary',
    vehicle: spec.vehicle,
    driverNote: spec.driverNote,
    start: '7:00 AM',
    stops: rows,
    totalMi: milesKnown ? round1(rawMi) : null,
    driveMin: milesKnown ? Math.round(rawMin) : null,
    totalHr,
    backAt: knownClock ? formatClock(clock) : '—',
    mapsUrl: googleMapsUrl(mapsAddresses),
  };
}

function oneWayMiles(stop: StopDraft, matrix: Matrix): number | null {
  return matrix.leg(HADLEY.id, stop.id)?.mi ?? null;
}

function liveFlags(assigned: StopDraft[], unscheduled: StopDraft[], date: string): DispatchFlag[] {
  const flags: DispatchFlag[] = [
    {
      level: 'info',
      text: 'Juan takes signs, cones, posts, Scorpion parts, and Windmaster stands. Truck 511 takes Crashgards, barriers, and Graco units. NetSuite weights are often blank, so this split is by item name.',
    },
  ];
  const planDate = parseLooseDate(date);
  for (const stop of [...assigned, ...unscheduled]) {
    if (stop.customers.length > 1) {
      flags.push({
        level: 'info',
        text: `${stop.customers.join(' / ')} in ${stop.town} share one stop — same street and ZIP.`,
      });
    }
    const deliverBy = deliverByOf(stop);
    if (deliverBy) {
      flags.push({
        level: 'warn',
        text: `${stop.customers[0] ?? stop.town} (${stop.sos.join(', ')}): deliver before ${deliverBy}.`,
      });
    }
    const pounds = nominalCrashgardLb(stop.items);
    if (pounds >= HEAVY_LOAD_LB) {
      flags.push({
        level: 'warn',
        text: `${stop.customers[0] ?? stop.town} ${stop.sos.join(', ')}: filled Crashgard nominal weight is about ${pounds.toLocaleString('en-US')} lb. Confirm it fits on one truck.`,
      });
    }
    const hollywood = stop.shipFrom.some((loc) => /hollywood/i.test(loc));
    const hadley = stop.shipFrom.some((loc) => /hadley/i.test(loc));
    if (hollywood && hadley) {
      flags.push({
        level: 'info',
        text: `${stop.customers[0] ?? stop.town} ships from both Hadley and Hollywood.`,
      });
    }
    if (planDate) {
      for (const packed of stop.packed) {
        const packedOn = parseLooseDate(packed.packedOn);
        if (!packedOn) continue;
        const days = Math.round((planDate.getTime() - packedOn.getTime()) / 86_400_000);
        if (days >= 5) {
          flags.push({
            level: 'info',
            text: `${packed.so} (${packed.ifnum}) has been packed since ${packed.packedOn}.`,
          });
        }
      }
    }
  }
  for (const stop of unscheduled) {
    flags.push({
      level: 'warn',
      text: `${stop.customers.join(' / ') || stop.town} (${stop.sos.join(', ')}) is over ${LONG_HAUL_MILES} miles from Hadley, so it stays off Juan and truck 511. Schedule a separate run or a common carrier.`,
    });
  }
  const [lead, ...rest] = flags;
  rest.sort((a, b) => Number(b.level === 'warn') - Number(a.level === 'warn'));
  const seen = new Set<string>();
  return [lead, ...rest].filter((flag): flag is DispatchFlag => {
    if (!flag || seen.has(flag.text)) return false;
    seen.add(flag.text);
    return true;
  });
}

export async function buildBoardFromStops(
  stops: StopDraft[],
  options: {
    date: string;
    warnings?: string[];
    distance?: 'auto' | 'haversine';
    fetchImpl?: typeof fetch;
    credentialsConfigured: boolean;
    gated: boolean;
    generatedAt?: string | null;
  },
): Promise<DispatchBoard> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const matrix = await buildMatrix(stops, options.distance ?? 'auto', fetchImpl);
  const warnings = [...(options.warnings ?? [])];
  if (matrix.source === 'haversine') {
    warnings.push('Road miles are a straight-line estimate (× 1.35) with a 1.4 traffic factor. Google Maps has the driving route.');
  }

  const light: StopDraft[] = [];
  const heavy: StopDraft[] = [];
  const unscheduled: StopDraft[] = [];
  for (const stop of stops) {
    const miles = oneWayMiles(stop, matrix);
    if (miles != null && miles > LONG_HAUL_MILES) {
      unscheduled.push(stop);
      continue;
    }
    if (stopIsHeavy(stop.items)) heavy.push(stop);
    else light.push(stop);
  }

  const routes: RoutePlan[] = [
    buildRoute({ id: JUAN_ID, kind: 'pickup', vehicle: JUAN_VEHICLE }, light, matrix, options.date),
    buildRoute(
      {
        id: BOX_ID,
        kind: 'box',
        vehicle: BOX_VEHICLE,
        driverNote: 'Driver varies (Roger / Timmy).',
      },
      heavy,
      matrix,
      options.date,
    ),
  ];
  if (unscheduled.length) {
    routes.push(
      buildRoute(
        {
          id: UNSCHEDULED_ID,
          kind: 'unscheduled',
          vehicle: UNSCHEDULED_VEHICLE,
          driverNote: `Over ${LONG_HAUL_MILES} miles from Hadley. Not assigned to Juan or truck 511.`,
        },
        unscheduled,
        matrix,
        options.date,
      ),
    );
  }

  for (const route of routes) {
    const deliveries = route.stops.filter((stop) => stop.kind === 'delivery').length;
    if (deliveries > 9) {
      warnings.push(`${route.vehicle} has ${deliveries} stops. Google Maps may drop extras; the board list is the full route.`);
    }
  }

  if (!stops.length) {
    warnings.push('No packed TSS Delivery Fleet orders came back.');
  }

  const routingNote =
    matrix.source === 'osrm'
      ? 'Miles and drive times are OSRM road data × 1.4 for metro traffic, plus 20 minutes per stop and 15 minutes to load at Hollywood. Start is 7:00 AM Eastern from 601 Hadley Rd.'
      : 'Miles are a straight-line estimate × 1.35, with drive time × 1.4 for traffic, plus 20 minutes per stop and 15 minutes to load at Hollywood. Google Maps has the turn-by-turn route. Start is 7:00 AM Eastern from 601 Hadley Rd.';

  return {
    source: 'netsuite',
    date: options.date,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    rule: READY_RULE,
    routingNote,
    credentialsConfigured: options.credentialsConfigured,
    gated: options.gated,
    defaultRouteIds: routes.map((route) => route.id),
    routes,
    flags: liveFlags([...light, ...heavy], unscheduled, options.date),
    warnings,
  };
}
