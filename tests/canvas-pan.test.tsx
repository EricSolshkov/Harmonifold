// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Canvas } from '../src/ui/Canvas';
import { graph } from './fixtures';

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 600, height: 400 } as DOMRect);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(locked = false, project = graph()) {
  const edit = vi.fn(), select = vi.fn();
  const view = render(<Canvas project={project} selected="A" select={select} edit={edit} locked={locked} cursors={[]} />);
  return { ...view, edit, select, canvas: screen.getByRole('application') };
}
function pan(canvas: HTMLElement) {
  fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas, { clientX: 150, clientY: 125 });
  fireEvent.pointerMove(canvas, { clientX: 200, clientY: 150 });
  fireEvent.pointerUp(canvas);
}
it('drags blank space to pan without editing geometry or clearing the current selection', () => {
  const { canvas, edit, select } = setup();
  pan(canvas); fireEvent.click(canvas);
  expect(canvas.getAttribute('viewBox')).toBe('-200 -100 1200 800');
  expect(edit).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'A' }).getAttribute('transform')).toBe('translate(0 0)');
  fireEvent.click(canvas); expect(select).toHaveBeenCalledWith(null);
});
it('creates nodes at the correct world position after panning', () => {
  const { canvas, edit } = setup();
  pan(canvas); fireEvent.click(canvas);
  fireEvent.doubleClick(canvas, { clientX: 60, clientY: 120 });
  expect(edit).toHaveBeenCalledWith(expect.objectContaining({ type: 'add', point: { x: -100, y: 100 } }));
});
it('drags a node beyond the old fixed bounds without moving the viewport', () => {
  const { canvas, edit } = setup();
  pan(canvas); fireEvent.click(canvas);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'A' }), { button: 0, clientX: 110, clientY: 70 });
  fireEvent.pointerMove(canvas, { clientX: 10, clientY: 20 }); fireEvent.pointerUp(canvas);
  expect(edit).toHaveBeenLastCalledWith({ type: 'move', id: 'A', point: { x: -200, y: -100 } });
  expect(canvas.getAttribute('viewBox')).toBe('-200 -100 1200 800');
});
it('fits all offscreen nodes, keeps world geometry unchanged, and can reset the view', () => {
  const project = graph(); project.nodes[0].x = -2000; project.nodes[1].x = 3000;
  const { canvas, edit } = setup(false, project);
  fireEvent.click(screen.getByRole('button', { name: '显示全部' }));
  const [x, y, width, height] = canvas.getAttribute('viewBox')!.split(' ').map(Number);
  for (const node of project.nodes) {
    expect(node.x).toBeGreaterThan(x); expect(node.x).toBeLessThan(x + width);
    expect(node.y).toBeGreaterThan(y); expect(node.y).toBeLessThan(y + height);
  }
  expect(edit).not.toHaveBeenCalled();
  fireEvent.doubleClick(canvas, { clientX: 310, clientY: 220 });
  expect(edit).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'add', point: { x: 500, y: 0 } }));
  edit.mockClear();
  fireEvent.pointerDown(screen.getByRole('button', { name: 'A' }), { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas, { clientX: 160, clientY: 100 }); fireEvent.pointerUp(canvas);
  expect(edit.mock.lastCall![0].point.x).toBeCloseTo(-2000 + width / 10);
  fireEvent.click(screen.getByRole('button', { name: '重置视图' }));
  expect(canvas.getAttribute('viewBox')).toBe('0 0 1200 800');
});
it('allows view navigation during playback while refusing node edits', () => {
  const { canvas, edit } = setup(true);
  pan(canvas); fireEvent.click(canvas);
  expect(canvas.getAttribute('viewBox')).toBe('-200 -100 1200 800');
  fireEvent.doubleClick(canvas, { clientX: 60, clientY: 120 });
  fireEvent.pointerDown(screen.getByRole('button', { name: 'A' }), { button: 0, clientX: 110, clientY: 70 });
  fireEvent.pointerMove(canvas, { clientX: 160, clientY: 120 }); fireEvent.pointerUp(canvas);
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '显示全部' }));
  expect(canvas.getAttribute('viewBox')).not.toBe('-200 -100 1200 800');
});
it('ends pan on pointer cancellation or window blur and preserves ordinary blank clicks', () => {
  const { canvas, select } = setup();
  fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerCancel(canvas);
  fireEvent.pointerMove(canvas, { clientX: 200, clientY: 150 });
  expect(canvas.getAttribute('viewBox')).toBe('0 0 1200 800');
  fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.blur(window); fireEvent.pointerMove(canvas, { clientX: 200, clientY: 150 });
  expect(canvas.getAttribute('viewBox')).toBe('0 0 1200 800');
  fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas, { clientX: 101, clientY: 100 }); fireEvent.pointerUp(canvas); fireEvent.click(canvas);
  expect(select).toHaveBeenCalledWith(null);
});
