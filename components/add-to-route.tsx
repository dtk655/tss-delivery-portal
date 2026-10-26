"use client";

import { useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { assignOrder } from "@/app/actions";

/** "add": pick a route for an unrouted order. "move": small menu on a stop to move it or take it off. */
export function AddToRoute({ orderId, routes, mode }: { orderId: string; routes: Array<{ id: string; label: string }>; mode: "add" | "move" }) {
  const [pending, start] = useTransition();
  const change = (routeId: string) => start(() => assignOrder(orderId, routeId));

  if (mode === "move") {
    return (
      <label className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700" title="Move this stop">
        <ArrowRightLeft className="size-4" />
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value=""
          disabled={pending}
          onChange={(e) => change(e.target.value === "__off" ? "" : e.target.value)}
          aria-label="Move this stop"
        >
          <option value="" disabled>
            Move stop…
          </option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              Move to {r.label}
            </option>
          ))}
          <option value="__off">Take off this route</option>
        </select>
      </label>
    );
  }

  return (
    <select
      value=""
      disabled={pending || routes.length === 0}
      onChange={(e) => change(e.target.value)}
      className="h-9 w-full rounded-lg border border-asphalt bg-asphalt px-2.5 text-sm font-semibold text-white disabled:opacity-60"
      aria-label="Add to a route"
    >
      <option value="">{pending ? "Adding…" : routes.length ? "Add to route…" : "No routes this day"}</option>
      {routes.map((r) => (
        <option key={r.id} value={r.id}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
