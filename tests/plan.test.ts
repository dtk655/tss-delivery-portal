import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { handlePlan } from '../src/server/plan-handler';
import { fetchReadyLines } from '../src/lib/suiteql';
import type { NsCreds } from '../src/lib/suiteql';

const CRED_KEYS = [
  'NETSUITE_ACCOUNT_ID',
  'NETSUITE_CONSUMER_KEY',
  'NETSUITE_CONSUMER_SECRET',
  'NETSUITE_TOKEN_ID',
  'NETSUITE_TOKEN_SECRET',
  'DISPATCH_PASSWORD',
] as const;

const previous: Record<string, string | undefined> = {};

function saveEnv() {
  for (const key of CRED_KEYS) previous[key] = process.env[key];
}

function restoreEnv() {
  for (const key of CRED_KEYS) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}

function clearCreds() {
  for (const key of CRED_KEYS) delete process.env[key];
}

describe('plan handler', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('serves the October 23 sample without credentials', async () => {
    saveEnv();
    clearCreds();
    const response = await handlePlan(new Request('http://localhost/api/plan'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe('fixture');
    expect(body.date).toBe('2026-10-23');
    const juan = body.routes.find((route: { id: string }) => route.id === 'juan_pickup');
    const babylon = body.routes.find((route: { id: string }) => route.id === 'box_511_plus_babylon');
    const short = body.routes.find((route: { id: string }) => route.id === 'box_511');
    const island = body.routes.find((route: { id: string }) => route.id === 'long_island_run_option');
    expect(juan.totalMi).toBe(86.3);
    expect(juan.backAt).toBe('11:22 AM');
    expect(juan.stops.find((stop: { code?: string }) => stop.code === 'PANYNJ').sos).toEqual([
      'SO9127',
      'SO9236',
      'SO9237',
      'SO9238',
    ]);
    expect(babylon.totalMi).toBe(146.5);
    expect(short.totalMi).toBe(34.9);
    expect(island.totalMi).toBe(278.6);
    expect(juan.mapsUrl).toContain('google.com/maps');
    expect(body.credentialsConfigured).toBe(false);
  });

  it('locks the payload when a shared password is set', async () => {
    saveEnv();
    clearCreds();
    process.env.DISPATCH_PASSWORD = 'yard-gate';
    const denied = await handlePlan(new Request('http://localhost/api/plan'));
    expect(denied.status).toBe(401);
    const opened = await handlePlan(
      new Request('http://localhost/api/plan', { headers: { 'x-dispatch-password': 'yard-gate' } }),
    );
    expect(opened.status).toBe(200);
    const body = await opened.json();
    expect(body.gated).toBe(true);
  });

  it('asks for NetSuite variables instead of calling out', async () => {
    saveEnv();
    clearCreds();
    const response = await handlePlan(new Request('http://localhost/api/plan?source=netsuite'));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain('NETSUITE_ACCOUNT_ID');
  });
});

describe('fetchReadyLines', () => {
  it('posts a read-only SuiteQL query and retries a rejected column', async () => {
    const calls: Array<{ url: string; method: string; prefer: string | null; body: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        prefer: new Headers(init?.headers).get('Prefer'),
        body: String(init?.body ?? ''),
      });
      if (calls.length === 1) {
        return new Response('{"o:errorDetails":[{"detail":"Unknown identifier kitcomponent"}]}', { status: 400 });
      }
      return new Response(
        JSON.stringify({
          hasMore: false,
          items: [
            {
              so: 'SO1',
              shipmethod: '517',
              customer: '100 Acme',
              ifnum: 'IF1',
              ifdate: '10/26/2026',
              item: 'SIGN24X18',
              itemtype: 'InvtPart',
              quantity: '-3',
              loc: 'Hadley',
              addr1: '1 Main St',
              city: 'Newark',
              state: 'NJ',
              zip: '07102',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };
    const creds: NsCreds = {
      account: '9787422',
      consumerKey: 'ck',
      consumerSecret: 'cs',
      tokenId: 'tk',
      tokenSecret: 'ts',
    };
    const result = await fetchReadyLines(creds, fetchImpl);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.prefer).toBe('transient');
    expect(calls[0]?.url).toContain('/services/rest/query/v1/suiteql?limit=1000&offset=0');
    expect(calls[0]?.body).toContain('shipmethod = 517');
    expect(calls[0]?.body).not.toMatch(/insert|update|delete/i);
    expect(result.rows[0]?.quantity).toBe(-3);
    expect(result.truncated).toBe(false);
  });
});

describe('repo hygiene', () => {
  it('keeps .env.example to empty NetSuite variables', () => {
    const text = readFileSync('.env.example', 'utf8');
    const keys = [...text.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]);
    expect(keys).toEqual([
      'NETSUITE_ACCOUNT_ID',
      'NETSUITE_CONSUMER_KEY',
      'NETSUITE_CONSUMER_SECRET',
      'NETSUITE_TOKEN_ID',
      'NETSUITE_TOKEN_SECRET',
    ]);
    for (const key of keys) {
      expect(text.split('\n').some((line) => line === `${key}=`)).toBe(true);
    }
  });

  it('keeps credentials out of the browser bundle sources', () => {
    const files = [
      'src/components/DispatchApp.tsx',
      'src/components/RouteColumn.tsx',
      'src/components/EmailPanel.tsx',
      'src/lib/email.ts',
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('NETSUITE_');
      expect(source).not.toContain('CONSUMER_SECRET');
    }
  });
});
