import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CountUp } from "@/components/count-up";
import type { MessageStatus, OrderKind, OrderStatus, RouteStatus, StopStatus, TruckStatus } from "@/lib/types";

export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={`w-full px-4 py-8 sm:px-6 lg:px-10 lg:py-10 ${wide ? "" : "max-w-[1600px]"}`}>{children}</main>;
}

export function PageHeader({
  title,
  lead,
  aside,
  eyebrow,
}: {
  title: string;
  lead?: React.ReactNode;
  aside?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="text-4xl font-extrabold tracking-tight text-stone-950 sm:text-[2.6rem]">{title}</h1>
        {lead ? <p className="mt-2 max-w-2xl text-[0.95rem] text-stone-600">{lead}</p> : null}
      </div>
      {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
    </div>
  );
}

export function Card({ children, className = "", flush = false }: { children: React.ReactNode; className?: string; flush?: boolean }) {
  return <section className={`rounded-2xl border border-stone-200 bg-white shadow-sm ${flush ? "" : "p-5"} ${className}`}>{children}</section>;
}

export function CardHead({ title, note, aside }: { title: string; note?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-stone-950">{title}</h2>
        {note ? <p className="mt-0.5 text-sm text-stone-500">{note}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function Kpi({
  label,
  value,
  note,
  href,
  tone = "plain",
  icon: Icon,
}: {
  label: string;
  value: string;
  note: React.ReactNode;
  href?: string;
  tone?: "plain" | "yellow" | "dark";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass =
    tone === "yellow" ? "border-[#e8c000] bg-sheeting" : tone === "dark" ? "border-asphalt bg-asphalt text-white" : "border-stone-200 bg-white";
  const labelClass = tone === "yellow" ? "text-stone-950/75" : tone === "dark" ? "text-sheeting" : "text-stone-500";
  const valueClass = tone === "dark" ? "text-white" : "text-stone-950";
  const noteClass = tone === "yellow" ? "text-stone-950/70" : tone === "dark" ? "text-[#b7bec5]" : "text-stone-500";
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex items-center gap-2 text-sm font-semibold ${labelClass}`}>
          {Icon ? <Icon className="size-4" /> : null}
          {label}
        </div>
        {href ? <ArrowUpRight className={`size-4 shrink-0 transition-colors ${tone === "plain" ? "text-stone-400 group-hover:text-tss-red" : "opacity-60 group-hover:opacity-100"}`} /> : null}
      </div>
      <div className={`figure mt-3 text-[2.6rem] leading-none font-extrabold ${valueClass}`}>
        <CountUp value={value} />
      </div>
      <div className={`mt-3 text-sm ${noteClass}`}>{note}</div>
    </>
  );
  const cls = `group block rounded-2xl border p-5 shadow-sm ${toneClass}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <section className={cls}>{body}</section>
  );
}

const ORDER_PILL: Record<OrderStatus, [string, string]> = {
  ready: ["pill-ready", "Ready to ship"],
  routed: ["pill-routed", "On a route"],
  out: ["pill-out", "Out for delivery"],
  delivered: ["pill-done", "Delivered"],
  exception: ["pill-bad", "Problem"],
};

export function OrderPill({ status }: { status: OrderStatus }) {
  const [cls, label] = ORDER_PILL[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

const STOP_PILL: Record<StopStatus, [string, string]> = {
  pending: ["pill-muted", "Scheduled"],
  "en-route": ["pill-out", "En route"],
  arrived: ["pill-ready", "On site"],
  delivered: ["pill-done", "Delivered"],
  exception: ["pill-bad", "Problem"],
};

export function StopPill({ status }: { status: StopStatus }) {
  const [cls, label] = STOP_PILL[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

const ROUTE_PILL: Record<RouteStatus, [string, string]> = {
  planned: ["pill-muted", "Planned"],
  loading: ["pill-ready", "Loading"],
  out: ["pill-out", "On the road"],
  complete: ["pill-done", "Complete"],
};

export function RoutePill({ status }: { status: RouteStatus }) {
  const [cls, label] = ROUTE_PILL[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

export const TRUCK_LABEL: Record<TruckStatus, string> = {
  moving: "Driving",
  stopped: "Stopped",
  "at-stop": "At a stop",
  yard: "In the yard",
  offline: "No signal",
};

const TRUCK_PILL: Record<TruckStatus, string> = {
  moving: "pill-out",
  stopped: "pill-ready",
  "at-stop": "pill-done",
  yard: "pill-muted",
  offline: "pill-bad",
};

export function TruckPill({ status }: { status: TruckStatus }) {
  return <span className={`pill ${TRUCK_PILL[status]}`}>{TRUCK_LABEL[status]}</span>;
}

const MESSAGE_PILL: Record<MessageStatus, [string, string]> = {
  sent: ["pill-done", "Sent"],
  "dry-run": ["pill-ready", "Preview only"],
  failed: ["pill-bad", "Not sent"],
  scheduled: ["pill-muted", "Scheduled"],
};

export function MessagePill({ status }: { status: MessageStatus }) {
  const [cls, label] = MESSAGE_PILL[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

const KIND_LABEL: Record<OrderKind, string> = { sale: "Sale", rental: "Rental", pickup: "Pickup" };

export function KindTag({ kind }: { kind: OrderKind }) {
  const cls =
    kind === "pickup" ? "border-stone-300 bg-white text-stone-600" : kind === "rental" ? "border-asphalt bg-asphalt text-white" : "border-[#e8c000] bg-sheeting text-stone-950";
  return <span className={`inline-flex rounded-md border px-1.5 text-[0.7rem] leading-5 font-bold tracking-wide uppercase ${cls}`}>{KIND_LABEL[kind]}</span>;
}

export function Road({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="road" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${done} of ${total} stops done`}>
      <div className={`road-fill ${pct === 100 ? "is-done" : ""}`} style={{ width: `${Math.max(pct, done ? 6 : 0)}%` }} />
    </div>
  );
}

export function SourceBadge({ mode, uploadedAt }: { mode: "sample" | "live"; uploadedAt: string | null }) {
  if (mode === "live") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700">
        <span className="live-dot" /> NetSuite synced{uploadedAt ? ` · ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(uploadedAt))}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#f6dc8b] bg-[#fffbeb] px-3 py-1 text-xs font-semibold text-[#8a5a00]" title="NetSuite is not connected yet, so pages show made-up orders.">
      <span className="size-2 rounded-full bg-[#e0a800]" /> Sample data
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">{children}</p>;
}

export function phoneOf(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : digits;
}

export function lbs(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k lb` : `${n.toLocaleString("en-US")} lb`;
}
