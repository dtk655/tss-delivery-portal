import { describe, expect, it } from 'vitest';
import { renderRouteEmail } from '../src/lib/email';
import { selectRoutes } from '../src/lib/select-routes';
import { fixtureBoard } from '../src/lib/fixture';

describe('email', () => {
  it('renders the visible sample routes and escapes HTML', () => {
    const board = fixtureBoard({ credentialsConfigured: false, gated: false });
    const routes = selectRoutes(board, { boxId: 'box_511_plus_babylon', showOption: false });
    const draft = renderRouteEmail({
      date: board.date,
      source: 'fixture',
      routes,
      flags: board.flags,
      routingNote: board.routingNote,
    });
    expect(draft.subject).toContain('Oct 23, 2026');
    expect(draft.html).toContain('SO9127');
    expect(draft.html).toContain('SO9225');
    expect(draft.html).toContain('SO9229');
    expect(draft.html).not.toContain('Long Island run');
    expect(draft.html).toContain('SO8612');
    expect(draft.html).toContain('Preview only');
    expect(draft.html).not.toContain('mailto:');
    expect(draft.html).toContain('https://www.google.com/maps/dir/');
    const escaped = renderRouteEmail({
      date: '2026-10-23',
      source: 'fixture',
      routes: [
        {
          ...routes[0]!,
          vehicle: 'A & B <script>',
          stops: [],
        },
      ],
      flags: [],
      routingNote: 'note',
    });
    expect(escaped.html).toContain('A &amp; B &lt;script&gt;');
    expect(escaped.html).not.toContain('<script>');
  });

  it('swaps the shorter truck 511 plan when Babylon is off', () => {
    const board = fixtureBoard({ credentialsConfigured: false, gated: false });
    const routes = selectRoutes(board, { boxId: 'box_511', showOption: true });
    expect(routes.map((route) => route.id)).toEqual(['juan_pickup', 'box_511', 'long_island_run_option']);
  });
});
