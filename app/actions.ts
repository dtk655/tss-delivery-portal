"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/auth";
import { EMPTY_EDITS, loadPortal, type Edits } from "@/lib/data";
import { isISODate } from "@/lib/dates";
import { driverFromToken } from "@/lib/driver-link";
import { emailCompany, emailCustomerDelivered, textDrivers, type SendSummary } from "@/lib/notify";
import { updateJSON, writeFile } from "@/lib/store";
import type { DeliveryEvent, StopStatus } from "@/lib/types";

async function guard() {
  if (!(await isAuthed())) throw new Error("Sign in again.");
}

function refreshAll() {
  for (const p of ["/", "/orders", "/routes", "/fleet", "/log", "/messages"]) revalidatePath(p);
}

/** Put an order on a route ("" takes it off). */
export async function assignOrder(orderId: string, routeId: string): Promise<void> {
  await guard();
  await updateJSON<Edits>("edits.json", EMPTY_EDITS, (edits) => ({ ...EMPTY_EDITS, ...edits, assign: { ...edits.assign, [orderId]: routeId } }));
  refreshAll();
}

export async function sendDriverTexts(date: string): Promise<SendSummary> {
  await guard();
  if (!isISODate(date)) throw new Error("Bad date.");
  const summary = await textDrivers(await loadPortal(), date);
  refreshAll();
  return summary;
}

export async function sendCompanyEmail(date: string): Promise<SendSummary> {
  await guard();
  if (!isISODate(date)) throw new Error("Bad date.");
  const summary = await emailCompany(await loadPortal(), date);
  refreshAll();
  return summary;
}

export type DriverUpdateResult = { ok: true; emailed: string | null } | { ok: false; error: string };

const MAX_PHOTO = 8 * 1024 * 1024;

/** Called from the driver's phone page. The token in the link is the driver's sign-in. */
export async function driverUpdate(form: FormData): Promise<DriverUpdateResult> {
  const driverId = driverFromToken(String(form.get("token") ?? ""));
  if (!driverId) return { ok: false, error: "This link is not valid. Ask dispatch for a new one." };
  const routeId = String(form.get("routeId") ?? "");
  const orderId = String(form.get("orderId") ?? "") || null;
  const action = String(form.get("action") ?? "") as DeliveryEvent["type"];
  if (!["departed", "arrived", "delivered", "exception", "note", "returned"].includes(action)) return { ok: false, error: "Unknown update." };

  const portal = await loadPortal();
  const route = portal.routes.find((r) => r.id === routeId && r.driverId === driverId);
  if (!route) return { ok: false, error: "That route is not assigned to you." };
  const order = orderId ? portal.orders.find((o) => o.id === orderId) : undefined;
  if (orderId && (!order || !route.stops.some((s) => s.orderId === orderId))) return { ok: false, error: "That stop is not on your route." };

  const id = randomUUID();
  const photos: string[] = [];
  for (const file of form.getAll("photos")) {
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_PHOTO) return { ok: false, error: "Photos must be under 8 MB each." };
    if (!file.type.startsWith("image/")) continue;
    const key = `photos/${id}-${photos.length + 1}`;
    await writeFile(key, await file.arrayBuffer(), file.type);
    photos.push(key);
  }

  const lat = Number(form.get("lat"));
  const lon = Number(form.get("lon"));
  const event: DeliveryEvent = {
    id,
    at: new Date().toISOString(),
    type: action,
    routeId,
    orderId,
    driverId,
    note: String(form.get("note") ?? "").slice(0, 600),
    receivedBy: String(form.get("receivedBy") ?? "").slice(0, 80) || undefined,
    photos,
    lat: Number.isFinite(lat) && lat !== 0 ? lat : undefined,
    lon: Number.isFinite(lon) && lon !== 0 ? lon : undefined,
  };

  const stopStatus: Partial<Record<DeliveryEvent["type"], StopStatus>> = { arrived: "arrived", delivered: "delivered", returned: "delivered", exception: "exception" };
  if (orderId && stopStatus[action]) {
    await updateJSON<Edits>("edits.json", EMPTY_EDITS, (edits) => ({
      ...EMPTY_EDITS,
      ...edits,
      stops: { ...edits.stops, [`${routeId}:${orderId}`]: { status: stopStatus[action]!, doneAt: action === "delivered" || action === "returned" ? event.at : undefined } },
    }));
  }

  // Leaving the yard, or finishing a stop, puts the next stop "en route".
  if (action === "departed" || action === "delivered" || action === "returned") {
    const next = route.stops.find((s) => s.status === "pending" && s.orderId !== orderId);
    if (next) {
      await updateJSON<Edits>("edits.json", EMPTY_EDITS, (edits) => ({
        ...EMPTY_EDITS,
        ...edits,
        stops: { ...edits.stops, [`${routeId}:${next.orderId}`]: { status: "en-route" } },
      }));
    }
  }

  let emailed: string | null = null;
  if (order && (action === "delivered" || action === "returned")) {
    const status = await emailCustomerDelivered(order, event, portal);
    event.customerEmailed = status === "sent";
    emailed = status === "sent" ? order.contactEmail : status === "dry-run" ? "dry-run" : null;
  }
  await updateJSON<DeliveryEvent[]>("events.json", [], (list) => [event, ...list].slice(0, 2000));
  refreshAll();
  return { ok: true, emailed };
}
