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
  const round1 = (n: number) => Math.round(n * 10) / 10;
  // Tier is chosen on the value as it would be *displayed* (rounded), so
  // ₺999.950 renders as "₺1 Mn" — never as the absurd "₺1.000 B".
  if (round1(abs / 1_000) >= 1_000) {
    return `${sign}₺${oneDecimalFmt.format(abs / 1_000_000)} Mn`;
  }
  if (Math.round(abs) >= 1_000) {
    return `${sign}₺${oneDecimalFmt.format(abs / 1_000)} B`;
  }
  return `${sign}₺${wholeFmt.format(abs)}`;
}

/**
 * Parses Turkish-convention amount input (§17): comma = decimal separator,
 * dot accepted ONLY as proper 3-digit thousands grouping ("1.250.000,75").
 * Anything else ("1.5", "1.25") is ambiguous between decimal-dot habits and
 * tr grouping — reject instead of silently guessing ×10 wrong. Returns null
 * for any input that is not a valid non-negative amount with ≤2 decimals.
 */
export function parseAmountMinor(input: string): Minor | null {
  const raw = input.replace(/[₺\s ]/g, '');
  const grouped = /^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(raw);
  const plain = /^\d+(,\d{1,2})?$/.test(raw);
  if (!grouped && !plain) return null;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  // Math.round guards against float artifacts like 1250.75*100 = 125074.999…
  return Math.round(Number(normalized) * 100);
}

/** Inverse of parseAmountMinor for edit prefills: 125075 → "1250,75", 12500 → "125". */
export function minorToInput(minor: Minor): string {
  const int = Math.trunc(minor / 100);
  const dec = Math.abs(minor % 100);
  return dec === 0 ? String(int) : `${int},${String(dec).padStart(2, '0')}`;
}
