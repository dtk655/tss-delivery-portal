import { createHmac, timingSafeEqual } from "crypto";

/**
 * Twilio texting. Settings come from the Netlify environment:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (+18889108408)
 */
export type TwilioConfig = { sid: string; token: string; from: string };

export function twilioConfig(env: Record<string, string | undefined> = process.env): TwilioConfig | null {
  const sid = (env.TWILIO_ACCOUNT_SID ?? "").trim();
  const token = (env.TWILIO_AUTH_TOKEN ?? "").trim();
  const from = (env.TWILIO_FROM_NUMBER ?? "").replace(/[^\d+]/g, "");
  if (!/^AC[0-9a-fA-F]{32}$/.test(sid) || !token || !/^\+1\d{10}$/.test(from)) return null;
  return { sid, token, from };
}

/** "7325550123" -> "+17325550123". */
export function e164(phone: string): string {
  return `+1${phone}`;
}

/** "+17325550123" -> "7325550123", or "" if it is not a US number. */
export function tenDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
}

export type SendResult = { ok: true; sid: string } | { ok: false; error: string; optedOut?: boolean };

export async function sendSms(config: TwilioConfig, to: string, body: string): Promise<SendResult> {
  const form = new URLSearchParams({ To: e164(to), From: config.from, Body: body });
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.sid}/Messages.json`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.sid}:${config.token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (response.ok && data.sid) return { ok: true, sid: data.sid };
    // 21610: the person replied STOP to this number.
    return { ok: false, error: data.message ?? `Twilio error ${response.status}`, optedOut: data.code === 21610 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Twilio could not be reached." };
  }
}

/** Twilio's X-Twilio-Signature: HMAC-SHA1 of the URL plus the sorted POST params. */
export function twilioSignature(token: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", token).update(data, "utf8").digest("base64");
}

export function validSignature(token: string, signature: string, urls: string[], params: Record<string, string>): boolean {
  if (!signature) return false;
  const given = Buffer.from(signature);
  return urls.some((url) => {
    const expected = Buffer.from(twilioSignature(token, url, params));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

const OPT_IN = new Set(["YES", "START", "UNSTOP", "Y"]);
const OPT_OUT = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"]);

/** What a reply means: "in", "out", or null for anything else. */
export function keywordOf(body: string): "in" | "out" | null {
  const word = body.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (OPT_IN.has(word)) return "in";
  if (OPT_OUT.has(word)) return "out";
  return null;
}
