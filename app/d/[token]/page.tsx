import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { DriverApp, type DriverStop } from "@/components/driver-app";
import { loadPortal } from "@/lib/data";
import { formatLong } from "@/lib/dates";
import { driverFromToken } from "@/lib/driver-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My route · TSS", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#1f2429", width: "device-width", initialScale: 1, maximumScale: 1 };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 bg-asphalt px-4 pt-3 pb-3 shadow-md">
        <Image src="/logo.png" alt="Traffic Safety Service" width={800} height={350} priority className="h-11 w-auto" />
      </header>
      <div className="hazard h-1.5" aria-hidden />
      {children}
    </main>
  );
}

export default async function DriverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const driverId = driverFromToken(token);
  if (!driverId) {
    return (
      <Shell>
        <div className="px-5 py-10">
          <h1 className="font-display text-2xl font-extrabold text-stone-950">This link doesn&apos;t work</h1>
          <p className="mt-2 text-stone-600">Ask dispatch to text you a new route link. Office: 908-561-4800.</p>
        </div>
      </Shell>
    );
  }
  const portal = await loadPortal();
  const driver = portal.drivers.find((d) => d.id === driverId);
  const route = portal.routes.find((r) => r.date === portal.today && r.driverId === driverId) ?? portal.routes.find((r) => r.date === portal.tomorrow && r.driverId === driverId);
  if (!driver || !route) {
    return (
      <Shell>
        <div className="px-5 py-10">
          <h1 className="font-display text-2xl font-extrabold text-stone-950">No route yet{driver ? `, ${driver.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-2 text-stone-600">You&apos;ll get a text with your route the evening before. This page shows it once it&apos;s ready.</p>
        </div>
      </Shell>
    );
  }
  const truck = portal.trucks.find((t) => t.id === route.truckId);
  const departed = portal.events.some((e) => e.routeId === route.id && e.type === "departed") || route.stops.some((s) => s.status !== "pending");
  const stops: DriverStop[] = route.stops.flatMap((s) => {
    const o = portal.orders.find((x) => x.id === s.orderId);
    if (!o) return [];
    return [
      {
        orderId: o.id,
        number: o.number,
        kind: o.kind,
        customer: o.customer,
        contact: o.contact,
        phone: o.contactPhone,
        address: `${o.address}, ${o.city}, ${o.state}`,
        lat: o.lat,
        lon: o.lon,
        eta: s.eta,
        window: o.window,
        status: s.status,
        doneAt: s.doneAt ?? null,
        notes: o.notes,
        items: o.items.map((i) => ({ name: i.name, qty: i.qty })),
      },
    ];
  });

  return (
    <Shell>
      <DriverApp
        token={token}
        routeId={route.id}
        routeName={route.name}
        dateLabel={route.date === portal.today ? `Today · ${formatLong(route.date)}` : `Tomorrow · ${formatLong(route.date)}`}
        isToday={route.date === portal.today}
        driverName={driver.name}
        truck={truck ? `${truck.unit} · ${truck.type}` : ""}
        departure={route.departure}
        departed={departed}
        stops={stops}
      />
    </Shell>
  );
}
