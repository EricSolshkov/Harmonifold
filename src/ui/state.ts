import { equalDivisionFrequency } from '../core';
import { waveforms, type Tone } from '../audio';

export const defaults = { mode: 'division', base: '440', period: '2', divisions: '12', step: '0', frequency: '440', wave: 'sine', gain: '0.05' };
export type Experiment = typeof defaults;
export function readState(search: string): Experiment {
  const params = new URLSearchParams(search);
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value])) as Experiment;
}
export function serializeState(state: Experiment): string { return new URLSearchParams(state).toString(); }
function number(value: string, name: string): number {
  if (!value.trim() || !Number.isFinite(Number(value))) throw new Error(`${name} must be a finite number.`);
  return Number(value);
}
export function toneFromState(state: Experiment): Tone {
  if (state.mode !== 'direct' && state.mode !== 'division') throw new Error('Choose a valid frequency mode.');
  const frequencyHz = state.mode === 'direct' ? number(state.frequency, 'Direct frequency') : equalDivisionFrequency(
    number(state.base, 'Base frequency'), number(state.step, 'Step index'), number(state.divisions, 'Divisions'), number(state.period, 'Period ratio'));
  if (frequencyHz <= 0) throw new Error('Frequency must be greater than zero.');
  const gain = number(state.gain, 'Gain');
  if (gain < 0 || gain > 0.2) throw new Error('Gain must be between 0 and 0.2.');
  const waveform = waveforms.find(wave => wave === state.wave);
  if (!waveform) throw new Error('Choose a supported waveform.');
  return { frequencyHz, gain, waveform };
}
