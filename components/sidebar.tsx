"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { logout } from "@/app/auth-actions";
import { useShell } from "@/components/shell";
import { NAV_GROUPS, sectionFor } from "@/lib/nav";

function useNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const date = params.get("date");
  const query = date ? `?date=${date}` : "";
  return { pathname, query };
}

function NavLinks({ compact = false }: { compact?: boolean }) {
  const { pathname, query } = useNav();
  const current = sectionFor(pathname);
  const navRef = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  const [motion, setMotion] = useState(false);
  const [bar, setBar] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const place = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active || active.offsetParent === null) {
        setBar(null);
        return;
      }
      const navBox = nav.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      setBar({ x: box.left - navBox.left, y: box.top - navBox.top, w: box.width, h: box.height });
    };
    place();
    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(() => setMotion(true));
    }
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    window.addEventListener("tss-rail", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("tss-rail", place);
    };
  }, [pathname, compact]);

  return (
    <div ref={navRef} className={`relative ${compact ? "flex items-center gap-1" : ""}`}>
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label} className={compact ? "flex items-center gap-1" : index === 0 ? "mt-1" : "mt-6"}>
          {compact ? null : (
            <>
              <div className="rail-hide px-3 pb-2 text-[0.72rem] font-medium tracking-wide text-[#7f8992]">{group.label}</div>
              {index > 0 ? <div className="rail-show mx-3 mb-3 h-px bg-white/10" aria-hidden /> : null}
            </>
          )}
          <div className={compact ? "flex items-center gap-1" : "space-y-1"}>
            {group.links.map((link) => {
              const active = current?.href === link.href;
              const href = link.keepDate ? `${link.href}${query}` : link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  data-tip={link.label}
                  className={`group/nav relative flex items-center gap-3 rounded-lg font-medium whitespace-nowrap ${
                    compact ? "px-3 py-2 text-sm" : "rail-tip px-3 py-2.5 text-[0.95rem]"
                  } ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-[#b7bec5] hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <Icon
                    className={`shrink-0 ${compact ? "size-4" : "size-[1.2rem]"} ${
                      active ? "text-tss-red" : "text-[#8a949c] group-hover/nav:text-[#d5dade]"
                    }`}
                  />
                  <span className={compact ? "" : "rail-label"}>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {bar ? (
        <span
          aria-hidden
          className={`nav-indicator ${compact ? "is-compact" : ""} ${motion ? "is-ready" : ""}`}
          style={
            compact
              ? { left: 0, top: 0, width: bar.w - 16, height: 2, transform: `translate(${bar.x + 8}px, ${bar.y + bar.h - 2}px)` }
              : { left: 0, top: 0, width: 3, height: Math.max(bar.h - 12, 14), transform: `translate(${bar.x}px, ${bar.y + 6}px)` }
          }
        />
      ) : null}
    </div>
  );
}

function CollapseButton() {
  const { toggleRail } = useShell();
  return (
    <button
      type="button"
      onClick={toggleRail}
      data-tip="Expand sidebar"
      aria-label="Collapse or expand sidebar"
      className="rail-tip flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#8a949c] hover:bg-white/[0.05] hover:text-white"
    >
      <PanelLeftClose className="rail-hide size-[1.2rem] shrink-0" />
      <PanelLeftOpen className="rail-show size-[1.2rem] shrink-0" />
      <span className="rail-label">Collapse sidebar</span>
      <span className="rail-label ml-auto rounded border border-white/15 px-1.5 text-[0.7rem] leading-5 text-[#8a949c]">[</span>
    </button>
  );
}

function MobileSearch() {
  const { openPalette } = useShell();
  return (
    <button
      type="button"
      onClick={() => openPalette()}
      aria-label="Search pages and actions"
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#d5dade] hover:bg-white/10"
    >
      <Search className="size-[1.1rem]" />
    </button>
  );
}

/** Labels for the icon-only rail. Rendered fixed so the rail's scroll area cannot clip them. */
function RailTooltip({ rail }: { rail: React.RefObject<HTMLElement | null> }) {
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const show = (event: Event) => {
      if (document.documentElement.dataset.rail !== "collapsed") return setTip(null);
      const target = (event.target as Element | null)?.closest?.("[data-tip]") as HTMLElement | null;
      if (!target) return setTip(null);
      const box = target.getBoundingClientRect();
      setTip({ label: target.dataset.tip ?? "", top: box.top + box.height / 2, left: box.right + 12 });
    };
    const hide = () => setTip(null);
    el.addEventListener("pointerover", show);
    el.addEventListener("focusin", show);
    el.addEventListener("pointerleave", hide);
    el.addEventListener("focusout", hide);
    el.addEventListener("click", hide);
    window.addEventListener("tss-rail", hide);
    return () => {
      el.removeEventListener("pointerover", show);
      el.removeEventListener("focusin", show);
      el.removeEventListener("pointerleave", hide);
      el.removeEventListener("focusout", hide);
      el.removeEventListener("click", hide);
      window.removeEventListener("tss-rail", hide);
    };
  }, [rail]);
  if (!tip) return null;
  return createPortal(
    <div
      role="tooltip"
      className="rail-tooltip pointer-events-none fixed z-[70] -translate-y-1/2 rounded-md bg-stone-950 px-2.5 py-1.5 text-[0.8rem] font-medium whitespace-nowrap text-white shadow-md"
      style={{ top: tip.top, left: tip.left }}
    >
      {tip.label}
    </div>,
    document.body,
  );
}

export function Sidebar() {
  const rail = useRef<HTMLElement>(null);
  return (
    <>
      <aside ref={rail} className="rail no-print sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-black/25 bg-asphalt md:flex">
        <Link
          href="/"
          className="rail-tip flex h-[7.75rem] shrink-0 items-center justify-center px-5"
          data-tip="Dashboard"
          aria-label="Dashboard"
        >
          <Image
            src="/logo.png"
            alt="Traffic Safety Service"
            width={800}
            height={350}
            priority
            className="rail-hide h-auto w-full max-w-[13.5rem]"
          />
          <span className="rail-show block h-[44px] w-[46px] overflow-hidden">
            <Image src="/logo.png" alt="" width={800} height={350} className="h-14 w-auto max-w-none" />
          </span>
        </Link>
        <div className="mx-4 h-px shrink-0 bg-white/10" aria-hidden />
        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 pt-4 pb-6">
          <NavLinks />
        </nav>
        <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
          <div className="rail-user flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="figure flex size-8 shrink-0 items-center justify-center rounded-md bg-sheeting text-sm font-bold text-asphalt">
              D
            </span>
            <span className="rail-label min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">Dispatch</span>
              <span className="block truncate text-xs text-[#8a949c]">Signed in</span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                data-tip="Sign out"
                className="flex size-8 items-center justify-center rounded-md text-[#8a949c] hover:bg-white/[0.07] hover:text-white"
              >
                <LogOut className="size-[1.05rem]" />
              </button>
            </form>
          </div>
          <CollapseButton />
        </div>
        <RailTooltip rail={rail} />
      </aside>
      <MobileBar />
    </>
  );
}

/* ---------------- Phone: top bar + full menu ---------------- */

function MobileBar() {
  const { pathname, query } = useNav();
  const current = sectionFor(pathname);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // Esc closes; the page behind does not scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div className="mobile-nav no-print sticky top-0 z-40 flex h-16 items-center gap-2 bg-asphalt px-3 md:hidden">
        <Link href="/" className="mr-auto shrink-0" aria-label="Dashboard">
          <Image src="/logo.png" alt="Traffic Safety Service" width={800} height={350} priority className="h-12 w-auto" />
        </Link>
        <MobileSearch />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          <Menu className="size-[1.15rem]" />
          Menu
        </button>
      </div>
      {mounted && open
        ? createPortal(
            <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation" className="mobile-menu fixed inset-0 z-[90] flex flex-col bg-asphalt md:hidden">
              <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-3">
                <Link href="/" className="mr-auto shrink-0" aria-label="Dashboard" onClick={() => setOpen(false)}>
                  <Image src="/logo.png" alt="Traffic Safety Service" width={800} height={350} className="h-12 w-auto" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  autoFocus
                  className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  <X className="size-[1.15rem]" />
                  Close
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
                {NAV_GROUPS.map((group, index) => (
                  <div key={group.label} className={`mobile-menu-group ${index ? "mt-5" : ""}`} style={{ animationDelay: `${index * 40}ms` }}>
                    <div className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-[0.12em] text-[#8a949c] uppercase">{group.label}</div>
                    {group.links.map((link) => {
                      const Icon = link.icon;
                      const active = current?.href === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={`${link.href}${link.keepDate ? query : ""}`}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={`flex h-12 items-center gap-3 rounded-xl px-3 text-[1.02rem] font-semibold ${
                            active ? "bg-white/[0.09] text-white" : "text-[#d5dade] active:bg-white/[0.06]"
                          }`}
                        >
                          {active ? <span className="h-6 w-1 rounded-full bg-sheeting" aria-hidden /> : null}
                          <Icon className={`size-5 ${active ? "text-sheeting" : "text-[#8a949c]"}`} />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <div className="shrink-0 border-t border-white/10 p-3">
                <form action={logout}>
                  <button type="submit" className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#d5dade] hover:bg-white/[0.07]">
                    <LogOut className="size-5 text-[#8a949c]" />
                    Sign out
                  </button>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
