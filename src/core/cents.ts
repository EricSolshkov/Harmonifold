import { finite } from './frequency';
import { ratioToFrequency } from './ratio';

export function centsToFrequency(baseHz: number, cents: number): number {
  return ratioToFrequency(baseHz, 2 ** (finite(cents, 'Cents') / 1200));
}
