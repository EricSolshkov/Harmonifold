import { expect, it } from 'vitest';
import { mappingEvents, mapProgress, mappings } from '../src/playback/mapping';
import { interpolate, Traversal } from '../src/playback/traversal';
import { compileProject } from '../src/graph/compile';
import { graph } from './fixtures';

it.each(mappings)('%s mapping clamps the domain and preserves both endpoints', mapping => {
  expect(mapProgress(-1, mapping)).toBe(0); expect(mapProgress(0, mapping)).toBe(0);
  expect(mapProgress(1, mapping)).toBe(1); expect(mapProgress(2, mapping)).toBe(1);
});
it('defines linear, exact floor, and the fixed last-5-percent smoothstep', () => {
  expect(mapProgress(0.37)).toBe(0.37);
  expect(mapProgress(0.999999, 'floor')).toBe(0);
  expect(mapProgress(0.5, 'smoothstep')).toBe(0);
  expect(mapProgress(0.95, 'smoothstep')).toBe(0);
  expect(mapProgress(0.9625, 'smoothstep')).toBeCloseTo(0.15625, 12);
  expect(mapProgress(0.975, 'smoothstep')).toBeCloseTo(0.5, 12);
  expect(mapProgress(0.9875, 'smoothstep')).toBeCloseTo(0.84375, 12);
});
it('maps both frequency and gain identically while leaving geometric cursor travel unchanged', () => {
  const p = graph(); p.arrows[0].mapping = 'floor';
  p.nodes[0].sounds[0].gain = '0'; p.nodes[1].sounds[0].gain = '0.2';
  const g = compileProject(p, 48000)[0], a = g.nodes.get('A')!.tones, b = g.nodes.get('B')!.tones;
  expect(interpolate(a, b, 0.975, 'floor')).toEqual(a);
  expect(interpolate(a, b, 1, 'floor')).toEqual(b);
  expect(interpolate(a, b, 0.975, 'smoothstep')[0].frequencyHz).toBeCloseTo(660);
  expect(interpolate(a, b, 0.975, 'smoothstep')[0].gain).toBeCloseTo(0.1);
  const t = new Traversal(g, 0); t.planUntil(1);
  expect(t.cursor(0.5)).toMatchObject({ x: 50, progress: 0.5, done: false });
  expect(t.endTime).toBe(1);
});
it('schedules floor as two set events and linear as one ramp', () => {
  expect(mappingEvents('floor')).toEqual([{ x: 0, value: 0, transition: 'set' }, { x: 1, value: 1, transition: 'set' }]);
  expect(mappingEvents('linear', 0.4)).toEqual([{ x: 0.4, value: 0.4, transition: 'set' }, { x: 1, value: 1, transition: 'linear' }]);
});
it('holds smoothstep until 95% and bounds the approximation error throughout the transition', () => {
  const events = mappingEvents('smoothstep');
  expect(events[1]).toEqual({ x: 0.95, value: 0, transition: 'set' });
  for (let i = 2; i < events.length; i++) {
    const a = events[i - 1], b = events[i];
    expect(b.x).toBeGreaterThan(a.x);
    for (const fraction of [0.25, 0.5, 0.75]) {
      const x = a.x + (b.x - a.x) * fraction;
      const value = a.value + (b.value - a.value) * fraction;
      expect(Math.abs(value - mapProgress(x, 'smoothstep'))).toBeLessThan(0.000046);
    }
  }
  expect(events.at(-1)).toEqual({ x: 1, value: 1, transition: 'linear' });
});
it('resumes late scheduling on the original curve rather than restarting its easing', () => {
  const events = mappingEvents('smoothstep', 0.973);
  expect(events[0]).toEqual({ x: 0.973, value: mapProgress(0.973, 'smoothstep'), transition: 'set' });
  expect(events.slice(1).every(e => e.x > 0.973)).toBe(true);
  expect(mappingEvents('smoothstep', 1)).toEqual([{ x: 1, value: 1, transition: 'set' }]);
});
