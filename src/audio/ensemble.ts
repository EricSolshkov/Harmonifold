import { compileProject } from '../graph/compile';
import type { Project, Point } from '../graph/model';
import { interpolate, Traversal, type Cursor, type Segment } from '../playback/traversal';
import { mappingEvents } from '../playback/mapping';
import { moveScrub, scrubCursor, type ScrubPosition } from '../playback/scrub';

interface Voice { oscillator: OscillatorNode; gain: GainNode }
interface Track { traversal: Traversal; voices: Voice[]; envelope: GainNode; released: boolean; finished: boolean }
export interface PlaybackCallbacks { frame: (cursors: Cursor[]) => void; ended: () => void; error: (message: string) => void }

/** Schedule per-edge mapped transitions on the audio clock; cursor speed stays geometric. */
export function createEnsemble(callbacks: PlaybackCallbacks, makeContext = () => new AudioContext()) {
  let context: AudioContext | undefined;
  let tracks: Track[] = [];
  let master: GainNode | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  let manual: { graph: string; position: ScrubPosition; cursors: Cursor[] } | undefined;
  function stop() {
    generation++;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    if (manual) { callbacks.frame(manual.cursors); manual = undefined; }
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
  function manualFrame() {
    if (manual) callbacks.frame(manual.cursors.map(cursor => ({ ...cursor, dragging: cursor.graph === manual!.graph, paused: !cursor.done && cursor.graph !== manual!.graph })));
  }
  function holdTone(track: Track, cursor: Cursor, now: number) {
    if (!cursor.edge) return;
    const edge = track.traversal.graph.arrows.get(cursor.edge)!;
    const tones = interpolate(track.traversal.nodes.get(edge.from)!.tones, track.traversal.nodes.get(edge.to)!.tones, cursor.progress, edge.mapping);
    track.voices.forEach((voice, i) => {
      voice.oscillator.frequency.cancelAndHoldAtTime(now);
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.oscillator.frequency.setValueAtTime(tones[i].frequencyHz, now);
      voice.gain.gain.setValueAtTime(tones[i].gain, now);
    });
  }
  function fail(cause: unknown) { stop(); callbacks.error((cause as Error).message); }
  function beginDrag(graph: string): boolean {
    if (!context || manual || !tracks.length) return false;
    try {
      tick();
      const now = context.currentTime;
      const target = tracks.find(track => track.traversal.graph.start === graph);
      if (!target || target.finished || target.traversal.cursor(now).done) return false;
      const cursors = tracks.map(track => track.traversal.freeze(now));
      const cursor = cursors.find(c => c.graph === graph)!;
      if (!cursor.edge) return false;
      manual = { graph, cursors, position: { edge: cursor.edge, progress: cursor.progress, pointer: { x: cursor.x, y: cursor.y } } };
      tracks.forEach((track, i) => {
        if (track.finished) return;
        holdTone(track, cursors[i], now);
        track.envelope.gain.cancelAndHoldAtTime(now);
        track.envelope.gain.linearRampToValueAtTime(track === target ? 1 : 0, now + 0.015);
        if (!cursors[i].done) track.released = false;
      });
      manualFrame(); return true;
    } catch (cause) { fail(cause); return false; }
  }
  function dragTo(pointer: Point, radius = 20) {
    if (!manual || !context) return;
    try {
      const track = tracks.find(t => t.traversal.graph.start === manual!.graph)!;
      manual.position = moveScrub(track.traversal.graph, manual.position, pointer, radius);
      const cursor = scrubCursor(track.traversal.graph, manual.position);
      manual.cursors = manual.cursors.map(c => c.graph === cursor.graph ? cursor : c);
      holdTone(track, cursor, context.currentTime); manualFrame();
    } catch (cause) { fail(cause); }
  }
  function endDrag() {
    if (!manual || !context) return;
    try {
      const now = context.currentTime, cursors = manual.cursors;
      manual = undefined;
      tracks.forEach((track, i) => {
        if (cursors[i].done) return;
        const segment = track.traversal.resumeAt(cursors[i], now);
        if (segment) schedule(track, segment);
        track.envelope.gain.cancelAndHoldAtTime(now);
        track.envelope.gain.linearRampToValueAtTime(1, now + 0.015);
      });
      tick();
    } catch (cause) { fail(cause); }
  }
  function tick() {
    if (!context || !tracks.length) return;
    if (manual) return;
    try {
      const now = context.currentTime;
      for (const track of tracks) {
        for (const segment of track.traversal.planUntil(now + 0.15)) schedule(track, segment);
        if (Number.isFinite(track.traversal.endTime) && !track.released) {
          track.released = true;
          const end = Math.max(now, track.traversal.endTime);
          track.envelope.gain.setValueAtTime(1, end);
          track.envelope.gain.linearRampToValueAtTime(0, end + 0.04);
        }
        // Do not pre-schedule oscillator.stop: a grab can cancel a not-yet-reached sink.
        if (!track.finished && now >= track.traversal.endTime + 0.04) {
          track.finished = true;
          for (const voice of track.voices) voice.oscillator.stop(now);
        }
      }
      callbacks.frame(tracks.map(track => track.traversal.cursor(now)));
      if (tracks.every(track => now >= track.traversal.endTime + 0.04)) { stop(); callbacks.ended(); }
    } catch (cause) { fail(cause); }
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
          const track: Track = { traversal: new Traversal(graph, start), envelope, voices: [], released: false, finished: false };
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
    stop, beginDrag, dragTo, endDrag,
    dispose() { stop(); if (context) void context.close(); context = undefined; },
  };
}
