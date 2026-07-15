import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../components/Sheet';
import { tr } from '../../i18n/tr';
import { formatMinor, minorToInput, parseAmountMinor } from '../../lib/money';
import { listAllCategories } from '../../db/repo/categories';
import {
  addTemplate,
  deleteTemplate,
  listTemplates,
  MAX_TEMPLATES,
  moveTemplate,
  updateTemplate,
} from '../../db/repo/templates';
import type { Necessity, QuickTemplate } from '../../db/types';

type SheetState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; template: QuickTemplate };

export function TemplatesManager() {
  const templates = useLiveQuery(listTemplates);
  const [sheet, setSheet] = useState<SheetState>({ mode: 'closed' });
  const [confirmingId, setConfirmingId] = useState<string>();

  const atLimit = (templates?.length ?? 0) >= MAX_TEMPLATES;

  return (
    <div className="space-y-4">
      <header>
        <Link to="/ayarlar" className="text-base text-ink-soft">
          ‹ {tr.settings.title}
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold">
          {tr.templates.title}
        </h1>
      </header>

      {(templates?.length ?? 0) === 0 ? (
        <p className="text-base text-ink-soft">{tr.templates.empty}</p>
      ) : (
        <div className="divide-y divide-grid rounded-card border border-grid bg-card">
          {templates!.map((t, i, list) => (
            <div key={t.id} className="flex min-h-11 items-center gap-2 px-3 py-2">
              {t.emoji && <span aria-hidden>{t.emoji}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{t.name}</span>
                <span className="font-mono text-xs text-ink-soft">
                  {formatMinor(t.amountMinor)}
                </span>
              </span>
              <button
                type="button"
                aria-label={tr.common.up}
                disabled={i === 0}
                onClick={() => void moveTemplate(t.id, -1)}
                className="h-9 w-9 rounded-full text-ink-soft disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={tr.common.down}
                disabled={i === list.length - 1}
                onClick={() => void moveTemplate(t.id, 1)}
                className="h-9 w-9 rounded-full text-ink-soft disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setSheet({ mode: 'edit', template: t })}
                className="rounded-full border border-grid px-3 py-1 text-xs text-ink-soft"
              >
                {tr.common.edit}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmingId === t.id) void deleteTemplate(t.id);
                  else setConfirmingId(t.id);
                }}
                className={`rounded-full border px-3 py-1 text-xs ${
                  confirmingId === t.id
                    ? 'border-redpen bg-redpen text-white'
                    : 'border-redpen text-redpen'
                }`}
              >
                {confirmingId === t.id
                  ? tr.templates.deleteConfirm
                  : tr.categories.delete}
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          disabled={atLimit}
          onClick={() => setSheet({ mode: 'new' })}
          className="text-base font-medium text-ballpoint disabled:opacity-40"
        >
          + {tr.templates.add}
        </button>
        {atLimit && (
          <p className="mt-1 text-xs text-ink-soft">{tr.templates.limitNote}</p>
        )}
      </div>

      {sheet.mode !== 'closed' && (
        <TemplateSheet
          key={sheet.mode === 'edit' ? sheet.template.id : 'new'}
          editing={sheet.mode === 'edit' ? sheet.template : undefined}
          onClose={() => setSheet({ mode: 'closed' })}
        />
      )}
    </div>
  );
}

function TemplateSheet(props: {
  editing?: QuickTemplate;
  onClose: () => void;
}) {
  const { editing } = props;
  // Include the edited template's category even when archived, so the select
  // shows what will actually be saved (P7 fix).
  const categories = useLiveQuery(async () => {
    const all = await listAllCategories();
    return all.filter(
      (c) =>
        c.kind === 'expense' &&
        (!c.isArchived || c.id === editing?.categoryId),
    );
  }, [editing?.categoryId]);

  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState(editing?.emoji ?? '');
  const [amount, setAmount] = useState(
    editing ? minorToInput(editing.amountMinor) : '',
  );
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '');
  const [necessity, setNecessity] = useState<Necessity>(
    editing?.necessity ?? 'istek',
  );
  const [merchant, setMerchant] = useState(editing?.merchant ?? '');
  const [error, setError] = useState<string>();

  async function save() {
    if (!name.trim()) {
      setError(tr.templates.nameRequired);
      return;
    }
    const amountMinor = parseAmountMinor(amount);
    if (!amountMinor || amountMinor <= 0) {
      setError(tr.templates.invalidAmount);
      return;
    }
    const catId = categoryId || categories?.[0]?.id;
    if (!catId) return;
    const draft = {
      name: name.trim(),
      emoji: emoji.trim() || undefined,
      amountMinor,
      categoryId: catId,
      necessity,
      merchant: merchant.trim() || undefined,
    };
    if (editing) await updateTemplate(editing.id, draft);
    else await addTemplate(draft);
    props.onClose();
  }

  return (
    <Sheet onClose={props.onClose}>
      <h2 className="text-md font-semibold">
        {editing ? tr.common.edit : tr.templates.add}
      </h2>

      <div className="mt-4 flex gap-2">
        <label className="block flex-1 text-base font-medium">
          {tr.templates.name}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none"
          />
        </label>
        <label className="block w-20 text-base font-medium">
          {tr.categories.emoji}
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="mt-1 w-full rounded-card border border-grid bg-card px-2 py-2.5 text-center text-md outline-none"
          />
        </label>
      </div>

      <label className="mt-3 block text-base font-medium">
        {tr.templates.amount}
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 font-mono text-base outline-none"
        />
      </label>

      <label className="mt-3 block text-base font-medium">
        {tr.templates.category}
        <select
          value={categoryId || categories?.[0]?.id || ''}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-card border border-grid bg-card px-3 text-base outline-none"
        >
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
              {c.isArchived ? ` ${tr.categories.archivedSuffix}` : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 flex gap-2">
        {(['gerekli', 'istek', 'bos'] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNecessity(n)}
            aria-pressed={necessity === n}
            className={`min-h-11 flex-1 rounded-full border text-base font-medium ${
              necessity === n
                ? n === 'gerekli'
                  ? 'border-green bg-green/15 text-green'
                  : n === 'istek'
                    ? 'border-ballpoint bg-ballpoint/15 text-ballpoint'
                    : 'border-redpen bg-redpen/15 text-redpen'
                : 'border-grid text-ink-soft'
            }`}
          >
            {tr.necessity[n]}
          </button>
        ))}
      </div>

      <input
        value={merchant}
        onChange={(e) => setMerchant(e.target.value)}
        placeholder={tr.quickAdd.merchant}
        className="mt-3 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none placeholder:text-ink-soft/50"
      />

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
