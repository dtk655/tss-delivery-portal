import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

function loadDotEnv() {
  if (!existsSync('.env')) return;
  const text = readFileSync('.env', 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const raw = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eq = raw.indexOf('=');
    if (eq === -1) continue;
    const key = raw.slice(0, eq).trim();
    let value = raw.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

function planDevPlugin() {
  const handlerPath = fileURLToPath(new URL('./src/server/plan-handler.ts', import.meta.url));
  return {
    name: 'tss-plan-dev',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const raw = req.originalUrl || req.url || '';
        const path = raw.split('?')[0];
        if (path !== '/api/plan' && path !== '/api/plan/') return next();
        try {
          const mod = await server.ssrLoadModule(handlerPath);
          const host = req.headers.host || 'localhost';
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
            else if (Array.isArray(value)) headers.set(key, value.join(', '));
          }
          const request = new Request(new URL(raw, `http://${host}`), {
            method: req.method,
            headers,
          });
          const response = await mod.handlePlan(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'content-encoding') res.setHeader(key, value);
          });
          const bytes = Buffer.from(await response.arrayBuffer());
          res.end(bytes);
        } catch (error) {
          console.error(error);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'The local plan route failed.' }));
        }
      });
    },
  };
}

export default defineConfig({
  output: 'static',
  integrations: [react()],
  server: { port: 4321, host: true },
  vite: {
    plugins: [planDevPlugin()],
  },
});
