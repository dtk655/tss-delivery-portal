"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Shown when a page could not load its data (usually a slow first read right
 * after the server woke up). It retries once by itself, then offers a button.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const auto = useRef(false);

  const retry = () => {
    setTries((n) => n + 1);
    router.refresh();
    reset();
  };

  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    const timer = window.setTimeout(retry, 2500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const known = error.name === "DataError";
  return (
    <main className="min-h-screen bg-canvas px-4 py-10 text-stone-900">
      <h1 className="text-lg font-semibold text-stone-900">Still loading the latest data…</h1>
      <p className="mt-2 max-w-xl text-sm text-stone-700">
        {known && error.message
          ? error.message
          : "The server took too long to read the delivery data. Trying again."}
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-4 inline-flex h-9 items-center rounded-lg bg-asphalt px-4 text-sm font-semibold text-white hover:bg-asphalt-3"
      >
        Try again{tries > 0 ? ` (${tries})` : ""}
      </button>
    </main>
  );
}
