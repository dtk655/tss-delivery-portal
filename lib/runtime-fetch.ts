/**
 * Fetch for Netlify Blobs and other live reads during a page render.
 *
 * Next.js replaces global fetch. In a server render that patched fetch can
 * postpone a GET until the function is killed (the loading shell is all Dylan
 * sees), and it can also cache a 404 for orders.json from before the upload.
 * Netlify's own blob client avoids both by calling the original fetch with
 * `next.internal`. Do that here, and give up after a few seconds so one stuck
 * read cannot hold the page open until the platform timeout.
 */

const TIMEOUT_MS = 8_000;

type PatchedFetch = typeof fetch & { _nextOriginalFetch?: typeof fetch };

type InitWithNext = RequestInit & { next?: Record<string, unknown> };

function isAbort(error: unknown): boolean {
  return (
    (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) ||
    (typeof DOMException !== "undefined" && error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"))
  );
}

export function runtimeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const patched = globalThis.fetch as PatchedFetch;
  const raw = typeof patched._nextOriginalFetch === "function" ? patched._nextOriginalFetch : patched;
  const prev = init as InitWithNext | undefined;
  const signals = [AbortSignal.timeout(TIMEOUT_MS), prev?.signal].filter((signal): signal is AbortSignal => Boolean(signal));
  const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
  return raw(input, {
    ...prev,
    cache: "no-store",
    signal,
    next: { ...prev?.next, internal: true },
  } as RequestInit).catch((error: unknown) => {
    // A thrown abort is retried for several seconds by @netlify/blobs. A 408 is not.
    if (isAbort(error)) return new Response(null, { status: 408, statusText: "Timed out" });
    throw error;
  });
}
