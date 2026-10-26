"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Check, CheckCircle2, ChevronDown, MapPin, Navigation, Phone, StickyNote, Truck, X } from "lucide-react";
import { driverUpdate } from "@/app/actions";
import { clock12, windowLabel } from "@/lib/dates";
import type { OrderKind, StopStatus } from "@/lib/types";

export type DriverStop = {
  orderId: string;
  number: string;
  kind: OrderKind;
  customer: string;
  contact: string;
  phone: string;
  address: string;
  lat: number;
  lon: number;
  eta: string;
  window: string;
  status: StopStatus;
  doneAt: string | null;
  notes: string;
  items: Array<{ name: string; qty: number }>;
};

type Sheet = { kind: "delivered" | "exception" | "note"; stop: DriverStop | null } | null;

function position(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 },
    );
  });
}

const doneTime = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export function DriverApp({
  token,
  routeId,
  routeName,
  dateLabel,
  isToday,
  driverName,
  truck,
  departure,
  departed,
  stops,
}: {
  token: string;
  routeId: string;
  routeName: string;
  dateLabel: string;
  isToday: boolean;
  driverName: string;
  truck: string;
  departure: string;
  departed: boolean;
  stops: DriverStop[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const done = stops.filter((s) => s.status === "delivered").length;
  const current = stops.find((s) => s.status !== "delivered");
  const pct = stops.length ? Math.round((done / stops.length) * 100) : 0;

  const send = (data: FormData, message: string) =>
    start(async () => {
      setError(null);
      const spot = await position();
      data.set("token", token);
      data.set("routeId", routeId);
      if (spot) {
        data.set("lat", String(spot.lat));
        data.set("lon", String(spot.lon));
      }
      const result = await driverUpdate(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSheet(null);
      setPreview([]);
      setToast(result.emailed && result.emailed !== "dry-run" ? `${message} Customer emailed.` : message);
      window.setTimeout(() => setToast(null), 3500);
      router.refresh();
    });

  const quick = (action: string, stop: DriverStop | null, message: string) => {
    const data = new FormData();
    data.set("action", action);
    if (stop) data.set("orderId", stop.orderId);
    send(data, message);
  };

  const first = driverName.split(" ")[0];

  return (
    <div className="mx-auto max-w-lg pb-28">
      <section className="bg-asphalt px-5 pt-5 pb-6 text-white">
        <div className="text-sm font-semibold text-sheeting">{dateLabel}</div>
        <h1 className="font-display mt-1 text-[1.9rem] leading-tight font-extrabold">Hi {first}, here&apos;s {routeName}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[#b7bec5]">
          <Truck className="size-4" /> {truck} · Load out {clock12(departure)}
        </p>
        <div className="mt-5 flex items-end justify-between">
          <div>
            <div className="figure text-4xl font-extrabold text-white">
              {done}
              <span className="text-[#8a949c]">/{stops.length}</span>
            </div>
            <div className="text-xs text-[#8a949c]">stops done</div>
          </div>
          <div className="figure text-2xl font-extrabold text-sheeting">{pct}%</div>
        </div>
        <div className="road mt-3 bg-white/10">
          <div className={`road-fill ${pct === 100 ? "is-done" : ""}`} style={{ width: `${Math.max(pct, done ? 6 : 0)}%`, background: pct === 100 ? undefined : "repeating-linear-gradient(90deg,#1f2429 0 10px,transparent 10px 16px) center/100% 2px no-repeat,#ffd100" }} />
        </div>
      </section>

      {isToday && !departed ? (
        <div className="px-4 pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => quick("departed", null, "Logged: left the yard.")}
            className="driver-cta flex w-full items-center justify-center gap-2 rounded-2xl bg-sheeting font-extrabold text-asphalt shadow-md active:scale-[0.99] disabled:opacity-60"
          >
            <Truck className="size-5" /> I&apos;m loaded and leaving the yard
          </button>
        </div>
      ) : null}

      {!isToday ? <p className="mx-4 mt-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">This is tomorrow&apos;s route. Buttons to log stops turn on the morning of.</p> : null}

      <ol className="space-y-3 px-4 pt-4">
        {stops.map((stop, i) => {
          const isCurrent = stop === current;
          const isDone = stop.status === "delivered";
          const open = isCurrent || expanded === stop.orderId;
          return (
            <li key={stop.orderId} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${isCurrent ? "border-asphalt ring-2 ring-sheeting" : "border-stone-200"}`}>
              <button type="button" onClick={() => setExpanded(open && !isCurrent ? null : stop.orderId)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <span className={`stop-dot is-${stop.status}`}>{isDone ? <Check className="size-4" /> : i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-stone-950">{stop.customer}</span>
                  <span className="block truncate text-sm text-stone-500">{stop.address}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="figure block text-base font-extrabold text-stone-950">{isDone && stop.doneAt ? doneTime(stop.doneAt) : clock12(stop.eta)}</span>
                  <span className={`block text-[0.7rem] font-bold uppercase ${isDone ? "text-[#15803d]" : stop.status === "arrived" ? "text-[#8a5a00]" : isCurrent ? "text-tss-red" : "text-stone-400"}`}>
                    {isDone ? "Done" : stop.status === "arrived" ? "On site" : isCurrent ? "Next" : "ETA"}
                  </span>
                </span>
                {!isCurrent ? <ChevronDown className={`size-4 shrink-0 text-stone-400 ${open ? "rotate-180" : ""}`} /> : null}
              </button>

              {open ? (
                <div className="border-t border-stone-100 px-4 pt-3 pb-4">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-600">
                    <span className="font-semibold text-stone-800">{stop.number}</span>
                    <span className="capitalize">{stop.kind === "pickup" ? "Rental pickup" : stop.kind}</span>
                    {stop.window ? <span className="font-semibold text-[#8a5a00]">Window {windowLabel(stop.window)}</span> : null}
                  </div>
                  <ul className="mt-2 space-y-1 text-[0.95rem] text-stone-900">
                    {stop.items.map((it) => (
                      <li key={it.name} className="flex justify-between gap-3">
                        <span>{it.name}</span>
                        <span className="figure font-extrabold">{it.qty}</span>
                      </li>
                    ))}
                  </ul>
                  {stop.notes ? (
                    <p className="mt-3 flex gap-2 rounded-xl bg-[#fffbeb] px-3 py-2.5 text-sm text-[#8a5a00]">
                      <StickyNote className="mt-0.5 size-4 shrink-0" /> {stop.notes}
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lon}`} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 font-bold text-stone-800">
                      <Navigation className="size-4" /> Navigate
                    </a>
                    <a href={`tel:${stop.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 font-bold text-stone-800">
                      <Phone className="size-4" /> Call {stop.contact.split(" ")[0]}
                    </a>
                  </div>
                  {isToday && !isDone ? (
                    <div className="mt-2 space-y-2">
                      {stop.status !== "arrived" ? (
                        <button type="button" disabled={pending} onClick={() => quick("arrived", stop, "Logged: arrived on site.")} className="driver-cta flex w-full items-center justify-center gap-2 rounded-xl bg-asphalt font-bold text-white disabled:opacity-60">
                          <MapPin className="size-5 text-sheeting" /> I&apos;m here
                        </button>
                      ) : null}
                      <button type="button" onClick={() => setSheet({ kind: "delivered", stop })} className="driver-cta flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] font-extrabold text-white">
                        <CheckCircle2 className="size-5" /> {stop.kind === "pickup" ? "Picked up" : "Delivered"}
                      </button>
                      <button type="button" onClick={() => setSheet({ kind: "exception", stop })} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-tss-red">
                        <AlertTriangle className="size-4" /> Report a problem
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {isToday ? (
        <div className="px-4 pt-4">
          <button type="button" onClick={() => setSheet({ kind: "note", stop: null })} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white text-sm font-bold text-stone-700">
            <StickyNote className="size-4" /> Send dispatch a note
          </button>
        </div>
      ) : null}

      <p className="px-6 pt-6 text-center text-xs text-stone-500">Updates go straight to dispatch. Office: 908-561-4800</p>

      {toast ? (
        <div className="fixed inset-x-4 bottom-5 z-50 mx-auto max-w-md rounded-2xl bg-asphalt px-4 py-3.5 text-center font-semibold text-white shadow-lg">
          <span className="text-sheeting">✓</span> {toast}
        </div>
      ) : null}

      {sheet ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <div className="absolute inset-0 bg-stone-950/50" onClick={() => !pending && setSheet(null)} aria-hidden />
          <form
            ref={form}
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              data.set("action", sheet.kind === "delivered" && sheet.stop?.kind === "pickup" ? "returned" : sheet.kind);
              if (sheet.stop) data.set("orderId", sheet.stop.orderId);
              send(data, sheet.kind === "delivered" ? "Drop-off logged." : sheet.kind === "exception" ? "Problem sent to dispatch." : "Note sent.");
            }}
            className="mobile-menu relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white px-5 pt-5 pb-8 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-extrabold text-stone-950">
                  {sheet.kind === "delivered" ? (sheet.stop?.kind === "pickup" ? "Confirm pickup" : "Confirm drop-off") : sheet.kind === "exception" ? "Report a problem" : "Note to dispatch"}
                </h2>
                {sheet.stop ? <p className="text-sm text-stone-500">{sheet.stop.customer}</p> : null}
              </div>
              <button type="button" onClick={() => setSheet(null)} className="flex size-10 items-center justify-center rounded-xl bg-stone-100 text-stone-600" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            {sheet.kind === "delivered" ? (
              <label className="mt-5 block">
                <span className="text-sm font-semibold text-stone-800">Who received it?</span>
                <input name="receivedBy" required autoComplete="off" placeholder="Name of the person on site" className="mt-1.5 h-12 w-full rounded-xl border border-stone-300 px-3.5 text-base" />
              </label>
            ) : null}

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-stone-800">{sheet.kind === "exception" ? "What happened?" : "Note (optional)"}</span>
              <textarea
                name="note"
                rows={3}
                required={sheet.kind !== "delivered"}
                placeholder={sheet.kind === "exception" ? "Site closed, wrong address, short on items…" : "Where you left it, anything the customer said"}
                className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-3 text-base"
              />
            </label>

            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-center">
              <Camera className="size-6 text-stone-500" />
              <span className="font-bold text-stone-800">{preview.length ? `${preview.length} photo${preview.length > 1 ? "s" : ""} added` : "Add photos"}</span>
              <span className="text-xs text-stone-500">{sheet.kind === "delivered" ? "Photo of the drop-off goes to the customer" : "Show dispatch what you see"}</span>
              <input
                type="file"
                name="photos"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                onChange={(e) => setPreview(Array.from(e.target.files ?? []).map((f) => URL.createObjectURL(f)))}
              />
            </label>
            {preview.length ? (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {preview.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
                ))}
              </div>
            ) : null}

            {error ? <p className="mt-3 rounded-xl bg-[#fef2f2] px-3 py-2 text-sm font-semibold text-[#b01820]">{error}</p> : null}

            <button
              type="submit"
              disabled={pending}
              className={`driver-cta mt-5 flex w-full items-center justify-center gap-2 rounded-2xl font-extrabold text-white disabled:opacity-60 ${sheet.kind === "exception" ? "bg-tss-red" : sheet.kind === "delivered" ? "bg-[#15803d]" : "bg-asphalt"}`}
            >
              {pending ? "Sending…" : sheet.kind === "delivered" ? "Confirm and email customer" : "Send to dispatch"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
