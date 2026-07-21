import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { tr } from '../../i18n/tr';
import { EnvelopesSegment } from './EnvelopesSegment';
import { PaymentsSegment } from '../payments/PaymentsSegment';
import { KumbaraSegment } from '../kumbara/KumbaraSegment';

type Segment = 'zarflar' | 'odemeler' | 'kumbara';

// /butce segments (§10): Zarflar | Sabitler | Kumbara.
export function BudgetsScreen() {
  // Dashboard kumbara card taps through with { segment: 'kumbara' } (§9.7.3).
  const navState = useLocation().state as { segment?: Segment } | null;
  const [segment, setSegment] = useState<Segment>(navState?.segment ?? 'zarflar');

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{tr.tabs.butce}</h1>

      <div className="flex gap-1 rounded-full border border-grid bg-card p-1">
        {(
          [
            ['zarflar', tr.budgets.envelopes],
            ['odemeler', tr.payments.segment],
            ['kumbara', tr.kumbara.title],
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

      {segment === 'zarflar' && <EnvelopesSegment />}
      {segment === 'odemeler' && <PaymentsSegment />}
      {segment === 'kumbara' && <KumbaraSegment />}
    </div>
  );
}
