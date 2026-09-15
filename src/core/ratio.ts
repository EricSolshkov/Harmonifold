import { positiveFinite } from './frequency';

export function ratioToFrequency(baseHz: number, ratio: number): number {
  return positiveFinite(positiveFinite(baseHz, 'Base frequency') * positiveFinite(ratio, 'Ratio'), 'Result frequency');
}
