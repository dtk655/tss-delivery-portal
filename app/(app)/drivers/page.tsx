import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, MessageSquareText, Phone, Wrench } from "lucide-react";
import { CopyLink } from "@/components/copy-link";
import { Card, CardHead, Page, PageHeader, Road, TruckPill, lbs, phoneOf } from "@/components/kit";
import { indexBy, loadPortal } from "@/lib/data";
import { ago } from "@/lib/dates";
import { driverToken } from "@/lib/driver-link";
import { siteUrl } from "@/lib/templates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Drivers & Trucks · TSS Deliveries" };

export default async function DriversPage() {
  const portal = await loadPortal();
  const trucks = indexBy(portal.trucks);
  const todays = portal.routes.filter((r) => r.date === portal.today);
  const tomorrows = portal.routes.filter((r) => r.date === portal.tomorrow);

  return (
    <Page>
      <PageHeader
        title="Drivers & Trucks"
        lead="Each driver has a private link for their phone. It shows their route and is where they log drop-offs; no password to remember."
        aside={
          <span className={`pill ${portal.truckSource === "fleetio" ? "pill-done" : "pill-ready"}`}>{portal.truckSource === "fleetio" ? "Trucks synced from Fleetio" : "Sample trucks · Fleetio not connected"}</span>
        }
      />

      <div className="mt-8 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {portal.drivers.map((driver) => {
          const route = todays.find((r) => r.driverId === driver.id);
          const next = tomorrows.find((r) => r.driverId === driver.id);
          const truck = trucks.get(route?.truckId ?? driver.defaultTruckId);
          const done = route?.stops.filter((s) => s.status === "delivered").length ?? 0;
          const link = `${siteUrl()}/d/${driverToken(driver.id)}`;
          const initials = driver.name
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2);
          return (
            <Card key={driver.id} flush className="flex flex-col overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <span className="figure flex size-14 shrink-0 items-center justify-center rounded-2xl bg-asphalt text-xl font-extrabold text-sheeting">{initials}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display truncate text-xl font-extrabold text-stone-950">{driver.name}</h2>
                    <span className="rounded-md border border-stone-300 px-1.5 text-[0.7rem] leading-5 font-bold text-stone-700">{driver.license}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
                    <a href={`tel:${driver.phone}`} className="inline-flex items-center gap-1.5 hover:text-tss-red">
                      <Phone className="size-3.5" /> {phoneOf(driver.phone)}
                    </a>
                    <span className={`inline-flex items-center gap-1.5 ${driver.smsOptIn ? "text-[#15803d]" : "text-[#b01820]"}`}>
                      <MessageSquareText className="size-3.5" /> {driver.smsOptIn ? "Gets route texts" : "Has not replied YES"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mx-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
                {route ? (
                  <>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/routes/${route.id}`} className="font-semibold text-stone-900 hover:text-tss-red">
                        Today · {route.name}
                      </Link>
                      <span className="figure font-bold">
                        {done}/{route.stops.length}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Road done={done} total={route.stops.length} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-stone-500">No route today.</p>
                )}
                <p className="mt-3 text-xs text-stone-500">
                  Tomorrow: {next ? `${next.name}, ${next.stops.length} stops` : "not scheduled"} · Truck {truck?.unit ?? "—"}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 p-5">
                <CopyLink url={link} />
                <a href={`/d/${driverToken(driver.id)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-stone-600 hover:bg-stone-100">
                  <ExternalLink className="size-4" /> Open driver view
                </a>
              </div>
            </Card>
          );
        })}
      </div>

      <Card flush className="mt-4 overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <CardHead title="Trucks" note={portal.truckSource === "fleetio" ? "From Fleetio: odometer and last GPS ping." : "Connect Fleetio to fill these in from your fleet records."} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-y border-stone-200 bg-stone-50 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                <th className="py-3 pr-3 pl-5">Unit</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Plate</th>
                <th className="px-3 py-3 text-right">Capacity</th>
                <th className="px-3 py-3 text-right">Odometer</th>
                <th className="px-3 py-3">Service</th>
                <th className="py-3 pr-5 pl-3">Right now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {portal.trucks.map((t) => {
                const left = t.nextServiceMiles ? t.nextServiceMiles - t.odometer : null;
                return (
                  <tr key={t.id}>
                    <td className="py-3.5 pr-3 pl-5">
                      <span className="figure font-extrabold text-stone-950">{t.unit}</span>
                      {t.cdl ? <span className="ml-2 rounded bg-stone-200 px-1 text-[0.65rem] font-bold text-stone-700">CDL</span> : null}
                    </td>
                    <td className="px-3 py-3.5 text-stone-700">{t.type}</td>
                    <td className="px-3 py-3.5 font-mono text-xs text-stone-600">{t.plate}</td>
                    <td className="figure px-3 py-3.5 text-right text-stone-800">{lbs(t.capacityLbs)}</td>
                    <td className="figure px-3 py-3.5 text-right text-stone-800">{t.odometer.toLocaleString("en-US")} mi</td>
                    <td className="px-3 py-3.5">
                      {left == null ? (
                        <span className="text-stone-400">—</span>
                      ) : left < 1000 ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-tss-red">
                          <Wrench className="size-3.5" /> Due in {left.toLocaleString("en-US")} mi
                        </span>
                      ) : (
                        <span className="text-stone-600">In {left.toLocaleString("en-US")} mi</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-5 pl-3">
                      <div className="flex items-center gap-2">
                        <TruckPill status={t.status} />
                        <span className="text-xs text-stone-500">{ago(t.lastPing)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </Page>
  );
}
