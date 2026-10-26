export const TZ = "America/New_York";

/** Today's date in New York, yyyy-mm-dd. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Next working day (skips Sat/Sun). */
export function nextWorkday(iso: string): string {
  let next = addDays(iso, 1);
  while ([0, 6].includes(parseISO(next).getUTCDay())) next = addDays(next, 1);
  return next;
}

export function isISODate(value: string | undefined | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(parseISO(iso));

export const formatLong = (iso: string) => fmt(iso, { weekday: "long", month: "long", day: "numeric" });
export const formatShort = (iso: string) => fmt(iso, { weekday: "short", month: "short", day: "numeric" });
export const formatMonthDay = (iso: string) => fmt(iso, { month: "short", day: "numeric" });
export const formatWeekdayShort = (iso: string) => fmt(iso, { weekday: "short" });

/** "13:05" -> "1:05 PM". */
export function clock12(hhmm: string): string {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** ISO timestamp -> "1:05 PM" in New York. */
export function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** ISO timestamp -> "Oct 26, 1:05 PM" in New York. */
export function stampOf(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "4 min ago", "2 hr ago", "yesterday". */
export function ago(iso: string, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** yyyy-mm-dd + "HH:MM" in New York -> ISO instant. Handles EDT/EST. */
export function nyInstant(date: string, hhmm: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h + 4, mi);
  const shown = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date(guess));
  const offset = Number(shown) - h;
  return new Date(guess - offset * 3_600_000).toISOString();
}

/** Minutes past midnight in New York right now. */
export function nyMinutesNow(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const hhmmOf = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** "06:00-07:30" -> "6:00–7:30 AM"; "11:00-13:00" -> "11:00 AM–1:00 PM". */
export function windowLabel(window: string): string {
  const [a, b] = window.split("-");
  if (!a || !b) return window;
  const left = clock12(a);
  const right = clock12(b);
  return left.slice(-2) === right.slice(-2) ? `${left.slice(0, -3)}–${right}` : `${left}–${right}`;
}
