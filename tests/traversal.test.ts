import { expect, it } from 'vitest';
import { compileProject } from '../src/graph/compile';
import { interpolate, Traversal } from '../src/playback/traversal';
import { graph, node, twoGraphs } from './fixtures';

it('linearly interpolates Hz and gain per index while retaining waveform', () => {
  const a = [{ frequencyHz: 440, gain: 0, waveform: 'sine' as const }, { frequencyHz: 100, gain: 0.2, waveform: 'square' as const }];
  const b = [{ ...a[0], frequencyHz: 880, gain: 0.2 }, { ...a[1], frequencyHz: 300, gain: 0 }];
  expect(interpolate(a, b, 0.5)).toEqual([{ frequencyHz: 660, gain: 0.1, waveform: 'sine' }, { frequencyHz: 200, gain: 0.1, waveform: 'square' }]);
  expect(interpolate(a, b, -1)).toEqual(a); expect(interpolate(a, b, 2)).toEqual(b);
});
it('keeps the cursor at its start until the audio start, then moves at constant speed and stops at the sink', () => {
  const t = new Traversal(compileProject(graph(), 48000)[0], 10);
  t.planUntil(10.15);
  expect(t.cursor(9)).toMatchObject({ x: 0, progress: 0, done: false });
  expect(t.cursor(10.5)).toMatchObject({ x: 50, progress: 0.5, done: false });
  t.planUntil(11);
  expect(t.cursor(11)).toMatchObject({ x: 100, progress: 1, done: true });
  expect(t.planUntil(100)).toEqual([]);
});
it('cycles outgoing arrows by creation order on revisits and resets on a new session', () => {
  const p = graph(); p.nodes.push(node('C', 0, 100));
  p.arrows.push({ id: 'AC', from: 'A', to: 'C' }, { id: 'BA', from: 'B', to: 'A' }, { id: 'CA', from: 'C', to: 'A' });
  const compiled = compileProject(p, 48000)[0];
  const t = new Traversal(compiled, 0);
  expect(t.planUntil(5).map(s => s.edge.id)).toEqual(['AB', 'BA', 'AC', 'CA', 'AB', 'BA']);
  expect(t.nodes.get('A')!.nextArrow).toBe(1);
  expect(t.endTime).toBe(Infinity);
  expect(new Traversal(compiled, 0).planUntil(0)[0].edge.id).toBe('AB');
});
it('does not backtrack to play another branch after reaching a sink', () => {
  const p = graph(); p.nodes.push(node('C', 0, 100)); p.arrows.push({ id: 'AC', from: 'A', to: 'C' });
  const t = new Traversal(compileProject(p, 48000)[0], 0);
  expect(t.planUntil(100).map(s => s.edge.id)).toEqual(['AB']); expect(t.endTime).toBe(1);
});
it('starts components simultaneously and lets each finish independently', () => {
  const tracks = compileProject(twoGraphs(), 48000).map(g => new Traversal(g, 5));
  tracks.forEach(t => t.planUntil(8));
  expect(tracks.map(t => t.cursor(6.5).done)).toEqual([true, false]);
  expect(tracks.map(t => t.endTime)).toEqual([6, 7]);
});
it('keeps cyclic cursor segment history bounded when time advances', () => {
  const p = graph(); p.arrows.push({ id: 'BA', from: 'B', to: 'A' });
  const t = new Traversal(compileProject(p, 48000)[0], 0);
  for (let time = 0; time < 1000; time++) { t.planUntil(time + 0.15); t.cursor(time); expect(t.segments.length).toBeLessThanOrEqual(2); }
});
