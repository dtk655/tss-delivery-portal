import type { FulfillmentLine, StopDraft } from './types';
import {
  addressKey,
  collapseSpace,
  customerName,
  deliverByNote,
  displayQuantity,
  formatNsDate,
  formatQty,
  titleCaseCity,
} from './format';

const SKIP_ITEM_TYPES = new Set([
  'ShipItem',
  'Discount',
  'Subtotal',
  'Description',
  'Payment',
  'TaxItem',
  'TaxGroup',
  'Markup',
]);

const HEAVY_ITEM = [/crashgard/i, /graco/i, /barrier/i, /barricade/i, /attenuator/i, /crash ?cushion/i];

export function isHeavyItem(item: string): boolean {
  return HEAVY_ITEM.some((pattern) => pattern.test(item));
}

export function stopIsHeavy(items: string[]): boolean {
  return items.some((item) => isHeavyItem(item));
}

export function shipsFromHollywood(shipFrom: string[]): boolean {
  return shipFrom.some((loc) => /hollywood|\b448\b/i.test(loc));
}

function truthyFlag(value: string): boolean {
  const flag = value.trim().toLowerCase();
  return flag === 't' || flag === 'true' || flag === 'yes' || flag === '1';
}

export function shouldKeepLine(line: FulfillmentLine): boolean {
  if (!line.so || !line.item.trim()) return false;
  if (line.shipmethod && line.shipmethod !== '517') return false;
  if (SKIP_ITEM_TYPES.has(line.itemtype)) return false;
  if (truthyFlag(line.kitcomponent)) return false;
  if (displayQuantity(line.quantity) <= 0) return false;
  return true;
}

function place(line: FulfillmentLine): { town: string; address: string; mapsAddress: string } {
  const city = titleCaseCity(line.city || '');
  const state = (line.state || '').trim().toUpperCase();
  const zip = (line.zip || '').trim();
  const town = [city, state].filter(Boolean).join(', ');
  const streetBits = [line.addressee, line.addr1, line.addr2].map((part) => collapseSpace(part || '')).filter(Boolean);
  const region = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const address = collapseSpace([...streetBits, region].filter(Boolean).join(', '));
  const mapsAddress = collapseSpace(
    [line.addr1, city && state ? `${city}, ${state} ${zip}`.trim() : town].filter(Boolean).join(', '),
  );
  return { town, address, mapsAddress };
}

function slug(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base || 'stop';
}

export function groupLines(lines: FulfillmentLine[]): StopDraft[] {
  const kept = lines.filter(shouldKeepLine);
  const sorted = [...kept].sort((a, b) => a.so.localeCompare(b.so) || a.ifnum.localeCompare(b.ifnum) || a.item.localeCompare(b.item));
  const used = new Set<string>();
  const order: string[] = [];
  const byKey = new Map<string, StopDraft>();

  for (const line of sorted) {
    const missing = !line.addr1.trim();
    const key = missing ? `missing|${line.so}|${line.ifnum}` : addressKey(line.addr1, line.zip);
    let stop = byKey.get(key);
    if (!stop) {
      const { town, address, mapsAddress } = place(line);
      let id = `stop-${slug(key)}`;
      while (used.has(id)) id = `${id}-2`;
      used.add(id);
      stop = {
        id,
        customers: [],
        sos: [],
        fulfillments: [],
        items: [],
        address: address || 'Address missing on the sales order',
        mapsAddress: mapsAddress || address,
        town: town || 'Town missing',
        shipFrom: [],
        memo: [],
        notes: [],
        packed: [],
        lat: null,
        lon: null,
      };
      byKey.set(key, stop);
      order.push(key);
    }
    const name = customerName(line.customer);
    if (name && !stop.customers.includes(name)) stop.customers.push(name);
    if (!stop.sos.includes(line.so)) stop.sos.push(line.so);
    const fulfillment = `${line.ifnum} (packed ${formatNsDate(line.ifdate)})`;
    if (line.ifnum && !stop.fulfillments.includes(fulfillment)) stop.fulfillments.push(fulfillment);
    const qty = displayQuantity(line.quantity);
    stop.items.push(`[${line.so}] ${line.item.trim()} x${formatQty(qty)}`);
    if (line.loc.trim() && !stop.shipFrom.includes(line.loc.trim())) stop.shipFrom.push(line.loc.trim());
    if (line.memo.trim()) {
      const memo = `${line.so}: ${collapseSpace(line.memo)}`;
      if (!stop.memo.includes(memo)) stop.memo.push(memo);
    }
    if (line.attention.trim()) {
      const phone = line.addrphone.trim();
      const note = `Attn ${collapseSpace(line.attention)}${phone ? ` ${phone}` : ''}`;
      if (!stop.notes.includes(note)) stop.notes.push(note);
    }
    if (!stop.packed.some((packed) => packed.ifnum === line.ifnum && packed.so === line.so)) {
      stop.packed.push({ so: line.so, ifnum: line.ifnum, packedOn: line.ifdate });
    }
  }

  return order.map((key) => {
    const stop = byKey.get(key)!;
    stop.customers.sort((a, b) => a.localeCompare(b));
    stop.shipFrom.sort((a, b) => a.localeCompare(b));
    stop.notes.sort((a, b) => a.localeCompare(b));
    return stop;
  });
}

export function deliverByOf(stop: StopDraft): string | null {
  return deliverByNote(stop.address);
}
