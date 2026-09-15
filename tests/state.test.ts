import { expect, it } from 'vitest';
import { defaults, readState, serializeState, toneFromState } from '../src/ui/state';

it('round-trips exact parameter strings including fractional frequency', () => {
  const state = { ...defaults, mode: 'direct', frequency: '523.2511306', step: '-18', period: '3', wave: 'triangle' };
  expect(readState(serializeState(state))).toEqual(state);
  expect(toneFromState(state).frequencyHz).toBe(523.2511306);
});
it('reads the documented URL and defaults missing fields', () => {
  const state = readState('?base=440&period=3&divisions=13&step=13&wave=sine');
  expect(toneFromState(state).frequencyHz).toBeCloseTo(1320);
});
it.each([['base', ''], ['divisions', '0'], ['period', '-2'], ['step', '0.5'], ['gain', '1'], ['gain', '-0.1'], ['wave', 'custom'], ['mode', 'unknown']])('rejects malformed %s without replacing it', (key, value) => {
  const state = readState(`?${key}=${value}`);
  expect(state[key as keyof typeof state]).toBe(value);
  expect(() => toneFromState(state)).toThrow();
});
it('rejects non-positive and blank direct frequencies', () => {
  for (const frequency of ['0', '-1', '', 'Infinity']) expect(() => toneFromState({ ...defaults, mode: 'direct', frequency })).toThrow();
});
