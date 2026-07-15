import { tr } from './tr';
import { ti } from './interpolate';
import { splitWorkTime } from '../lib/timecost';

/** Formats work minutes per §9.10: "45 dk", "2 sa", "2 sa 15 dk". */
export function formatWorkTime(totalMinutes: number): string {
  const { hours, minutes } = splitWorkTime(totalMinutes);
  if (hours === 0) return ti(tr.timeCost.minutesOnly, { m: String(minutes) });
  if (minutes === 0) return ti(tr.timeCost.hoursOnly, { h: String(hours) });
  return ti(tr.timeCost.hoursMinutes, { h: String(hours), m: String(minutes) });
}
