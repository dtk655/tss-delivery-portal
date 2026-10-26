/**
 * The Grok bot posts ready-to-ship orders here after reading NetSuite (read-only).
 * Same pattern as the lane closure board: header x-upload-secret must equal DATA_UPLOAD_SECRET.
 *
 * Body: { "orders": [...], "drivers": [...]? }   (see docs/NETSUITE_UPLOAD.md for each field)
 */
import { timingSafeEqual } from "crypto";
import { writeJSON } from "@/lib/store";
import type { Driver, LineItem, Order } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 8 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function secretMatches(given: string | null): boolean {
  const expected = process.env.DATA_UPLOAD_SECRET ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

function toOrder(raw: unknown): Order | string {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object") return "not an object";
  const id = str(r.id, 40);
  const shipDate = str(r.shipDate, 10);
  const lat = num(r.lat);
  const lon = num(r.lon);
  if (!id) return "missing id";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shipDate)) return `order ${id}: shipDate must be yyyy-mm-dd`;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return `order ${id}: lat and lon are required`;
  const kind = r.kind === "pickup" || r.kind === "rental" ? r.kind : "sale";
  const items: LineItem[] = Array.isArray(r.items)
    ? r.items.slice(0, 200).map((i) => {
        const it = i as Record<string, unknown>;
        return { sku: str(it.sku, 60), name: str(it.name, 160), qty: Number(it.qty) || 0 };
      })
    : [];
  return {
    id,
    number: str(r.number, 40) || id,
    kind,
    customer: str(r.customer, 160),
    contact: str(r.contact, 120),
    contactEmail: str(r.contactEmail, 160),
    contactPhone: str(r.contactPhone, 20).replace(/\D/g, "").slice(-10),
    address: str(r.address, 200),
    city: str(r.city, 80),
    state: str(r.state, 4).toUpperCase(),
    lat,
    lon,
    shipDate,
    window: str(r.window, 20),
    items,
    weightLbs: Number(r.weightLbs) || 0,
    salesRep: str(r.salesRep, 80),
    notes: str(r.notes, 600),
    needsCdl: Boolean(r.needsCdl),
  };
}

function toDriver(raw: unknown): Driver | null {
  const r = raw as Record<string, unknown>;
  if (!r || !str(r.id) || !str(r.name)) return null;
  const license = r.license === "CDL-A" || r.license === "CDL-B" ? r.license : "Non-CDL";
  return {
    id: str(r.id, 40),
    name: str(r.name, 80),
    phone: str(r.phone, 20).replace(/\D/g, "").slice(-10),
    email: str(r.email, 160),
    license,
    smsOptIn: Boolean(r.smsOptIn),
    defaultTruckId: str(r.defaultTruckId, 40),
  };
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.DATA_UPLOAD_SECRET) return json({ error: "DATA_UPLOAD_SECRET is not set." }, 503);
  if (!secretMatches(request.headers.get("x-upload-secret"))) return json({ error: "Unauthorized." }, 401);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return json({ error: "Body is over 8 MB." }, 413);

  let body: { orders?: unknown; drivers?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  if (!Array.isArray(body.orders)) return json({ error: "Send { orders: [...] }." }, 400);

  const orders: Order[] = [];
  const problems: string[] = [];
  for (const raw of body.orders) {
    const result = toOrder(raw);
    if (typeof result === "string") problems.push(result);
    else orders.push(result);
  }
  const drivers = Array.isArray(body.drivers) ? body.drivers.map(toDriver).filter((d): d is Driver => d !== null) : undefined;

  const uploadedAt = new Date().toISOString();
  await writeJSON("orders.json", { uploadedAt, orders, ...(drivers?.length ? { drivers } : {}) });
  return json({ ok: true, uploadedAt, orders: orders.length, drivers: drivers?.length ?? 0, skipped: problems.slice(0, 50) });
}
