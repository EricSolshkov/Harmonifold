import type { Point } from '../graph/model';

export function canvasPoint(client: Point, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, width: number, height: number): Point {
  return { x: (client.x - rect.left) * width / rect.width, y: (client.y - rect.top) * height / rect.height };
}
export function lineGeometry(from: Point, to: Point, reverse: boolean) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const ux = length ? (to.x - from.x) / length : 1;
  const uy = length ? (to.y - from.y) / length : 0;
  const offset = reverse ? 9 : 0;
  const inset = Math.min(27, length / 3);
  const a = { x: from.x + ux * inset - uy * offset, y: from.y + uy * inset + ux * offset };
  const b = { x: to.x - ux * inset - uy * offset, y: to.y - uy * inset + ux * offset };
  return { a, b, label: { x: (a.x + b.x) / 2 - uy * 13, y: (a.y + b.y) / 2 + ux * 13 }, length, offset: { x: -uy * offset, y: ux * offset } };
}
export function isTextInput(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, select, textarea, [contenteditable="true"]');
}
