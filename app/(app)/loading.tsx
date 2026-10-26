/** Shown the moment a tab is clicked, while the server builds the page. */
export default function Loading() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-9 w-56 animate-pulse rounded-lg bg-stone-200" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-stone-200" />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="h-5 w-2/3 animate-pulse rounded bg-stone-200" />
            <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-stone-100" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
