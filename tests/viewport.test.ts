import { expect, it } from 'vitest';
import { defaultViewport, fitViewport, panViewport, worldPoint } from '../src/ui/viewport';

const rect = { left: 10, top: 20, width: 600, height: 400 };
it('converts pointer coordinates through pan and fit scale into world coordinates', () => {
  expect(worldPoint({ x: 60, y: 120 }, rect, defaultViewport())).toEqual({ x: 100, y: 200 });
  expect(worldPoint({ x: 60, y: 120 }, rect, { x: -500, y: 1000, width: 2400, height: 1600 })).toEqual({ x: -300, y: 1400 });
});
it('pans from the gesture start without accumulating movement or mutating the view', () => {
  const view = defaultViewport();
  expect(panViewport(view, { x: 100, y: 100 }, { x: 150, y: 125 }, rect)).toEqual({ x: -100, y: -50, width: 1200, height: 800 });
  expect(panViewport(view, { x: 100, y: 100 }, { x: 200, y: 150 }, rect)).toEqual({ x: -200, y: -100, width: 1200, height: 800 });
  expect(view).toEqual(defaultViewport());
});
it('fits distant and negative-position nodes with label padding and the canvas aspect ratio', () => {
  const nodes = [{ x: -3200, y: -900 }, { x: 4500, y: 6000 }];
  const view = fitViewport(nodes);
  expect(view.width / view.height).toBe(1.5);
  for (const n of nodes) {
    expect(n.x - view.x).toBeGreaterThanOrEqual(80);
    expect(n.y - view.y).toBeGreaterThanOrEqual(80);
    expect(view.x + view.width - n.x).toBeGreaterThanOrEqual(80);
    expect(view.y + view.height - n.y).toBeGreaterThanOrEqual(80);
  }
});
it('resets an empty canvas and recenters a single distant node without magnifying it', () => {
  expect(fitViewport([])).toEqual(defaultViewport());
  expect(fitViewport([{ x: 2000, y: -1000 }])).toEqual({ x: 1400, y: -1400, width: 1200, height: 800 });
});
