export const waveforms = ['sine', 'square', 'sawtooth', 'triangle'] as const;
export type Waveform = typeof waveforms[number];
export interface Tone { frequencyHz: number; gain: number; waveform: Waveform }

export function validateTone(tone: Tone, sampleRate: number): void {
  if (!Number.isFinite(tone.frequencyHz) || tone.frequencyHz <= 0 || tone.frequencyHz >= sampleRate / 2)
    throw new RangeError(`Playback frequency must be greater than 0 and below ${sampleRate / 2} Hz (sample-rate limit).`);
  if (!Number.isFinite(tone.gain) || tone.gain < 0 || tone.gain > 0.2)
    throw new RangeError('Gain must be between 0 and 0.2.');
  if (!waveforms.includes(tone.waveform)) throw new RangeError('Unsupported waveform.');
}

export function createPlayer() {
  let context: AudioContext | undefined;
  let voice: { oscillator: OscillatorNode; gain: GainNode } | undefined;
  let generation = 0;
  function stop() {
    generation++;
    if (!voice || !context) return;
    const old = voice;
    voice = undefined;
    old.gain.gain.setTargetAtTime(0, context.currentTime, 0.008);
    old.oscillator.stop(context.currentTime + 0.08);
    old.oscillator.onended = () => { old.oscillator.disconnect(); old.gain.disconnect(); };
  }
  function update(tone: Tone) {
    if (!context) return;
    validateTone(tone, context.sampleRate);
    if (!voice) return;
    voice.oscillator.frequency.setTargetAtTime(tone.frequencyHz, context.currentTime, 0.015);
    voice.gain.gain.setTargetAtTime(tone.gain, context.currentTime, 0.015);
    voice.oscillator.type = tone.waveform;
  }
  return {
    async play(tone: Tone) {
      context ??= new AudioContext();
      validateTone(tone, context.sampleRate);
      const request = ++generation;
      await context.resume();
      if (request !== generation) return false;
      if (context.state !== 'running') throw new Error('Audio is suspended. Please press Play again.');
      if (!voice) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone.waveform;
        oscillator.frequency.value = tone.frequencyHz;
        gain.gain.value = 0;
        oscillator.connect(gain).connect(context.destination);
        voice = { oscillator, gain };
        oscillator.start();
      }
      update(tone);
      return true;
    },
    update, stop,
    dispose() { stop(); if (context) void context.close(); context = undefined; },
  };
}
