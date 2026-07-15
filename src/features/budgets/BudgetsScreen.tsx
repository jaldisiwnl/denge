import { tr } from '../../i18n/tr';

export function BudgetsScreen() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{tr.tabs.butce}</h1>
      <p className="text-base text-ink-soft">{tr.common.comingSoon}</p>
    </div>
  );
}
