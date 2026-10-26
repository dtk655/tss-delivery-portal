export type DataSource = 'fixture' | 'netsuite';

export interface DispatchFlag {
  level: 'info' | 'warn';
  text: string;
}

export interface RouteStop {
  label: string;
  code?: string;
  kind: 'load' | 'delivery' | 'return';
  customers: string[];
  sos: string[];
  fulfillments: string[];
  items: string[];
  address: string;
  town: string;
  shipFrom: string[];
  memo: string[];
  notes: string[];
  deliverBy?: string;
  eta: string;
  legMi: number | null;
  dwellMin?: number;
}

export interface RoutePlan {
  id: string;
  kind: 'pickup' | 'box' | 'unscheduled' | 'option';
  role: 'primary' | 'alternate';
  vehicle: string;
  driverNote?: string;
  start: string;
  stops: RouteStop[];
  totalMi: number | null;
  driveMin: number | null;
  totalHr: number | null;
  backAt: string;
  mapsUrl: string | null;
}

export interface DispatchBoard {
  source: DataSource;
  date: string;
  generatedAt: string | null;
  rule: string;
  routingNote: string;
  credentialsConfigured: boolean;
  gated: boolean;
  defaultRouteIds: string[];
  routes: RoutePlan[];
  flags: DispatchFlag[];
  warnings: string[];
}

/** One kept item-fulfillment line, ready to group into a stop. */
export interface FulfillmentLine {
  so: string;
  customer: string;
  memo: string;
  ifnum: string;
  ifdate: string;
  item: string;
  itemtype: string;
  kitcomponent: string;
  quantity: number;
  quantityshiprecv: number | null;
  loc: string;
  addr1: string;
  addr2: string;
  addressee: string;
  attention: string;
  addrphone: string;
  city: string;
  state: string;
  zip: string;
  shipmethod: string;
}

export interface StopDraft {
  id: string;
  customers: string[];
  sos: string[];
  fulfillments: string[];
  items: string[];
  address: string;
  mapsAddress: string;
  town: string;
  shipFrom: string[];
  memo: string[];
  notes: string[];
  packed: { so: string; ifnum: string; packedOn: string }[];
  lat: number | null;
  lon: number | null;
}

export interface PlanError {
  error: string;
  gate?: boolean;
}
