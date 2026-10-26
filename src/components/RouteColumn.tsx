import { milesLabel } from '../lib/format';
import type { RoutePlan, RouteStop } from '../lib/types';

function shipClass(loc: string): string {
  return /hollywood|448/i.test(loc) ? 'chip yard' : 'chip';
}

function StopRow({ stop }: { stop: RouteStop }) {
  const yard = stop.kind !== 'delivery';
  return (
    <article className={yard ? 'stop yard' : 'stop'}>
      <div className="time">{stop.eta}</div>
      <div>
        {stop.kind === 'load' && <p className="kicker">Yard</p>}
        {stop.kind === 'return' && <p className="kicker">Depot</p>}
        {stop.town && stop.kind === 'delivery' && <p className="town">{stop.town}</p>}
        <h3 className="customer">
          {stop.label}
          {stop.code && <span className="code">{stop.code}</span>}
        </h3>
        {stop.sos.length > 0 && (
          <div className="sos">
            {stop.sos.map((so) => (
              <span className="so" key={so}>
                {so}
              </span>
            ))}
          </div>
        )}
        <p className="address">{stop.address}</p>
        {(stop.shipFrom.length > 0 || stop.deliverBy) && (
          <div className="chips">
            {stop.shipFrom.map((loc) => (
              <span className={shipClass(loc)} key={loc}>
                Ships from {loc}
              </span>
            ))}
            {stop.deliverBy && <span className="chip deadline">Deliver before {stop.deliverBy}</span>}
          </div>
        )}
        {stop.notes.map((note) => (
          <p className="notes" key={note}>
            {note}
          </p>
        ))}
        {stop.memo.map((memo) => (
          <p className="memo" key={memo}>
            {memo}
          </p>
        ))}
        {stop.legMi != null && <p className="leg">{milesLabel(stop.legMi)} mi from the previous point</p>}
        {stop.items.length > 0 && (
          <ul className="items">
            {stop.items.map((item, index) => (
              <li className="item" key={`${item}-${index}`}>
                {item}
              </li>
            ))}
          </ul>
        )}
        {stop.fulfillments.length > 0 && (
          <details className="fulfillments">
            <summary>{stop.fulfillments.length} packed fulfillment{stop.fulfillments.length === 1 ? '' : 's'}</summary>
            <ul>
              {stop.fulfillments.map((fulfillment) => (
                <li key={fulfillment}>{fulfillment}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}

export default function RouteColumn({ route }: { route: RoutePlan }) {
  const deliveries = route.stops.filter((stop) => stop.kind === 'delivery');
  const kicker =
    route.kind === 'pickup'
      ? 'Pickup'
      : route.kind === 'box'
        ? 'Box truck'
        : route.kind === 'unscheduled'
          ? 'Not on today’s trucks'
          : 'Option';
  return (
    <section className="route" data-kind={route.kind} data-testid="route-column">
      <p className="kicker">{kicker}</p>
      <h2 className="vehicle">{route.vehicle}</h2>
      {route.driverNote && <p className="driver-note">{route.driverNote}</p>}
      <p className="stats">
        {route.totalMi == null ? 'Miles pending' : `${milesLabel(route.totalMi)} mi`}
        {route.driveMin != null && <span> · {route.driveMin} min driving</span>}
        <span> · back {route.backAt}</span>
        <span> · {deliveries.length} stop{deliveries.length === 1 ? '' : 's'}</span>
      </p>
      {route.mapsUrl && (
        <a className="maps" href={route.mapsUrl} target="_blank" rel="noopener noreferrer">
          Google Maps directions
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      {route.stops.length === 0 ? (
        <p className="empty">No packed orders for this truck.</p>
      ) : (
        route.stops.map((stop, index) => <StopRow stop={stop} key={`${stop.kind}-${stop.label}-${index}`} />)
      )}
    </section>
  );
}
