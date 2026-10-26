"use client";

import { useEffect, useState } from "react";
import { afterSplash } from "@/components/splash";

/**
 * Counts a formatted figure up from zero when it first appears, keeping its prefix, suffix,
 * thousands separators and decimals ("$713.5K", "1,437", "~$42K").
 * The server renders the final value, so print and no-JS views are exact.
 */
export function CountUp({ value, duration = 900 }: { value: string; duration?: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const match = value.match(/^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/);
    if (!match || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const [, prefix, digits, suffix] = match;
    const target = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) return;
    const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
    const grouped = digits.includes(",");
    const format = (n: number) =>
      n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: grouped,
      });

    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(`${prefix}${format(target * eased)}${suffix}`);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setShown(value);
    };
    setShown(`${prefix}${format(0)}${suffix}`);
    const stop = afterSplash(() => {
      frame = requestAnimationFrame(tick);
    });
    return () => {
      stop();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span aria-label={value}>
      <span aria-hidden>{shown}</span>
    </span>
  );
}
