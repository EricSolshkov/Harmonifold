// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { Canvas } from '../src/ui/Canvas';
import { serializeProject, storageKey } from '../src/graph/storage';
import { audioMock } from './audioMock';
import { graph, twoGraphs } from './fixtures';

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  });
  vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1200, height: 800 } as DOMRect);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function start() {
  const mock = audioMock(); vi.stubGlobal('AudioContext', class { constructor() { return mock.context; } });
  localStorage.setItem(storageKey, serializeProject(twoGraphs())); render(<App />);
  await act(async () => { fireEvent.keyDown(window, { code: 'Space' }); });
  act(() => { mock.context.currentTime = 0.54; vi.advanceTimersByTime(25); });
  return { mock, canvas: screen.getByRole('application') };
}
function grabA() { fireEvent.pointerDown(screen.getByTestId('cursor-A'), { button: 0, pointerId: 7, clientX: 50, clientY: 0 }); }

it('captures a cursor instead of panning, solos it, and resumes all graphs on release', async () => {
  const { mock, canvas } = await start(); grabA();
  expect(screen.getByRole('status').textContent).toContain('独奏拖动');
  expect(screen.getByTestId('cursor-A').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('cursor-C').textContent).toContain('暂停');
  expect((screen.getByRole('button', { name: '显示全部' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 25, clientY: 0 });
  expect(screen.getByTestId('cursor-A').textContent).toContain('25%');
  expect(mock.oscillators[0].frequency.setValueAtTime).toHaveBeenLastCalledWith(550, 0.54);
  expect(canvas.getAttribute('viewBox')).toBe('0 0 1200 800');
  fireEvent.pointerUp(canvas, { pointerId: 7 });
  expect(screen.getByRole('status').textContent).toContain('播放中');
  expect(screen.getByTestId('cursor-C').textContent).not.toContain('暂停');
  expect((screen.getByRole('button', { name: '显示全部' }) as HTMLButtonElement).disabled).toBe(false);
  expect(localStorage.getItem(storageKey)).toBe(serializeProject(twoGraphs()));
});
it('ignores a second pointer until the owning pointer releases', async () => {
  const { canvas } = await start(); grabA();
  fireEvent.pointerDown(screen.getByTestId('cursor-C'), { button: 0, pointerId: 8, clientX: 50, clientY: 200 });
  fireEvent.pointerMove(canvas, { pointerId: 8, clientX: 150, clientY: 200 });
  fireEvent.pointerUp(canvas, { pointerId: 8 });
  expect(screen.getByRole('status').textContent).toContain('独奏拖动');
  expect(screen.getByTestId('cursor-A').getAttribute('transform')).toBe('translate(50 0)');
  expect(screen.getByTestId('cursor-C').getAttribute('aria-pressed')).toBe('false');
  fireEvent.pointerUp(canvas, { pointerId: 7 });
  expect(screen.getByRole('status').textContent).toContain('播放中');
});
it.each(['cancel', 'lost', 'blur', 'space', 'hidden'])('%s stops a grabbed performance and late release does not restart it', async action => {
  const { mock, canvas } = await start(); grabA();
  if (action === 'cancel') fireEvent.pointerCancel(canvas, { pointerId: 7 });
  if (action === 'lost') fireEvent.lostPointerCapture(canvas, { pointerId: 7 });
  if (action === 'blur') fireEvent.blur(window);
  if (action === 'space') fireEvent.keyDown(window, { code: 'Space' });
  if (action === 'hidden') { vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); fireEvent(document, new Event('visibilitychange')); }
  expect(screen.getByRole('status').textContent).toContain('编辑模式');
  fireEvent.pointerUp(canvas, { pointerId: 7 });
  expect(screen.getByRole('status').textContent).toContain('编辑模式');
  expect(mock.oscillators).toHaveLength(2); mock.oscillators.forEach(o => expect(o.stop).toHaveBeenCalled());
});
it('cannot grab an ended cursor or grab outside playback', async () => {
  const { mock } = await start();
  act(() => { mock.context.currentTime = 1.5; vi.advanceTimersByTime(25); });
  grabA(); expect(screen.getByRole('status').textContent).not.toContain('独奏拖动');
  expect(screen.getByTestId('cursor-A').getAttribute('aria-disabled')).toBe('true');
  fireEvent.keyDown(window, { code: 'Space' });
  fireEvent.pointerDown(screen.getByTestId('cursor-C'), { button: 0, pointerId: 8 });
  expect(screen.getByRole('status').textContent).toContain('编辑模式');
});
it('converts scrub motion after panning to world coordinates and preserves the grab offset', () => {
  const controls = { begin: vi.fn(() => true), move: vi.fn(), end: vi.fn(), cancel: vi.fn() };
  render(<Canvas project={graph()} selected={null} select={vi.fn()} edit={vi.fn()} locked cursors={[{ graph: 'A', edge: 'AB', progress: 0.5, x: 50, y: 0, done: false }]} cursorControls={controls} />);
  const canvas = screen.getByRole('application');
  fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300, clientY: 200 }); fireEvent.pointerUp(canvas, { pointerId: 1 });
  fireEvent.pointerDown(screen.getByTestId('cursor-A'), { button: 0, pointerId: 7, clientX: 255, clientY: 100 });
  fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 275, clientY: 100 });
  expect(controls.move).toHaveBeenCalledWith({ x: 70, y: 0 }, 18);
  fireEvent.pointerUp(canvas, { pointerId: 7 }); expect(controls.end).toHaveBeenCalledOnce();
});
