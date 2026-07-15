import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { reviewWindow } from '../../lib/review';
import { todayISO } from '../../lib/dates';
import { getSettings } from '../../db/repo/settings';
import { listReviewItems } from '../../db/repo/transactions';
import { ReviewFlow } from './ReviewFlow';

/** Dashboard badge (§9.8): shows while the review window has open items. */
export function ReviewBadgeCard() {
  const [open, setOpen] = useState(false);

  const items = useLiveQuery(async () => {
    const settings = await getSettings();
    if (!settings) return [];
    return listReviewItems(reviewWindow(todayISO(), settings.reviewDay));
  });

  if (!items?.length) return null;

  return (
    <section className="rounded-card border border-grid bg-card p-4">
      <p className="text-base text-ink">
        {ti(tr.review.badge, { count: String(items.length) })}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 min-h-11 w-full rounded-full bg-ballpoint text-base font-medium text-white"
      >
        {tr.review.open}
      </button>
      {open && <ReviewFlow items={items} onClose={() => setOpen(false)} />}
    </section>
  );
}
