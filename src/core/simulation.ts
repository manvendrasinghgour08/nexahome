/** Pure helpers that produce realistic-looking simulated sensor values. */
import type { ThermostatDevice } from './types';

/** Standard normal random number (Box–Muller). */
export function gaussian(rand: () => number = Math.random): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Indoor temperature follows a gentle day cycle: coolest ~5am, warmest ~5pm. */
export function dailyTarget(baseline: number, ts: number): number {
  const d = new Date(ts);
  const hour = d.getHours() + d.getMinutes() / 60;
  return baseline + 1.8 * Math.sin((2 * Math.PI * (hour - 11)) / 24);
}

export type HvacState = 'idle' | 'heating' | 'cooling' | 'off';

/** What a thermostat is doing right now given the room temperature (0.3°C dead-band). */
export function hvacState(t: Pick<ThermostatDevice, 'mode' | 'target'>, current: number | undefined): HvacState {
  if (t.mode === 'off' || current === undefined) return 'off';
  if ((t.mode === 'heat' || t.mode === 'auto') && current < t.target - 0.3) return 'heating';
  if ((t.mode === 'cool' || t.mode === 'auto') && current > t.target + 0.3) return 'cooling';
  return 'idle';
}

/**
 * Next temperature reading: drift toward the daily target with a little sensor noise.
 * An active thermostat pulls the room toward its target instead.
 */
export function nextTemperature(
  current: number,
  baseline: number,
  ts: number,
  rand: () => number = Math.random,
  hvacTarget?: number,
): number {
  const target = hvacTarget ?? dailyTarget(baseline, ts);
  const rate = hvacTarget === undefined ? 0.2 : 0.25;
  const next = current + (target - current) * rate + gaussian(rand) * 0.12;
  return Math.round(next * 10) / 10;
}

export function nextHumidity(current: number, baseline: number, rand: () => number = Math.random): number {
  const next = current + (baseline - current) * 0.15 + gaussian(rand) * 0.8;
  return Math.round(Math.min(95, Math.max(15, next)));
}

export const VISITORS = [
  'Courier with a parcel',
  'Food delivery',
  'Neighbour',
  'Postman with letters',
  'Friend visiting',
  'Unknown visitor',
  'Maintenance technician',
  'Grocery delivery',
];

export const pickVisitor = (rand: () => number = Math.random) => VISITORS[Math.floor(rand() * VISITORS.length)];
