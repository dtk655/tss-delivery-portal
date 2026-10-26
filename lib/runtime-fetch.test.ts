import assert from "node:assert/strict";
import test from "node:test";
import { runtimeFetch } from "./runtime-fetch.ts";

type Patched = typeof fetch & { _nextOriginalFetch?: typeof fetch };

test("runtimeFetch uses the original fetch and marks the call internal", async () => {
  const original = globalThis.fetch;
  let patchedCalls = 0;
  let seen: RequestInit | undefined;
  const patched = (async () => {
    patchedCalls += 1;
    return new Response("patched", { status: 500 });
  }) as Patched;
  patched._nextOriginalFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    seen = init;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  globalThis.fetch = patched;
  try {
    const response = await runtimeFetch("https://example.test/orders.json", { method: "get", headers: { authorization: "Bearer secret" } });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
    assert.equal(patchedCalls, 0);
    assert.equal(seen?.cache, "no-store");
    assert.equal((seen as { next?: { internal?: boolean } } | undefined)?.next?.internal, true);
    assert.equal(new Headers(seen?.headers).get("authorization"), "Bearer secret");
    assert.equal(seen?.method, "get");
  } finally {
    globalThis.fetch = original;
  }
});

test("runtimeFetch asks the patched fetch to skip the data cache when no original exists", async () => {
  const original = globalThis.fetch;
  let seen: RequestInit | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    seen = init;
    const internal = (init as { next?: { internal?: boolean } } | undefined)?.next?.internal;
    if (!internal) return new Promise(() => {});
    return new Response("fresh", { status: 200 });
  }) as typeof fetch;
  try {
    const response = await runtimeFetch("https://example.test/blob");
    assert.equal(await response.text(), "fresh");
    assert.equal(seen?.cache, "no-store");
  } finally {
    globalThis.fetch = original;
  }
});

test("an aborted read becomes 408 so the blob client does not retry for half a minute", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const error = new DOMException("The operation was aborted", "TimeoutError");
      if (init?.signal?.aborted) reject(error);
      else init?.signal?.addEventListener("abort", () => reject(error), { once: true });
    });
  }) as typeof fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30);
  try {
    const started = Date.now();
    const response = await runtimeFetch("https://example.test/slow", { signal: controller.signal });
    assert.equal(response.status, 408);
    assert.ok(Date.now() - started < 2_000);
  } finally {
    clearTimeout(timer);
    globalThis.fetch = original;
  }
});
