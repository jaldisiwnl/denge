import { describe, expect, it } from 'vitest';
import { effectiveEnvelope, median, suggestEnvelope } from './budget';

describe('effectiveEnvelope', () => {
  it('adds only the positive remainder when rollover is on', () => {
    expect(
      effectiveEnvelope({
        baseMinor: 100000,
        rollover: true,
        prevBaseMinor: 100000,
        prevSpentMinor: 82000,
      }),
    ).toEqual({ totalMinor: 118000, rolloverMinor: 18000 });
  });

  it('clamps a negative remainder (overspent last month) to zero', () => {
    expect(
      effectiveEnvelope({
        baseMinor: 100000,
        rollover: true,
        prevBaseMinor: 100000,
        prevSpentMinor: 130000,
      }),
    ).toEqual({ totalMinor: 100000, rolloverMinor: 0 });
  });

  it('ignores history when rollover is off', () => {
    expect(
      effectiveEnvelope({
        baseMinor: 50000,
        rollover: false,
        prevBaseMinor: 100000,
        prevSpentMinor: 0,
      }),
    ).toEqual({ totalMinor: 50000, rolloverMinor: 0 });
  });
});

describe('median / suggestEnvelope', () => {
  it('computes odd and even medians', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([400, 100, 300, 200])).toBe(250);
    expect(median([])).toBeNull();
  });

  it('ignores zero-spend months and hides without history', () => {
    expect(suggestEnvelope([120000, 0, 98000])).toBe(109000);
    expect(suggestEnvelope([0, 0, 0])).toBeNull();
    expect(suggestEnvelope([])).toBeNull();
  });
});
