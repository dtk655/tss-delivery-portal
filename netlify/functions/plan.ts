import type { Config, Context } from '@netlify/functions';
import { handlePlan } from '../../src/server/plan-handler';

/**
 * Read-only dispatch board.
 * GET /api/plan            → sample plan, or NetSuite when TBA env vars are set
 * GET /api/plan?source=fixture
 * GET /api/plan?source=netsuite
 * Optional header: x-dispatch-password
 * This function only runs SuiteQL SELECT queries. It never writes to NetSuite.
 */
export default async function handler(request: Request, _context: Context): Promise<Response> {
  return handlePlan(request);
}

export const config: Config = {
  path: '/api/plan',
  method: 'GET',
};
