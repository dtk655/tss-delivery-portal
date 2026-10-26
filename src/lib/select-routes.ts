import type { DispatchBoard, RoutePlan } from './types';

export function selectRoutes(board: DispatchBoard, choice: { boxId: string; showOption: boolean }): RoutePlan[] {
  const byId = new Map(board.routes.map((route) => [route.id, route]));
  if (byId.has('juan_pickup') && byId.has('box_511_plus_babylon')) {
    const box = byId.get(choice.boxId) ?? byId.get('box_511_plus_babylon');
    const picked = [byId.get('juan_pickup'), box];
    if (choice.showOption) picked.push(byId.get('long_island_run_option'));
    return picked.filter((route): route is RoutePlan => Boolean(route));
  }
  return board.routes.filter((route) => route.role === 'primary');
}
