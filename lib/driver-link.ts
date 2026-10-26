import { createHmac, timingSafeEqual } from "crypto";

/** Each driver gets a fixed private link: /d/<driverId>.<signature>. No password to remember on a phone. */
function secret(): string {
  return process.env.AUTH_SECRET ?? "local-dev-only-change-before-deploy";
}

function sign(driverId: string): string {
  return createHmac("sha256", `${secret()}:driver`).update(driverId).digest("base64url").slice(0, 16);
}

export function driverToken(driverId: string): string {
  return `${driverId}.${sign(driverId)}`;
}

export function driverFromToken(token: string): string | null {
  const [id, sig] = decodeURIComponent(token).split(".");
  if (!id || !sig) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}
