/** Sends route texts, the company route email and customer delivery emails, and records each in Messages. */
import { randomUUID } from "crypto";
import { type Portal } from "@/lib/data";
import { driverToken } from "@/lib/driver-link";
import { companyRecipients, sendMail } from "@/lib/mail";
import { updateJSON } from "@/lib/store";
import { companyRoutesEmail, customerDeliveredEmail, driverRouteText, siteUrl } from "@/lib/templates";
import { sendSms, twilioConfig } from "@/lib/twilio";
import type { DeliveryEvent, Message, Order } from "@/lib/types";

const KEEP = 400;

export async function recordMessages(messages: Message[]): Promise<void> {
  if (!messages.length) return;
  await updateJSON<Message[]>("messages.json", [], (list) => [...messages, ...list].slice(0, KEEP));
}

function base(partial: Omit<Message, "id" | "at">): Message {
  return { id: randomUUID(), at: new Date().toISOString(), ...partial };
}

export type SendSummary = { sent: number; dryRun: number; failed: number; skipped: string[] };

export async function textDrivers(portal: Portal, date: string): Promise<SendSummary> {
  const config = twilioConfig();
  const summary: SendSummary = { sent: 0, dryRun: 0, failed: 0, skipped: [] };
  const out: Message[] = [];
  for (const route of portal.routes.filter((r) => r.date === date && r.stops.length)) {
    const driver = portal.drivers.find((d) => d.id === route.driverId);
    if (!driver) continue;
    const body = driverRouteText(route, driver, portal.orders, `${siteUrl()}/d/${driverToken(driver.id)}`);
    if (!driver.smsOptIn) {
      summary.skipped.push(driver.name);
      out.push(base({ channel: "sms", kind: "driver-route", to: driver.phone, toName: driver.name, subject: "", body, status: "failed", error: "Driver has not replied YES to route texts." }));
      continue;
    }
    if (!config) {
      summary.dryRun += 1;
      out.push(base({ channel: "sms", kind: "driver-route", to: driver.phone, toName: driver.name, subject: "", body, status: "dry-run", error: "Twilio is not set up yet." }));
      continue;
    }
    const result = await sendSms(config, driver.phone, body);
    if (result.ok) summary.sent += 1;
    else summary.failed += 1;
    out.push(base({ channel: "sms", kind: "driver-route", to: driver.phone, toName: driver.name, subject: "", body, status: result.ok ? "sent" : "failed", error: result.ok ? undefined : result.error }));
  }
  await recordMessages(out);
  return summary;
}

export async function emailCompany(portal: Portal, date: string): Promise<SendSummary> {
  const routes = portal.routes.filter((r) => r.date === date && r.stops.length);
  const mail = companyRoutesEmail(date, routes, portal.orders, portal.drivers, portal.trucks);
  const to = companyRecipients();
  const result = to.length ? await sendMail(to, mail.subject, mail.html) : ({ ok: false, dryRun: true, error: "COMPANY_ROUTES_TO is not set." } as const);
  const status: Message["status"] = result.ok ? "sent" : "dryRun" in result && result.dryRun ? "dry-run" : "failed";
  await recordMessages([
    base({ channel: "email", kind: "company-routes", to: to.join(", ") || "company list", toName: "Company distribution list", subject: mail.subject, body: "", status, error: result.ok ? undefined : result.error }),
  ]);
  return { sent: status === "sent" ? 1 : 0, dryRun: status === "dry-run" ? 1 : 0, failed: status === "failed" ? 1 : 0, skipped: [] };
}

export async function emailCustomerDelivered(order: Order, event: DeliveryEvent, portal: Portal): Promise<Message["status"]> {
  const driver = portal.drivers.find((d) => d.id === event.driverId);
  const photoUrls = (event.photos ?? []).map((key) => `${siteUrl()}/api/photo/${key}`);
  const mail = customerDeliveredEmail(order, event, driver, photoUrls);
  const result = order.contactEmail ? await sendMail(order.contactEmail, mail.subject, mail.html, mail.text) : ({ ok: false, error: "No customer email on the order." } as const);
  const status: Message["status"] = result.ok ? "sent" : "dryRun" in result && result.dryRun ? "dry-run" : "failed";
  await recordMessages([
    base({ channel: "email", kind: "customer-delivered", to: order.contactEmail || "(none)", toName: order.customer, subject: mail.subject, body: mail.text, status, error: result.ok ? undefined : result.error }),
  ]);
  return status;
}
