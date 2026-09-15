import { finite, positiveFinite } from './frequency';
import { ratioToFrequency } from './ratio';

export function equalDivisionFrequency(baseHz: number, step: number, divisions: number, periodRatio = 2): number {
  positiveFinite(divisions, 'Divisions');
  if (!Number.isSafeInteger(divisions)) throw new RangeError('Divisions must be a positive safe integer.');
  finite(step, 'Step index');
  if (!Number.isSafeInteger(step)) throw new RangeError('Step index must be a safe integer.');
  positiveFinite(periodRatio, 'Period ratio');
  return ratioToFrequency(baseHz, periodRatio ** (step / divisions));
}
