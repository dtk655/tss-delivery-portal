"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CommandPalette } from "@/components/command-palette";
import { NAV_LINKS } from "@/lib/nav";

type PaletteView = "commands" | "keys";

type Shell = {
  paletteOpen: boolean;
  paletteView: PaletteView;
  openPalette: (view?: PaletteView) => void;
  closePalette: () => void;
  toggleRail: () => void;
  /** Navigate with the load bar showing. */
  go: (href: string) => void;
  startProgress: () => void;
};

const ShellContext = createContext<Shell | null>(null);

export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell must be used inside <ShellProvider>");
  return shell;
}

export function toggleRailState(): void {
  const root = document.documentElement;
  const collapsed = root.dataset.rail !== "collapsed";
  if (collapsed) root.dataset.rail = "collapsed";
  else delete root.dataset.rail;
  try {
    localStorage.setItem("tss-rail", collapsed ? "collapsed" : "open");
  } catch {
    // Private windows can refuse storage; the toggle still works for this visit.
  }
  window.dispatchEvent(new Event("tss-rail"));
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Routes that answer with a file, not a page. The load bar would never finish on them. */
function isFileRoute(path: string): boolean {
  return /\/(pdf|export|preview)(\/|$)/.test(path) || path.startsWith("/api/");
}

/* ---------- Barricade load bar ---------- */

type Phase = "idle" | "start" | "loading" | "done";

function ProgressBar({ phase }: { phase: Phase }) {
  if (phase === "idle") return null;
  const scale = phase === "start" ? 0.06 : phase === "loading" ? 0.86 : 1;
  const transition =
    phase === "start"
      ? "none"
      : phase === "loading"
        ? "transform 2.6s cubic-bezier(0.1, 0.6, 0.2, 1)"
        : "transform 180ms ease-out, opacity 260ms ease 160ms";
  return (
    <div
      aria-hidden
      className="nav-progress no-print"
      style={{ transform: `scaleX(${scale})`, transition, opacity: phase === "done" ? 0 : 1 }}
    />
  );
}

function RouteWatcher({ onChange }: { onChange: (key: string) => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = `${pathname}?${params.toString()}`;
  useEffect(() => onChange(key), [key, onChange]);
  return null;
}

/* ---------- Provider ---------- */

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteView, setPaletteView] = useState<PaletteView>("commands");
  const [phase, setPhase] = useState<Phase>("idle");
  const routeKey = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  const finishProgress = useCallback(() => {
    clearTimers();
    setPhase((current) => (current === "idle" ? "idle" : "done"));
    timers.current.push(window.setTimeout(() => setPhase("idle"), 480));
  }, []);

  const startProgress = useCallback(() => {
    clearTimers();
    setPhase("start");
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase("loading")));
    // Never leave the bar hanging if a navigation is abandoned.
    timers.current.push(window.setTimeout(finishProgress, 12000));
  }, [finishProgress]);

  const onRouteChange = useCallback(
    (key: string) => {
      if (routeKey.current !== null && routeKey.current !== key) finishProgress();
      routeKey.current = key;
    },
    [finishProgress],
  );

  const go = useCallback(
    (href: string) => {
      const here = `${window.location.pathname}${window.location.search}`;
      if (href !== here && !isFileRoute(href.split("?")[0])) startProgress();
      router.push(href);
    },
    [router, startProgress],
  );

  const openPalette = useCallback((view: PaletteView = "commands") => {
    setPaletteView(view);
    setPaletteOpen(true);
  }, []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Start the load bar for ordinary link clicks and GET filter forms.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || isFileRoute(url.pathname)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      startProgress();
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || event.defaultPrevented) return;
      const method = (form.getAttribute("method") ?? "get").toLowerCase();
      const action = form.getAttribute("action") ?? "";
      if (method !== "get" || typeof form.action !== "string") return;
      const target = new URL(action ? form.action : window.location.href, window.location.href);
      if (isFileRoute(target.pathname)) return;
      const query = new URLSearchParams();
      for (const [name, field] of new FormData(form, event.submitter)) {
        if (typeof field === "string") query.append(name, field);
      }
      const next = `${target.pathname}?${query.toString()}`;
      const here = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
      if (next === here) return;
      startProgress();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [startProgress]);

  // Keyboard: ⌘K / Ctrl+K, "/", "?", "[", and G-then-letter page jumps.
  useEffect(() => {
    let leader = 0;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteView("commands");
        setPaletteOpen((open) => !open);
        return;
      }
      if (paletteOpen || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      const key = event.key;
      if (leader && Date.now() - leader < 1200) {
        leader = 0;
        const link = NAV_LINKS.find((item) => item.key === key.toLowerCase());
        if (link) {
          event.preventDefault();
          go(link.href);
        }
        return;
      }
      if (key === "/") {
        event.preventDefault();
        openPalette("commands");
      } else if (key === "?") {
        event.preventDefault();
        openPalette("keys");
      } else if (key === "[") {
        event.preventDefault();
        toggleRailState();
      } else if (key === "g" || key === "G") {
        leader = Date.now();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, go, openPalette]);

  const value = useMemo<Shell>(
    () => ({
      paletteOpen,
      paletteView,
      openPalette,
      closePalette,
      toggleRail: toggleRailState,
      go,
      startProgress,
    }),
    [paletteOpen, paletteView, openPalette, closePalette, go, startProgress],
  );

  return (
    <ShellContext.Provider value={value}>
      <Suspense fallback={null}>
        <RouteWatcher onChange={onRouteChange} />
      </Suspense>
      <ProgressBar phase={phase} />
      {children}
      {paletteOpen ? <CommandPalette /> : null}
    </ShellContext.Provider>
  );
}
