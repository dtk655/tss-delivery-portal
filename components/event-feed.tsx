import Link from "next/link";
import { AlertTriangle, Camera, CheckCircle2, MailCheck, MapPin, MessageSquare, PackageOpen, Truck, Undo2 } from "lucide-react";
import { ago, timeOf } from "@/lib/dates";
import type { DeliveryEvent, Driver, EventType, Order, Route } from "@/lib/types";

const META: Record<EventType, { icon: typeof Truck; label: string; dot: string }> = {
  departed: { icon: Truck, label: "Left the yard", dot: "bg-asphalt text-sheeting" },
  arrived: { icon: MapPin, label: "Arrived", dot: "bg-sheeting text-asphalt" },
  delivered: { icon: CheckCircle2, label: "Delivered", dot: "bg-[#15803d] text-white" },
  returned: { icon: Undo2, label: "Picked up", dot: "bg-[#15803d] text-white" },
  exception: { icon: AlertTriangle, label: "Problem", dot: "bg-tss-red text-white" },
  note: { icon: MessageSquare, label: "Driver note", dot: "bg-stone-200 text-stone-700" },
};

export function EventFeed({
  events,
  orders,
  drivers,
  routes,
  compact = false,
}: {
  events: DeliveryEvent[];
  orders: Map<string, Order>;
  drivers: Map<string, Driver>;
  routes: Map<string, Route>;
  compact?: boolean;
}) {
  return (
    <ol className="relative">
      {events.map((event, index) => {
        const meta = META[event.type];
        const Icon = meta.icon;
        const order = event.orderId ? orders.get(event.orderId) : undefined;
        const driver = drivers.get(event.driverId);
        const route = routes.get(event.routeId);
        const last = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3.5 pb-5">
            {!last ? <span className="absolute top-9 bottom-0 left-[1.05rem] w-px bg-stone-200" aria-hidden /> : null}
            <span className={`relative z-[1] flex size-[2.1rem] shrink-0 items-center justify-center rounded-full ring-4 ring-white ${meta.dot}`}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-sm text-stone-900">
                  <span className="font-semibold">{meta.label}</span>
                  {order ? (
                    <>
                      {" "}
                      · <span className="font-semibold">{order.customer}</span>
                      <span className="text-stone-500">
                        {" "}
                        in {order.city}, {order.state}
                      </span>
                    </>
                  ) : null}
                </p>
                <span className="shrink-0 text-xs text-stone-500" title={ago(event.at)}>
                  {timeOf(event.at)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                {driver?.name ?? "Driver"}
                {route ? (
                  <>
                    {" · "}
                    <Link href={`/routes/${route.id}`} className="hover:text-tss-red hover:underline">
                      {route.name}
                    </Link>
                  </>
                ) : null}
                {order ? ` · ${order.number}` : ""}
              </p>
              {!compact && event.note ? <p className="mt-1.5 text-sm text-stone-700">{event.note}</p> : null}
              {(event.receivedBy || event.photos?.length || event.customerEmailed) && !compact ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {event.receivedBy ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 font-medium text-stone-700">
                      <PackageOpen className="size-3.5" /> Received by {event.receivedBy}
                    </span>
                  ) : null}
                  {event.photos?.length ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 font-medium text-stone-700">
                      <Camera className="size-3.5" /> {event.photos.length} photo{event.photos.length > 1 ? "s" : ""}
                    </span>
                  ) : null}
                  {event.customerEmailed ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#ecfdf3] px-2 py-1 font-medium text-[#15803d]">
                      <MailCheck className="size-3.5" /> Customer emailed
                    </span>
                  ) : null}
                </div>
              ) : null}
              {!compact && event.photos?.length ? (
                <div className="mt-2 flex gap-2">
                  {event.photos.map((key) => (
                    <a key={key} href={`/api/photo/${key}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/photo/${key}`} alt="Delivery photo" className="size-20 rounded-lg border border-stone-200 object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
