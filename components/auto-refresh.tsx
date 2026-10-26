"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps a page current without a reload: re-fetches the server data every
 * `seconds` while the tab is visible, and right away when you come back to it.
 */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      last = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, seconds * 1000);
    const onFocus = () => {
      if (Date.now() - last > 10_000) refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, seconds]);
  return null;
}
