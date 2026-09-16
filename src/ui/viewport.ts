import type { Point } from '../graph/model';
import { canvasPoint } from './geometry';

export interface Viewport extends Point { width: number; height: number }
export const defaultViewport = (): Viewport => ({ x: 0, y: 0, width: 1200, height: 800 });
type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
export function worldPoint(client: Point, rect: Rect, view: Viewport): Point {
  const point = canvasPoint(client, rect, view.width, view.height);
  return { x: point.x + view.x, y: point.y + view.y };
}
export function panViewport(view: Viewport, start: Point, current: Point, rect: Rect): Viewport {
  return { ...view, x: view.x - (current.x - start.x) * view.width / rect.width, y: view.y - (current.y - start.y) * view.height / rect.height };
}
/** Fit all node centers with room for their circles, labels and start markers. */
export function fitViewport(points: Point[]): Viewport {
  if (!points.length) return defaultViewport();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  const width = Math.max(1200, maxX - minX + 160, (maxY - minY + 160) * 1.5);
  const height = width / 1.5;
  return { x: minX + (maxX - minX) / 2 - width / 2, y: minY + (maxY - minY) / 2 - height / 2, width, height };
}
