import type { Tone } from '../audio';
import type { CompiledArrow, CompiledGraph } from '../graph/compile';
import { mapProgress, type Mapping } from './mapping';

export interface Segment { edge: CompiledArrow; start: number; end: number }
export interface Cursor { graph: string; x: number; y: number; done: boolean; edge?: string; progress: number; dragging?: boolean; paused?: boolean }
export function interpolate(from: Tone[], to: Tone[], x: number, mapping: Mapping = 'linear'): Tone[] {
  const t = mapProgress(x, mapping);
  return from.map((tone, i) => ({ waveform: tone.waveform, frequencyHz: tone.frequencyHz * (1 - t) + to[i].frequencyHz * t, gain: tone.gain * (1 - t) + to[i].gain * t }));
}

/** Each playback node owns nextArrow; the cursor has no traversal history. */
export class Traversal {
  readonly nodes;
  readonly segments: Segment[] = [];
  private nodeId: string;
  private nextTime: number;
  endTime = Infinity;
  constructor(readonly graph: CompiledGraph, readonly startTime: number) {
    this.nodes = new Map([...graph.nodes].map(([id, node]) => [id, { ...node, nextArrow: 0 }]));
    this.nodeId = graph.start; this.nextTime = startTime;
  }
  planUntil(time: number): Segment[] {
    const added: Segment[] = [];
    while (this.nextTime <= time && this.endTime === Infinity) {
      if (added.length >= 10000) throw new Error('连接过短或速度过高，请拉开结点或降低速度。');
      const node = this.nodes.get(this.nodeId)!;
      if (!node.outgoing.length) { this.endTime = this.nextTime; break; }
      const edge = this.graph.arrows.get(node.outgoing[node.nextArrow])!;
      node.nextArrow = (node.nextArrow + 1) % node.outgoing.length;
      const segment = { edge, start: this.nextTime, end: this.nextTime + edge.duration };
      added.push(segment); this.segments.push(segment);
      this.nextTime = segment.end; this.nodeId = edge.to;
    }
    return added;
  }
  /** Discard speculative departures, retaining only decisions that have actually happened. */
  freeze(time: number): Cursor {
    const actualTime = Math.max(time, this.startTime);
    this.planUntil(actualTime);
    const cursor = this.cursor(actualTime);
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const segment = this.segments[i];
      if (segment.start > actualTime) {
        const node = this.nodes.get(segment.edge.from)!;
        node.nextArrow = (node.nextArrow + node.outgoing.length - 1) % node.outgoing.length;
        this.segments.splice(i, 1);
      }
    }
    return cursor;
  }
  /** Manual movement never consumes a departure. Resume forward on the selected edge. */
  resumeAt(cursor: Cursor, time: number): Segment | undefined {
    if (cursor.done || !cursor.edge) return;
    const edge = this.graph.arrows.get(cursor.edge)!;
    const progress = Math.max(0, Math.min(1, cursor.progress));
    const segment = { edge, start: time - progress * edge.duration, end: time + (1 - progress) * edge.duration };
    this.segments.splice(0, this.segments.length, segment);
    this.nodeId = edge.to; this.nextTime = segment.end; this.endTime = Infinity;
    return segment;
  }
  cursor(time: number): Cursor {
    while (this.segments.length > 1 && this.segments[1].start <= time) this.segments.shift();
    const segment = this.segments[0];
    if (!segment) {
      const node = this.nodes.get(this.graph.start)!;
      return { graph: this.graph.start, x: node.x, y: node.y, done: time >= this.endTime, progress: 0 };
    }
    const from = this.nodes.get(segment.edge.from)!;
    const to = this.nodes.get(segment.edge.to)!;
    const progress = Math.max(0, Math.min(1, (time - segment.start) / segment.edge.duration));
    return { graph: this.graph.start, x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress, progress, edge: segment.edge.id, done: time >= this.endTime };
  }
}
