import { TIME_ZONE } from './constants';

const STREET_SUFFIX: Record<string, string> = {
  avenue: 'ave',
  ave: 'ave',
  street: 'st',
  st: 'st',
  road: 'rd',
  rd: 'rd',
  drive: 'dr',
  dr: 'dr',
  boulevard: 'blvd',
  blvd: 'blvd',
  lane: 'ln',
  ln: 'ln',
  court: 'ct',
  ct: 'ct',
  place: 'pl',
  pl: 'pl',
  highway: 'hwy',
  hwy: 'hwy',
  parkway: 'pkwy',
  pkwy: 'pkwy',
  terrace: 'ter',
  ter: 'ter',
  trail: 'trl',
  trl: 'trl',
  circle: 'cir',
  cir: 'cir',
};

const ADDRESS_STOP = new Set([
  'stockroom',
  'suite',
  'ste',
  'unit',
  'apt',
  'apartment',
  'bldg',
  'building',
  'floor',
  'fl',
  'garage',
  'room',
  'rm',
  'dept',
  'department',
]);

/** NetSuite entity display names often start with the internal number. */
export function customerName(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([A-Za-z]*\d[\w-]*)\s+(.+)$/);
  return match ? match[2].trim() : trimmed;
}

export function titleCaseCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function collapseSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Street-number + street name + ZIP. "777 Jersey Avenue" and
 * "777 Jersey Avenue Stockroom" share a key so they become one stop.
 */
export function addressKey(addr1: string, zip: string): string {
  const tokens = addr1
    .toLowerCase()
    .replace(/[#.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const kept: string[] = [];
  for (const token of tokens) {
    const clean = token.replace(/[^a-z0-9]/g, '');
    if (!clean) continue;
    if (ADDRESS_STOP.has(clean)) break;
    kept.push(STREET_SUFFIX[clean] ?? clean);
  }
  const zip5 = (zip || '').replace(/\D/g, '').slice(0, 5);
  return `${kept.join(' ')}|${zip5}`;
}

export function formatNsDate(raw: string): string {
  const value = raw.trim();
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${Number(iso[2])}/${Number(iso[3])}/${iso[1]}`;
  return value;
}

export function parseLooseDate(raw: string): Date | null {
  const value = raw.trim();
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return new Date(Date.UTC(Number(us[3]), Number(us[1]) - 1, Number(us[2])));
  return null;
}

/** Packed qty on an item fulfillment line. SuiteQL often returns it negative. */
export function displayQuantity(quantity: number): number {
  return Math.abs(quantity);
}

/**
 * Sales-order remaining: abs(quantity) − quantity already shipped.
 * The live query reads fulfillment lines, so the board uses displayQuantity.
 */
export function remainingQuantity(quantity: number, quantityShipRecv: number | null): number {
  const absQty = Math.abs(quantity);
  if (quantityShipRecv == null) return absQty;
  return Math.max(0, absQty - Math.abs(quantityShipRecv));
}

export function formatQty(quantity: number): string {
  if (!Number.isFinite(quantity)) return '0';
  const rounded = Math.round(Math.abs(quantity) * 1000) / 1000;
  return String(rounded);
}

export function deliverByNote(address: string): string | null {
  const cleaned = address.replace(/\*/g, '');
  const match = cleaned.match(/deliver before\s+([0-9]{1,2}(?::[0-9]{2})?\s*[ap]\.?m\.?)/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, '').toUpperCase();
}

export function nominalCrashgardLb(items: string[]): number {
  let total = 0;
  for (const item of items) {
    const weight = item.match(/CRASHGARDFILLED(\d+(?:\.\d+)?)/i);
    const qty = item.match(/\bx(\d+(?:\.\d+)?)\b/i);
    if (!weight || !qty) continue;
    total += Number(weight[1]) * Number(qty[1]);
  }
  return total;
}

export function stripMarkup(value: string): string {
  return collapseSpace(value.replace(/\*\*/g, ''));
}

export function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatBoardDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 16));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatClock(date: Date): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return formatted.replace(/\u202f|\u00a0/g, ' ').replace(/\s*(am|pm)$/i, (_, ap: string) => ` ${ap.toUpperCase()}`);
}

export function formatGeneratedAt(iso: string): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
  return formatted.replace(/\u202f|\u00a0/g, ' ');
}

export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Wall-clock time in America/New_York as a UTC Date. */
export function zonedDate(isoDate: string, hour: number, minute: number, timeZone = TIME_ZONE): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const desired = Date.UTC(year, (month ?? 1) - 1, day ?? 1, hour, minute, 0);
  let utc = desired;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(utc)).map((part) => [part.type, part.value]));
    const hourPart = Number(parts.hour) % 24;
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hourPart,
      Number(parts.minute),
      Number(parts.second),
    );
    utc += desired - asUtc;
  }
  return new Date(utc);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function milesLabel(value: number | null): string {
  if (value == null) return '—';
  return value.toFixed(1);
}

export function googleMapsUrl(addresses: string[]): string | null {
  const clean = addresses.map((address) => collapseSpace(address)).filter(Boolean);
  if (clean.length < 2) return null;
  const url = `https://www.google.com/maps/dir/${clean.map((address) => encodeURIComponent(address)).join('/')}`;
  return safeMapsUrl(url);
}

export function safeMapsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname !== 'www.google.com' && parsed.hostname !== 'maps.google.com') return null;
    if (!parsed.pathname.startsWith('/maps/')) return null;
    return url;
  } catch {
    return null;
  }
}
