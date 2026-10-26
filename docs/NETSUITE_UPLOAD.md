# NetSuite → Delivery Portal upload (for the Grok bot)

The portal never connects to NetSuite. The Grok bot (read-only NetSuite access) posts the
orders that are ready to ship, the same way it feeds the lane closure board.

```
POST https://<delivery-site>/api/data-upload
Header: x-upload-secret: <DATA_UPLOAD_SECRET>
Header: Content-Type: application/json
```

Each upload replaces the previous order list, so send every open order that is picked/ready
(today and the next few days), not just new ones. Every 15–30 minutes during the day is plenty.

## Body

```json
{
  "orders": [
    {
      "id": "880024",                 // NetSuite internal id (required)
      "number": "SO-48024",           // tranid shown to people
      "kind": "sale",                 // "sale" | "rental" | "pickup"
      "customer": "Customer name",
      "contact": "Site contact name",
      "contactEmail": "orders@customer.com",  // gets the "delivered" email
      "contactPhone": "7325551234",
      "address": "45 Municipal Plaza",
      "city": "Morristown",
      "state": "NJ",
      "lat": 40.7968,                 // required: geocode the ship-to address
      "lon": -74.4815,                // required
      "shipDate": "2026-10-27",       // yyyy-mm-dd (required)
      "window": "07:00-09:00",        // optional delivery window, 24-hour
      "items": [{ "sku": "CONE-28", "name": "28\" Traffic Cone", "qty": 60 }],
      "weightLbs": 556,
      "salesRep": "Joe M.",
      "notes": "Gate 3. Hard hat and vest required.",
      "needsCdl": false
    }
  ],
  "drivers": [
    { "id": "d1", "name": "Marcus Bell", "phone": "9085550141", "license": "CDL-A",
      "smsOptIn": true, "defaultTruckId": "t1" }
  ]
}
```

`drivers` is optional; leave it out and the portal keeps its own list.

## Where to find these in NetSuite (SuiteQL starting points)

- Sales orders pending fulfillment: `transaction` where `type = 'SalesOrd'` and status is
  Pending Fulfillment / Partially Fulfilled, `shipdate` in the next few days.
- Ship-to: the order's shipping address (`shippingaddress`): addr1, city, state.
- Lines: `transactionline` (item, quantity) joined to `item` for name and weight.
- Rentals and pickups: whichever record type / custom form your rental orders use.

## Response

`{ "ok": true, "orders": 24, "drivers": 0, "skipped": [] }` — `skipped` lists any order that
was missing an id, ship date, or coordinates.

Once the first upload lands, the portal switches from sample data to live data automatically.
The same site-wide Netlify Blobs store (`tss-delivery`, key `orders.json`) is what the pages
read on each load. `{ "ok": true }` means that snapshot was saved. Refresh the dashboard: the
badge should say “NetSuite synced”, Ready to ship should equal `orders`, and Ready to Ship
should list every order in the body. No extra Blobs environment variables are required.
`DATA_UPLOAD_SECRET` must still match the `x-upload-secret` header.
