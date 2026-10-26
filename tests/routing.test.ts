import { describe, expect, it } from 'vitest';
import { HADLEY } from '../src/lib/constants';
import { buildBoardFromStops } from '../src/lib/routing';
import type { StopDraft } from '../src/lib/types';

function stop(over: Partial<StopDraft> & Pick<StopDraft, 'id' | 'items' | 'lat' | 'lon'>): StopDraft {
  return {
    customers: ['Example Co'],
    sos: ['SO1'],
    fulfillments: [],
    address: '1 Main St, Newark, NJ 07102',
    mapsAddress: '1 Main St, Newark, NJ 07102',
    town: 'Newark, NJ',
    shipFrom: ['Hadley'],
    memo: [],
    notes: [],
    packed: [],
    ...over,
  };
}

describe('routing', () => {
  it('sends light freight to Juan and heavy freight through Hollywood', async () => {
    const board = await buildBoardFromStops(
      [
        stop({
          id: 'stop-near',
          items: ['[SO1] SIGN24X18 x2'],
          lat: 40.58,
          lon: -74.4,
          town: 'Near, NJ',
          mapsAddress: '10 Near St, Near, NJ 07080',
        }),
        stop({
          id: 'stop-far',
          items: ['[SO2] CONE x1'],
          sos: ['SO2'],
          lat: 40.7,
          lon: -74.1,
          town: 'Far, NJ',
          mapsAddress: '20 Far Ave, Far, NJ 07002',
        }),
        stop({
          id: 'stop-heavy',
          items: ['[SO9225] CRASHGARDFILLED1400 x7', '[SO9225] CRASHGARDFILLED2100 x2', '[SO9225] CRASHGARDFILLED400 x1', '[SO9225] CRASHGARDFILLED700 x1'],
          sos: ['SO9225'],
          customers: ['J Fletcher Creamer & Son, Inc.'],
          shipFrom: ['Hollywood'],
          lat: 40.65,
          lon: -74.23,
          town: 'Linden, NJ',
          address: '1701 East Linden Ave, Linden, NJ 07036',
          mapsAddress: '1701 East Linden Ave, Linden, NJ 07036',
        }),
        stop({
          id: 'stop-island',
          items: ['[SO8612] SIGN24X18 x4'],
          sos: ['SO8612'],
          customers: ['Railroad Construction'],
          lat: 42.9,
          lon: -72.1,
          town: 'Amagansett, NY',
          mapsAddress: '23 Cranberry Hole Rd, Amagansett, NY 11930',
        }),
      ],
      { date: '2026-10-23', distance: 'haversine', credentialsConfigured: false, gated: false },
    );

    const juan = board.routes.find((route) => route.id === 'juan_pickup');
    const box = board.routes.find((route) => route.id === 'truck_511');
    const parked = board.routes.find((route) => route.id === 'unscheduled');
    expect(juan?.stops.some((stopRow) => stopRow.kind === 'load')).toBe(false);
    expect(juan?.stops.filter((stopRow) => stopRow.kind === 'delivery').map((stopRow) => stopRow.town)).toEqual([
      'Near, NJ',
      'Far, NJ',
    ]);
    expect(juan?.stops.at(-1)?.label).toBe('Return to depot');
    expect(box?.stops[0]?.label).toBe('Load at Hollywood yard');
    expect(box?.stops[0]?.address).toContain('448 Hollywood');
    expect(box?.stops.some((stopRow) => stopRow.sos.includes('SO9225'))).toBe(true);
    expect(parked?.stops.some((stopRow) => stopRow.sos.includes('SO8612'))).toBe(true);
    expect(juan?.mapsUrl).toContain('https://www.google.com/maps/dir/');
    expect(juan?.mapsUrl).toContain(encodeURIComponent(HADLEY.address).slice(0, 12));
    expect(board.flags.some((flag) => flag.text.includes('15,100'))).toBe(true);
    expect(board.warnings.some((warning) => warning.includes('straight-line'))).toBe(true);
    expect(box?.stops[0]?.eta).toMatch(/^7:\d{2} AM$/);
  });
});
