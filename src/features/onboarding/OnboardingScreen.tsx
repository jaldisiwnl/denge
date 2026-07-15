import { useState } from 'react';
import { tr } from '../../i18n/tr';
import { parseAmountMinor } from '../../lib/money';
import { updateSettings } from '../../db/repo/settings';
import { createGoal } from '../../db/repo/savings';
import { useUiStore } from '../../app/theme';

// 4 screens max, skippable throughout (§10): concept → salary day →
// optional income → Kumbara starter. Genel Kumbara is already seeded by
// db populate; step 4 only offers an *additional* named goal.

const STEPS = 4;

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [salaryDay, setSalaryDay] = useState(1);
  const [income, setIncome] = useState('');
  const [incomeError, setIncomeError] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalError, setGoalError] = useState(false);
  const theme = useUiStore((s) => s.theme);

  async function finish(withGoal: boolean) {
    if (withGoal && goalName.trim()) {
      const target = goalTarget.trim() ? parseAmountMinor(goalTarget) : null;
      if (goalTarget.trim() && target === null) {
        setGoalError(true);
        return;
      }
      await createGoal({
        name: goalName.trim(),
        targetAmountMinor: target ?? undefined,
      });
    }
    const incomeMinor = income.trim() ? parseAmountMinor(income) : null;
    await updateSettings({
      monthStartDay: salaryDay,
      monthlyNetIncomeMinor: incomeMinor ?? undefined,
      theme, // mirror the live UI preference into the exportable settings row
      onboardingDone: true,
    });
    // No navigation needed: the Layout gate re-renders via useLiveQuery.
  }

  function nextFromIncome() {
    if (income.trim() && parseAmountMinor(income) === null) {
      setIncomeError(true);
      return;
    }
    setIncomeError(false);
    setStep(3);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper px-6 py-10">
      {/* progress dots */}
      <div className="mb-8 flex justify-center gap-2" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-ballpoint' : 'bg-grid'}`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-1 flex-col">
          <h1 className="font-display text-hero font-bold text-ballpoint">
            {tr.app.name}
          </h1>
          <p className="mt-2 font-display text-xl font-semibold">
            {tr.app.tagline}
          </p>
          <p className="mt-6 text-md text-ink-soft">{tr.onboarding.concept}</p>
          <div className="mt-auto">
            <PrimaryButton onClick={() => setStep(1)}>
              {tr.onboarding.start}
            </PrimaryButton>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-1 flex-col">
          <h1 className="font-display text-2xl font-semibold">
            {tr.onboarding.salaryDayTitle}
          </h1>
          <p className="mt-2 text-base text-ink-soft">
            {tr.onboarding.salaryDayHint}
          </p>
          {/* 1–28: capped to keep fiscal clamping sane (§8.1) */}
          <div className="mt-6 grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSalaryDay(d)}
                aria-pressed={salaryDay === d}
                className={`h-11 rounded-card border font-mono text-base ${
                  salaryDay === d
                    ? 'border-ballpoint bg-ballpoint/15 font-medium text-ballpoint'
                    : 'border-grid text-ink'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="mt-auto">
            <PrimaryButton onClick={() => setStep(2)}>
              {tr.onboarding.next}
            </PrimaryButton>
            {/* Every Atla advances exactly one step; only the last screen
                finishes — consistent behavior on every screen. */}
            <SkipButton onClick={() => setStep(2)} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col">
          <h1 className="font-display text-2xl font-semibold">
            {tr.onboarding.incomeTitle}
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
            {tr.onboarding.incomeOptional}
          </p>
          <p className="mt-2 text-base text-ink-soft">
            {tr.onboarding.incomeHint}
          </p>
          <div className="mt-6 flex items-center gap-2 rounded-card border border-grid bg-card px-4 py-3">
            <span className="font-mono text-xl text-ink-soft">₺</span>
            <input
              inputMode="decimal"
              value={income}
              onChange={(e) => {
                setIncome(e.target.value);
                setIncomeError(false);
              }}
              placeholder={tr.onboarding.incomePlaceholder}
              className="w-full bg-transparent font-mono text-xl outline-none placeholder:text-ink-soft/50"
              aria-label={tr.onboarding.incomeTitle}
            />
          </div>
          {incomeError && (
            <p className="mt-2 text-base text-redpen">
              {tr.onboarding.invalidAmount}
            </p>
          )}
          <div className="mt-auto">
            <PrimaryButton onClick={nextFromIncome}>
              {tr.onboarding.next}
            </PrimaryButton>
            <SkipButton
              onClick={() => {
                setIncome('');
                setStep(3);
              }}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-1 flex-col">
          <h1 className="font-display text-2xl font-semibold">
            {tr.onboarding.kumbaraTitle}
          </h1>
          <p className="mt-2 text-base text-ink-soft">
            {tr.onboarding.kumbaraHint}
          </p>
          <label className="mt-6 block text-base font-medium">
            {tr.onboarding.goalNameLabel}
            <input
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder={tr.onboarding.goalNamePlaceholder}
              className="mt-1 w-full rounded-card border border-grid bg-card px-4 py-3 text-base outline-none placeholder:text-ink-soft/50"
            />
          </label>
          <label className="mt-4 block text-base font-medium">
            {tr.onboarding.goalTargetLabel}
            <input
              inputMode="decimal"
              value={goalTarget}
              onChange={(e) => {
                setGoalTarget(e.target.value);
                setGoalError(false);
              }}
              placeholder={tr.onboarding.incomePlaceholder}
              className="mt-1 w-full rounded-card border border-grid bg-card px-4 py-3 font-mono text-base outline-none placeholder:text-ink-soft/50"
            />
          </label>
          {goalError && (
            <p className="mt-2 text-base text-redpen">
              {tr.onboarding.invalidAmount}
            </p>
          )}
          <div className="mt-auto">
            <PrimaryButton onClick={() => void finish(true)}>
              {goalName.trim()
                ? tr.onboarding.addGoalAndFinish
                : tr.onboarding.finish}
            </PrimaryButton>
            <SkipButton onClick={() => void finish(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function PrimaryButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="min-h-12 w-full rounded-full bg-ballpoint px-6 text-md font-medium text-white"
    >
      {props.children}
    </button>
  );
}

function SkipButton(props: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="mt-3 min-h-11 w-full rounded-full text-base text-ink-soft"
    >
      {tr.onboarding.skip}
    </button>
  );
}
