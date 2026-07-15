import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { Sheet } from '../../components/Sheet';
import { RedPen } from '../../components/RedPen';
import { useCountUp } from '../../components/useCountUp';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { useEphemeralStore } from '../../app/ui';
import { formatMinor, minorToInput, parseAmountMinor } from '../../lib/money';
import { parseLocalDate } from '../../lib/dates';
import { shiftMonthKey } from '../../lib/fiscal';
import type { MonthKey } from '../../lib/types';
import { buildCloseContext, saveClose, type CloseContext } from '../../db/repo/close';
import { listAllCategories } from '../../db/repo/categories';
import { suggestForCategory, upsertBudget, getBudget } from '../../db/repo/budgets';
import { addSavingsEntry, goalTotals, listGoals } from '../../db/repo/savings';
import { getSettings } from '../../db/repo/settings';
import type { Category, SavingsGoal } from '../../db/types';

export function monthLabel(monthKey: MonthKey): string {
  return format(parseLocalDate(`${monthKey}-01`), 'LLLL yyyy', { locale: trLocale });
}

/** Ay Kapanışı (§9.12): guided 6-step full-screen wizard. */
export function CloseWizard(props: { monthKey: MonthKey; onClose: () => void }) {
  const showToast = useEphemeralStore((s) => s.showToast);
  const [step, setStep] = useState(1);
  const [movedMinor, setMovedMinor] = useState<number>();
  const [note, setNote] = useState('');
  const [wasteLimit, setWasteLimit] = useState('');

  const data = useLiveQuery(async () => {
    const [context, categories, goals, totals, settings] = await Promise.all([
      buildCloseContext(props.monthKey),
      listAllCategories(),
      listGoals(),
      goalTotals(),
      getSettings(),
    ]);
    return context && settings
      ? { context, categories: new Map(categories.map((c) => [c.id, c])), goals, totals, settings }
      : null;
  }, [props.monthKey]);

  if (!data) return null;
  const { context, categories } = data;
  const s = context.snapshot;

  async function finish() {
    // Rebuild for freshness: the savings step may have changed the snapshot.
    const fresh = await buildCloseContext(props.monthKey);
    if (!fresh) return;
    const limit = wasteLimit.trim() ? parseAmountMinor(wasteLimit) : null;
    await saveClose({
      monthKey: props.monthKey,
      snapshot: fresh.snapshot,
      grade: fresh.grade,
      note: note.trim() || undefined,
      nextMonthWasteLimitMinor: limit ?? undefined,
    });
    showToast(ti(tr.close.closedToast, { month: monthLabel(props.monthKey) }));
    props.onClose();
  }

  return (
    <Sheet onClose={props.onClose} full>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-md font-semibold">
          {monthLabel(props.monthKey)}
        </h2>
        <span className="font-mono text-xs text-ink-soft">
          {ti(tr.close.stepOf, { current: String(step) })}
        </span>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {step === 1 && (
          <StepCard title={tr.close.step1Title}>
            <Row label={tr.close.income} value={formatMinor(s.incomeMinor)} valueClass="text-green" />
            <Row label={tr.close.expense} value={formatMinor(s.expenseMinor)} />
            <div className="mt-3 border-t border-grid pt-3 text-center">
              <p className="text-xs text-ink-soft">{tr.close.pocket}</p>
              <p className="mt-1 font-mono text-2xl font-medium">
                {formatMinor(s.incomeMinor - s.expenseMinor)}
              </p>
            </div>
          </StepCard>
        )}

        {step === 2 && (
          <StepCard title={tr.close.step2Title}>
            <SplitBar gerekli={s.gerekliMinor} istek={s.istekMinor} bos={s.bosMinor} />
            <Row label={tr.necessity.gerekli} value={formatMinor(s.gerekliMinor)} valueClass="text-green" />
            <Row label={tr.necessity.istek} value={formatMinor(s.istekMinor)} valueClass="text-ballpoint" />
            <Row label={tr.necessity.bos} value={formatMinor(s.bosMinor)} valueClass="text-redpen" />
            <p className="mt-3 border-t border-grid pt-3 text-base">
              {s.reviewedBaseMinor > 0
                ? ti(tr.close.regretLine, {
                    reviewed: formatMinor(s.reviewedBaseMinor),
                    pisman: formatMinor(s.pismanMinor),
                  })
                : tr.close.noReviews}
            </p>
            {s.reclassifiedCount > 0 && (
              <p className="mt-1 text-xs text-ink-soft">
                {ti(tr.close.honestyStat, { count: String(s.reclassifiedCount) })}
              </p>
            )}
          </StepCard>
        )}

        {step === 3 && (
          <StepCard title={tr.close.step3Title}>
            {context.envelopes.length === 0 ? (
              <p className="text-base text-ink-soft">{tr.close.noBudgets}</p>
            ) : (
              context.envelopes.map((e) => {
                const cat = categories.get(e.categoryId);
                const over = e.spentMinor > e.totalMinor;
                return (
                  <div key={e.categoryId} className="flex items-baseline justify-between py-1.5">
                    <span className="min-w-0 truncate text-base">
                      {cat?.emoji} {cat?.name}
                    </span>
                    <span className="font-mono text-base">
                      {over ? (
                        <RedPen variant="circle">{formatMinor(e.spentMinor)}</RedPen>
                      ) : (
                        formatMinor(e.spentMinor)
                      )}
                      <span className="text-ink-soft"> / {formatMinor(e.totalMinor)}</span>
                    </span>
                  </div>
                );
              })
            )}
          </StepCard>
        )}

        {step === 4 && (
          <SavingsStep
            context={context}
            goals={data.goals}
            movedMinor={movedMinor}
            onMoved={setMovedMinor}
          />
        )}

        {step === 5 && (
          <NextMonthStep
            monthKey={props.monthKey}
            wasteLimit={wasteLimit}
            onWasteLimit={setWasteLimit}
          />
        )}

        {step === 6 && (
          <GradeReveal context={context} categories={categories} note={note} onNote={setNote} />
        )}
      </div>

      <div className="mt-4 flex gap-2 pt-2">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="min-h-12 rounded-full border border-grid px-6 text-base text-ink-soft"
          >
            {tr.close.back}
          </button>
        )}
        <button
          type="button"
          onClick={() => (step < 6 ? setStep(step + 1) : void finish())}
          className="min-h-12 flex-1 rounded-full bg-ballpoint text-md font-medium text-white"
        >
          {step < 6 ? tr.close.next : tr.close.saveClose}
        </button>
      </div>
    </Sheet>
  );
}

function StepCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-grid bg-card p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {props.title}
      </h3>
      <div className="mt-2">{props.children}</div>
    </div>
  );
}

function Row(props: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-base text-ink-soft">{props.label}</span>
      <span className={`font-mono text-base ${props.valueClass ?? ''}`}>{props.value}</span>
    </div>
  );
}

function SplitBar(props: { gerekli: number; istek: number; bos: number }) {
  const total = props.gerekli + props.istek + props.bos;
  if (total === 0) return null;
  return (
    <div className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-grid" aria-hidden>
      <div className="bg-green" style={{ width: `${(props.gerekli / total) * 100}%` }} />
      <div className="bg-ballpoint" style={{ width: `${(props.istek / total) * 100}%` }} />
      <div className="bg-redpen" style={{ width: `${(props.bos / total) * 100}%` }} />
    </div>
  );
}

/** Step 4 (§9.12.4): suggested transfer → SavingsEntry(ayKapanisi). */
function SavingsStep(props: {
  context: CloseContext;
  goals: SavingsGoal[];
  movedMinor?: number;
  onMoved: (minor: number) => void;
}) {
  const showToast = useEphemeralStore((s) => s.showToast);
  const [amount, setAmount] = useState(minorToInput(props.context.suggestedTransferMinor));
  const [goalId, setGoalId] = useState(props.goals[0]?.id ?? '');
  const [error, setError] = useState(false);

  if (props.movedMinor !== undefined) {
    return (
      <StepCard title={tr.close.step4Title}>
        <p className="text-base text-green">
          ✓ {ti(tr.close.savingsMoved, { amount: formatMinor(props.movedMinor) })}
        </p>
      </StepCard>
    );
  }
  if (props.context.suggestedTransferMinor <= 0) {
    return (
      <StepCard title={tr.close.step4Title}>
        <p className="text-base text-ink-soft">{tr.close.nothingLeft}</p>
      </StepCard>
    );
  }

  async function move() {
    const minor = parseAmountMinor(amount);
    if (!minor || minor <= 0 || !goalId) {
      setError(true);
      return;
    }
    const result = await addSavingsEntry({
      goalId,
      amountMinor: minor,
      source: 'ayKapanisi',
    });
    if (result) {
      if (result.completedGoal) showToast(tr.kumbara.goalDone, { highlight: true });
      props.onMoved(minor);
    }
  }

  return (
    <StepCard title={tr.close.step4Title}>
      <p className="text-base">
        {ti(tr.close.savingsPrompt, {
          amount: formatMinor(props.context.suggestedTransferMinor),
        })}
      </p>
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setError(false);
        }}
        className="mt-3 w-full rounded-card border border-grid bg-card px-3 py-2.5 font-mono text-base outline-none"
        aria-label={tr.kumbara.amount}
      />
      {props.goals.length > 1 && (
        <select
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
          aria-label={tr.close.goalLabel}
          className="mt-2 min-h-11 w-full rounded-card border border-grid bg-card px-3 text-base outline-none"
        >
          {props.goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.emoji} {g.name}
            </option>
          ))}
        </select>
      )}
      {error && <p className="mt-2 text-base text-redpen">{tr.kumbara.invalidAmount}</p>}
      <button
        type="button"
        onClick={() => void move()}
        className="mt-3 min-h-11 w-full rounded-full bg-green text-base font-medium text-white"
      >
        {tr.close.savingsMove}
      </button>
    </StepCard>
  );
}

/** Step 5 (§9.12.5): envelope suggestions + optional waste-limit challenge. */
function NextMonthStep(props: {
  monthKey: MonthKey;
  wasteLimit: string;
  onWasteLimit: (v: string) => void;
}) {
  const data = useLiveQuery(async () => {
    const settings = await getSettings();
    if (!settings) return null;
    const cats = (await listAllCategories()).filter(
      (c) => !c.isArchived && c.kind === 'expense',
    );
    const rows = [];
    for (const c of cats) {
      const [budget, suggestion] = await Promise.all([
        getBudget(c.id),
        // Suggestions are FOR next month, so the median window must include
        // the month being closed (reference month = closed + 1).
        suggestForCategory(
          c.id,
          shiftMonthKey(props.monthKey, 1),
          settings.monthStartDay,
        ),
      ]);
      if (budget || suggestion) {
        rows.push({
          category: c,
          currentMinor: budget?.amountMinor ?? null,
          rollover: budget?.rollover ?? false,
          suggestionMinor: suggestion,
        });
      }
    }
    return rows;
  }, [props.monthKey]);

  const [values, setValues] = useState<Record<string, string>>({});

  async function commit(categoryId: string, rollover: boolean) {
    const raw = values[categoryId];
    if (raw === undefined) return;
    const minor = parseAmountMinor(raw);
    if (minor && minor > 0) await upsertBudget(categoryId, minor, rollover);
  }

  return (
    <StepCard title={tr.close.step5Title}>
      <p className="text-xs text-ink-soft">{tr.close.envelopeHint}</p>
      <div className="mt-2 space-y-2">
        {(data ?? []).map((row) => (
          <div key={row.category.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-base">
              {row.category.emoji} {row.category.name}
              {row.suggestionMinor && (
                <span className="ml-1 font-mono text-xs text-ink-soft">
                  ({formatMinor(row.suggestionMinor)})
                </span>
              )}
            </span>
            <input
              inputMode="decimal"
              value={
                values[row.category.id] ??
                (row.currentMinor !== null
                  ? minorToInput(row.currentMinor)
                  : row.suggestionMinor
                    ? minorToInput(row.suggestionMinor)
                    : '')
              }
              onChange={(e) =>
                setValues((v) => ({ ...v, [row.category.id]: e.target.value }))
              }
              onBlur={() => void commit(row.category.id, row.rollover)}
              className="w-28 rounded-card border border-grid bg-card px-2 py-1.5 text-right font-mono text-base outline-none"
              aria-label={row.category.name}
            />
          </div>
        ))}
      </div>
      <label className="mt-4 block border-t border-grid pt-3 text-base font-medium">
        {tr.close.wasteLimitLabel}
        <input
          inputMode="decimal"
          value={props.wasteLimit}
          onChange={(e) => props.onWasteLimit(e.target.value)}
          className="mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 font-mono text-base outline-none"
        />
      </label>
    </StepCard>
  );
}

/** Step 6 (§9.12.6): grade reveal with the no-shame rule (§8.6). */
function GradeReveal(props: {
  context: CloseContext;
  categories: Map<string, Category>;
  note: string;
  onNote: (v: string) => void;
}) {
  const { context, categories } = props;
  const { grade } = context;
  const lowGrade = grade.grade === 'D' || grade.grade === 'F';
  const score = useCountUp(grade.score);

  // The single most actionable observation (no-shame rule §8.6).
  const observation = useMemo(() => {
    const s = context.snapshot;
    if (
      s.bosRate !== null &&
      s.bosRate >= 0.1 &&
      context.worstBosCategoryId &&
      context.worstBosShare >= 0.3
    ) {
      return ti(tr.close.obsWaste, {
        share: String(Math.round(context.worstBosShare * 100)),
        category: categories.get(context.worstBosCategoryId)?.name ?? '—',
      });
    }
    if (context.worstEnvelope) {
      return ti(tr.close.obsBudget, {
        category: categories.get(context.worstEnvelope.categoryId)?.name ?? '—',
        amount: formatMinor(context.worstEnvelope.overMinor),
      });
    }
    if (s.netSavingsRate !== null && s.netSavingsRate === 0 && s.incomeMinor > 0) {
      return ti(tr.close.obsSavings, {
        amount: formatMinor(Math.round(s.incomeMinor * 0.01)),
      });
    }
    if (context.worstRegretCategoryId) {
      return ti(tr.close.obsRegret, {
        category: categories.get(context.worstRegretCategoryId)?.name ?? '—',
      });
    }
    return tr.close.obsGeneric;
  }, [context, categories]);

  return (
    <StepCard title={tr.close.step6Title}>
      {lowGrade ? (
        <>
          {/* D/F leads with direction, not the letter (§8.6 no-shame). */}
          <p className="text-md">{observation}</p>
          <p className="mt-3 text-center font-display text-hero font-bold text-ink-soft">
            {grade.grade}
            <span className="ml-2 font-mono text-md">{score}</span>
          </p>
        </>
      ) : (
        <>
          <p className="text-center font-display text-[72px] font-bold leading-none text-ballpoint">
            {grade.grade}
          </p>
          <p className="mt-1 text-center font-mono text-md text-ink-soft">{score}/100</p>
        </>
      )}
      {grade.improvementBonus > 0 && (
        <p className="mt-3 rounded-card bg-highlight/40 px-3 py-2 text-base">
          {ti(tr.close.bonusLine, { bonus: String(grade.improvementBonus) })}
        </p>
      )}
      <label className="mt-4 block text-base font-medium">
        {tr.close.noteLabel}
        <input
          value={props.note}
          onChange={(e) => props.onNote(e.target.value)}
          className="mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none"
        />
      </label>
    </StepCard>
  );
}
