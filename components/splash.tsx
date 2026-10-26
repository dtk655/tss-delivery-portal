"use client";

import Image from "next/image";
import { useLayoutEffect } from "react";

const COOKIE = "tss_splash";
const MIN_MS = 1400;
const FADE_MS = 520;

/** Runs before first paint on a full page load: the sign-in left a one-time flag. */
export const SPLASH_SCRIPT = `try{if(/(?:^|; )${COOKIE}=1/.test(document.cookie))document.documentElement.dataset.splash="on"}catch(e){}`;

function hasFlag(): boolean {
  return new RegExp(`(?:^|; )${COOKIE}=1`).test(document.cookie);
}

/** Clear the flag right away so a refresh or another tab never replays it. */
function clearFlag(): void {
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function splashActive(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.splash !== undefined;
}

/** Calls `run` now, or as soon as the splash has finished. */
export function afterSplash(run: () => void): () => void {
  if (!splashActive()) {
    run();
    return () => {};
  }
  const handler = () => run();
  window.addEventListener("tss-splash-done", handler, { once: true });
  return () => window.removeEventListener("tss-splash-done", handler);
}

export function Splash() {
  // Layout effect: decides before the browser paints. Needed because sign-in
  // redirects without a full page load, so the inline script does not run.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.dataset.splash === undefined) {
      if (!hasFlag()) return;
      root.dataset.splash = "on";
    }
    if (root.dataset.splash !== "on") return;
    clearFlag();
    const started = performance.now();
    let timer = 0;
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      root.dataset.splash = "leaving";
      timer = window.setTimeout(() => {
        delete root.dataset.splash;
        window.dispatchEvent(new Event("tss-splash-done"));
      }, FADE_MS);
    };

    const fonts = document.fonts?.ready ?? Promise.resolve();
    fonts.then(() => {
      const wait = Math.max(0, MIN_MS - (performance.now() - started));
      timer = window.setTimeout(finish, wait);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="splash no-print" aria-hidden>
      <div className="login-grid absolute inset-0" />
      <div className="login-glow absolute" />
      <div className="splash-inner relative flex flex-col items-center px-6 text-center">
        <Image
          src="/logo.png"
          alt=""
          width={800}
          height={350}
          priority
          className="h-auto w-[min(26rem,78vw)] drop-shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
        />
        <p className="font-display mt-10 text-[1.35rem] font-extrabold tracking-tight text-white sm:text-[1.7rem]">
          Delivery Operations
        </p>
        <div className="splash-track mt-6">
          <div className="splash-fill" />
        </div>
      </div>
    </div>
  );
}
