import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Mail, MessageSquareText, Users } from "lucide-react";
import { Card, CardHead, Empty, MessagePill, Page, PageHeader } from "@/components/kit";
import { loadPortal } from "@/lib/data";
import { stampOf } from "@/lib/dates";
import { driverToken } from "@/lib/driver-link";
import { companyRecipients, mailConfigured } from "@/lib/mail";
import { companyRoutesEmail, customerDeliveredEmail, driverRouteText, siteUrl } from "@/lib/templates";
import { twilioConfig } from "@/lib/twilio";
import type { DeliveryEvent, MessageKind } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Messages · TSS Deliveries" };

const KINDS: Array<{ id: string; label: string; kinds: MessageKind[] }> = [
  { id: "all", label: "All", kinds: ["driver-route", "company-routes", "customer-delivered", "customer-eta"] },
  { id: "drivers", label: "Driver texts", kinds: ["driver-route"] },
  { id: "company", label: "Company emails", kinds: ["company-routes"] },
  { id: "customers", label: "Customer emails", kinds: ["customer-delivered", "customer-eta"] },
];

const KIND_LABEL: Record<MessageKind, string> = {
  "driver-route": "Route text",
  "company-routes": "Company routes",
  "customer-delivered": "Delivered email",
  "customer-eta": "ETA email",
};

function Channel({ on, label, detail }: { on: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4">
      <span className={`mt-1 size-2.5 shrink-0 rounded-full ${on ? "bg-[#22c55e]" : "bg-[#e0a800]"}`} />
      <div>
        <div className="text-sm font-semibold text-stone-900">
          {label} <span className={`ml-1 text-xs font-semibold ${on ? "text-[#15803d]" : "text-[#8a5a00]"}`}>{on ? "Connected" : "Preview only"}</span>
        </div>
        <p className="mt-0.5 text-xs text-stone-500">{detail}</p>
      </div>
    </div>
  );
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "all" } = await searchParams;
  const portal = await loadPortal();
  const filter = KINDS.find((k) => k.id === kind) ?? KINDS[0];
  const messages = portal.messages.filter((m) => filter.kinds.includes(m.kind)).slice(0, 150);

  // Template previews from real routes when there are some.
  const route = portal.routes.find((r) => r.date === portal.tomorrow && r.stops.length) ?? portal.routes.find((r) => r.stops.length);
  const driver = route ? portal.drivers.find((d) => d.id === route.driverId) : undefined;
  const text = route && driver ? driverRouteText(route, driver, portal.orders, `${siteUrl()}/d/${driverToken(driver.id)}`) : "";
  const tomorrowRoutes = portal.routes.filter((r) => r.date === portal.tomorrow && r.stops.length);
  const company = companyRoutesEmail(portal.tomorrow, tomorrowRoutes, portal.orders, portal.drivers, portal.trucks);
  const sampleOrder = portal.orders.find((o) => o.kind !== "pickup") ?? portal.orders[0];
  const sampleEvent: DeliveryEvent = portal.events.find((e) => e.type === "delivered") ?? {
    id: "preview",
    at: new Date().toISOString(),
    type: "delivered",
    routeId: route?.id ?? "",
    orderId: sampleOrder?.id ?? null,
    driverId: driver?.id ?? "",
    note: "Unloaded and counted with the customer.",
    receivedBy: "Site foreman",
  };
  const previewOrder = portal.orders.find((o) => o.id === sampleEvent.orderId) ?? sampleOrder;
  const customer = previewOrder ? customerDeliveredEmail(previewOrder, sampleEvent, portal.drivers.find((d) => d.id === sampleEvent.driverId)) : null;
  const sms = Boolean(twilioConfig());
  const mail = mailConfigured();
  const list = companyRecipients();

  return (
    <Page>
      <PageHeader title="Messages" lead="Every text and email the portal sends, and what each one looks like. Nothing goes out until Twilio and email are connected; until then sends are recorded here as previews." />

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Channel on={sms} label="Driver texts (Twilio)" detail={sms ? "Texts send from your Twilio number." : "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER."} />
        <Channel on={mail} label="Email (Outlook / SMTP)" detail={mail ? `Sends as ${process.env.MAIL_FROM ?? process.env.SMTP_USER}.` : "Add SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM."} />
        <Channel on={list.length > 0} label="Company route list" detail={list.length ? list.join(", ") : "Add COMPANY_ROUTES_TO with the addresses to copy every day."} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card flush className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-asphalt text-sheeting">
              <MessageSquareText className="size-[1.1rem]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-950">Driver route text</h2>
              <p className="text-xs text-stone-500">Weekdays at 5:00 PM, or from the Route Planner</p>
            </div>
          </div>
          <div className="flex-1 bg-stone-50 p-5">
            <div className="mx-auto max-w-[18rem] rounded-[2rem] border-[6px] border-asphalt bg-white p-3 shadow-md">
              <div className="mb-2 text-center text-[0.7rem] font-semibold text-stone-500">TSS Dispatch</div>
              {text ? <div className="rounded-2xl rounded-tl-md bg-[#e9e9eb] px-3 py-2.5 text-[0.8rem] leading-snug break-words whitespace-pre-line text-stone-900 [overflow-wrap:anywhere]">{text}</div> : <p className="text-sm text-stone-500">No routes yet.</p>}
            </div>
          </div>
        </Card>

        <Card flush className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-asphalt text-sheeting">
              <Users className="size-[1.1rem]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-950">Company route email</h2>
              <p className="text-xs text-stone-500">Weekdays at 5:30 PM, after driver texts</p>
            </div>
          </div>
          <iframe title="Company route email preview" srcDoc={company.html} className="mail-frame h-[30rem] flex-1" />
        </Card>

        <Card flush className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-asphalt text-sheeting">
              <CheckCircle2 className="size-[1.1rem]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-950">Customer delivered email</h2>
              <p className="text-xs text-stone-500">The moment a driver logs a drop-off</p>
            </div>
          </div>
          {customer ? <iframe title="Customer email preview" srcDoc={customer.html} className="mail-frame h-[30rem] flex-1" /> : null}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHead
          title="Outbox"
          note="Newest first."
          aside={
            <div className="flex flex-wrap gap-1">
              {KINDS.map((k) => (
                <Link
                  key={k.id}
                  href={k.id === "all" ? "/messages" : `/messages?kind=${k.id}`}
                  className={`h-9 rounded-lg px-3 text-sm leading-9 font-semibold ${filter.id === k.id ? "bg-asphalt text-white" : "text-stone-600 hover:bg-stone-100"}`}
                >
                  {k.label}
                </Link>
              ))}
            </div>
          }
        />
        <div className="mt-4 divide-y divide-stone-100 border-t border-stone-100">
          {messages.length === 0 ? (
            <div className="pt-4">
              <Empty>Nothing sent yet.</Empty>
            </div>
          ) : null}
          {messages.map((m) => (
            <details key={m.id} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${m.channel === "sms" ? "bg-sheeting text-asphalt" : "bg-asphalt text-white"}`}>
                  {m.channel === "sms" ? <MessageSquareText className="size-4" /> : <Mail className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-semibold text-stone-900">{m.toName}</span>
                    <span className="truncate text-stone-500">{m.to}</span>
                  </div>
                  <div className="truncate text-xs text-stone-500">
                    {KIND_LABEL[m.kind]}
                    {m.subject ? ` · ${m.subject}` : ""}
                  </div>
                </div>
                <span className="hidden text-xs text-stone-500 sm:block">{stampOf(m.at)}</span>
                <MessagePill status={m.status} />
                <ChevronDown className="size-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mb-4 ml-11 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
                {m.error ? <p className="mb-2 font-semibold text-[#b01820]">{m.error}</p> : null}
                <p className="whitespace-pre-line text-stone-700">{m.body || "Full route email with every route and stop (see the preview above)."}</p>
              </div>
            </details>
          ))}
        </div>
      </Card>
    </Page>
  );
}
