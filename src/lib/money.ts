import type { Minor } from './types';

// All arithmetic happens in integer kuruş (spec §8.2, P4 "numbers are sacred").
// Division by 100 appears only at the display/parse boundary.

const currencyFmt = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
});

const oneDecimalFmt = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 1,
});

const wholeFmt = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
});

/** 123456 → "₺1.234,56" */
export function formatMinor(minor: Minor): string {
  return currencyFmt.format(minor / 100);
}

/** Compact form for charts (§8.2): "₺1,2 B" (bin) / "₺1,2 Mn" (milyon). */
export function formatCompactMinor(minor: Minor): string {
  const lira = minor / 100;
  const sign = lira < 0 ? '-' : '';
  const abs = Math.abs(lira);
  if (abs >= 1_000_000) return `${sign}₺${oneDecimalFmt.format(abs / 1_000_000)} Mn`;
  if (abs >= 1_000) return `${sign}₺${oneDecimalFmt.format(abs / 1_000)} B`;
  return `${sign}₺${wholeFmt.format(abs)}`;
}

/**
 * Parses Turkish-convention amount input (§17): dot = thousands separator,
 * comma = decimal separator. "1.250,75" → 125075. Returns null when the
 * input is not a valid non-negative amount with at most 2 decimals.
 */
export function parseAmountMinor(input: string): Minor | null {
  const cleaned = input
    .replace(/[₺\s ]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  // Math.round guards against float artifacts like 1250.75*100 = 125074.999…
  return Math.round(Number(cleaned) * 100);
}
