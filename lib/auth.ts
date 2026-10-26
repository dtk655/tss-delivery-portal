import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "tss_session";
const HOURS = 14;

export function hostedAuthError(): string | null {
  if (process.env.NETLIFY !== "true") return null;
  const missing = ["APP_PASSWORD", "AUTH_SECRET"].filter((name) => !process.env[name]);
  if (missing.length === 0) return null;
  return `Set ${missing.join(" and ")} in the Netlify site environment before anyone can sign in.`;
}

export function appPassword(): string {
  if (process.env.APP_PASSWORD) return process.env.APP_PASSWORD;
  if (process.env.NETLIFY === "true") return "";
  return "tss-director";
}

function authSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NETLIFY === "true") return "";
  return "local-dev-only-change-before-deploy";
}

function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function passwordMatches(password: string): boolean {
  return safeEqual(password, appPassword());
}

function sign(body: string): string {
  return createHmac("sha256", authSecret()).update(body).digest("base64url");
}

export async function setSession(): Promise<void> {
  const exp = Date.now() + HOURS * 60 * 60 * 1000;
  const body = `v1.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HOURS * 60 * 60,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAuthed(): Promise<boolean> {
  if (hostedAuthError()) return false;
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const body = `v1.${parts[1]}`;
  const expected = sign(body);
  const given = parts[2];
  const left = Buffer.from(expected);
  const right = Buffer.from(given);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const exp = Number(parts[1]);
  return Number.isFinite(exp) && exp > Date.now();
}
