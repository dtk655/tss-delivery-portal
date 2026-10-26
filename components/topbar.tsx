"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Keyboard, Search } from "lucide-react";
import { useShell } from "@/components/shell";
import { sectionFor, subpageFor } from "@/lib/nav";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    // Tick on the minute so the time never lags behind the wall clock.
    let interval = 0;
    const timeout = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);
  return now;
}

function Clock() {
  const now = useClock();
  if (!now) return <div className="hidden h-9 w-[5.5rem] lg:block" aria-hidden />;
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);
  return (
    <div className="hidden text-right leading-tight lg:block" title="Time in New York">
      <div className="figure text-[1.05rem] font-bold text-stone-950">{time}</div>
      <div className="text-xs text-stone-500">{day}</div>
    </div>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { openPalette } = useShell();
  const section = sectionFor(pathname);
  const subpage = subpageFor(pathname);
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod("⌘");
  }, []);

  const Icon = section?.icon;

  return (
    <header className="topbar no-print sticky top-0 z-30 hidden items-center gap-4 border-b border-stone-200 px-6 md:flex lg:px-10">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-600">
            <Icon className="size-4" />
          </span>
        ) : null}
        {section && subpage ? (
          <>
            <Link href={section.href} className="truncate text-sm font-medium text-stone-500 hover:text-stone-950">
              {section.label}
            </Link>
            <ChevronRight className="size-4 shrink-0 text-stone-400" />
            <span className="font-display truncate text-[1.05rem] font-bold text-stone-950">{subpage}</span>
          </>
        ) : (
          <span className="font-display truncate text-[1.05rem] font-bold text-stone-950">{section?.label ?? "Deliveries"}</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => openPalette()}
        className="group ml-auto flex h-9 w-full max-w-[22rem] items-center gap-2.5 rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-500 hover:border-stone-300 hover:bg-white"
      >
        <Search className="size-4 shrink-0 text-stone-400 group-hover:text-stone-600" />
        <span className="truncate">Search pages, orders, customers…</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <kbd>{mod}</kbd>
          <kbd>K</kbd>
        </span>
      </button>

      <button
        type="button"
        onClick={() => openPalette("keys")}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      >
        <Keyboard className="size-[1.1rem]" />
      </button>

      <div className="hidden h-7 w-px shrink-0 bg-stone-200 lg:block" aria-hidden />
      <Clock />
    </header>
  );
}
