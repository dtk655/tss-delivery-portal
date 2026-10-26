import { useEffect, useMemo, useState } from 'react';
import { formatBoardDate, formatGeneratedAt } from '../lib/format';
import { selectRoutes } from '../lib/select-routes';
import type { DispatchBoard } from '../lib/types';
import EmailPanel from './EmailPanel';
import RouteColumn from './RouteColumn';

const PASSWORD_KEY = 'tss-dispatch-password';

function storedPassword(): string {
  try {
    return sessionStorage.getItem(PASSWORD_KEY) ?? '';
  } catch {
    return '';
  }
}

function summarize(routes: DispatchBoard['routes']): string {
  const deliveries = routes.flatMap((route) => route.stops.filter((stop) => stop.kind === 'delivery'));
  const stopKeys = new Set(deliveries.map((stop) => `${stop.label}|${stop.address}`));
  const orders = new Set(deliveries.flatMap((stop) => stop.sos));
  const trucks = routes.filter((route) => route.kind === 'pickup' || route.kind === 'box').length;
  return `${trucks} truck${trucks === 1 ? '' : 's'} · ${stopKeys.size} stop${stopKeys.size === 1 ? '' : 's'} · ${orders.size} order${orders.size === 1 ? '' : 's'}`;
}

export default function DispatchApp() {
  const [board, setBoard] = useState<DispatchBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gate, setGate] = useState(false);
  const [password, setPassword] = useState('');
  const [boxId, setBoxId] = useState('box_511_plus_babylon');
  const [showOption, setShowOption] = useState(false);

  async function load(source?: 'fixture' | 'netsuite', passwordOverride?: string) {
    setLoading(true);
    setError('');
    const sent = passwordOverride ?? storedPassword();
    const params = source ? `?source=${source}` : '';
    try {
      const response = await fetch(`/api/plan${params}`, {
        cache: 'no-store',
        headers: sent ? { 'x-dispatch-password': sent } : {},
      });
      const body = (await response.json()) as DispatchBoard & { error?: string; gate?: boolean };
      if (response.status === 401 || body.gate) {
        setGate(true);
        setBoard(null);
        if (sent) {
          try {
            sessionStorage.removeItem(PASSWORD_KEY);
          } catch {
            /* private mode */
          }
          setError('That password did not match.');
        }
        return;
      }
      if (!response.ok) {
        setError(body.error || 'The board could not be loaded.');
        return;
      }
      setGate(false);
      setBoard(body);
    } catch {
      setError('The board could not be loaded. Check the connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!board) return;
    if (!board.routes.some((route) => route.id === boxId)) {
      const next = board.defaultRouteIds.find((id) => id !== 'juan_pickup') ?? board.routes.find((route) => route.kind === 'box')?.id;
      if (next) setBoxId(next);
    }
  }, [board, boxId]);

  const routes = useMemo(
    () => (board ? selectRoutes(board, { boxId, showOption }) : []),
    [board, boxId, showOption],
  );
  const hasChoice = Boolean(board?.routes.some((route) => route.id === 'box_511') && board.routes.some((route) => route.id === 'box_511_plus_babylon'));

  function lock() {
    try {
      sessionStorage.removeItem(PASSWORD_KEY);
    } catch {
      /* private mode */
    }
    setBoard(null);
    setGate(true);
    setPassword('');
  }

  const dateLabel = board ? formatBoardDate(board.date) : '';
  const sourceLabel = !board
    ? ''
    : board.source === 'fixture'
      ? 'Sample plan'
      : `NetSuite · pulled ${board.generatedAt ? formatGeneratedAt(board.generatedAt) : 'just now'}`;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 3 28 28H4L16 3Z" fill="#ffe14a" />
            <path d="M8 22h16" stroke="#1a1d1a" strokeWidth="2" />
          </svg>
          <p className="eyebrow">Traffic Safety Service</p>
          <h1>Delivery board</h1>
          <p className="date">
            {dateLabel || 'South Plainfield'}
            {sourceLabel && <span className="pill">{sourceLabel}</span>}
          </p>
        </div>
        <div className="toolbar">
          {board && <p className="counts">{summarize(routes)}</p>}
          <div className="actions">
            <button className="btn primary" type="button" onClick={() => void load('netsuite')} disabled={loading || gate}>
              {loading ? 'Loading…' : 'Refresh from NetSuite'}
            </button>
            <button className="btn ghost" type="button" onClick={() => void load('fixture')} disabled={loading || gate}>
              Load sample plan
            </button>
            {!gate && (
              <a className="btn ghost" href="#email">
                Email preview
              </a>
            )}
            {board?.gated && (
              <button className="btn ghost" type="button" onClick={lock}>
                Lock
              </button>
            )}
          </div>
          {!gate && (
            <p className="hint">
              {board?.credentialsConfigured
                ? 'NetSuite credentials are set. Refresh pulls packed orders.'
                : 'Showing the October 23 sample until the NetSuite variables are set.'}
            </p>
          )}
        </div>
      </header>
      <div className="stripe" aria-hidden="true" />
      <main className="wrap">
        {gate && (
          <form
            className="gate-card"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                sessionStorage.setItem(PASSWORD_KEY, password);
              } catch {
                /* private mode */
              }
              void load(undefined, password);
            }}
          >
            <h2>Board locked</h2>
            <p>Enter the shared office password. It stays in this browser tab until you lock it.</p>
            <label htmlFor="dispatch-password">Shared password</label>
            <input
              id="dispatch-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Open board'}
            </button>
          </form>
        )}

        {!gate && error && (
          <div className="alert" role="alert">
            <p>{error}</p>
          </div>
        )}

        {!gate && loading && !board && (
          <div className="columns" aria-busy="true">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        )}

        {!gate && board && (
          <div data-testid="dispatch-board">
            <p className="rule">{board.rule}</p>
            <p className="routing">{board.routingNote}</p>
            {board.warnings.length > 0 && (
              <div className="banner" role="status">
                {board.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
            {hasChoice && (
              <fieldset className="chooser">
                <legend>Truck 511</legend>
                <label>
                  <input
                    type="radio"
                    name="box"
                    checked={boxId === 'box_511_plus_babylon'}
                    onChange={() => setBoxId('box_511_plus_babylon')}
                  />
                  Incl. Babylon
                  {board.routes.find((route) => route.id === 'box_511_plus_babylon')?.totalMi != null &&
                    ` · ${board.routes.find((route) => route.id === 'box_511_plus_babylon')!.totalMi!.toFixed(1)} mi`}
                </label>
                <label>
                  <input type="radio" name="box" checked={boxId === 'box_511'} onChange={() => setBoxId('box_511')} />
                  Without Babylon
                  {board.routes.find((route) => route.id === 'box_511')?.totalMi != null &&
                    ` · ${board.routes.find((route) => route.id === 'box_511')!.totalMi!.toFixed(1)} mi`}
                </label>
                <label>
                  <input type="checkbox" checked={showOption} onChange={(event) => setShowOption(event.target.checked)} />
                  Show Long Island option
                </label>
              </fieldset>
            )}
            <div className="columns">
              {routes.map((route) => (
                <RouteColumn route={route} key={route.id} />
              ))}
            </div>
            {board.flags.length > 0 && (
              <section className="flags">
                <h2>Dispatch notes</h2>
                {board.flags.map((flag) => (
                  <p className={flag.level === 'warn' ? 'flag warn' : 'flag'} key={flag.text}>
                    {flag.text}
                  </p>
                ))}
              </section>
            )}
            <EmailPanel
              date={board.date}
              source={board.source}
              routes={routes}
              flags={board.flags}
              routingNote={board.routingNote}
            />
            <footer className="foot">
              <p>Traffic Safety Service · 601 Hadley Rd and 448 Hollywood Ave, South Plainfield, NJ 07080</p>
              <p>Phase 1 reads packed orders and drafts the office email. Driver texts, Fleetio, and customer mail come later.</p>
            </footer>
          </div>
        )}
      </main>
    </>
  );
}
