import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { reviewWindow } from '../../lib/review';
import { todayISO } from '../../lib/dates';
import { getSettings } from '../../db/repo/settings';
import { listReviewItems } from '../../db/repo/transactions';
import { ReviewFlow } from './ReviewFlow';
import type { Transaction } from '../../db/types';

/** Dashboard badge (§9.8): shows while the review window has open items. */
export function ReviewBadgeCard() {
  // The flow gets a FROZEN snapshot: answering removes items from the live
  // query, which would otherwise shift the stepper and unmount the flow
  // before its summary screen (P5/P6 review fix).
  const [flowItems, setFlowItems] = useState<Transaction[] | null>(null);

  const items = useLiveQuery(async () => {
    const settings = await getSettings();
    if (!settings) return [];
    return listReviewItems(reviewWindow(todayISO(), settings.reviewDay));
  });

  if (!items?.length && !flowItems) return null;

  return (
    <>
      {items && items.length > 0 && (
        <section className="rounded-card border border-grid bg-card p-4">
          <p className="text-base text-ink">
            {ti(tr.review.badge, { count: String(items.length) })}
          </p>
          <button
            type="button"
            onClick={() => setFlowItems(items)}
            className="mt-3 min-h-11 w-full rounded-full bg-ballpoint text-base font-medium text-white"
          >
            {tr.review.open}
          </button>
        </section>
      )}
      {flowItems && (
        <ReviewFlow items={flowItems} onClose={() => setFlowItems(null)} />
      )}
    </>
  );
}
