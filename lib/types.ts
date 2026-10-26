/** Shapes shared by every page. NetSuite and Fleetio data are mapped into these. */

export type OrderKind = "sale" | "rental" | "pickup";

export type OrderStatus = "ready" | "routed" | "out" | "delivered" | "exception";

export type LineItem = { sku: string; name: string; qty: number };

export type Order = {
  /** NetSuite internal id. */
  id: string;
  /** Document number shown to people, e.g. SO-48213. */
  number: string;
  kind: OrderKind;
  customer: string;
  contact: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  /** Requested delivery date, yyyy-mm-dd. */
  shipDate: string;
  /** "07:00-10:00" style window, or "" for any time. */
  window: string;
  items: LineItem[];
  weightLbs: number;
  salesRep: string;
  notes: string;
  /** Needs a CDL truck (flatbed loads, heavy trailers). */
  needsCdl: boolean;
};

export type Driver = {
  id: string;
  name: string;
  phone: string;
  email: string;
  license: "CDL-A" | "CDL-B" | "Non-CDL";
  /** Agreed to route texts by replying YES. */
  smsOptIn: boolean;
  defaultTruckId: string;
};

export type TruckStatus = "moving" | "stopped" | "at-stop" | "yard" | "offline";

export type Truck = {
  id: string;
  unit: string;
  type: string;
  plate: string;
  capacityLbs: number;
  cdl: boolean;
  odometer: number;
  nextServiceMiles: number;
  fleetioId: string | null;
  lat: number;
  lon: number;
  speedMph: number;
  heading: number;
  status: TruckStatus;
  /** ISO time of the last GPS ping. */
  lastPing: string;
  address: string;
};

export type StopStatus = "pending" | "en-route" | "arrived" | "delivered" | "exception";

export type Stop = {
  orderId: string;
  /** "08:40" planned arrival. */
  eta: string;
  status: StopStatus;
  /** ISO time it was marked delivered. */
  doneAt?: string;
};

export type RouteStatus = "planned" | "loading" | "out" | "complete";

export type Route = {
  id: string;
  date: string;
  name: string;
  driverId: string;
  truckId: string;
  departure: string;
  status: RouteStatus;
  stops: Stop[];
  miles: number;
};

export type EventType = "departed" | "arrived" | "delivered" | "exception" | "note" | "returned";

export type DeliveryEvent = {
  id: string;
  at: string;
  type: EventType;
  routeId: string;
  orderId: string | null;
  driverId: string;
  note: string;
  receivedBy?: string;
  photos?: string[];
  lat?: number;
  lon?: number;
  customerEmailed?: boolean;
};

export type MessageChannel = "sms" | "email";
export type MessageKind = "driver-route" | "company-routes" | "customer-delivered" | "customer-eta";
export type MessageStatus = "sent" | "dry-run" | "failed" | "scheduled";

export type Message = {
  id: string;
  at: string;
  channel: MessageChannel;
  kind: MessageKind;
  to: string;
  toName: string;
  subject: string;
  body: string;
  status: MessageStatus;
  error?: string;
};
