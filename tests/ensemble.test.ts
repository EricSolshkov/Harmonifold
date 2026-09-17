import { afterEach, expect, it, vi } from 'vitest';
import { createEnsemble } from '../src/audio/ensemble';
import { graph, node, twoGraphs } from './fixtures';
import { audioMock } from './audioMock';
const callbacks = () => ({ frame: vi.fn(), ended: vi.fn(), error: vi.fn() });
afterEach(() => vi.useRealTimers());
it('holds floor frequency/gain exactly until the end, without linear ramps', async () => {
  vi.useFakeTimers(); const mock = audioMock(); const player = createEnsemble(callbacks(), mock.makeContext);
  const p = graph(); p.arrows[0].mapping = 'floor';
  p.nodes[0].sounds[0].gain = '0'; p.nodes[1].sounds[0].gain = '0.2';
  await player.play(p);
  expect(mock.oscillators[0].frequency.setValueAtTime.mock.calls).toEqual([[440, 0.04], [880, 1.04]]);
  expect(mock.gains[2].gain.setValueAtTime.mock.calls).toEqual([[0, 0.04], [0.2, 1.04]]);
  expect(mock.oscillators[0].frequency.linearRampToValueAtTime).not.toHaveBeenCalled();
  expect(mock.gains[2].gain.linearRampToValueAtTime).not.toHaveBeenCalled();
  player.dispose();
});
it('schedules smoothstep for all voices only over the last 5% of edge time', async () => {
  vi.useFakeTimers(); const mock = audioMock(); const player = createEnsemble(callbacks(), mock.makeContext);
  const p = graph(); p.arrows[0].mapping = 'smoothstep';
  p.nodes.forEach(n => n.sounds.push({ ...n.sounds[0], frequency: String(Number(n.sounds[0].frequency) / 2), wave: 'triangle' }));
  p.nodes[0].sounds[0].gain = '0'; p.nodes[1].sounds[0].gain = '0.2';
  await player.play(p);
  expect(mock.oscillators[0].frequency.setValueAtTime.mock.calls).toEqual([[440, 0.04], [440, 0.99]]);
  const ramps = mock.oscillators[0].frequency.linearRampToValueAtTime.mock.calls;
  expect(ramps).toHaveLength(128); expect(ramps[0][1]).toBeGreaterThan(0.99);
  expect(ramps[63][0]).toBeCloseTo(660); expect(ramps[63][1]).toBeCloseTo(1.015);
  expect(ramps.at(-1)).toEqual([880, 1.04]);
  expect(mock.gains[2].gain.linearRampToValueAtTime.mock.calls[63][0]).toBeCloseTo(0.1);
  expect(mock.oscillators[1].frequency.linearRampToValueAtTime.mock.calls[63][0]).toBeCloseTo(330);
  player.dispose();
});
it('catches up late smoothstep scheduling at the mapped current value', async () => {
  vi.useFakeTimers(); const mock = audioMock(); const player = createEnsemble(callbacks(), mock.makeContext);
  const p = graph(); p.nodes.push(node('C', 200)); p.arrows.push({ id: 'BC', from: 'B', to: 'C', mapping: 'smoothstep' });
  await player.play(p);
  mock.context.currentTime = 2.015; vi.advanceTimersByTime(25);
  const lastSet = mock.oscillators[0].frequency.setValueAtTime.mock.lastCall!;
  expect(lastSet[0]).toBeCloseTo(660); expect(lastSet[1]).toBeCloseTo(2.015);
  expect(mock.oscillators[0].frequency.linearRampToValueAtTime.mock.lastCall).toEqual([440, 2.04]);
  player.dispose();
});
it('uses independent mappings in simultaneously playing graphs', async () => {
  vi.useFakeTimers(); const mock = audioMock(); const player = createEnsemble(callbacks(), mock.makeContext);
  const p = twoGraphs(); p.arrows[0].mapping = 'floor'; p.arrows[1].mapping = 'smoothstep';
  await player.play(p);
  expect(mock.oscillators[0].frequency.linearRampToValueAtTime).not.toHaveBeenCalled();
  expect(mock.oscillators[1].frequency.linearRampToValueAtTime).toHaveBeenCalledTimes(128);
  expect(mock.oscillators[1].frequency.linearRampToValueAtTime.mock.calls[0][1]).toBeGreaterThan(1.94);
  player.dispose();
});

it('schedules exact linear frequency/gain ramps on a shared audio clock for simultaneous components', async () => {
  vi.useFakeTimers(); const mock = audioMock(), cb = callbacks();
  const p = twoGraphs(); p.nodes[0].sounds[0].gain = '0'; p.nodes[1].sounds[0].gain = '0.2';
  const player = createEnsemble(cb, mock.makeContext);
  expect(mock.context.resume).not.toHaveBeenCalled();
  expect(await player.play(p)).toBe(true);
  expect(mock.oscillators).toHaveLength(2);
  mock.oscillators.forEach(o => expect(o.start).toHaveBeenCalledWith(0.04));
  expect(mock.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(440, 0.04);
  expect(mock.oscillators[0].frequency.linearRampToValueAtTime).toHaveBeenCalledWith(880, 1.04);
  expect(mock.gains[2].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.2, 1.04);
  expect(mock.oscillators[1].frequency.linearRampToValueAtTime).toHaveBeenCalledWith(440, 2.04);
  mock.context.currentTime = 0.54; vi.advanceTimersByTime(25);
  expect(cb.frame.mock.lastCall![0][0]).toMatchObject({ x: 50, progress: 0.5 });
  player.dispose(); expect(mock.context.close).toHaveBeenCalled();
});
it('releases only the completed component and exits after all components finish', async () => {
  vi.useFakeTimers(); const mock = audioMock(), cb = callbacks(); const player = createEnsemble(cb, mock.makeContext);
  await player.play(twoGraphs());
  mock.context.currentTime = 1; vi.advanceTimersByTime(25);
  expect(mock.gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.08);
  expect(mock.oscillators[0].stop).not.toHaveBeenCalled();
  expect(mock.oscillators[1].stop).not.toHaveBeenCalled(); expect(cb.ended).not.toHaveBeenCalled();
  mock.context.currentTime = 1.5; vi.advanceTimersByTime(25);
  expect(mock.oscillators[0].stop).toHaveBeenCalledWith(1.5);
  expect(cb.frame.mock.lastCall![0].map((c: { done: boolean }) => c.done)).toEqual([true, false]);
  mock.context.currentTime = 2; vi.advanceTimersByTime(25);
  mock.context.currentTime = 2.1; vi.advanceTimersByTime(25);
  expect(cb.ended).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  mock.oscillators.forEach(o => o.onended?.());
  mock.gains.forEach(g => expect(g.disconnect).toHaveBeenCalled());
});
it('reuses voices across a loop and keeps playing until explicitly stopped', async () => {
  vi.useFakeTimers(); const mock = audioMock(), cb = callbacks(); const player = createEnsemble(cb, mock.makeContext);
  const p = graph(); p.arrows.push({ id: 'BA', from: 'B', to: 'A' });
  await player.play(p);
  for (let i = 1; i <= 20; i++) { mock.context.currentTime = i; vi.advanceTimersByTime(25); }
  expect(mock.oscillators).toHaveLength(1); expect(cb.ended).not.toHaveBeenCalled();
  player.stop(); expect(vi.getTimerCount()).toBe(0);
  expect(mock.gains[1].gain.cancelAndHoldAtTime).toHaveBeenCalledWith(20);
});
it('creates one oscillator per sound and fixes mix attenuation across the session', async () => {
  vi.useFakeTimers(); const mock = audioMock(); const player = createEnsemble(callbacks(), mock.makeContext);
  const p = twoGraphs();
  p.nodes.forEach(n => { n.sounds = Array.from({ length: 4 }, (_, i) => ({ ...n.sounds[0], wave: i % 2 ? 'triangle' : 'square' })); });
  await player.play(p);
  expect(mock.oscillators).toHaveLength(8); expect(mock.gains[0].gain.value).toBe(0.5);
  expect(mock.oscillators.map(o => o.type)).toEqual(['square', 'triangle', 'square', 'triangle', 'square', 'triangle', 'square', 'triangle']);
  player.dispose();
});
it('validates every graph before creating any oscillators', async () => {
  const mock = audioMock(); const p = twoGraphs(); p.nodes[3].sounds = [];
  await expect(createEnsemble(callbacks(), mock.makeContext).play(p)).rejects.toThrow(/不能为空/);
  expect(mock.oscillators).toEqual([]); expect(mock.context.resume).not.toHaveBeenCalled();
});
it('cancels an outstanding resume and prevents stale requests from producing audio', async () => {
  let resolve!: () => void;
  const mock = audioMock(() => new Promise<void>(done => { resolve = done; })); const player = createEnsemble(callbacks(), mock.makeContext);
  const pending = player.play(graph()); player.stop(); resolve();
  expect(await pending).toBe(false); expect(mock.oscillators).toHaveLength(0);
  player.dispose();
});
it('reports suspended audio without entering playback', async () => {
  const mock = audioMock(); mock.context.state = 'suspended';
  await expect(createEnsemble(callbacks(), mock.makeContext).play(graph())).rejects.toThrow(/音频未能启动/);
  expect(mock.oscillators).toHaveLength(0);
});
