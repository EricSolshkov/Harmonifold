// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { Canvas } from '../src/ui/Canvas';
import { NodeEditor } from '../src/ui/NodeEditor';
import { canvasPoint, isTextInput, lineGeometry } from '../src/ui/geometry';
import { parseProject, serializeProject, storageKey } from '../src/graph/storage';
import { graph, node, twoGraphs } from './fixtures';
import { audioMock } from './audioMock';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 600, height: 400 } as DOMRect);
});
afterEach(() => { cleanup(); history.replaceState(null, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('converts screen coordinates to canvas units and offsets reverse arrows on opposite sides', () => {
  expect(canvasPoint({ x: 60, y: 120 }, { left: 10, top: 20, width: 600, height: 400 }, 1200, 800)).toEqual({ x: 100, y: 200 });
  const a = lineGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, true), b = lineGeometry({ x: 100, y: 0 }, { x: 0, y: 0 }, true);
  expect(a.a.y).toBe(9); expect(b.a.y).toBe(-9); expect(a.length).toBe(100);
  expect(isTextInput(document.createElement('input'))).toBe(true); expect(isTextInput(window)).toBe(false);
});
it('creates a node on blank double-click but never on node or edge double-click', () => {
  const edit = vi.fn(); render(<Canvas project={graph()} selected={null} select={vi.fn()} edit={edit} locked={false} cursors={[]} />);
  fireEvent.doubleClick(screen.getByRole('application'), { clientX: 60, clientY: 120 });
  expect(edit).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'add', point: { x: 100, y: 200 } }));
  edit.mockClear(); fireEvent.doubleClick(screen.getByRole('button', { name: 'A' })); expect(edit).not.toHaveBeenCalled();
  fireEvent.doubleClick(screen.getByTestId('edge-A-B')); expect(edit).toHaveBeenCalledExactlyOnceWith({ type: 'disconnect', id: 'AB' });
});
it('chains Ctrl clicks in order and releases the connection anchor when Ctrl is released', () => {
  const edit = vi.fn(), p = graph(); p.nodes.push(node('C', 200));
  render(<Canvas project={p} selected={null} select={vi.fn()} edit={edit} locked={false} cursors={[]} />);
  for (const name of ['A', 'B', 'C']) fireEvent.click(screen.getByRole('button', { name }), { ctrlKey: true });
  expect(edit.mock.calls.map(call => [call[0].from, call[0].to])).toEqual([['A', 'B'], ['B', 'C']]);
  fireEvent.keyUp(window, { key: 'Control' });
  fireEvent.click(screen.getByRole('button', { name: 'A' }), { ctrlKey: true }); expect(edit).toHaveBeenCalledTimes(2);
});
it('drags using canvas coordinates and ignores editing gestures while locked', () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  const edit = vi.fn(), props = { project: graph(), selected: null, select: vi.fn(), edit, cursors: [] };
  const { rerender } = render(<Canvas {...props} locked={false} />);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'A' }), { button: 0, clientX: 10, clientY: 20 });
  fireEvent.pointerMove(screen.getByRole('application'), { clientX: 60, clientY: 70 });
  expect(edit).toHaveBeenLastCalledWith({ type: 'move', id: 'A', point: { x: 100, y: 100 } });
  fireEvent.pointerUp(screen.getByRole('application'));
  edit.mockClear(); rerender(<Canvas {...props} locked />);
  fireEvent.doubleClick(screen.getByRole('application')); fireEvent.doubleClick(screen.getByTestId('edge-A-B'));
  fireEvent.click(screen.getByRole('button', { name: 'A' }), { ctrlKey: true }); fireEvent.click(screen.getByRole('button', { name: 'B' }), { ctrlKey: true });
  expect(edit).not.toHaveBeenCalled();
});
it('edits each sound with the existing frequency modes and supports add/remove', () => {
  const onSounds = vi.fn(), n = node('A');
  const props = { node: n, locked: false, canStart: true, isStart: false, onSounds, onStart: vi.fn(), onDelete: vi.fn() };
  const { rerender } = render(<NodeEditor {...props} />);
  fireEvent.change(screen.getByLabelText('声音 1 频率 (Hz)'), { target: { value: '660' } });
  expect(onSounds.mock.lastCall![0][0].frequency).toBe('660');
  fireEvent.change(screen.getByLabelText('声音 1 波形'), { target: { value: 'triangle' } });
  expect(onSounds.mock.lastCall![0][0].wave).toBe('triangle');
  fireEvent.click(screen.getByText('＋ 添加声音')); expect(onSounds.mock.lastCall![0]).toHaveLength(2);
  fireEvent.click(screen.getByLabelText('删除声音 1')); expect(onSounds).toHaveBeenLastCalledWith([]);
  n.sounds[0].mode = 'division'; rerender(<NodeEditor {...props} />);
  expect(screen.getByLabelText('声音 1 等分数')).toBeTruthy();
  rerender(<NodeEditor {...props} locked />);
  expect(screen.getByLabelText('声音 1 等分数').closest('fieldset')!.disabled).toBe(true);
});
it('selects/deletes nodes, persists the graph, and does not intercept editing keys inside inputs', () => {
  localStorage.setItem(storageKey, serializeProject(graph())); render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'A' }));
  const input = screen.getByLabelText('声音 1 频率 (Hz)');
  fireEvent.keyDown(input, { key: 'Delete' }); fireEvent.keyDown(input, { code: 'Space', key: ' ' });
  expect(screen.getByRole('button', { name: 'A' })).toBeTruthy(); expect(screen.getByRole('status').textContent).toContain('编辑模式');
  fireEvent.keyDown(window, { key: 'Delete' });
  expect(screen.queryByRole('button', { name: 'A' })).toBeNull();
  expect(parseProject(localStorage.getItem(storageKey)!).arrows).toEqual([]);
});
it('Space starts simultaneous graphs, locks controls, and Space stops playback', async () => {
  vi.useFakeTimers(); const mock = audioMock(); vi.stubGlobal('AudioContext', class { constructor() { return mock.context; } });
  localStorage.setItem(storageKey, serializeProject(twoGraphs())); render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'A' }));
  await act(async () => { fireEvent.keyDown(window, { key: ' ', code: 'Space' }); });
  expect(mock.oscillators).toHaveLength(2); expect(screen.getByRole('status').textContent).toContain('播放中');
  expect((screen.getByLabelText('播放速度') as HTMLInputElement).disabled).toBe(true);
  fireEvent.keyDown(window, { key: 'Delete' }); expect(screen.getByRole('button', { name: 'A' })).toBeTruthy();
  fireEvent.keyDown(window, { key: ' ', code: 'Space', repeat: true }); expect(screen.getByRole('status').textContent).toContain('播放中');
  fireEvent.keyDown(window, { key: ' ', code: 'Space' }); expect(screen.getByRole('status').textContent).toContain('编辑模式');
});
it('reports validation errors and remains editable without starting partial playback', async () => {
  const mock = audioMock(); vi.stubGlobal('AudioContext', class { constructor() { return mock.context; } });
  const p = twoGraphs(); p.nodes[3].sounds = [];
  localStorage.setItem(storageKey, serializeProject(p)); render(<App />);
  await act(async () => { fireEvent.keyDown(window, { key: ' ', code: 'Space' }); });
  expect(screen.getByRole('alert').textContent).toContain('不能为空');
  expect(screen.getByRole('status').textContent).toContain('编辑模式'); expect(mock.oscillators).toHaveLength(0);
});
it('stops playback when the page is hidden', async () => {
  vi.useFakeTimers(); const mock = audioMock(); vi.stubGlobal('AudioContext', class { constructor() { return mock.context; } });
  const clear = vi.spyOn(globalThis, 'clearInterval');
  localStorage.setItem(storageKey, serializeProject(graph())); render(<App />);
  await act(async () => { fireEvent.keyDown(window, { key: ' ', code: 'Space' }); });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByRole('status').textContent).toContain('编辑模式'); expect(clear).toHaveBeenCalled();
  expect(mock.oscillators[0].stop).toHaveBeenCalled();
});
it('cancels pending startup before resume finishes and leaves editing unlocked', async () => {
  let resolve!: () => void;
  const mock = audioMock(() => new Promise<void>(done => { resolve = done; }));
  vi.stubGlobal('AudioContext', class { constructor() { return mock.context; } });
  localStorage.setItem(storageKey, serializeProject(graph())); render(<App />);
  fireEvent.keyDown(window, { code: 'Space' });
  expect(screen.getByRole('button', { name: /取消启动/ })).toBeTruthy();
  fireEvent.keyDown(window, { code: 'Space' });
  await act(async () => { resolve(); });
  expect(mock.oscillators).toHaveLength(0); expect(screen.getByRole('status').textContent).toContain('编辑模式');
  expect((screen.getByLabelText('播放速度') as HTMLInputElement).disabled).toBe(false);
});
it('exits playback at the terminal node while retaining the final cursor', async () => {
  vi.useFakeTimers(); const mock = audioMock(); vi.stubGlobal('AudioContext', class { constructor() { return mock.context; } });
  localStorage.setItem(storageKey, serializeProject(graph())); const { container } = render(<App />);
  await act(async () => { fireEvent.keyDown(window, { code: 'Space' }); });
  act(() => { mock.context.currentTime = 1; vi.advanceTimersByTime(25); });
  act(() => { mock.context.currentTime = 1.1; vi.advanceTimersByTime(25); });
  expect(screen.getByRole('status').textContent).toContain('编辑模式');
  expect(container.querySelector('.cursor.done')!.parentElement!.getAttribute('transform')).toBe('translate(100 0)');
});
it('migrates legacy URL parameters without overriding saved canvas edits on reload', () => {
  history.replaceState(null, '', '/?base=220&wave=triangle');
  const view = render(<App />); fireEvent.click(screen.getByRole('button', { name: '结点 1' }));
  fireEvent.change(screen.getByLabelText('声音 1 基准频率 (Hz)'), { target: { value: '330' } });
  expect(location.search).toBe(''); view.unmount(); render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '结点 1' }));
  expect((screen.getByLabelText('声音 1 基准频率 (Hz)') as HTMLInputElement).value).toBe('330');
});
it('retains malformed saved data until the user edits instead of silently overwriting it', () => {
  localStorage.setItem(storageKey, '{broken'); render(<App />);
  expect(screen.getByRole('alert').textContent).toContain('恢复画布失败');
  expect(localStorage.getItem(storageKey)).toBe('{broken');
});
it('does not invoke sound editing actions from disabled controls', async () => {
  const user = userEvent.setup(), onSounds = vi.fn(), onStart = vi.fn(), onDelete = vi.fn();
  render(<NodeEditor node={node('A')} locked canStart isStart={false} onSounds={onSounds} onStart={onStart} onDelete={onDelete} />);
  await user.click(screen.getByText('＋ 添加声音'));
  await user.click(screen.getByLabelText('删除声音 1'));
  await user.click(screen.getByText('设为当前图起点'));
  await user.click(screen.getByText('删除结点'));
  await user.type(screen.getByLabelText('声音 1 频率 (Hz)'), '880');
  expect(onSounds).not.toHaveBeenCalled(); expect(onStart).not.toHaveBeenCalled(); expect(onDelete).not.toHaveBeenCalled();
});
it('imports a complete project, validates bad imports, and preserves the last valid graph', async () => {
  render(<App />);
  const input = screen.getByLabelText('导入画布');
  await act(async () => { fireEvent.change(input, { target: { files: [{ text: async () => serializeProject(twoGraphs()) }] } }); });
  expect(screen.getByRole('status').textContent).toContain('2 个连通图');
  expect(parseProject(localStorage.getItem(storageKey)!)).toEqual(twoGraphs());
  await act(async () => { fireEvent.change(input, { target: { files: [{ text: async () => '{bad' }] } }); });
  expect(screen.getByRole('alert')).toBeTruthy(); expect(screen.getByRole('status').textContent).toContain('2 个连通图');
});
it('exports a JSON download and releases its temporary object URL', () => {
  vi.useFakeTimers();
  const create = vi.fn(() => 'blob:canvas-export'), revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('harmonifold.json'); expect(this.href).toBe('blob:canvas-export');
  });
  localStorage.setItem(storageKey, serializeProject(graph())); render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  expect(create).toHaveBeenCalledWith(expect.any(Blob)); expect(click).toHaveBeenCalled();
  act(() => { vi.runOnlyPendingTimers(); }); expect(revoke).toHaveBeenCalledWith('blob:canvas-export');
});
it('selects an arrow, edits and persists its mapping, and clears selection on blank or node clicks', () => {
  localStorage.setItem(storageKey, serializeProject(twoGraphs())); const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'A' }));
  fireEvent.click(screen.getByRole('button', { name: '连接 A → B' }));
  const selector = screen.getByLabelText('连接插值映射') as HTMLSelectElement;
  expect(selector.value).toBe('linear'); expect(selector.options).toHaveLength(3);
  expect(screen.queryByLabelText('声音 1 频率 (Hz)')).toBeNull();
  expect(screen.getByRole('button', { name: '连接 A → B' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.change(selector, { target: { value: 'floor' } });
  expect(parseProject(localStorage.getItem(storageKey)!).arrows[0].mapping).toBe('floor');
  fireEvent.click(screen.getByRole('button', { name: '连接 C → D' }));
  expect((screen.getByLabelText('连接插值映射') as HTMLSelectElement).value).toBe('linear');
  fireEvent.change(screen.getByLabelText('连接插值映射'), { target: { value: 'smoothstep' } });
  fireEvent.click(screen.getByRole('application')); expect(screen.queryByLabelText('连接插值映射')).toBeNull();
  view.unmount(); render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '连接 A → B' }));
  expect((screen.getByLabelText('连接插值映射') as HTMLSelectElement).value).toBe('floor');
  fireEvent.click(screen.getByRole('button', { name: '连接 C → D' }));
  expect((screen.getByLabelText('连接插值映射') as HTMLSelectElement).value).toBe('smoothstep');
  fireEvent.click(screen.getByRole('button', { name: 'C' }));
  expect(screen.queryByLabelText('连接插值映射')).toBeNull(); expect(screen.getByLabelText('声音 1 频率 (Hz)')).toBeTruthy();
});
it('deletes selected arrows with double-click or Delete without deleting nodes or creating a node', () => {
  localStorage.setItem(storageKey, serializeProject(twoGraphs())); render(<App />);
  fireEvent.click(screen.getByTestId('edge-A-B')); fireEvent.doubleClick(screen.getByTestId('edge-A-B'));
  expect(screen.queryByLabelText('连接插值映射')).toBeNull(); expect(screen.queryByTestId('edge-A-B')).toBeNull();
  fireEvent.click(screen.getByTestId('edge-C-D'));
  fireEvent.keyDown(screen.getByLabelText('连接插值映射'), { key: 'Delete' }); expect(screen.getByTestId('edge-C-D')).toBeTruthy();
  fireEvent.keyDown(window, { key: 'Delete' }); expect(screen.queryByTestId('edge-C-D')).toBeNull();
  expect(parseProject(localStorage.getItem(storageKey)!).nodes).toHaveLength(4);
});
it('locks the arrow mapping selector during playback and restores it after stopping', async () => {
  const user = userEvent.setup(), mock = audioMock();
  vi.stubGlobal('AudioContext', class { constructor() { return mock.context; } });
  localStorage.setItem(storageKey, serializeProject(graph())); render(<App />);
  fireEvent.click(screen.getByTestId('edge-A-B'));
  await act(async () => { fireEvent.keyDown(window, { code: 'Space' }); });
  expect((screen.getByLabelText('连接插值映射') as HTMLSelectElement).disabled).toBe(true);
  await user.selectOptions(screen.getByLabelText('连接插值映射'), 'floor');
  expect((screen.getByLabelText('连接插值映射') as HTMLSelectElement).value).toBe('linear');
  fireEvent.doubleClick(screen.getByTestId('edge-A-B')); expect(screen.getByTestId('edge-A-B')).toBeTruthy();
  fireEvent.keyDown(window, { code: 'Space' });
  expect((screen.getByLabelText('连接插值映射') as HTMLSelectElement).disabled).toBe(false);
});
