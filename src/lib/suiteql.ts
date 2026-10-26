import { createOAuthHeader, freshOAuthMaterial } from './oauth';
import type { FulfillmentLine } from './types';

const SKIP_TYPES = `('ShipItem','Discount','Subtotal','Description','Payment','TaxItem','TaxGroup','Markup')`;

export class NsError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'NsError';
    this.retryable = retryable;
  }
}

export interface NsCreds {
  account: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
}

export function credsFromEnv(env: NodeJS.ProcessEnv = process.env): NsCreds | null {
  const account = env.NETSUITE_ACCOUNT_ID?.trim();
  const consumerKey = env.NETSUITE_CONSUMER_KEY?.trim();
  const consumerSecret = env.NETSUITE_CONSUMER_SECRET?.trim();
  const tokenId = env.NETSUITE_TOKEN_ID?.trim();
  const tokenSecret = env.NETSUITE_TOKEN_SECRET?.trim();
  if (!account || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) return null;
  return { account, consumerKey, consumerSecret, tokenId, tokenSecret };
}

export function missingCredNames(env: NodeJS.ProcessEnv = process.env): string[] {
  return [
    'NETSUITE_ACCOUNT_ID',
    'NETSUITE_CONSUMER_KEY',
    'NETSUITE_CONSUMER_SECRET',
    'NETSUITE_TOKEN_ID',
    'NETSUITE_TOKEN_SECRET',
  ].filter((name) => !env[name]?.trim());
}

/** SELECT/WITH only. The portal never posts a NetSuite write. */
export function assertReadOnlySql(sql: string): void {
  const trimmed = sql.trim();
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new NsError('Read-only: SuiteQL must be a SELECT.');
  }
  if (trimmed.includes(';') || trimmed.includes('--') || trimmed.includes('/*')) {
    throw new NsError('Read-only: SQL comments and extra statements are not allowed.');
  }
  if (/\b(insert|update|delete|merge|drop|alter|create|grant|revoke|call)\b/i.test(trimmed)) {
    throw new NsError('Read-only: write statements are not allowed.');
  }
}

export function netsuiteQueryUrl(account: string, limit: number, offset: number): string {
  const host = account.trim().toLowerCase().replace(/_/g, '-');
  return `https://${host}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${limit}&offset=${offset}`;
}

export function assertSuiteQlUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new NsError('SuiteQL URL must be https.');
  if (!parsed.hostname.endsWith('.suitetalk.api.netsuite.com')) {
    throw new NsError('Refusing a non-NetSuite host.');
  }
  if (parsed.pathname !== '/services/rest/query/v1/suiteql') {
    throw new NsError('Refusing a NetSuite URL that is not SuiteQL.');
  }
}

export function readySql(strict: boolean): string {
  const extra = strict
    ? `AND NVL(line.kitcomponent, 'F') = 'F'
  AND NVL(line.iscogs, 'F') = 'F'
  AND NVL(fulfillment.voided, 'F') = 'F'
  AND NVL(so.voided, 'F') = 'F'`
    : '';
  const kitSelect = strict ? 'line.kitcomponent AS kitcomponent,' : '';
  return `
SELECT
  so.tranid AS so,
  so.shipmethod AS shipmethod,
  so.status AS sostatus,
  BUILTIN.DF(so.entity) AS customer,
  so.memo AS memo,
  fulfillment.tranid AS ifnum,
  fulfillment.trandate AS ifdate,
  fulfillment.status AS ifstatus,
  COALESCE(item.itemid, BUILTIN.DF(line.item)) AS item,
  item.itemtype AS itemtype,
  ${kitSelect}
  line.quantity AS quantity,
  line.quantityshiprecv AS quantityshiprecv,
  BUILTIN.DF(line.location) AS loc,
  ship.addr1 AS addr1,
  ship.addr2 AS addr2,
  ship.addressee AS addressee,
  ship.attention AS attention,
  ship.addrphone AS addrphone,
  ship.city AS city,
  ship.state AS state,
  ship.zip AS zip
FROM transaction so
INNER JOIN transaction fulfillment
  ON fulfillment.createdfrom = so.id
 AND fulfillment.type = 'ItemShip'
INNER JOIN transactionline line
  ON line.transaction = fulfillment.id
 AND line.mainline = 'F'
 AND line.taxline = 'F'
 AND line.item IS NOT NULL
LEFT JOIN item ON item.id = line.item
LEFT JOIN transactionShippingAddress ship ON ship.nkey = so.shippingaddress
WHERE so.type = 'SalesOrd'
  AND so.shipmethod = 517
  AND fulfillment.status IN ('B', 'ItemShip:B')
  AND so.status NOT IN ('C', 'H', 'SalesOrd:C', 'SalesOrd:H')
  AND NVL(item.itemtype, 'InvtPart') NOT IN ${SKIP_TYPES}
  ${extra}
ORDER BY so.tranid, fulfillment.tranid
`.trim();
}

function redact(text: string, secrets: string[]): string {
  let out = text.slice(0, 400);
  for (const secret of secrets) {
    if (secret.length > 3) out = out.split(secret).join('[redacted]');
  }
  return out;
}

function lowerRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value == null) continue;
    out[key.toLowerCase()] = String(value);
  }
  return out;
}

function toNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toLine(row: Record<string, string>): FulfillmentLine {
  return {
    so: row.so ?? '',
    customer: row.customer ?? '',
    memo: row.memo ?? '',
    ifnum: row.ifnum ?? '',
    ifdate: row.ifdate ?? '',
    item: row.item ?? '',
    itemtype: row.itemtype ?? '',
    kitcomponent: row.kitcomponent ?? '',
    quantity: toNumber(row.quantity) ?? 0,
    quantityshiprecv: toNumber(row.quantityshiprecv),
    loc: row.loc ?? '',
    addr1: row.addr1 ?? '',
    addr2: row.addr2 ?? '',
    addressee: row.addressee ?? '',
    attention: row.attention ?? '',
    addrphone: row.addrphone ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    zip: row.zip ?? '',
    shipmethod: row.shipmethod ?? '',
  };
}

async function runQuery(
  sql: string,
  creds: NsCreds,
  fetchImpl: typeof fetch,
): Promise<{ rows: FulfillmentLine[]; truncated: boolean }> {
  assertReadOnlySql(sql);
  const page = 1000;
  const maxRows = 5000;
  const rows: FulfillmentLine[] = [];
  let offset = 0;
  const secrets = [creds.consumerKey, creds.consumerSecret, creds.tokenId, creds.tokenSecret];
  while (rows.length < maxRows) {
    const url = netsuiteQueryUrl(creds.account, page, offset);
    assertSuiteQlUrl(url);
    const material = freshOAuthMaterial();
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: createOAuthHeader({ ...creds, url, ...material }),
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Prefer: 'transient',
        },
        body: JSON.stringify({ q: sql }),
        signal: AbortSignal.timeout(12_000),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new NsError('NetSuite did not answer in time. Try the refresh again.');
      }
      throw new NsError('NetSuite could not be reached. Try the refresh again.');
    }
    const text = await response.text();
    if (!response.ok) {
      const detail = redact(text, secrets);
      const retryable = response.status === 400;
      if (response.status === 401 || response.status === 403) {
        throw new NsError(
          `NetSuite rejected the token (HTTP ${response.status}). Check the TBA consumer key, token, and that the role can log in with access tokens and run SuiteQL.`,
        );
      }
      throw new NsError(`NetSuite returned HTTP ${response.status}. ${detail}`.trim(), retryable);
    }
    let payload: { items?: Array<Record<string, unknown>>; hasMore?: boolean };
    try {
      payload = JSON.parse(text) as { items?: Array<Record<string, unknown>>; hasMore?: boolean };
    } catch {
      throw new NsError(`NetSuite returned HTTP ${response.status} with an unreadable body.`);
    }
    const items = payload.items ?? [];
    for (const item of items) {
      delete item.links;
      rows.push(toLine(lowerRow(item)));
      if (rows.length >= maxRows) break;
    }
    if (!payload.hasMore || items.length === 0 || rows.length >= maxRows) {
      return { rows, truncated: Boolean(payload.hasMore) || rows.length >= maxRows && items.length === page };
    }
    offset += page;
  }
  return { rows, truncated: true };
}

export async function fetchReadyLines(
  creds: NsCreds,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rows: FulfillmentLine[]; truncated: boolean }> {
  const queries = [readySql(true), readySql(false)];
  let last: NsError | null = null;
  for (let i = 0; i < queries.length; i += 1) {
    try {
      return await runQuery(queries[i]!, creds, fetchImpl);
    } catch (error) {
      if (error instanceof NsError && error.retryable && i < queries.length - 1) {
        last = error;
        continue;
      }
      throw error;
    }
  }
  throw last ?? new NsError('NetSuite query failed.');
}
