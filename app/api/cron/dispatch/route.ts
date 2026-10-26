/**
 * Evening dispatch, called by the scheduled Netlify functions:
 *   ?step=texts  -> each driver gets tomorrow's route (5:00 PM)
 *   ?step=email  -> the company list gets every route (5:30 PM)
 * Header x-cron-secret must equal CRON_SECRET. Does nothing on weekends.
 */
import { timingSafeEqual } from "crypto";
import { loadPortal } from "@/lib/data";
import { parseISO } from "@/lib/dates";
import { emailCompany, textDrivers } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(given: string | null): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!ok(request.headers.get("x-cron-secret"))) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const step = new URL(request.url).searchParams.get("step");
  const portal = await loadPortal();
  if ([0, 6].includes(parseISO(portal.today).getUTCDay())) return Response.json({ skipped: "weekend" });
  const date = portal.tomorrow;
  if (step === "texts") return Response.json({ date, ...(await textDrivers(portal, date)) });
  if (step === "email") return Response.json({ date, ...(await emailCompany(portal, date)) });
  return Response.json({ error: "step must be texts or email" }, { status: 400 });
}
