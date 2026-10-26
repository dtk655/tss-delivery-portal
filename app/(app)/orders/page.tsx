import type { Metadata } from "next";
import { OrdersBoard, type OrderRow } from "@/components/orders-board";
import { Page, PageHeader, SourceBadge } from "@/components/kit";
import { indexBy, loadPortal, orderStatus } from "@/lib/data";
import { ago } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ready to Ship · TSS Deliveries" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "ready" } = await searchParams;
  const portal = await loadPortal();
  const drivers = indexBy(portal.drivers);
  const trucks = indexBy(portal.trucks);
  const rows: OrderRow[] = portal.orders
    .filter((o) => o.shipDate >= portal.today || orderStatus(o, portal.routes).status !== "delivered")
    .map((order) => {
      const { status: s, route, stop } = orderStatus(order, portal.routes);
      return {
        order,
        status: s,
        routeId: route?.id ?? "",
        routeLabel: route ? `${route.name} · ${drivers.get(route.driverId)?.name ?? ""}` : "",
        eta: stop?.eta ?? "",
      };
    })
    .sort((a, b) => a.order.shipDate.localeCompare(b.order.shipDate) || a.order.number.localeCompare(b.order.number));
  const routes = portal.routes
    .filter((r) => r.date >= portal.today && r.status !== "complete")
    .map((r) => ({ id: r.id, date: r.date, name: r.name, driver: drivers.get(r.driverId)?.name ?? "", truck: trucks.get(r.truckId)?.unit ?? "", capacity: trucks.get(r.truckId)?.capacityLbs ?? 0, stops: r.stops.length }));

  return (
    <Page>
      <PageHeader
        title="Ready to Ship"
        lead={
          <>
            Orders from NetSuite that are picked and ready to go out. Put each one on a route for its ship date.
            {portal.uploadedAt ? ` Last synced ${ago(portal.uploadedAt)}.` : ""}
          </>
        }
        aside={<SourceBadge mode={portal.mode} uploadedAt={portal.uploadedAt} />}
      />
      <OrdersBoard rows={rows} routes={routes} today={portal.today} tomorrow={portal.tomorrow} initialQuery={q} initialStatus={status} />
    </Page>
  );
}
