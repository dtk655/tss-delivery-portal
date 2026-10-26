/**
 * Fleetio: truck list and last GPS position.
 * Set FLEETIO_API_KEY and FLEETIO_ACCOUNT_TOKEN in Netlify. Without them the portal shows sample trucks.
 * Docs: https://developer.fleetio.com/docs/overview/quick-start
 */
import type { Truck, TruckStatus } from "@/lib/types";

const BASE = "https://secure.fleetio.com/api/v1";

export function fleetioConfigured(): boolean {
  return Boolean(process.env.FLEETIO_API_KEY && process.env.FLEETIO_ACCOUNT_TOKEN);
}

async function get<T>(pathname: string): Promise<T> {
  const response = await fetch(`${BASE}${pathname}`, {
    headers: {
      Authorization: `Token ${process.env.FLEETIO_API_KEY}`,
      "Account-Token": String(process.env.FLEETIO_ACCOUNT_TOKEN),
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Fleetio ${pathname} answered ${response.status}`);
  return (await response.json()) as T;
}

type FleetioVehicle = {
  id: number;
  name: string;
  license_plate?: string | null;
  vehicle_type_name?: string | null;
  current_meter_value?: number | null;
  vehicle_status_name?: string | null;
};

type FleetioLocation = {
  date?: string;
  created_at?: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  geolocation?: { latitude?: number | string; longitude?: number | string } | null;
};

/** Fleetio sometimes wraps lists as { records: [...] }. */
function rows<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const records = (value as { records?: unknown })?.records;
  return Array.isArray(records) ? (records as T[]) : [];
}

function statusFrom(ping: string, moved: boolean): TruckStatus {
  const minutes = (Date.now() - new Date(ping).getTime()) / 60_000;
  if (!Number.isFinite(minutes) || minutes > 60) return "offline";
  return moved ? "moving" : "stopped";
}

/**
 * Live trucks from Fleetio, matched to the portal's truck list by Fleetio id or unit name.
 * Trucks Fleetio does not return keep their last known values.
 */
export async function liveTrucks(known: Truck[]): Promise<Truck[]> {
  if (!fleetioConfigured()) return known;
  const vehicles = rows<FleetioVehicle>(await get("/vehicles?per_page=100"));
  const out: Truck[] = [];
  for (const vehicle of vehicles) {
    const match =
      known.find((t) => t.fleetioId === String(vehicle.id)) ??
      known.find((t) => t.unit.toLowerCase() === vehicle.name.toLowerCase());
    let loc: FleetioLocation | undefined;
    try {
      loc = rows<FleetioLocation>(await get(`/vehicles/${vehicle.id}/location_entries?per_page=2`))[0];
    } catch {
      loc = undefined;
    }
    const lat = Number(loc?.geolocation?.latitude ?? loc?.latitude ?? match?.lat ?? NaN);
    const lon = Number(loc?.geolocation?.longitude ?? loc?.longitude ?? match?.lon ?? NaN);
    const ping = loc?.date ?? loc?.created_at ?? match?.lastPing ?? new Date(0).toISOString();
    const moved = match ? Math.hypot(lat - match.lat, lon - match.lon) > 0.0005 : false;
    out.push({
      id: match?.id ?? `f${vehicle.id}`,
      unit: vehicle.name,
      type: vehicle.vehicle_type_name ?? match?.type ?? "Truck",
      plate: vehicle.license_plate ?? match?.plate ?? "",
      capacityLbs: match?.capacityLbs ?? 10000,
      cdl: match?.cdl ?? true,
      odometer: Math.round(vehicle.current_meter_value ?? match?.odometer ?? 0),
      nextServiceMiles: match?.nextServiceMiles ?? 0,
      fleetioId: String(vehicle.id),
      lat,
      lon,
      speedMph: moved ? 35 : 0,
      heading: 0,
      status: Number.isFinite(lat) ? statusFrom(ping, moved) : "offline",
      lastPing: ping,
      address: loc?.address ?? "",
    });
  }
  return out.length ? out : known;
}
