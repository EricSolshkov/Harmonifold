import { compileProject } from '../graph/compile';
import type { Project } from '../graph/model';
import { interpolate, Traversal, type Cursor, type Segment } from '../playback/traversal';
import { mappingEvents } from '../playback/mapping';

interface Voice { oscillator: OscillatorNode; gain: GainNode }
interface Track { traversal: Traversal; voices: Voice[]; envelope: GainNode; released: boolean }
export interface PlaybackCallbacks { frame: (cursors: Cursor[]) => void; ended: () => void; error: (message: string) => void }

/** Schedule per-edge mapped transitions on the audio clock; cursor speed stays geometric. */
export function createEnsemble(callbacks: PlaybackCallbacks, makeContext = () => new AudioContext()) {
  let context: AudioContext | undefined;
  let tracks: Track[] = [];
  let master: GainNode | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  function stop() {
    generation++;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    if (context) {
      const now = context.currentTime;
      for (const track of tracks) {
        track.envelope.gain.cancelAndHoldAtTime(now);
        track.envelope.gain.linearRampToValueAtTime(0, now + 0.04);
        for (const voice of track.voices) {
          try { voice.oscillator.stop(now + 0.04); } catch { /* already ended */ }
        }
      }
    }
    tracks = []; master = undefined;
  }
  function schedule(track: Track, segment: Segment) {
    const now = context!.currentTime;
    if (segment.end <= now) return;
    const from = track.traversal.nodes.get(segment.edge.from)!.tones;
    const to = track.traversal.nodes.get(segment.edge.to)!.tones;
    const start = Math.max(segment.start, now);
    for (const event of mappingEvents(segment.edge.mapping, (start - segment.start) / segment.edge.duration)) {
      const time = event.x === 1 ? segment.end : Math.max(start, segment.start + event.x * segment.edge.duration);
      const tones = interpolate(from, to, event.value);
      track.voices.forEach((voice, i) => {
        const method = event.transition === 'set' ? 'setValueAtTime' : 'linearRampToValueAtTime';
        voice.oscillator.frequency[method](tones[i].frequencyHz, time);
        voice.gain.gain[method](tones[i].gain, time);
      });
    }
  }
  function tick() {
    if (!context || !tracks.length) return;
    try {
      const now = context.currentTime;
      for (const track of tracks) {
        for (const segment of track.traversal.planUntil(now + 0.15)) schedule(track, segment);
        if (Number.isFinite(track.traversal.endTime) && !track.released) {
          track.released = true;
          const end = Math.max(now, track.traversal.endTime);
          track.envelope.gain.setValueAtTime(1, end);
          track.envelope.gain.linearRampToValueAtTime(0, end + 0.04);
          for (const voice of track.voices) voice.oscillator.stop(end + 0.04);
        }
      }
      callbacks.frame(tracks.map(track => track.traversal.cursor(now)));
      if (tracks.every(track => now >= track.traversal.endTime + 0.04)) { stop(); callbacks.ended(); }
    } catch (cause) { stop(); callbacks.error((cause as Error).message); }
  }
  return {
    async play(project: Project): Promise<boolean> {
      stop();
      const request = generation;
      context ??= makeContext();
      const graphs = compileProject(project, context.sampleRate);
      await context.resume();
      if (request !== generation) return false;
      if (context.state !== 'running') throw new Error('音频未能启动，请再次按播放。');
      try {
        master = context.createGain();
        const output = master;
        const count = graphs.reduce((sum, graph) => sum + graph.nodes.get(graph.start)!.tones.length, 0);
        // A fixed mix scale for the complete session, never pumped as tracks finish.
        output.gain.value = Math.min(1, 0.8 / (count * 0.2));
        output.connect(context.destination);
        let remaining = count;
        const start = context.currentTime + 0.04;
        for (const graph of graphs) {
          const envelope = context.createGain();
          envelope.gain.setValueAtTime(0, start);
          envelope.gain.linearRampToValueAtTime(1, start + 0.01);
          envelope.connect(output);
          const track: Track = { traversal: new Traversal(graph, start), envelope, voices: [], released: false };
          tracks.push(track);
          let trackRemaining = graph.nodes.get(graph.start)!.tones.length;
          for (const tone of graph.nodes.get(graph.start)!.tones) {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = tone.waveform; oscillator.frequency.value = tone.frequencyHz; gain.gain.value = tone.gain;
            oscillator.connect(gain).connect(envelope);
            oscillator.onended = () => {
              oscillator.disconnect(); gain.disconnect();
              if (--trackRemaining === 0) envelope.disconnect();
              if (--remaining === 0) output.disconnect();
            };
            track.voices.push({ oscillator, gain }); oscillator.start(start);
          }
        }
        tick();
        if (request !== generation) return false;
        timer = setInterval(tick, 25);
        return true;
      } catch (cause) { stop(); throw cause; }
    },
    stop,
    dispose() { stop(); if (context) void context.close(); context = undefined; },
  };
}
