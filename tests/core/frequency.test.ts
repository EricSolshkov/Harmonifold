import { describe, expect, it } from 'vitest';
import { centsToFrequency, equalDivisionFrequency, ratioToFrequency } from '../../src/core';

describe('frequency mathematics', () => {
  it.each([[2, 880], [0.5, 220], [1.5, 660]])('ratio %s → %s Hz', (ratio, result) => {
    expect(ratioToFrequency(440, ratio)).toBeCloseTo(result, 10);
  });
  it.each([[0, 440], [1200, 880], [-1200, 220]])('cents %s → %s Hz', (cents, result) => {
    expect(centsToFrequency(440, cents)).toBeCloseTo(result, 10);
  });
  it.each([[0, 440], [12, 880], [-12, 220]])('12-EDO step %s → %s Hz', (step, result) => {
    expect(equalDivisionFrequency(440, step, 12)).toBeCloseTo(result, 10);
  });
  it('supports non-octave and descending periods', () => {
    expect(equalDivisionFrequency(440, 13, 13, 3)).toBeCloseTo(1320, 10);
    expect(equalDivisionFrequency(440, 13, 13, 0.5)).toBeCloseTo(220, 10);
    expect(equalDivisionFrequency(440, 7, 13, 1)).toBe(440);
    expect(equalDivisionFrequency(440, 7, 13, 3) / equalDivisionFrequency(440, 6, 13, 3)).toBeCloseTo(3 ** (1 / 13), 12);
  });
  it('agrees across equivalent constructions', () => {
    expect(ratioToFrequency(440, 2)).toBeCloseTo(centsToFrequency(440, 1200), 10);
    expect(centsToFrequency(440, 1200)).toBeCloseTo(equalDivisionFrequency(440, 12, 12, 2), 10);
  });
  it.each([0, -1, NaN, Infinity, -Infinity])('rejects invalid positive inputs %s', value => {
    expect(() => ratioToFrequency(value, 2)).toThrow();
    expect(() => ratioToFrequency(440, value)).toThrow();
    expect(() => equalDivisionFrequency(440, 0, value)).toThrow();
    expect(() => equalDivisionFrequency(440, 0, 12, value)).toThrow();
  });
  it('rejects invalid indices, cents and unrepresentable results', () => {
    for (const step of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) expect(() => equalDivisionFrequency(440, step, 12)).toThrow();
    expect(() => equalDivisionFrequency(440, 0, 12.5)).toThrow();
    expect(() => centsToFrequency(440, Infinity)).toThrow();
    expect(() => ratioToFrequency(Number.MAX_VALUE, 2)).toThrow();
    expect(() => ratioToFrequency(Number.MIN_VALUE, 0.1)).toThrow();
  });
});
