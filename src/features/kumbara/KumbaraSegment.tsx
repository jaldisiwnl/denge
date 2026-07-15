import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { Sheet } from '../../components/Sheet';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { useEphemeralStore } from '../../app/ui';
import { formatMinor, minorToInput, parseAmountMinor } from '../../lib/money';
import { parseLocalDate } from '../../lib/dates';
import {
  addSavingsEntry,
  createGoal,
  goalTotals,
  listGoalEntries,
  listGoals,
  projectedFinish,
  setGoalArchived,
  updateGoal,
} from '../../db/repo/savings';
import { db } from '../../db/db';
import type { SavingsEntry, SavingsGoal } from '../../db/types';

/** Kumbara (§9.13): goals, real transfers, the growing number. */
export function KumbaraSegment() {
  const [goalSheet, setGoalSheet] = useState<{ open: boolean; goal?: SavingsGoal }>({
    open: false,
  });
  const [detail, setDetail] = useState<SavingsGoal>();

  const data = useLiveQuery(async () => {
    const [goals, archived, totals] = await Promise.all([
      listGoals(),
      listGoals(true).then((all) => all.filter((g) => g.isArchived)),
      goalTotals(),
    ]);
    const projections = new Map<string, string | null>();
    for (const g of goals) {
      projections.set(g.id, await projectedFinish(g, totals.get(g.id) ?? 0));
    }
    return { goals, archived, totals, projections };
  });
  if (!data) return null;

  return (
    <div className="space-y-3">
      {data.goals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          savedMinor={data.totals.get(goal.id) ?? 0}
          projection={data.projections.get(goal.id) ?? null}
          onOpen={() => setDetail(goal)}
        />
      ))}

      <button
        type="button"
        onClick={() => setGoalSheet({ open: true })}
        className="text-base font-medium text-ballpoint"
      >
        + {tr.kumbara.addGoal}
      </button>

      {data.archived.length > 0 && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {tr.kumbara.archivedSection}
          </h2>
          <div className="mt-1.5 divide-y divide-grid rounded-card border border-grid bg-card opacity-70">
            {data.archived.map((g) => (
              <div key={g.id} className="flex min-h-11 items-center gap-2 px-3 py-2">
                <span aria-hidden>{g.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-base">{g.name}</span>
                <span className="font-mono text-xs text-ink-soft">
                  {formatMinor(data.totals.get(g.id) ?? 0)}
                </span>
                <button
                  type="button"
                  onClick={() => void setGoalArchived(g.id, false)}
                  className="rounded-full border border-grid px-3 py-1 text-xs text-ink-soft"
                >
                  {tr.kumbara.unarchive}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {goalSheet.open && (
        <GoalSheet
          key={goalSheet.goal?.id ?? 'new'}
          editing={goalSheet.goal}
          onClose={() => setGoalSheet({ open: false })}
        />
      )}
      {detail && (
        <GoalDetailSheet
          key={detail.id}
          goal={detail}
          onEdit={() => {
            setGoalSheet({ open: true, goal: detail });
            setDetail(undefined);
          }}
          onClose={() => setDetail(undefined)}
        />
      )}
    </div>
  );
}

function GoalCard(props: {
  goal: SavingsGoal;
  savedMinor: number;
  projection: string | null;
  onOpen: () => void;
}) {
  const { goal, savedMinor } = props;
  const target = goal.targetAmountMinor;
  const done = Boolean(target && savedMinor >= target);
  const ratio = target ? Math.min(1, savedMinor / target) : 0;

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="w-full rounded-card border border-grid bg-card p-4 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-base">
          <span aria-hidden>{goal.emoji}</span>
          <span className="truncate">{goal.name}</span>
          {done && (
            <span className="shrink-0 rounded-full bg-highlight/60 px-2 py-0.5 text-xs font-medium text-ink">
              {tr.kumbara.goalDone}
            </span>
          )}
        </span>
        <span className="shrink-0 font-mono text-base">
          {formatMinor(savedMinor)}
          {target ? (
            <span className="text-ink-soft"> / {formatMinor(target)}</span>
          ) : null}
        </span>
      </div>
      {target ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-grid">
          <div
            className={`h-full rounded-full ${done ? 'bg-green' : 'bg-ballpoint'}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      ) : null}
      {(props.projection || goal.deadline) && (
        <p className="mt-1.5 text-xs text-ink-soft">
          {props.projection &&
            ti(tr.kumbara.projection, {
              date: format(parseLocalDate(props.projection), 'LLLL yyyy', {
                locale: trLocale,
              }),
            })}
          {props.projection && goal.deadline ? ' · ' : ''}
          {goal.deadline &&
            ti(tr.kumbara.deadlineChip, {
              date: format(parseLocalDate(goal.deadline), 'd MMM yyyy', {
                locale: trLocale,
              }),
            })}
        </p>
      )}
    </button>
  );
}

function GoalSheet(props: { editing?: SavingsGoal; onClose: () => void }) {
  const { editing } = props;
  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState(editing?.emoji ?? '🎯');
  const [target, setTarget] = useState(
    editing?.targetAmountMinor ? minorToInput(editing.targetAmountMinor) : '',
  );
  const [deadline, setDeadline] = useState(editing?.deadline ?? '');
  const [error, setError] = useState<string>();

  async function save() {
    if (!name.trim()) {
      setError(tr.kumbara.nameRequired);
      return;
    }
    const targetMinor = target.trim() ? parseAmountMinor(target) : null;
    if (target.trim() && (targetMinor === null || targetMinor <= 0)) {
      setError(tr.kumbara.invalidAmount);
      return;
    }
    const fields = {
      name: name.trim(),
      emoji: emoji.trim() || '🎯',
      targetAmountMinor: targetMinor ?? undefined,
      deadline: deadline || undefined,
    };
    if (editing) await updateGoal(editing.id, fields);
    else await createGoal(fields);
    props.onClose();
  }

  const fieldCls =
    'mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none';

  return (
    <Sheet onClose={props.onClose}>
      <h2 className="text-md font-semibold">
        {editing ? tr.common.edit : tr.kumbara.addGoal}
      </h2>
      <div className="mt-4 flex gap-2">
        <label className="block flex-1 text-base font-medium">
          {tr.kumbara.goalName}
          <input value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} className={fieldCls} />
        </label>
        <label className="block w-20 text-base font-medium">
          {tr.kumbara.goalEmoji}
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className={`${fieldCls} px-2 text-center text-md`}
          />
        </label>
      </div>
      <label className="mt-3 block text-base font-medium">
        {tr.kumbara.target}
        <input
          inputMode="decimal"
          value={target}
          onChange={(e) => { setTarget(e.target.value); setError(undefined); }}
          placeholder={tr.kumbara.optionalHint}
          className={`${fieldCls} font-mono placeholder:font-sans placeholder:text-xs placeholder:text-ink-soft/60`}
        />
      </label>
      <label className="mt-3 block text-base font-medium">
        {tr.kumbara.deadline}
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className={`${fieldCls} font-mono`}
        />
      </label>
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

function GoalDetailSheet(props: {
  goal: SavingsGoal;
  onEdit: () => void;
  onClose: () => void;
}) {
  const showToast = useEphemeralStore((s) => s.showToast);
  const [mode, setMode] = useState<'none' | 'deposit' | 'withdraw'>('none');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const data = useLiveQuery(async () => {
    const [entries, totals, wishlist] = await Promise.all([
      listGoalEntries(props.goal.id),
      goalTotals(),
      db.wishlist.toArray(),
    ]);
    return {
      entries,
      savedMinor: totals.get(props.goal.id) ?? 0,
      wishTitles: new Map(wishlist.map((w) => [w.id, w.title])),
    };
  }, [props.goal.id]);

  async function submit() {
    const amountMinor = parseAmountMinor(amount);
    if (!amountMinor || amountMinor <= 0) {
      setError(tr.kumbara.invalidAmount);
      return;
    }
    if (mode === 'withdraw' && !confirmingWithdraw) {
      setConfirmingWithdraw(true);
      return;
    }
    const result = await addSavingsEntry({
      goalId: props.goal.id,
      amountMinor: mode === 'deposit' ? amountMinor : -amountMinor,
      source: 'manuel',
      note: note.trim() || undefined,
    });
    if (result === null) {
      setError(tr.kumbara.belowZero); // §17: never below zero
      setConfirmingWithdraw(false);
      return;
    }
    if (result.completedGoal) {
      showToast(tr.kumbara.goalDone, { highlight: true });
    }
    setMode('none');
    setAmount('');
    setNote('');
    setConfirmingWithdraw(false);
    setError(undefined);
  }

  if (!data) return null;
  const sourceLabel = (e: SavingsEntry) =>
    e.source === 'vazgecme' && e.wishlistItemId
      ? `${tr.kumbara.sources.vazgecme} · ${data.wishTitles.get(e.wishlistItemId) ?? ''}`
      : tr.kumbara.sources[e.source];

  return (
    <Sheet onClose={props.onClose} full>
      <div className="flex items-center justify-between">
        <h2 className="text-md font-semibold">
          {props.goal.emoji} {props.goal.name}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={props.onEdit}
            className="rounded-full border border-grid px-3 py-1.5 text-xs text-ink-soft"
          >
            {tr.common.edit}
          </button>
          <button
            type="button"
            onClick={() =>
              void setGoalArchived(props.goal.id, true).then(props.onClose)
            }
            className="rounded-full border border-grid px-3 py-1.5 text-xs text-ink-soft"
          >
            {tr.kumbara.archive}
          </button>
        </div>
      </div>

      <p className="mt-3 text-center font-mono text-2xl font-medium">
        {formatMinor(data.savedMinor)}
        {props.goal.targetAmountMinor ? (
          <span className="text-base text-ink-soft">
            {' / '}
            {formatMinor(props.goal.targetAmountMinor)}
          </span>
        ) : null}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => { setMode('deposit'); setConfirmingWithdraw(false); }}
          aria-pressed={mode === 'deposit'}
          className={`min-h-11 flex-1 rounded-full border text-base font-medium ${
            mode === 'deposit' ? 'border-green bg-green/15 text-green' : 'border-grid text-ink'
          }`}
        >
          {tr.kumbara.deposit}
        </button>
        <button
          type="button"
          onClick={() => { setMode('withdraw'); setConfirmingWithdraw(false); }}
          aria-pressed={mode === 'withdraw'}
          className={`min-h-11 flex-1 rounded-full border text-base font-medium ${
            mode === 'withdraw' ? 'border-ink bg-grid/50 text-ink' : 'border-grid text-ink'
          }`}
        >
          {tr.kumbara.withdraw}
        </button>
      </div>

      {mode !== 'none' && (
        <div className="mt-3 rounded-card border border-grid p-3">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(undefined); setConfirmingWithdraw(false); }}
            placeholder="0,00"
            aria-label={tr.kumbara.amount}
            className="w-full rounded-card border border-grid bg-card px-3 py-2.5 font-mono text-base outline-none placeholder:text-ink-soft/50"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tr.kumbara.note}
            className="mt-2 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none placeholder:text-ink-soft/50"
          />
          {error && <p className="mt-2 text-base text-redpen">{error}</p>}
          <button
            type="button"
            onClick={() => void submit()}
            className={`mt-3 min-h-11 w-full rounded-full text-base font-medium ${
              mode === 'withdraw' && confirmingWithdraw
                ? 'bg-redpen text-white'
                : 'bg-ballpoint text-white'
            }`}
          >
            {mode === 'deposit'
              ? tr.kumbara.deposit
              : confirmingWithdraw
                ? tr.kumbara.confirmWithdraw
                : tr.kumbara.withdraw}
          </button>
        </div>
      )}

      <div className="mt-4 divide-y divide-grid rounded-card border border-grid bg-card">
        {data.entries.map((e) => (
          <div key={e.id} className="flex min-h-11 items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base">
                {e.note || sourceLabel(e)}
              </span>
              <span className="block text-xs text-ink-soft">
                {format(parseLocalDate(e.date), 'd MMM yyyy', { locale: trLocale })}
                {' · '}
                {sourceLabel(e)}
              </span>
            </span>
            <span
              className={`shrink-0 font-mono text-base ${
                e.amountMinor >= 0 ? 'text-green' : 'text-ink'
              }`}
            >
              {e.amountMinor >= 0 ? '+' : ''}
              {formatMinor(e.amountMinor)}
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
