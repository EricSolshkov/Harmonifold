import { afterEach, expect, it, vi } from 'vitest';
import { createPlayer, validateTone, waveforms, type Tone } from '../src/audio';

const tone: Tone = { frequencyHz: 440.5, gain: 0.05, waveform: 'sine' };
function mockContext(resume = () => Promise.resolve()) {
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const gain = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
  const oscillator = { frequency: parameter(), type: 'sine', connect: vi.fn(() => gain), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: undefined as (() => void) | undefined };
  const context = { sampleRate: 48000, currentTime: 1, state: 'running', destination: {}, resume: vi.fn(resume), close: vi.fn(() => Promise.resolve()), createGain: vi.fn(() => gain), createOscillator: vi.fn(() => oscillator) };
  vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  return { context, oscillator, gain };
}
afterEach(() => vi.unstubAllGlobals());
it('validates the playback boundary while accepting all four waveforms', () => {
  for (const waveform of waveforms) expect(() => validateTone({ ...tone, waveform }, 48000)).not.toThrow();
  for (const frequencyHz of [0, -1, NaN, Infinity, 24000, 30000]) expect(() => validateTone({ ...tone, frequencyHz }, 48000)).toThrow();
  for (const gain of [-1, 0.21, NaN]) expect(() => validateTone({ ...tone, gain }, 48000)).toThrow();
});
it('creates audio only on play, ramps gain and reuses the oscillator on updates', async () => {
  const mock = mockContext();
  const player = createPlayer();
  expect(mock.context.resume).not.toHaveBeenCalled();
  expect(await player.play(tone)).toBe(true);
  expect(mock.gain.gain.value).toBe(0);
  expect(mock.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0.05, 1, 0.015);
  for (const waveform of waveforms) player.update({ ...tone, frequencyHz: 660, waveform });
  expect(mock.context.createOscillator).toHaveBeenCalledTimes(1);
  expect(mock.oscillator.frequency.setTargetAtTime).toHaveBeenLastCalledWith(660, 1, 0.015);
  player.stop();
  expect(mock.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, 0.008);
  expect(mock.oscillator.stop).toHaveBeenCalledWith(1.08);
  mock.oscillator.onended?.();
  expect(mock.oscillator.disconnect).toHaveBeenCalled();
  player.dispose();
  expect(mock.context.close).toHaveBeenCalled();
});
it('does not start a stale play request after Stop during resume', async () => {
  let resolve!: () => void;
  const mock = mockContext(() => new Promise<void>(done => { resolve = done; }));
  const player = createPlayer();
  const pending = player.play(tone);
  player.stop(); resolve();
  expect(await pending).toBe(false);
  expect(mock.context.createOscillator).not.toHaveBeenCalled();
  player.dispose();
});
