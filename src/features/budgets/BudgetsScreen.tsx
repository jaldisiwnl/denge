import { useState } from 'react';
import { tr } from '../../i18n/tr';
import { EnvelopesSegment } from './EnvelopesSegment';
import { RecurringSegment } from '../recurring/RecurringSegment';

// /butce segments (§10): Zarflar | Sabitler — Kumbara joins in P5.
export function BudgetsScreen() {
  const [segment, setSegment] = useState<'zarflar' | 'sabitler'>('zarflar');

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{tr.tabs.butce}</h1>

      <div className="flex gap-1 rounded-full border border-grid bg-card p-1">
        {(
          [
            ['zarflar', tr.budgets.envelopes],
            ['sabitler', tr.budgets.recurring],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSegment(key)}
            aria-pressed={segment === key}
            className={`min-h-10 flex-1 rounded-full text-base ${
              segment === key
                ? 'bg-ballpoint font-medium text-white'
                : 'text-ink-soft'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {segment === 'zarflar' ? <EnvelopesSegment /> : <RecurringSegment />}
    </div>
  );
}
