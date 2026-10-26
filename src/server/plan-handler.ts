import { READY_RULE } from '../lib/constants';
import { fixtureBoard } from '../lib/fixture';
import { groupLines } from '../lib/group';
import { passwordMatches } from '../lib/password';
import { buildBoardFromStops, withCoordinates } from '../lib/routing';
import { credsFromEnv, fetchReadyLines, missingCredNames, NsError } from '../lib/suiteql';
import { todayIso } from '../lib/format';
import type { DispatchBoard, PlanError } from '../lib/types';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function json(body: DispatchBoard | PlanError, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

function redact(text: string): string {
  const secrets = [
    process.env.NETSUITE_CONSUMER_KEY,
    process.env.NETSUITE_CONSUMER_SECRET,
    process.env.NETSUITE_TOKEN_ID,
    process.env.NETSUITE_TOKEN_SECRET,
    process.env.DISPATCH_PASSWORD,
  ].filter((value): value is string => Boolean(value && value.length > 3));
  let out = text;
  for (const secret of secrets) out = out.split(secret).join('[redacted]');
  return out;
}

function gateOn(): boolean {
  return Boolean(process.env.DISPATCH_PASSWORD?.trim());
}

async function liveBoard(fetchImpl: typeof fetch): Promise<DispatchBoard> {
  const creds = credsFromEnv();
  if (!creds) {
    const missing = missingCredNames().join(', ');
    throw new ConfigError(
      `NetSuite is not configured. Set ${missing} in the Netlify site environment (or a local .env), then refresh. The sample board does not need them.`,
    );
  }
  const { rows, truncated } = await fetchReadyLines(creds, fetchImpl);
  const grouped = groupLines(rows);
  const located = await withCoordinates(grouped, fetchImpl);
  const warnings = [...located.warnings];
  if (truncated) warnings.push('Stopped after 5,000 SuiteQL rows. Tell dispatch if the board looks short.');
  const board = await buildBoardFromStops(located.stops, {
    date: todayIso(),
    warnings,
    distance: 'auto',
    fetchImpl,
    credentialsConfigured: true,
    gated: gateOn(),
    generatedAt: new Date().toISOString(),
  });
  board.rule = READY_RULE;
  return board;
}

export async function loadBoard(source: string | null, fetchImpl: typeof fetch = fetch): Promise<DispatchBoard> {
  const configured = credsFromEnv() != null;
  const mode = source === 'fixture' || source === 'netsuite' ? source : 'auto';
  if (mode === 'fixture' || (mode === 'auto' && !configured)) {
    return fixtureBoard({ credentialsConfigured: configured, gated: gateOn() });
  }
  return liveBoard(fetchImpl);
}

export async function handlePlan(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);
  const expected = process.env.DISPATCH_PASSWORD?.trim();
  if (expected && !passwordMatches(expected, request.headers.get('x-dispatch-password'))) {
    return json({ error: 'Password required.', gate: true }, 401);
  }
  const source = new URL(request.url).searchParams.get('source');
  try {
    const board = await loadBoard(source, fetchImpl);
    return json(board, 200);
  } catch (error) {
    const status = error instanceof ConfigError ? 503 : 502;
    const message = error instanceof Error ? error.message : 'The board could not be built.';
    if (!(error instanceof ConfigError) && !(error instanceof NsError)) {
      console.error('[plan] board failed');
    }
    return json({ error: redact(message) }, status);
  }
}
