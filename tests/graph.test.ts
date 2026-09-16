import { describe, expect, it } from 'vitest';
import { components, editProject, emptyProject, reachable } from '../src/graph/model';
import { compileProject } from '../src/graph/compile';
import { graph, node, twoGraphs } from './fixtures';

describe('graph editing', () => {
  it('edits only the selected arrow mapping without changing order, start or geometry', () => {
    const original = twoGraphs();
    const changed = editProject(original, { type: 'mapping', id: 'AB', mapping: 'smoothstep' });
    expect(changed.arrows[0].mapping).toBe('smoothstep');
    expect(changed.arrows[1]).toBe(original.arrows[1]);
    expect(changed.nodes).toBe(original.nodes); expect(changed.starts).toBe(original.starts);
    expect(original.arrows[0].mapping).toBeUndefined();
    expect(compileProject(changed, 48000)[0].arrows.get('AB')).toMatchObject({ mapping: 'smoothstep', duration: 1 });
    expect(compileProject(original, 48000)[0].arrows.get('AB')!.mapping).toBe('linear');
  });
  it('adds independent sound arrays, moves nodes and preserves original state', () => {
    const original = emptyProject();
    let p = editProject(original, { type: 'add', id: 'A', point: { x: 30, y: 40 } });
    p = editProject(p, { type: 'add', id: 'B', point: { x: 80, y: 90 } });
    p = editProject(p, { type: 'move', id: 'A', point: { x: 50, y: 60 } });
    expect(original.nodes).toEqual([]);
    expect(p.nodes[0]).toMatchObject({ x: 50, y: 60 });
    expect(p.nodes[0].sounds[0]).not.toBe(p.nodes[1].sounds[0]);
    p = editProject(p, { type: 'sounds', id: 'A', sounds: [] });
    expect(p.nodes[0].sounds).toEqual([]); expect(p.nodes[1].sounds).toHaveLength(1);
  });
  it('creates directed edges in order, initializes a start and rejects duplicates and self edges', () => {
    let p: ReturnType<typeof graph> = { ...graph(), arrows: [], starts: [] };
    p = editProject(p, { type: 'connect', id: 'AB', from: 'A', to: 'B' });
    expect(p.starts).toEqual(['A']);
    expect(editProject(p, { type: 'connect', id: 'duplicate', from: 'A', to: 'B' })).toBe(p);
    expect(editProject(p, { type: 'connect', id: 'self', from: 'A', to: 'A' })).toBe(p);
    expect(editProject(p, { type: 'connect', id: 'missing', from: 'A', to: 'X' })).toBe(p);
    p = editProject(p, { type: 'connect', id: 'BA', from: 'B', to: 'A' });
    expect(p.arrows.map(e => e.id)).toEqual(['AB', 'BA']);
    p = editProject(p, { type: 'start', id: 'B' }); expect(p.starts).toEqual(['B']);
  });
  it('deletes incident edges and start markers, but leaves other nodes intact', () => {
    const p = editProject(twoGraphs(), { type: 'delete', id: 'A' });
    expect(p.arrows.map(e => e.id)).toEqual(['CD']); expect(p.starts).toEqual(['C']);
    expect(p.nodes.map(n => n.id)).toEqual(['B', 'C', 'D']);
  });
  it('merges components with the source component start and exposes missing starts after a split', () => {
    let p = editProject(twoGraphs(), { type: 'connect', id: 'BC', from: 'B', to: 'C' });
    expect(p.starts).toEqual(['A']); expect(components(p)).toHaveLength(1);
    p = editProject(p, { type: 'disconnect', id: 'BC' });
    expect(components(p)).toHaveLength(2);
    expect(() => compileProject(p, 48000)).toThrow(/图 2.*起点/);
    p = editProject(p, { type: 'start', id: 'C' });
    expect(compileProject(p, 48000)).toHaveLength(2);
  });
  it('distinguishes weak connectivity and directed reachability, ignoring isolates', () => {
    const p = { ...graph(), nodes: [...graph().nodes, node('C'), node('draft')], arrows: [...graph().arrows, { id: 'CB', from: 'C', to: 'B' }] };
    expect(components(p)).toEqual([['A', 'B', 'C']]);
    expect([...reachable(p)]).toEqual(['A', 'B']);
    expect(editProject(p, { type: 'start', id: 'B' })).toBe(p);
    expect(editProject(p, { type: 'start', id: 'draft' })).toBe(p);
  });
});

describe('playback compilation and validation', () => {
  it('uses geometric length / speed, recomputing after move and speed edits', () => {
    let p = graph(); expect(compileProject(p, 48000)[0].arrows.get('AB')!.duration).toBe(1);
    p = editProject(p, { type: 'move', id: 'B', point: { x: 300, y: 400 } });
    expect(compileProject(p, 48000)[0].arrows.get('AB')!.duration).toBe(5);
    p = editProject(p, { type: 'speed', speed: 200 });
    expect(compileProject(p, 48000)[0].arrows.get('AB')!.duration).toBe(2.5);
  });
  it('allows different counts and waveforms across disconnected graphs', () => {
    const p = twoGraphs();
    for (const n of p.nodes.slice(2)) n.sounds = [{ ...n.sounds[0], wave: 'square' }, { ...n.sounds[0], wave: 'triangle' }];
    const result = compileProject(p, 48000);
    expect(result[0].nodes.get('A')!.tones).toHaveLength(1);
    expect(result[1].nodes.get('C')!.tones.map(t => t.waveform)).toEqual(['square', 'triangle']);
  });
  it('validates matching indices rather than unordered waveform sets', () => {
    const p = graph();
    p.nodes[0].sounds = [{ ...p.nodes[0].sounds[0], wave: 'sine' }, { ...p.nodes[0].sounds[0], wave: 'square' }];
    p.nodes[1].sounds = [...p.nodes[0].sounds].reverse();
    expect(() => compileProject(p, 48000)).toThrow(/B · 声音 1.*波形/);
  });
  it('rejects differing sizes and empty arrays in a component', () => {
    const p = graph(); p.nodes[1].sounds.push({ ...p.nodes[1].sounds[0] });
    expect(() => compileProject(p, 48000)).toThrow(/声音数量/);
    p.nodes[1].sounds = []; expect(() => compileProject(p, 48000)).toThrow(/不能为空/);
  });
  it('validates all component nodes even when unreachable and ignores invalid isolated drafts', () => {
    const p = graph(); const draft = node('draft'); draft.sounds = []; p.nodes.push(draft);
    expect(() => compileProject(p, 48000)).not.toThrow();
    p.arrows.push({ id: 'draftB', from: 'draft', to: 'B' });
    expect(() => compileProject(p, 48000)).toThrow(/draft/);
  });
  it.each([0, -1, Infinity, NaN, 1001])('rejects invalid speed %s', speed => {
    expect(() => compileProject({ ...graph(), speed }, 48000)).toThrow(/速度/);
  });
  it('rejects missing or duplicate starts and sink starts', () => {
    for (const starts of [[], ['B'], ['A', 'B']]) expect(() => compileProject({ ...graph(), starts }, 48000)).toThrow(/起点/);
  });
  it('rejects empty graph, overlapping endpoints and invalid frequency before starting any graph', () => {
    expect(() => compileProject(emptyProject(), 48000)).toThrow(/连接/);
    const p = graph(); p.nodes[1].x = 0;
    expect(() => compileProject(p, 48000)).toThrow(/重叠/);
    p.nodes[1].x = 100; p.nodes[1].sounds[0].frequency = '24000';
    expect(() => compileProject(p, 48000)).toThrow(/B · 声音 1/);
  });
});
