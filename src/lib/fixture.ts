import planFile from '../data/plan-2026-10-23.json';
import { READY_RULE } from './constants';
import { deliverByNote, safeMapsUrl, stripMarkup } from './format';
import type { DispatchBoard, DispatchFlag, RoutePlan, RouteStop } from './types';

interface FixtureStop {
  stop: string;
  address: string;
  eta: string;
  leg_mi: number;
  dwell_min?: number;
  customers?: string[];
  sos?: string[];
  fulfillments?: string[];
  items?: string[];
  town?: string;
  ship_from?: string[];
  memo?: string[];
  notes?: string[];
}

interface FixturePlan {
  vehicle: string;
  start: string;
  stops: FixtureStop[];
  total_mi: number;
  drive_min: number;
  total_hr: number;
  back_at: string;
  maps: string;
}

interface FixtureFile {
  date: string;
  rule: string;
  routing: string;
  plans: Record<string, FixturePlan>;
}

const PLAN_ORDER = ['juan_pickup', 'box_511_plus_babylon', 'box_511', 'long_island_run_option'] as const;

const PLAN_META: Record<string, { role: RoutePlan['role']; kind: RoutePlan['kind'] }> = {
  juan_pickup: { role: 'primary', kind: 'pickup' },
  box_511_plus_babylon: { role: 'primary', kind: 'box' },
  box_511: { role: 'alternate', kind: 'box' },
  long_island_run_option: { role: 'alternate', kind: 'option' },
};

const FIXTURE_FLAGS: DispatchFlag[] = [
  {
    level: 'info',
    text: 'Recommended board is Juan’s pickup plus truck 511 including Babylon. Forte’s two empty Crashgard barrels ride after Creamer is unloaded. The shorter 511 route is the fallback.',
  },
  {
    level: 'warn',
    text: 'Amagansett (Railroad Construction SO8612, about 139 miles each way) stays off the recommended trucks. Show the Long Island option to include it, or use a common carrier.',
  },
  {
    level: 'warn',
    text: 'Creamer SO9225: 11 filled Crashgard barrels (1×400, 1×700, 7×1400, 2×2100 lb) are about 15,100 lb nominal if sand-filled. Confirm the load; it may need two Hollywood trips.',
  },
  {
    level: 'info',
    text: 'NetSuite item weights are blank, so the split is by item type: signs, cones, posts, Scorpion parts, and Windmaster stands on the pickup; Crashgards and Graco LineLazer on truck 511.',
  },
  {
    level: 'info',
    text: 'Port Authority is two customer records at 777 Jersey Ave (stockroom SO9236–SO9238 and SO9127, attn Bassim Megaly). They are one stop.',
  },
  {
    level: 'warn',
    text: 'Entact in Bayonne says deliver before 2:30 PM. Sample ETA is about 9:01 AM.',
  },
  {
    level: 'info',
    text: 'Jefco is five sales orders. SO9080 was packed on 10/15.',
  },
  {
    level: 'info',
    text: 'Times use a 7:00 AM Hadley start (OSRM road time × 1.4, 20 minutes per stop, 15 minutes to load at Hollywood). The sample was built mid-morning, so 7:00 AM is nominal.',
  },
];

function stopKind(name: string): RouteStop['kind'] {
  if (/load at hollywood/i.test(name)) return 'load';
  if (/return to depot/i.test(name)) return 'return';
  return 'delivery';
}

function mapStop(stop: FixtureStop): RouteStop {
  const kind = stopKind(stop.stop);
  const address = stripMarkup(stop.address);
  const customers = (stop.customers ?? []).map((customer) => stripMarkup(customer));
  const deliverBy = deliverByNote(address) ?? undefined;
  return {
    label: kind === 'delivery' ? customers.join(' / ') || stop.stop : stop.stop,
    code: kind === 'delivery' && stop.stop && !stop.stop.includes(' ') ? stop.stop : undefined,
    kind,
    customers,
    sos: stop.sos ?? [],
    fulfillments: stop.fulfillments ?? [],
    items: stop.items ?? [],
    address,
    town: stop.town ?? '',
    shipFrom: stop.ship_from ?? [],
    memo: (stop.memo ?? []).map((memo) => stripMarkup(memo)),
    notes: (stop.notes ?? []).map((note) => stripMarkup(note)),
    deliverBy,
    eta: stop.eta,
    legMi: stop.leg_mi,
    dwellMin: stop.dwell_min,
  };
}

export function fixtureBoard(options: { credentialsConfigured: boolean; gated: boolean }): DispatchBoard {
  const file = planFile as FixtureFile;
  const ids = [...PLAN_ORDER.filter((id) => file.plans[id]), ...Object.keys(file.plans).filter((id) => !PLAN_ORDER.includes(id as (typeof PLAN_ORDER)[number]))];
  const routes: RoutePlan[] = ids.map((id) => {
    const plan = file.plans[id]!;
    const meta = PLAN_META[id] ?? { role: 'alternate' as const, kind: 'option' as const };
    const driverNote =
      meta.kind === 'box' && !/roger|timmy/i.test(plan.vehicle) ? 'Driver varies (Roger / Timmy).' : undefined;
    return {
      id,
      kind: meta.kind,
      role: meta.role,
      vehicle: plan.vehicle,
      driverNote,
      start: plan.start,
      stops: plan.stops.map(mapStop),
      totalMi: plan.total_mi,
      driveMin: plan.drive_min,
      totalHr: plan.total_hr,
      backAt: plan.back_at,
      mapsUrl: safeMapsUrl(plan.maps),
    };
  });
  return {
    source: 'fixture',
    date: file.date,
    generatedAt: null,
    rule: READY_RULE,
    routingNote:
      'Sample from Fri Oct 23, 2026. Miles and ETAs are the precomputed OSRM plan (road time × 1.4, 20 min per stop, 15 min to load at Hollywood), starting 7:00 AM at 601 Hadley Rd.',
    credentialsConfigured: options.credentialsConfigured,
    gated: options.gated,
    defaultRouteIds: ['juan_pickup', 'box_511_plus_babylon'],
    routes,
    flags: FIXTURE_FLAGS,
    warnings: [],
  };
}

export function fixtureRuleText(): string {
  return (planFile as FixtureFile).rule;
}
