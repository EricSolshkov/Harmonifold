export const mappings = ['linear', 'floor', 'smoothstep'] as const;
export type Mapping = typeof mappings[number];
export const mappingLabels: Record<Mapping, string> = {
  linear: 'y = x', floor: 'y = floor(x)', smoothstep: 'y = smoothstep(x, 0.95, 1)',
};
export function isMapping(value: unknown): value is Mapping {
  return mappings.some(mapping => mapping === value);
}
export function mapProgress(x: number, mapping: Mapping = 'linear'): number {
  const progress = Math.max(0, Math.min(1, x));
  if (mapping === 'floor') return Math.floor(progress);
  if (mapping === 'smoothstep') {
    const t = Math.max(0, Math.min(1, (progress - 0.95) / 0.05));
    return t * t * (3 - 2 * t);
  }
  return progress;
}

export interface MappingEvent { x: number; value: number; transition: 'set' | 'linear' }
/** Audio automation approximation: 128 linear intervals only inside the smooth transition.
 * Maximum normalized interpolation error is below 0.000046. Steps remain exact jumps.
 * startX allows delayed scheduling to resume at the correct point on the original curve.
 */
export function mappingEvents(mapping: Mapping, startX = 0): MappingEvent[] {
  const start = Math.max(0, Math.min(1, startX));
  const events: MappingEvent[] = [{ x: start, value: mapProgress(start, mapping), transition: 'set' }];
  if (start === 1) return events;
  if (mapping !== 'smoothstep') {
    events.push({ x: 1, value: 1, transition: mapping === 'floor' ? 'set' : 'linear' });
  } else {
    if (start < 0.95) events.push({ x: 0.95, value: 0, transition: 'set' });
    for (let i = 1; i <= 128; i++) {
      const x = 0.95 + 0.05 * i / 128;
      if (x > start) events.push({ x, value: mapProgress(x, mapping), transition: 'linear' });
    }
  }
  return events;
}
