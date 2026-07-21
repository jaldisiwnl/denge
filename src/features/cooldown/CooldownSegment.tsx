import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../components/Sheet';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { useEphemeralStore } from '../../app/ui';
import { formatMinor, parseAmountMinor } from '../../lib/money';
import { deriveHourlyWageMinor, workMinutes } from '../../lib/timecost';
import { formatWorkTime } from '../../i18n/workTime';
import { getSettings } from '../../db/repo/settings';
import {
  addWishlistItem,
  deleteWishlistItem,
  expiresAtMs,
  getCooldownCounters,
  linkSavingsEntry,
  listWishlist,
  markForgone,
} from '../../db/repo/wishlist';
import { addSavingsEntry, goalTotals, listGoals } from '../../db/repo/savings';
import type { SavingsGoal, WishlistItem } from '../../db/types';

const COOLDOWN_OPTIONS = [
  { hours: 24, label: tr.cooldown.cooldownOptions.h24 },
  { hours: 48, label: tr.cooldown.cooldownOptions.h48 },
  { hours: 72, label: tr.cooldown.cooldownOptions.h72 },
  { hours: 168, label: tr.cooldown.cooldownOptions.h168 },
];

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} g ${hours} sa`;
  if (hours > 0) return `${hours} sa ${minutes} dk`;
  return `${minutes} dk`;
}

/** Soğuma Listesi (§9.9) — the cooldown wishlist + kumbara bridge. */
export function CooldownSegment() {
  const [addOpen, setAddOpen] = useState(false);
  const [transferItem, setTransferItem] = useState<WishlistItem>();
  const [confirmingRemove, setConfirmingRemove] = useState<string>();
  // re-render every minute so countdowns stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const data = useLiveQuery(async () => {
    const [items, counters, settings] = await Promise.all([
      listWishlist(),
      getCooldownCounters(),
      getSettings(),
    ]);
    const wage = settings?.showTimeCost ? deriveHourlyWageMinor(settings) : null;
    return { items, counters, wage };
  });
  if (!data) return null;

  const now = Date.now();
  const waiting = data.items
    .filter((i) => i.status === 'bekliyor')
    .sort((a, b) => expiresAtMs(a) - expiresAtMs(b));
  const expired = waiting.filter((i) => expiresAtMs(i) <= now);
  const cooling = waiting.filter((i) => expiresAtMs(i) > now);
  const decided = data.items
    .filter((i) => i.status !== 'bekliyor')
    .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));

  return (
    <div className="space-y-4">
      {/* Header counters (§9.9): virtual first (highlighter), real beneath */}
      {data.counters.forgoneTotalMinor > 0 && (
        <section className="rounded-card border border-grid bg-card p-4">
          <p className="text-base">
            <span className="bg-highlight/60 box-decoration-clone px-1 font-medium">
              {ti(tr.cooldown.savedHeader, {
                amount: formatMinor(data.counters.forgoneTotalMinor),
              })}
            </span>
          </p>
          <p className="mt-1.5 text-xs text-ink-soft">
            {ti(tr.cooldown.inKumbara, {
              amount: formatMinor(data.counters.inKumbaraMinor),
            })}
          </p>
          <p className="mt-1 text-xs text-ink-soft">{tr.forgone.celebrate}</p>
        </section>
      )}

      {data.items.length === 0 && (
        <p className="text-base text-ink-soft">{tr.cooldown.empty}</p>
      )}

      {[...expired, ...cooling].map((item) => (
        <WishCard
          key={item.id}
          item={item}
          now={now}
          wage={data.wage}
          confirmingRemove={confirmingRemove === item.id}
          onRemoveTap={() =>
            confirmingRemove === item.id
              ? void deleteWishlistItem(item.id)
              : setConfirmingRemove(item.id)
          }
          onForgo={() => {
            void markForgone(item.id);
            if (item.estimatedAmountMinor) setTransferItem(item);
          }}
        />
      ))}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="text-base font-medium text-ballpoint"
      >
        + {tr.cooldown.addCta}
      </button>

      {decided.length > 0 && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {tr.cooldown.decidedSection}
          </h2>
          <div className="mt-1.5 divide-y divide-grid rounded-card border border-grid bg-card opacity-80">
            {decided.map((i) => (
              <div key={i.id} className="flex min-h-11 items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-base">{i.title}</span>
                {i.estimatedAmountMinor ? (
                  <span className="font-mono text-xs text-ink-soft">
                    {formatMinor(i.estimatedAmountMinor)}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    i.status === 'alindi'
                      ? 'bg-ballpoint/15 text-ballpoint'
                      : 'bg-green/15 text-green'
                  }`}
                >
                  {i.status === 'alindi'
                    ? tr.cooldown.statusBought
                    : tr.cooldown.statusForgone}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {addOpen && <AddWishSheet onClose={() => setAddOpen(false)} />}
      {transferItem && (
        <TransferSheet item={transferItem} onClose={() => setTransferItem(undefined)} />
      )}
    </div>
  );
}

function WishCard(props: {
  item: WishlistItem;
  now: number;
  wage: number | null;
  confirmingRemove: boolean;
  onRemoveTap: () => void;
  onForgo: () => void;
}) {
  const openWishlistPurchase = useEphemeralStore((s) => s.openWishlistPurchase);
  const { item, now } = props;
  const expiresAt = expiresAtMs(item);
  const isExpired = expiresAt <= now;
  const totalMs = item.cooldownHours * 3_600_000;
  const fraction = Math.max(0, Math.min(1, (expiresAt - now) / totalMs));

  return (
    <div className="rounded-card border border-grid bg-card p-4">
      <div className="flex items-center gap-3">
        {/* countdown ring (§9.9) */}
        <svg viewBox="0 0 36 36" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--grid)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={isExpired ? 'var(--green)' : 'var(--ballpoint)'}
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={isExpired ? 0 : 100 - fraction * 100}
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base text-ink">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="underline decoration-grid underline-offset-2">
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </p>
          <p className="text-xs text-ink-soft">
            {isExpired
              ? tr.cooldown.stillWant
              : ti(tr.cooldown.remaining, { time: formatRemaining(expiresAt - now) })}
            {item.estimatedAmountMinor && props.wage
              ? ` · ${ti(tr.timeCost.line, {
                  time: formatWorkTime(workMinutes(item.estimatedAmountMinor, props.wage)),
                })}`
              : ''}
          </p>
        </div>
        {item.estimatedAmountMinor ? (
          <span className="shrink-0 font-mono text-base">
            {formatMinor(item.estimatedAmountMinor)}
          </span>
        ) : null}
      </div>

      {isExpired ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => openWishlistPurchase(item)}
            className="min-h-11 flex-1 rounded-full bg-ballpoint text-base font-medium text-white"
          >
            {tr.cooldown.buy}
          </button>
          <button
            type="button"
            onClick={props.onForgo}
            className="min-h-11 flex-1 rounded-full border border-green text-base font-medium text-green"
          >
            {tr.cooldown.forgo}
          </button>
        </div>
      ) : (
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={props.onRemoveTap}
            className={`rounded-full border px-3 py-1 text-xs ${
              props.confirmingRemove
                ? 'border-redpen bg-redpen text-white'
                : 'border-grid text-ink-soft'
            }`}
          >
            {props.confirmingRemove ? tr.cooldown.confirmRemove : tr.cooldown.remove}
          </button>
        </div>
      )}
    </div>
  );
}

function AddWishSheet(props: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [estimate, setEstimate] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [cooldownHours, setCooldownHours] = useState(72);
  const [error, setError] = useState<string>();

  async function save() {
    if (!title.trim()) {
      setError(tr.cooldown.titleRequired);
      return;
    }
    const estimateMinor = estimate.trim() ? parseAmountMinor(estimate) : null;
    if (estimate.trim() && (estimateMinor === null || estimateMinor <= 0)) {
      setError(tr.cooldown.invalidAmount);
      return;
    }
    await addWishlistItem({
      title: title.trim(),
      estimatedAmountMinor: estimateMinor ?? undefined,
      url: url.trim() || undefined,
      note: note.trim() || undefined,
      cooldownHours,
    });
    props.onClose();
  }

  const fieldCls =
    'mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none';

  return (
    <Sheet onClose={props.onClose}>
      <h2 className="text-md font-semibold">{tr.cooldown.addCta}</h2>
      <label className="mt-4 block text-base font-medium">
        {tr.cooldown.titleLabel}
        <input value={title} onChange={(e) => { setTitle(e.target.value); setError(undefined); }} className={fieldCls} />
      </label>
      <label className="mt-3 block text-base font-medium">
        {tr.cooldown.estimateLabel}
        <input
          inputMode="decimal"
          value={estimate}
          onChange={(e) => { setEstimate(e.target.value); setError(undefined); }}
          className={`${fieldCls} font-mono`}
        />
      </label>
      <label className="mt-3 block text-base font-medium">
        {tr.cooldown.urlLabel}
        <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" className={fieldCls} />
      </label>
      <label className="mt-3 block text-base font-medium">
        {tr.cooldown.noteLabel}
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls} />
      </label>
      <p className="mt-3 text-base font-medium">{tr.cooldown.cooldownLabel}</p>
      <div className="mt-1 flex gap-2">
        {COOLDOWN_OPTIONS.map((o) => (
          <button
            key={o.hours}
            type="button"
            onClick={() => setCooldownHours(o.hours)}
            aria-pressed={cooldownHours === o.hours}
            className={`min-h-11 flex-1 rounded-full border text-base ${
              cooldownHours === o.hours
                ? 'border-ballpoint bg-ballpoint/15 font-medium text-ballpoint'
                : 'border-grid text-ink-soft'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-base text-redpen">{error}</p>}
      <button
        type="button"
        onClick={() => void save()}
        className="mt-5 min-h-12 w-full rounded-full bg-ballpoint text-md font-medium text-white"
      >
        {tr.common.save}
      </button>
    </Sheet>
  );
}

/**
 * The virtual→real bridge (§9.9): "₺X'i kurtardın. Kumbaraya atalım mı?"
 * One tap for the single-goal case; a picker when there are several.
 */
function TransferSheet(props: { item: WishlistItem; onClose: () => void }) {
  const showToast = useEphemeralStore((s) => s.showToast);
  const goals = useLiveQuery(() => listGoals());
  const totals = useLiveQuery(goalTotals);
  const amount = props.item.estimatedAmountMinor ?? 0;

  async function transfer(goal: SavingsGoal) {
    const result = await addSavingsEntry({
      goalId: goal.id,
      amountMinor: amount,
      source: 'vazgecme',
      wishlistItemId: props.item.id,
      note: props.item.title,
    });
    if (result) {
      await linkSavingsEntry(props.item.id, result.entry.id);
      if (result.completedGoal) {
        showToast(tr.kumbara.goalDone, { highlight: true });
      } else {
        showToast(
          <span>
            {tr.cooldown.transfer}: <span className="font-mono">{formatMinor(amount)}</span>
            {' · '}
            {goal.emoji} {goal.name}
          </span>,
        );
      }
    }
    props.onClose();
  }

  return (
    <Sheet onClose={props.onClose}>
      <h2 className="text-md font-semibold">
        {ti(tr.cooldown.transferTitle, { amount: formatMinor(amount) })}
      </h2>
      <div className="mt-4 space-y-2">
        {(goals ?? []).map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => void transfer(g)}
            className="flex min-h-12 w-full items-center gap-2 rounded-card border border-grid bg-card px-4 text-left text-base"
          >
            <span aria-hidden>{g.emoji}</span>
            <span className="min-w-0 flex-1 truncate">
              {g.name}
              <span className="ml-2 font-mono text-xs text-ink-soft">
                {formatMinor(totals?.get(g.id) ?? 0)}
              </span>
            </span>
            <span className="font-medium text-ballpoint">{tr.cooldown.transfer}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={props.onClose}
        className="mt-4 min-h-11 w-full rounded-full text-base text-ink-soft"
      >
        {tr.cooldown.keepForNow}
      </button>
    </Sheet>
  );
}
