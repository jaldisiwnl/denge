import { describe, expect, it } from 'vitest';
import { computeGrade, gradeLetter } from './grade';

const fullData = {
  overspendRatio: 0,
  bosRate: 0,
  netSavingsRate: 0.2,
  regretRate: 0,
  bestStreakInMonth: 10,
  savingsTargetRate: 0.2,
};

describe('computeGrade — §8.6 fixtures', () => {
  it('perfect month scores 100 / A', () => {
    const r = computeGrade(fullData);
    expect(r.score).toBe(100);
    expect(r.grade).toBe('A');
    expect(r.improvementBonus).toBe(0);
  });

  it('computes the documented component formula', () => {
    // budget 30×0.8=24, waste 25×(1−0.1/0.25)=15, savings 20×0.5=10,
    // regret 15×(1−0.25/0.5)=7.5, streak 10×0.5=5 → 61.5 → 62 → C
    const r = computeGrade({
      overspendRatio: 0.2,
      bosRate: 0.1,
      netSavingsRate: 0.1,
      regretRate: 0.25,
      bestStreakInMonth: 5,
      savingsTargetRate: 0.2,
    });
    expect(r.score).toBe(62);
    expect(r.grade).toBe('C');
  });

  it('redistributes missing weights proportionally (AC)', () => {
    // Only waste (25) and streak (10) have data → scale ×100/35.
    const r = computeGrade({
      overspendRatio: null,
      bosRate: 0,
      netSavingsRate: null,
      regretRate: null,
      bestStreakInMonth: 10,
    });
    expect(r.score).toBe(100); // both perfect → still a perfect score
    expect(r.effectiveWeights.waste).toBeCloseTo(71.43, 1);
    expect(r.effectiveWeights.streak).toBeCloseTo(28.57, 1);
    expect(r.effectiveWeights.budget).toBe(0);
  });

  it('a single mediocre component alone carries the whole grade', () => {
    const r = computeGrade({
      overspendRatio: null,
      bosRate: 0.125, // waste ratio 0.5
      netSavingsRate: null,
      regretRate: null,
      bestStreakInMonth: null,
    });
    expect(r.score).toBe(50);
    expect(r.grade).toBe('D');
  });

  it('improvement bonus needs a previous close and lifts the grade (AC)', () => {
    // base: 24+25+20+9+4 = 82 → B
    const month = {
      overspendRatio: 0.2,
      bosRate: 0,
      netSavingsRate: 0.2,
      regretRate: 0.2,
      bestStreakInMonth: 4,
      savingsTargetRate: 0.2,
    };
    expect(computeGrade(month).score).toBe(82);
    expect(computeGrade(month).grade).toBe('B');

    const improved = computeGrade({
      ...month,
      bosRate: 0.0,
      previous: { bosRate: 0.1, netSavingsRate: 0.1 },
    });
    expect(improved.improvementBonus).toBe(10);
    expect(improved.score).toBe(92);
    expect(improved.grade).toBe('A');

    // without a previous close there is never a bonus
    expect(computeGrade({ ...month, previous: null }).improvementBonus).toBe(0);
  });

  it('caps at 100 even with the bonus', () => {
    const r = computeGrade({
      ...fullData,
      previous: { bosRate: 0.5, netSavingsRate: 0 },
    });
    expect(r.improvementBonus).toBe(10);
    expect(r.score).toBe(100);
  });

  it('band boundaries: ≥85 A, ≥70 B, ≥55 C, ≥40 D, else F', () => {
    expect(gradeLetter(85)).toBe('A');
    expect(gradeLetter(84)).toBe('B');
    expect(gradeLetter(70)).toBe('B');
    expect(gradeLetter(69)).toBe('C');
    expect(gradeLetter(55)).toBe('C');
    expect(gradeLetter(54)).toBe('D');
    expect(gradeLetter(40)).toBe('D');
    expect(gradeLetter(39)).toBe('F');
  });
});
