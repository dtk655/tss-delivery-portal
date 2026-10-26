# TSS Delivery Portal

Dispatch, live fleet tracking and proof of delivery for Traffic Safety Service. Same design system
as the lane closure portal (tssmptscheduler): asphalt sidebar, TSS red and sheeting yellow, Overpass
headings, command bar (⌘K), keyboard shortcuts.

## Pages

| Page | What it does |
| --- | --- |
| **Dashboard** | Today's routes with live progress, drop-offs vs. remaining, live driver log, automation status, deliveries by day |
| **Live Fleet** | Full-screen dark map of every truck from Fleetio GPS; click a truck to see its route and stops |
| **Delivery Log** | Every driver update: left the yard, arrived, delivered (who received it, photos), problems, notes |
| **Ready to Ship** | NetSuite orders that are picked and ready; put each on a route |
| **Route Planner** | Routes per day: stops, ETAs, truck load vs. capacity, CDL check; text drivers and email the company |
| **Route sheet** | One route, printable, with a map and the driver's updates |
| **Messages** | Previews of the driver text, company route email and customer "delivered" email, plus the outbox |
| **Drivers & Trucks** | Driver roster with each driver's private phone link; truck list with service due |
| **Driver view** `/d/<link>` | Phone page for drivers: route, navigate, call, "I'm here", "Delivered" with name, note and photos |

When a driver taps **Delivered**, the stop updates on every dispatch screen and the customer is
emailed a branded delivery notice (with the photos).

## Data sources

- **NetSuite** (read only): the Grok bot posts orders to `/api/data-upload`. See
  [docs/NETSUITE_UPLOAD.md](docs/NETSUITE_UPLOAD.md). Until the first upload, every page shows
  clearly labeled sample data. The snapshot lives in Netlify Blobs (store `tss-delivery`).
  Pages and the upload route open that same store; no extra Blobs token or `DATABASE_URL` is
  required. After a deploy, reload the dashboard. Post the orders again only if the badge
  still says “Sample data”.
- **Fleetio**: truck list and GPS from the Fleetio API (`FLEETIO_API_KEY`, `FLEETIO_ACCOUNT_TOKEN`).
- **Twilio**: driver route texts. **SMTP (Outlook)**: customer and company emails.
- Everything the portal writes (route edits, driver log, photos, outbox) is in Netlify Blobs.

Nothing is sent until the matching keys are set; until then sends are recorded in Messages as
"Preview only".

## Setup on Netlify

1. Add a new site from this repo (build command `npm run build`, Node 22; `netlify.toml` covers it).
2. Set `APP_PASSWORD` and `AUTH_SECRET`. The rest of `.env.example` can be added as each piece is ready.
3. For the evening texts/email, set `CRON_SECRET` and `ENABLE_AUTO_DISPATCH=true`.

## Local

```
npm install
npm run dev     # http://localhost:3848, password tss-director
```
