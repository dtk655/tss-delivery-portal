"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CornerDownLeft,
  Keyboard,
  LogOut,
  Mail,
  PanelLeft,
  PackageCheck,
  Printer,
  Search,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/auth-actions";
import { useShell } from "@/components/shell";
import { NAV_LINKS } from "@/lib/nav";

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keys?: string[];
  icon: LucideIcon;
  terms?: string;
  run: () => void;
};

function score(item: Item, query: string): number {
  if (!query) return 1;
  const label = item.label.toLowerCase();
  const terms = (item.terms ?? "").toLowerCase();
  if (label.startsWith(query)) return 4;
  if (label.split(/\s+/).some((word) => word.startsWith(query))) return 3;
  if (label.includes(query)) return 2.5;
  if (terms.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  let at = 0;
  for (const char of query) {
    at = label.indexOf(char, at);
    if (at < 0) return 0;
    at += 1;
  }
  return 1;
}

const SHORTCUTS: { keys: string[]; label: string; together?: boolean }[] = [
  { keys: ["Ctrl", "K"], label: "Open the command bar (⌘K on a Mac)", together: true },
  { keys: ["/"], label: "Open the command bar" },
  ...NAV_LINKS.map((link) => ({ keys: ["G", link.key.toUpperCase()], label: `Go to ${link.label}` })),
  { keys: ["["], label: "Collapse or expand the sidebar" },
  { keys: ["?"], label: "Show these shortcuts" },
];

export function CommandPalette() {
  const { closePalette, go, toggleRail, paletteView, openPalette } = useShell();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    input.current?.focus();
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = body;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();

  const items = useMemo<Item[]>(() => {
    const close = (fn: () => void) => () => {
      closePalette();
      fn();
    };

    const pages: Item[] = NAV_LINKS.map((link) => ({
      id: `page-${link.href}`,
      group: "Go to",
      label: link.label,
      keys: ["G", link.key.toUpperCase()],
      icon: link.icon,
      terms: link.terms,
      run: close(() => go(link.href)),
    }));

    const actions: Item[] = [
      { id: "plan-tomorrow", group: "Actions", label: "Plan tomorrow's routes", icon: PackageCheck, terms: "dispatch routes tomorrow", run: close(() => go("/routes")) },
      { id: "messages", group: "Actions", label: "Preview driver texts and emails", icon: Mail, terms: "sms email outbox", run: close(() => go("/messages")) },
      { id: "print", group: "Actions", label: "Print this page", icon: Printer, terms: "pdf paper route sheet", run: close(() => window.setTimeout(() => window.print(), 120)) },
      { id: "rail", group: "Actions", label: "Collapse or expand the sidebar", icon: PanelLeft, keys: ["["], terms: "sidebar menu nav", run: close(toggleRail) },
      { id: "keys", group: "Actions", label: "Show keyboard shortcuts", icon: Keyboard, keys: ["?"], terms: "help keys hotkeys", run: () => { setQuery(""); openPalette("keys"); } },
      { id: "logout", group: "Actions", label: "Sign out", icon: LogOut, terms: "logout exit", run: close(() => startTransition(() => logout())) },
    ];

    const out: Item[] = [];
    const ranked = [...pages, ...actions]
      .map((item) => ({ item, rank: score(item, needle) }))
      .filter((entry) => entry.rank > 0)
      .sort((a, b) => (needle ? b.rank - a.rank : 0));
    for (const { item } of ranked) out.push(item);

    if (trimmed.length >= 2) {
      const q = encodeURIComponent(trimmed);
      out.push(
        { id: "find-orders", group: `Search for “${trimmed}”`, label: "Find in orders", hint: "Customers, order numbers, towns", icon: Search, run: close(() => go(`/orders?q=${q}`)) },
        { id: "find-log", group: `Search for “${trimmed}”`, label: "Find in delivery log", hint: "Customers, drivers, notes", icon: Search, run: close(() => go(`/log?q=${q}`)) },
      );
    }
    return out;
  }, [trimmed, needle, closePalette, go, toggleRail, openPalette]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (paletteView === "keys") openPalette("commands");
      else closePalette();
      return;
    }
    if (paletteView === "keys") return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (items.length ? (index + 1) % items.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (items.length ? (index - 1 + items.length) % items.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[active]?.run();
    }
  };

  let lastGroup = "";

  return (
    <div className="no-print fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
      <div className="cmd-backdrop absolute inset-0 bg-stone-950/45 backdrop-blur-[2px]" onClick={closePalette} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={paletteView === "keys" ? "Keyboard shortcuts" : "Command bar"}
        className="cmd-panel relative w-full max-w-[640px] overflow-hidden rounded-xl border border-stone-300/70 bg-white shadow-lg"
      >
        {paletteView === "keys" ? (
          <div>
            <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3.5">
              <Keyboard className="size-5 text-stone-500" />
              <h2 className="font-display text-lg font-bold text-stone-950">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={() => openPalette("commands")}
                className="ml-auto rounded-md px-2 py-1 text-sm font-medium text-stone-600 hover:bg-stone-100"
                autoFocus
              >
                Back
              </button>
            </div>
            <ul className="max-h-[60vh] divide-y divide-stone-100 overflow-y-auto">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm text-stone-800">
                  {shortcut.label}
                  <span className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((key, index) => (
                      <span key={key} className="flex items-center gap-1">
                        {index > 0 ? <span className="text-xs text-stone-400">{shortcut.together ? "+" : "then"}</span> : null}
                        <kbd>{key}</kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-stone-200 bg-stone-50 px-4 py-2.5 text-xs text-stone-500">
              Shortcuts pause while you are typing in a field.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-stone-200 px-4">
              <Search className="size-5 shrink-0 text-stone-400" />
              <input
                ref={input}
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Go to a page, run an action, or search orders"
                aria-label="Search pages and actions"
                aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
                aria-controls="cmd-list"
                role="combobox"
                aria-expanded="true"
                className="h-14 w-full bg-transparent text-base text-stone-950 outline-none placeholder:text-stone-400"
                style={{ boxShadow: "none" }}
                data-slot="command-input"
              />
              <kbd className="hidden shrink-0 sm:inline-flex">Esc</kbd>
            </div>
            <div ref={list} id="cmd-list" role="listbox" className="max-h-[56vh] overflow-y-auto p-2">
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-stone-500">
                  Nothing matches “{trimmed}”. Try a page name, a customer or an order number.
                </p>
              ) : (
                items.map((item, index) => {
                  const heading = item.group !== lastGroup ? item.group : null;
                  lastGroup = item.group;
                  const Icon = item.icon;
                  const selected = index === active;
                  return (
                    <div key={item.id}>
                      {heading ? (
                        <div className="px-3 pt-3 pb-1.5 text-xs font-medium text-stone-500 first:pt-1">{heading}</div>
                      ) : null}
                      <div
                        id={`cmd-${item.id}`}
                        role="option"
                        aria-selected={selected}
                        data-index={index}
                        onMouseMove={() => setActive(index)}
                        onClick={item.run}
                        className={`relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                          selected ? "bg-stone-100 text-stone-950" : "text-stone-700"
                        }`}
                      >
                        {selected ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-tss-red" aria-hidden /> : null}
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-md border ${
                            selected ? "border-stone-300 bg-white text-tss-red" : "border-stone-200 bg-stone-50 text-stone-500"
                          }`}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{item.label}</span>
                          {item.hint ? <span className="block truncate text-xs text-stone-500">{item.hint}</span> : null}
                        </span>
                        {item.keys ? (
                          <span className="hidden shrink-0 items-center gap-1 sm:flex">
                            {item.keys.map((key) => (
                              <kbd key={key}>{key}</kbd>
                            ))}
                          </span>
                        ) : selected ? (
                          <CornerDownLeft className="size-4 shrink-0 text-stone-400" />
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-200 bg-stone-50 px-4 py-2.5 text-xs text-stone-500 sm:flex">
              <span className="flex items-center gap-1.5"><kbd>↑</kbd><kbd>↓</kbd> to move</span>
              <span className="flex items-center gap-1.5"><kbd>↵</kbd> to open</span>
              <button type="button" onClick={() => openPalette("keys")} className="ml-auto flex items-center gap-1.5 hover:text-stone-800">
                <kbd>?</kbd> all shortcuts
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
