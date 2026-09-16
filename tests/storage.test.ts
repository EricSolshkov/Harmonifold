import { expect, it } from 'vitest';
import { loadProject, parseProject, serializeProject, storageKey } from '../src/graph/storage';
import { graph, twoGraphs } from './fixtures';
import { readFileSync } from 'node:fs';
import { compileProject } from '../src/graph/compile';
import { Traversal } from '../src/playback/traversal';
import { mappings } from '../src/playback/mapping';
it.each(mappings)('round-trips per-arrow %s mapping', mapping => {
  const p = twoGraphs(); p.arrows[0].mapping = mapping;
  expect(parseProject(serializeProject(p))).toEqual(p);
});
it('rejects unknown mapping values instead of silently changing the sound', () => {
  for (const mapping of ['unknown', null, 1, {}]) {
    const p = { ...graph(), arrows: [{ ...graph().arrows[0], mapping }] };
    expect(() => parseProject(JSON.stringify(p))).toThrow(/插值映射/);
  }
});
it('round-trips geometry, edge order, all sound parameters and independent starts', () => {
  const p = twoGraphs(); p.nodes[0].sounds[0].frequency = '440.123456789';
  expect(parseProject(serializeProject(p))).toEqual(p);
});
it('loads local storage and migrates old single-tone URLs with priority', () => {
  const storage = { getItem: (key: string) => key === storageKey ? serializeProject(graph()) : null };
  expect(loadProject(storage, '')).toEqual(graph());
  expect(loadProject(storage, '?base=220&wave=triangle').nodes[0].sounds[0]).toMatchObject({ base: '220', wave: 'triangle' });
  expect(loadProject({ getItem: () => null }, '').nodes).toEqual([]);
});
it.each(['null', '{}', '{broken', '{"version":2}'])('rejects malformed project %s', raw => { expect(() => parseProject(raw)).toThrow(); });
it('rejects dangling, duplicate and self edges, bad sound records, duplicate nodes and invalid starts', () => {
  const mutations = [
    (p: ReturnType<typeof graph>) => { p.arrows[0].to = 'missing'; },
    (p: ReturnType<typeof graph>) => { p.arrows.push({ ...p.arrows[0] }); },
    (p: ReturnType<typeof graph>) => { p.arrows[0].to = 'A'; },
    (p: ReturnType<typeof graph>) => { p.nodes.push({ ...p.nodes[0] }); },
    (p: ReturnType<typeof graph>) => { p.starts = ['missing']; },
    (p: ReturnType<typeof graph>) => { delete (p.nodes[0].sounds[0] as Partial<typeof p.nodes[0]['sounds'][0]>).gain; },
  ];
  for (const mutate of mutations) { const p = graph(); mutate(p); expect(() => parseProject(serializeProject(p))).toThrow(); }
});
it('ships a valid example with two independent repeating periods and different voice counts', () => {
  const p = parseProject(readFileSync(new URL('../docs/examples/independent-loops.json', import.meta.url), 'utf8'));
  const compiled = compileProject(p, 48000);
  expect(compiled.map(g => g.nodes.get(g.start)!.tones.length)).toEqual([1, 2]);
  const cycles = compiled.map(g => [...g.arrows.values()].reduce((sum, e) => sum + e.duration, 0));
  expect(cycles[0]).toBeCloseTo(8.3254, 3); expect(cycles[1]).toBeCloseTo(7.4404, 3);
  for (const g of compiled) {
    const t = new Traversal(g, 0); const segments = t.planUntil(30);
    expect(segments.filter(s => s.edge.from === g.start).length).toBeGreaterThan(3);
    expect(t.endTime).toBe(Infinity);
  }
});
