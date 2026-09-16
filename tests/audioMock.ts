import { vi } from 'vitest';
export function audioMock(resume = () => Promise.resolve()) {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelAndHoldAtTime: vi.fn() });
  const gain = () => ({ gain: param(), connect: vi.fn().mockReturnThis(), disconnect: vi.fn() });
  const oscillator = () => ({ frequency: param(), type: 'sine', connect: vi.fn().mockReturnThis(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: undefined as (() => void) | undefined });
  const gains: ReturnType<typeof gain>[] = [], oscillators: ReturnType<typeof oscillator>[] = [];
  const context = {
    currentTime: 0, sampleRate: 48000, state: 'running', destination: {},
    resume: vi.fn(resume), close: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(() => { const g = gain(); gains.push(g); return g; }),
    createOscillator: vi.fn(() => { const o = oscillator(); oscillators.push(o); return o; }),
  };
  // Each oscillator.connect(gain) must return the passed AudioNode, like Web Audio.
  context.createOscillator.mockImplementation(() => { const o = oscillator(); o.connect.mockImplementation((target: unknown) => target); oscillators.push(o); return o; });
  return { context, gains, oscillators, makeContext: () => context as unknown as AudioContext };
}
