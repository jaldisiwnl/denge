import { describe, expect, it } from 'vitest';
import { formatCompactMinor, formatMinor, parseAmountMinor } from './money';

describe('formatMinor', () => {
  it('formats kuruş with tr-TR currency rules', () => {
    expect(formatMinor(123456)).toBe('₺1.234,56');
    expect(formatMinor(0)).toBe('₺0,00');
    expect(formatMinor(50)).toBe('₺0,50');
    expect(formatMinor(100000000)).toBe('₺1.000.000,00');
  });

  it('formats negative amounts', () => {
    expect(formatMinor(-12345)).toBe('-₺123,45');
  });
});

describe('parseAmountMinor', () => {
  it('parses Turkish thousands + decimal convention', () => {
    expect(parseAmountMinor('1.250,75')).toBe(125075);
    expect(parseAmountMinor('1250,75')).toBe(125075);
    expect(parseAmountMinor('1250')).toBe(125000);
    expect(parseAmountMinor('0,5')).toBe(50);
    expect(parseAmountMinor('₺1.234,56')).toBe(123456);
  });

  it('rejects invalid input', () => {
    expect(parseAmountMinor('')).toBeNull();
    expect(parseAmountMinor('abc')).toBeNull();
    expect(parseAmountMinor('12,345')).toBeNull(); // >2 decimals
    expect(parseAmountMinor('1,2,3')).toBeNull();
    expect(parseAmountMinor('-50')).toBeNull(); // sign comes from type, §7
  });

  it('round-trips formatMinor output', () => {
    for (const minor of [0, 50, 125075, 99999999]) {
      expect(parseAmountMinor(formatMinor(minor))).toBe(minor);
    }
  });
});

describe('formatCompactMinor', () => {
  it('uses B (bin) and Mn (milyon) tiers', () => {
    expect(formatCompactMinor(85000)).toBe('₺850');
    expect(formatCompactMinor(123400)).toBe('₺1,2 B');
    expect(formatCompactMinor(120000000)).toBe('₺1,2 Mn');
  });

  it('keeps whole tiers clean and handles negatives', () => {
    expect(formatCompactMinor(100000)).toBe('₺1 B');
    expect(formatCompactMinor(-123400)).toBe('-₺1,2 B');
  });
});
