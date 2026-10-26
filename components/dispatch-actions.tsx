"use client";

import { useState, useTransition } from "react";
import { Mail, MessageSquareText, Send, X } from "lucide-react";
import { sendCompanyEmail, sendDriverTexts } from "@/app/actions";
import type { SendSummary } from "@/lib/notify";

type TextPreview = { driver: string; phone: string; optIn: boolean; body: string };

function summaryLine(s: SendSummary, noun: string): string {
  const parts: string[] = [];
  if (s.sent) parts.push(`${s.sent} ${noun} sent`);
  if (s.dryRun) parts.push(`${s.dryRun} recorded as preview (not connected yet)`);
  if (s.failed) parts.push(`${s.failed} failed`);
  if (s.skipped.length) parts.push(`skipped ${s.skipped.join(", ")} (not opted in)`);
  return parts.join(" · ") || "Nothing to send.";
}

export function DispatchActions({
  date,
  dateLabel,
  texts,
  emailHtml,
  emailSubject,
  recipients,
}: {
  date: string;
  dateLabel: string;
  texts: TextPreview[];
  emailHtml: string;
  emailSubject: string;
  recipients: string;
}) {
  const [open, setOpen] = useState<"texts" | "email" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (kind: "texts" | "email") =>
    start(async () => {
      try {
        const s = kind === "texts" ? await sendDriverTexts(date) : await sendCompanyEmail(date);
        setResult(summaryLine(s, kind === "texts" ? "texts" : "email"));
      } catch (error) {
        setResult(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setOpen("texts");
        }}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 shadow-sm hover:border-stone-400"
      >
        <MessageSquareText className="size-4" /> Text drivers
      </button>
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setOpen("email");
        }}
        className="btn-ink inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold"
      >
        <Mail className="size-4" /> Email company
      </button>

      {open ? (
        <div className="no-print fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto px-4 py-[6vh]">
          <div className="cmd-backdrop fixed inset-0 bg-stone-950/45 backdrop-blur-[2px]" onClick={() => setOpen(null)} aria-hidden />
          <div role="dialog" aria-modal="true" className="cmd-panel relative w-full max-w-3xl overflow-hidden rounded-2xl border border-stone-300/70 bg-white shadow-lg">
            <div className="flex items-center gap-3 border-b border-stone-200 px-5 py-4">
              <span className="flex size-9 items-center justify-center rounded-lg bg-asphalt text-sheeting">
                {open === "texts" ? <MessageSquareText className="size-[1.1rem]" /> : <Mail className="size-[1.1rem]" />}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-stone-950">{open === "texts" ? "Route texts to drivers" : "Company route email"}</h2>
                <p className="text-sm text-stone-500">
                  {open === "texts" ? `${texts.length} drivers · routes for ${dateLabel}` : `To ${recipients} · ${emailSubject}`}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="ml-auto flex size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto bg-stone-50 p-5">
              {open === "texts" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {texts.map((t) => (
                    <div key={t.phone} className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-stone-950">{t.driver}</div>
                          <div className="text-xs text-stone-500">{t.phone}</div>
                        </div>
                        <span className={`pill ${t.optIn ? "pill-done" : "pill-bad"}`}>{t.optIn ? "Opted in" : "Not opted in"}</span>
                      </div>
                      <div className="mt-3 rounded-2xl rounded-tl-md bg-[#e9e9eb] px-3.5 py-2.5 text-[0.85rem] leading-snug whitespace-pre-line text-stone-900 [overflow-wrap:anywhere]">{t.body}</div>
                    </div>
                  ))}
                  {texts.length === 0 ? <p className="text-sm text-stone-500">No routes with stops for this day.</p> : null}
                </div>
              ) : (
                <iframe title="Email preview" srcDoc={emailHtml} className="mail-frame h-[56vh] rounded-xl border border-stone-200" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 px-5 py-4">
              <p className="min-w-0 flex-1 text-sm text-stone-600">
                {result ?? (open === "texts" ? "Each driver gets their own route and a private link for logging stops." : "Sends every route for the day to the company list.")}
              </p>
              <button type="button" onClick={() => setOpen(null)} className="h-10 rounded-lg px-4 text-sm font-semibold text-stone-600 hover:bg-stone-100">
                {result ? "Done" : "Cancel"}
              </button>
              {!result ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(open)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-tss-red px-4 text-sm font-semibold text-white hover:bg-[#c10500] disabled:opacity-60"
                >
                  <Send className="size-4" /> {pending ? "Sending…" : open === "texts" ? `Send ${texts.length} texts` : "Send email"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
