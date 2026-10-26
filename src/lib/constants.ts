export const READY_RULE =
  'Ship method TSS Delivery Fleet (id 517) and item fulfillment Packed (B). Closed and Cancelled sales orders stay off the board. Orders to the same address are one stop.';

export const HADLEY = {
  id: 'HADLEY',
  label: 'Hadley',
  address: '601 Hadley Rd, South Plainfield, NJ 07080',
  lat: 40.55124833333,
  lon: -74.412908697766,
} as const;

export const HOLLYWOOD = {
  id: 'HOLLYWOOD',
  label: 'Hollywood',
  address: '448 Hollywood Ave, South Plainfield, NJ 07080',
  lat: 40.56219878536,
  lon: -74.410658136395,
} as const;

/** OSRM free-flow minutes are scaled for NJ/NY metro traffic and a loaded truck. */
export const TRAFFIC_FACTOR = 1.4;
export const STOP_DWELL_MIN = 20;
export const LOAD_DWELL_MIN = 15;
/** Straight-line fallback: inflate miles to roughly a local road path. */
export const ROAD_FACTOR = 1.35;
export const FREEFLOW_MPH = 45;
export const START_HOUR = 7;
export const TIME_ZONE = 'America/New_York';
/** One-way road miles from Hadley. Farther than this stays off Juan and truck 511. */
export const LONG_HAUL_MILES = 100;
export const HEAVY_LOAD_LB = 10_000;

export const JUAN_VEHICLE = 'Juan — pickup truck';
export const BOX_VEHICLE = 'Truck 511 — box truck';
export const UNSCHEDULED_VEHICLE = 'Unscheduled long haul';

export const JUAN_ID = 'juan_pickup';
export const BOX_ID = 'truck_511';
export const UNSCHEDULED_ID = 'unscheduled';
