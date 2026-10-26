"use client";

import { useEffect, useRef } from "react";

const CARD = "a.rounded-2xl.shadow-sm, article.rounded-2xl.shadow-sm";

export function ViewFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      document.documentElement.dataset.scrolled = window.scrollY > 4 ? "true" : "false";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Faint light that follows the pointer across clickable cards.
  useEffect(() => {
    const root = ref.current;
    if (!root || !window.matchMedia("(hover: hover)").matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest?.(CARD) as HTMLElement | null;
      if (!card) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = card.getBoundingClientRect();
        card.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
        card.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
      });
    };
    const onLeave = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest?.(CARD) as HTMLElement | null;
      if (card && !card.contains(event.relatedTarget as Node | null)) {
        card.style.removeProperty("--spot-x");
        card.style.removeProperty("--spot-y");
      }
    };
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerout", onLeave, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerout", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className="min-w-0">
      {children}
    </div>
  );
}
