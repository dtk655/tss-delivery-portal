# TSS Delivery Portal

Dispatch board for [Traffic Safety Service](https://trafficsafetyservice.com). Phase 1 reads packed sales orders from NetSuite and lays them on two trucks: Juan’s pickup and box truck 511. It also drafts the company-wide route email. Nothing is sent, and nothing is written back to NetSuite.

The October 23, 2026 plan is built in, so the board works before any credentials exist.

## What you get

- One column per truck: customer, sales orders, items and quantities, town, and where the freight ships from.
- A Google Maps directions link for each route, starting and ending at **601 Hadley Rd, South Plainfield, NJ 07080**. Stops that ship from the Hollywood yard add a load at **448 Hollywood Ave**.
- **Refresh from NetSuite** runs a read-only SuiteQL query: ship method TSS Delivery Fleet (internal id `517`) and item fulfillment status Packed (`B`). Closed and Cancelled sales orders are excluded. Lines for the same street and ZIP are one stop.
- Light freight (signs, cones, posts, Scorpion parts, Windmaster stands) goes on Juan’s pickup. Crashgards, barriers, and Graco units go on truck 511. A stop more than 100 road miles from Hadley stays in an “Unscheduled long haul” column.
- An email preview of the routes on screen, with copy and download. Send it from your own mail client.

Later phases (not in this repo yet): driver SMS, Fleetio, driver drop logs, customer delivery emails.

## Run it locally

Requires Node.js 22.23.4 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:4321. You should see Juan’s pickup (86.3 mi, back 11:22 AM) and truck 511 including Babylon (146.5 mi). Use the Truck 511 control to switch to the shorter fallback, or to show the Long Island option.

```bash
npm test
npm run build
```

`npm run dev` serves the same `/api/plan` route the Netlify Function serves in production. With the five `NETSUITE_*` variables empty, that route returns the sample plan.

To try a live pull on your machine, copy the example file and fill it in. `.env` is gitignored.

```bash
cp .env.example .env
```

Then restart `npm run dev` and click **Refresh from NetSuite**.

## Deploy on Netlify from GitHub

The repo is `dtk655/tss-delivery-portal`. [`netlify.toml`](netlify.toml) already sets the build.

1. Sign in at [app.netlify.com](https://app.netlify.com).
2. **Add new site** → **Import an existing project**.
3. Choose **GitHub** and authorize Netlify if it asks. Pick **dtk655/tss-delivery-portal**.
4. Branch: `main`. Netlify should read the build from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Deploy. The first deploy has no secrets, so the site opens on the October 23 sample. That is the expected check that the build worked.
6. After the sample board looks right, add environment variables (next section) and click **Refresh from NetSuite** on the site. Function variables are read on each refresh, so you do not need a new build just to add them.

Node 22 is set in `netlify.toml` and `.nvmrc`. Astro 7 needs Node `22.23.4` or newer. If a build image is older than that, set `NODE_VERSION` to a current 22.x in Site configuration → Environment variables.

## Environment variables

Set these under **Site configuration → Environment variables**. Scope them to **Functions** (runtime). Builds do not need them. Do not put the values in git.

| Name | What it is |
| --- | --- |
| `NETSUITE_ACCOUNT_ID` | Account id `9787422`. A sandbox looks like `9787422_SB1`. |
| `NETSUITE_CONSUMER_KEY` | Integration consumer key |
| `NETSUITE_CONSUMER_SECRET` | Integration consumer secret |
| `NETSUITE_TOKEN_ID` | Token-based auth token id |
| `NETSUITE_TOKEN_SECRET` | Token-based auth token secret |

The token’s role needs **Log in using Access Tokens**, **REST Web Services**, and **SuiteAnalytics Workbook** (SuiteQL), plus view access to sales orders and item fulfillments. It does not need any write permission.

The query lives in [`src/lib/suiteql.ts`](src/lib/suiteql.ts). It POSTs a `SELECT` to `https://{account}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql` with `Prefer: transient` and OAuth 1.0a HMAC-SHA256. Packed quantity is the absolute value of the fulfillment line (SuiteQL often returns that number negative). Kit components and shipping-charge lines are left off the item list. If NetSuite rejects a column name, the function retries once without the optional filters and shows the error on the board.

## Optional lock

Phase 1 is usable with the board open. Before you share the URL, lock it — the board lists customers, order numbers, and delivery addresses.

**Shared password (built in).** Add a Function environment variable named `DISPATCH_PASSWORD`. `/api/plan` then returns the board only when the browser sends that password. The lock form stores it in `sessionStorage` for the tab. It is not in `.env.example` on purpose; that file is the NetSuite list only. Locally:

```bash
DISPATCH_PASSWORD='choose-one' npm run dev
```

**Netlify Identity.** Site configuration → Identity → Enable Identity, set registration to Invite only, and invite the office. Identity by itself does not hide this static site. The password above is the lock that actually gates the order data. On plans that include it, **Project configuration → Access & security → Visitor access** can put a second password on the whole site.

## How a refresh is routed

The function groups packed lines by street and ZIP, geocodes them with the US Census geocoder, and asks the public OSRM demo for road miles. If either service is down, miles fall back to a straight-line estimate and the Google Maps link still uses the street address. ETAs assume a 7:00 AM Eastern start, 20 minutes at each stop, and 15 minutes when the truck loads at Hollywood.

The sample plan does not re-route. It shows the precomputed October 23 miles, including the Babylon and Long Island alternatives.

## Project layout

- `src/pages/index.astro` — the board
- `netlify/functions/plan.ts` — Netlify Function at `/api/plan`
- `src/server/plan-handler.ts` — fixture vs NetSuite, and the password check
- `src/lib/suiteql.ts` — read-only query
- `src/lib/oauth.ts` — TBA signer
- `src/data/plan-2026-10-23.json` — sample plan

`npm run dev` mounts that handler at `/api/plan` so you can work without the Netlify CLI. Production uses the function in `netlify/functions`.
