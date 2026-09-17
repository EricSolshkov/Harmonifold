import type { CompiledGraph, CompiledArrow } from '../graph/compile';
import { distance, type Point } from '../graph/model';
import type { Cursor } from './traversal';

export interface ScrubPosition { edge: string; progress: number; pointer: Point }
function project(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const progress = length2 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2)) : 0;
  const position = { x: a.x + dx * progress, y: a.y + dy * progress };
  return { progress, position, distance: distance(point, position) };
}
function edgeProjection(graph: CompiledGraph, edge: CompiledArrow, pointer: Point) {
  const a = graph.nodes.get(edge.from)!, b = graph.nodes.get(edge.to)!;
  const reverse = [...graph.arrows.values()].some(e => e.from === edge.to && e.to === edge.from);
  const length = distance(a, b);
  // Match the two visible lanes used for opposite-direction arrows.
  const offset = reverse ? { x: -(b.y - a.y) / length * 9, y: (b.x - a.x) / length * 9 } : { x: 0, y: 0 };
  return project(pointer, { x: a.x + offset.x, y: a.y + offset.y }, { x: b.x + offset.x, y: b.y + offset.y });
}
export function scrubCursor(graph: CompiledGraph, position: ScrubPosition): Cursor {
  const edge = graph.arrows.get(position.edge)!;
  const a = graph.nodes.get(edge.from)!, b = graph.nodes.get(edge.to)!;
  return { graph: graph.start, edge: edge.id, progress: position.progress, x: a.x + (b.x - a.x) * position.progress, y: a.y + (b.y - a.y) * position.progress, done: false };
}
/** Only adjacent edges at a reached endpoint are candidates; screen intersections are inert.
 * Hysteresis favors the current edge. Equal candidates retain graph creation order.
 */
export function moveScrub(graph: CompiledGraph, current: ScrubPosition, pointer: Point, radius: number): ScrubPosition {
  const edge = graph.arrows.get(current.edge)!;
  const a = graph.nodes.get(edge.from)!, b = graph.nodes.get(edge.to)!;
  const projection = edgeProjection(graph, edge, pointer);
  let best = { edge: edge.id, progress: projection.progress, pointer };
  let bestDistance = projection.distance;
  const cursor = scrubCursor(graph, current);
  for (const endpoint of [a, b]) {
    // Swept hit testing also handles a fast pointer move across the shared node.
    const reached = distance(cursor, endpoint) <= radius || project(endpoint, current.pointer, pointer).distance <= radius;
    if (!reached) continue;
    for (const candidate of graph.arrows.values()) {
      if (candidate.id === edge.id || (candidate.from !== endpoint.id && candidate.to !== endpoint.id)) continue;
      const from = graph.nodes.get(candidate.from)!, to = graph.nodes.get(candidate.to)!;
      const next = edgeProjection(graph, candidate, pointer);
      const away = distance(from, to) * (candidate.from === endpoint.id ? next.progress : 1 - next.progress);
      if (away > radius * 0.35 && next.distance + Math.max(1, radius * 0.2) < bestDistance) {
        best = { edge: candidate.id, progress: next.progress, pointer }; bestDistance = next.distance;
      }
    }
  }
  return best;
}
