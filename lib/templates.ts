/** Wording for every outgoing text and email, in one file so it is easy to change. */
import { clock12, formatLong, timeOf } from "@/lib/dates";
import type { DeliveryEvent, Driver, Order, Route, Truck } from "@/lib/types";

export const COMPANY = {
  name: "Traffic Safety Service",
  phone: "908-561-4800",
  site: "www.TrafficSafetyService.com",
};

export function siteUrl(): string {
  return (process.env.URL ?? process.env.SITE_URL ?? "http://localhost:3848").replace(/\/$/, "");
}

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

/** The evening text each driver gets about tomorrow's route. Kept short for SMS. */
export function driverRouteText(route: Route, driver: Driver, orders: Order[], link: string): string {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const lines = route.stops.map((s, i) => {
    const o = byId.get(s.orderId);
    return o ? `${i + 1}. ${clock12(s.eta)} ${o.customer} - ${o.city}, ${o.state}` : "";
  });
  return [
    `TSS route for ${formatLong(route.date)}, ${firstName(driver.name)}:`,
    `Load out ${clock12(route.departure)}. ${route.stops.length} stop${route.stops.length === 1 ? "" : "s"}, about ${route.miles} mi.`,
    ...lines,
    `Stops, directions and delivery log: ${link}`,
    "Reply STOP to opt out.",
  ].join("\n");
}

function shell(title: string, inner: string): string {
  const logo = `${siteUrl()}/logo.png`;
  return `<!doctype html><html><body style="margin:0;background:#eceeef;font-family:Arial,Helvetica,sans-serif;color:#15181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceeef;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0e3e6">
<tr><td style="background:#1f2429;padding:20px 24px"><img src="${logo}" alt="Traffic Safety Service" width="180" style="display:block;width:180px;height:auto"></td></tr>
<tr><td style="height:6px;background:repeating-linear-gradient(90deg,#ffd100 0 18px,#1f2429 18px 30px);background-color:#ffd100"></td></tr>
<tr><td style="padding:28px 28px 8px"><h1 style="margin:0;font-size:22px;line-height:1.25;color:#15181b">${esc(title)}</h1></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.55;color:#39414a">${inner}</td></tr>
<tr><td style="background:#f6f7f8;border-top:1px solid #e0e3e6;padding:16px 28px;font-size:12px;color:#646e78">${COMPANY.name} · ${COMPANY.phone} · ${COMPANY.site}<br>Serving the traffic safety industry since 1971.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Email to the customer when the driver marks the stop delivered. */
export function customerDeliveredEmail(order: Order, event: DeliveryEvent, driver?: Driver, photoUrls: string[] = []) {
  const pickup = order.kind === "pickup";
  const subject = pickup
    ? `Pickup complete: ${order.number} from ${order.city}, ${order.state}`
    : `Delivered: your Traffic Safety Service order ${order.number}`;
  const when = timeOf(event.at);
  const items = order.items.map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eef0f1">${esc(i.name)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #eef0f1;font-weight:bold">${i.qty}</td></tr>`).join("");
  const photos = photoUrls.length
    ? `<p style="margin:18px 0 6px;font-weight:bold;color:#15181b">Drop-off photo${photoUrls.length > 1 ? "s" : ""}</p>${photoUrls
        .map((u) => `<img src="${u}" alt="Delivery photo" width="260" style="width:260px;max-width:100%;border-radius:8px;margin:0 8px 8px 0">`)
        .join("")}`
    : "";
  const inner = `<p style="margin:0 0 14px">Hi ${esc(order.contact)},</p>
<p style="margin:0 0 18px">${pickup ? "We picked up the rental equipment" : "Your order was delivered"} at <b>${esc(order.address)}, ${esc(order.city)}, ${esc(order.state)}</b> at <b>${when}</b>${event.receivedBy ? ` and was received by <b>${esc(event.receivedBy)}</b>` : ""}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#15181b"><tr><td style="padding-bottom:6px;color:#646e78;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Item</td><td align="right" style="padding-bottom:6px;color:#646e78;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Qty</td></tr>${items}</table>
${event.note ? `<p style="margin:18px 0 0"><b>Driver note:</b> ${esc(event.note)}</p>` : ""}
${photos}
<p style="margin:20px 0 0">Questions about this ${pickup ? "pickup" : "delivery"}? Call us at ${COMPANY.phone} or reply to this email.</p>`;
  const text = `${pickup ? "Pickup complete" : "Delivered"}: ${order.number} at ${order.address}, ${order.city}, ${order.state} at ${when}${
    event.receivedBy ? `, received by ${event.receivedBy}` : ""
  }.${event.note ? ` Driver note: ${event.note}` : ""} ${driver ? `Driver: ${driver.name}.` : ""} Questions? ${COMPANY.phone}`;
  return { subject, html: shell(pickup ? "Your rental pickup is complete" : "Your order has been delivered", inner), text };
}

/** Company-wide email with every route for a day. */
export function companyRoutesEmail(date: string, routes: Route[], orders: Order[], drivers: Driver[], trucks: Truck[]) {
  const byOrder = new Map(orders.map((o) => [o.id, o]));
  const totalStops = routes.reduce((n, r) => n + r.stops.length, 0);
  const blocks = routes
    .map((route) => {
      const driver = drivers.find((d) => d.id === route.driverId);
      const truck = trucks.find((t) => t.id === route.truckId);
      const rows = route.stops
        .map((s, i) => {
          const o = byOrder.get(s.orderId);
          if (!o) return "";
          return `<tr><td style="padding:7px 8px 7px 0;border-bottom:1px solid #eef0f1;color:#646e78;width:22px">${i + 1}</td><td style="padding:7px 8px;border-bottom:1px solid #eef0f1;white-space:nowrap;font-weight:bold">${clock12(s.eta)}</td><td style="padding:7px 8px;border-bottom:1px solid #eef0f1"><b>${esc(o.customer)}</b><br><span style="color:#646e78">${esc(o.address)}, ${esc(o.city)}, ${o.state}</span></td><td style="padding:7px 0 7px 8px;border-bottom:1px solid #eef0f1;white-space:nowrap;color:#646e78">${esc(o.number)}</td></tr>`;
        })
        .join("");
      return `<div style="margin:0 0 22px;border:1px solid #e0e3e6;border-radius:10px;overflow:hidden">
<div style="background:#1f2429;color:#fff;padding:10px 14px;font-size:14px"><b style="color:#ffd100">${esc(route.name)}</b> &nbsp;·&nbsp; ${esc(driver?.name ?? "No driver")} &nbsp;·&nbsp; ${esc(truck?.unit ?? "")} ${esc(truck?.type ?? "")} &nbsp;·&nbsp; Load out ${clock12(route.departure)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#15181b;padding:4px 14px 8px">${rows}</table></div>`;
    })
    .join("");
  const inner = `<p style="margin:0 0 18px">${routes.length} routes and ${totalStops} stops are scheduled for <b>${formatLong(date)}</b>. Drivers were texted their routes.</p>${blocks}
<p style="margin:0"><a href="${siteUrl()}/routes?date=${date}" style="color:#e10600;font-weight:bold">Open the route planner</a></p>`;
  return {
    subject: `Delivery routes for ${formatLong(date)} · ${routes.length} trucks, ${totalStops} stops`,
    html: shell(`Delivery routes for ${formatLong(date)}`, inner),
  };
}
