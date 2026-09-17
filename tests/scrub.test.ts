import { expect, it } from 'vitest';
import { compileProject } from '../src/graph/compile';
import { moveScrub, scrubCursor, type ScrubPosition } from '../src/playback/scrub';
import { Traversal } from '../src/playback/traversal';
import { graph, node } from './fixtures';

it('scrubs forward/backward on an edge, clamps at endpoints, and keeps endpoints alive', () => {
  const g = compileProject(graph(), 48000)[0];
  let state: ScrubPosition = { edge: 'AB', progress: 0.5, pointer: { x: 50, y: 0 } };
  state = moveScrub(g, state, { x: 25, y: 40 }, 10);
  expect(scrubCursor(g, state)).toMatchObject({ x: 25, progress: 0.25, done: false });
  state = moveScrub(g, state, { x: 200, y: 0 }, 10);
  expect(scrubCursor(g, state)).toMatchObject({ x: 100, progress: 1, done: false });
  state = moveScrub(g, state, { x: -100, y: 0 }, 10);
  expect(state.progress).toBe(0);
});
it('chooses a connected branch by pointer direction and can travel backwards into an incoming edge', () => {
  const p = graph(); p.nodes.push(node('C', 100, 100), node('D', 100, -100));
  p.arrows.push({ id: 'BC', from: 'B', to: 'C' }, { id: 'DB', from: 'D', to: 'B' });
  const g = compileProject(p, 48000)[0];
  const start: ScrubPosition = { edge: 'AB', progress: 1, pointer: { x: 100, y: 0 } };
  expect(moveScrub(g, start, { x: 100, y: 60 }, 10)).toMatchObject({ edge: 'BC', progress: 0.6 });
  expect(moveScrub(g, start, { x: 100, y: -60 }, 10)).toMatchObject({ edge: 'DB', progress: 0.4 });
});
it('does not switch at geometric crossings or jump directly to a remote edge', () => {
  const p = graph(); p.nodes.push(node('C', 50, -100), node('D', 50, 100));
  p.arrows.push({ id: 'BC', from: 'B', to: 'C' }, { id: 'CD', from: 'C', to: 'D' });
  const g = compileProject(p, 48000)[0];
  const start: ScrubPosition = { edge: 'AB', progress: 0.5, pointer: { x: 50, y: 0 } };
  expect(moveScrub(g, start, { x: 50, y: 70 }, 10)).toMatchObject({ edge: 'AB', progress: 0.5 });
});
it('handles a fast move across a junction and retains the current edge for ambiguous nearby motion', () => {
  const p = graph(); p.nodes.push(node('C', 200)); p.arrows.push({ id: 'BC', from: 'B', to: 'C' });
  const g = compileProject(p, 48000)[0];
  const start: ScrubPosition = { edge: 'AB', progress: 0.5, pointer: { x: 50, y: 0 } };
  expect(moveScrub(g, start, { x: 180, y: 0 }, 10)).toMatchObject({ edge: 'BC', progress: 0.8 });
  expect(moveScrub(g, { ...start, progress: 1, pointer: { x: 100, y: 0 } }, { x: 101, y: 0 }, 10).edge).toBe('AB');
});
it('can select the opposite directed edge by its visible lane at a shared node', () => {
  const p = graph(); p.arrows.push({ id: 'BA', from: 'B', to: 'A' });
  const g = compileProject(p, 48000)[0];
  const start = { edge: 'AB', progress: 1, pointer: { x: 100, y: 9 } };
  expect(moveScrub(g, start, { x: 50, y: -9 }, 10)).toMatchObject({ edge: 'BA', progress: 0.5 });
  expect(moveScrub(g, start, { x: 50, y: 9 }, 10)).toMatchObject({ edge: 'AB', progress: 0.5 });
});
it('rolls back speculative branch counts and resumes from a moved position with remaining travel time', () => {
  const p = graph(); p.nodes.push(node('C', 100, 100), node('D', 200));
  p.arrows.push({ id: 'BC', from: 'B', to: 'C' }, { id: 'BD', from: 'B', to: 'D' });
  const g = compileProject(p, 48000)[0], t = new Traversal(g, 0);
  t.planUntil(1.1); expect(t.nodes.get('B')!.nextArrow).toBe(1);
  const frozen = t.freeze(0.95);
  expect(frozen).toMatchObject({ edge: 'AB', progress: 0.95 });
  expect(t.nodes.get('B')!.nextArrow).toBe(0);
  const resume = t.resumeAt({ ...frozen, progress: 0.5 }, 10)!;
  expect(resume.end).toBe(10.5);
  expect(t.planUntil(10.5)[0].edge.id).toBe('BC');
});
it('does not roll back a departure already reached, including an exact boundary', () => {
  const p = graph(); p.nodes.push(node('C', 100, 100), node('D', 200));
  p.arrows.push({ id: 'BC', from: 'B', to: 'C' }, { id: 'BD', from: 'B', to: 'D' });
  const t = new Traversal(compileProject(p, 48000)[0], 0);
  t.planUntil(1.1); const c = t.freeze(1);
  expect(c.edge).toBe('BC'); expect(t.nodes.get('B')!.nextArrow).toBe(1);
  t.resumeAt({ ...c, edge: 'AB', progress: 0.5 }, 10);
  expect(t.planUntil(10.5)[0].edge.id).toBe('BD');
});
it('restores every future departure in a short-edge loop and does not reset past decisions', () => {
  const p = graph(); p.nodes[1].x = 1; p.nodes.push(node('C', 0, 1));
  p.arrows.push({ id: 'AC', from: 'A', to: 'C' }, { id: 'BA', from: 'B', to: 'A' }, { id: 'CA', from: 'C', to: 'A' });
  const g = compileProject(p, 48000)[0];
  const ahead = new Traversal(g, 0), reference = new Traversal(g, 0);
  ahead.planUntil(0.15); reference.planUntil(0.035);
  const c = ahead.freeze(0.035);
  expect([...ahead.nodes.values()].map(n => n.nextArrow)).toEqual([...reference.nodes.values()].map(n => n.nextArrow));
  ahead.resumeAt(c, 20);
  expect(ahead.planUntil(20.1).map(s => s.edge.id)).toEqual(reference.planUntil(0.135).map(s => s.edge.id));
});
