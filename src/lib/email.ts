import { HADLEY, HOLLYWOOD } from './constants';
import { formatBoardDate, htmlEscape, milesLabel, safeMapsUrl } from './format';
import type { DispatchFlag, RoutePlan } from './types';

export interface EmailDraft {
  subject: string;
  html: string;
  text: string;
}

function stopBlock(stop: RoutePlan['stops'][number]): { html: string; text: string } {
  const title = htmlEscape(stop.label);
  const town = stop.town && stop.kind === 'delivery' ? ` · ${htmlEscape(stop.town)}` : '';
  const sos = stop.sos.length ? stop.sos.map((so) => htmlEscape(so)).join(', ') : '';
  const leg = stop.legMi == null ? '' : `${milesLabel(stop.legMi)} mi`;
  const meta = [
    stop.address ? htmlEscape(stop.address) : '',
    stop.shipFrom.length ? `Ships from ${htmlEscape(stop.shipFrom.join(', '))}` : '',
    stop.deliverBy ? `Deliver before ${htmlEscape(stop.deliverBy)}` : '',
    ...stop.notes.map((note) => htmlEscape(note)),
    ...stop.memo.map((memo) => htmlEscape(memo)),
  ].filter(Boolean);
  const items = stop.items
    .map((item) => `<li style="margin:0 0 2px;font-family:Consolas,Menlo,monospace;font-size:12px;">${htmlEscape(item)}</li>`)
    .join('');
  const html = `
    <tr>
      <td style="padding:10px 8px 10px 0;vertical-align:top;white-space:nowrap;font-weight:700;">${htmlEscape(stop.eta)}</td>
      <td style="padding:10px 0;vertical-align:top;border-top:1px solid #e4dccb;">
        <div style="font-size:16px;font-weight:700;">${title}${town}</div>
        ${sos ? `<div style="margin-top:4px;font-family:Consolas,Menlo,monospace;font-size:12px;">${sos}</div>` : ''}
        ${meta.map((line) => `<div style="margin-top:3px;color:#3f3a32;font-size:13px;">${line}</div>`).join('')}
        ${leg ? `<div style="margin-top:3px;color:#6b6458;font-size:12px;">${leg} from the previous point</div>` : ''}
        ${items ? `<ul style="margin:8px 0 0;padding-left:16px;">${items}</ul>` : ''}
      </td>
    </tr>`;
  const textLines = [
    `${stop.eta} — ${stop.label}${stop.kind === 'delivery' && stop.town ? ` — ${stop.town}` : ''}`,
    stop.sos.length ? `  ${stop.sos.join(', ')}` : '',
    stop.address ? `  ${stop.address}` : '',
    stop.shipFrom.length ? `  Ships from ${stop.shipFrom.join(', ')}` : '',
    stop.deliverBy ? `  Deliver before ${stop.deliverBy}` : '',
    ...stop.notes.map((note) => `  ${note}`),
    ...stop.memo.map((memo) => `  ${memo}`),
    leg ? `  ${leg}` : '',
    ...stop.items.map((item) => `  - ${item}`),
  ].filter(Boolean);
  return { html, text: textLines.join('\n') };
}

export function renderRouteEmail(input: {
  date: string;
  source: 'fixture' | 'netsuite';
  routes: RoutePlan[];
  flags: DispatchFlag[];
  routingNote: string;
}): EmailDraft {
  const dateLabel = formatBoardDate(input.date);
  const subject = `TSS delivery routes · ${dateLabel}`;
  const sourceLine =
    input.source === 'fixture'
      ? 'Sample plan from the October 23 board.'
      : 'Pulled from NetSuite with a read-only SuiteQL query.';
  const routeHtml = input.routes
    .map((route) => {
      const maps = safeMapsUrl(route.mapsUrl);
      const stats = [
        route.totalMi == null ? null : `${milesLabel(route.totalMi)} mi`,
        route.driveMin == null ? null : `${route.driveMin} min driving`,
        `back ${route.backAt}`,
      ]
        .filter(Boolean)
        .join(' · ');
      const stops = route.stops.map((stop) => stopBlock(stop).html).join('');
      return `
        <h2 style="margin:28px 0 4px;font-size:20px;">${htmlEscape(route.vehicle)}</h2>
        <p style="margin:0 0 8px;color:#3f3a32;">Out ${htmlEscape(route.start)} · ${htmlEscape(stats)}${route.driverNote ? ` · ${htmlEscape(route.driverNote)}` : ''}</p>
        ${maps ? `<p style="margin:0 0 8px;"><a href="${htmlEscape(maps)}">Google Maps directions</a></p>` : ''}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${stops}</table>`;
    })
    .join('');
  const flagHtml = input.flags.length
    ? `<h2 style="margin:28px 0 8px;font-size:18px;">Dispatch notes</h2><ul style="margin:0;padding-left:18px;">${input.flags
        .map((flag) => `<li style="margin:0 0 6px;">${htmlEscape(flag.text)}</li>`)
        .join('')}</ul>`
    : '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${htmlEscape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3efe4;color:#1c1914;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3efe4;">
    <tr>
      <td style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#fffdf8;border:1px solid #e2dacb;">
          <tr>
            <td style="background:#1a1d1a;color:#ffffff;padding:20px 24px;">
              <div style="color:#ffe14a;font-size:12px;letter-spacing:0.14em;font-weight:700;">TRAFFIC SAFETY SERVICE</div>
              <div style="font-size:26px;font-weight:700;margin-top:4px;">${htmlEscape(subject)}</div>
              <div style="margin-top:6px;color:#d9d3c5;font-size:14px;">${htmlEscape(sourceLine)} Preview only — copy this into your mail client to send it.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              ${routeHtml || '<p>No routes on the board.</p>'}
              ${flagHtml}
              <p style="margin:28px 0 0;color:#6b6458;font-size:12px;line-height:1.45;">${htmlEscape(input.routingNote)}</p>
              <p style="margin:8px 0 0;color:#6b6458;font-size:12px;line-height:1.45;">Depots: ${htmlEscape(HADLEY.address)} and ${htmlEscape(HOLLYWOOD.address)}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    subject,
    sourceLine,
    'Preview only. Copy this into your mail client to send it.',
    '',
    ...input.routes.flatMap((route) => {
      const maps = safeMapsUrl(route.mapsUrl);
      const stats = [
        route.totalMi == null ? null : `${milesLabel(route.totalMi)} mi`,
        route.driveMin == null ? null : `${route.driveMin} min driving`,
        `back ${route.backAt}`,
      ]
        .filter(Boolean)
        .join(', ');
      return [
        route.vehicle,
        `Out ${route.start}. ${stats}.${route.driverNote ? ` ${route.driverNote}` : ''}`,
        maps ? maps : '',
        ...route.stops.map((stop) => stopBlock(stop).text),
        '',
      ];
    }),
    'Dispatch notes',
    ...input.flags.map((flag) => `- ${flag.text}`),
    '',
    input.routingNote,
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { subject, html, text };
}
