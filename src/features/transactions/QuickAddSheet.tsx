import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../components/Sheet';
import { Numpad, type NumpadKey } from '../../components/Numpad';
import { tr } from '../../i18n/tr';
import { useEphemeralStore } from '../../app/ui';
import { formatMinor, parseAmountMinor, minorToInput } from '../../lib/money';
import { daysAgoISO, todayISO } from '../../lib/dates';
import { listCategories } from '../../db/repo/categories';
import {
  addTransaction,
  categoryUsageSince,
  deleteTransaction,
  updateTransaction,
} from '../../db/repo/transactions';
import {
  applyTemplate,
  createTemplateFromTransaction,
  listTemplates,
} from '../../db/repo/templates';
import type { Category, Mood, Necessity, QuickTemplate } from '../../db/types';

const MOODS: Mood[] = ['normal', 'stresli', 'sikilmis', 'sosyal', 'ac', 'kutlama'];

const NECESSITY_STYLE: Record<Necessity, { on: string; dot: string }> = {
  gerekli: { on: 'border-green bg-green/15 text-green', dot: 'bg-green' },
  istek: { on: 'border-ballpoint bg-ballpoint/15 text-ballpoint', dot: 'bg-ballpoint' },
  bos: { on: 'border-redpen bg-redpen/15 text-redpen', dot: 'bg-redpen' },
};

/** Groups the typed raw string ("1250,5") for display ("1.250,5"). */
function displayAmount(raw: string): string {
  const [int = '', dec] = raw.split(',');
  const grouped = int ? new Intl.NumberFormat('tr-TR').format(Number(int)) : '0';
  return raw.includes(',') ? `${grouped},${dec ?? ''}` : grouped;
}

/**
 * The quick-add sheet (§9.1) — also the transaction detail editor (§9.3)
 * when `editTransaction` is set in the ephemeral store. Happy path:
 * amount → category → necessity → save = 3 taps + digits.
 */
export function QuickAddSheet() {
  const close = useEphemeralStore((s) => s.closeQuickAdd);
  const editing = useEphemeralStore((s) => s.editTransaction);
  const showToast = useEphemeralStore((s) => s.showToast);

  const [type, setType] = useState<'expense' | 'income'>(editing?.type ?? 'expense');
  const [amountStr, setAmountStr] = useState(
    editing ? minorToInput(editing.amountMinor) : '',
  );
  const [categoryId, setCategoryId] = useState(editing?.categoryId);
  const [necessity, setNecessity] = useState(editing?.necessity);
  const [mood, setMood] = useState(editing?.mood);
  const [note, setNote] = useState(editing?.note ?? '');
  const [merchant, setMerchant] = useState(editing?.merchant ?? '');
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [detayOpen, setDetayOpen] = useState(
    Boolean(editing && (editing.note || editing.merchant || editing.mood)),
  );
  const [amountError, setAmountError] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Chips ordered by usage frequency over the last 90 days (§9.1).
  const categories = useLiveQuery(async () => {
    const [cats, usage] = await Promise.all([
      listCategories(type),
      categoryUsageSince(daysAgoISO(90)),
    ]);
    return cats.sort(
      (a, b) =>
        (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) ||
        a.sortOrder - b.sortOrder,
    );
  }, [type]);

  // Templates whose category is archived are hidden, not deleted (§9.4).
  const templates = useLiveQuery(async () => {
    const [list, cats] = await Promise.all([listTemplates(), listCategories()]);
    const active = new Set(cats.map((c) => c.id));
    return list.filter((t) => active.has(t.categoryId));
  });

  function pressKey(key: NumpadKey) {
    setAmountError(false);
    setAmountStr((prev) => {
      if (key === '⌫') return prev.slice(0, -1);
      if (key === ',') {
        if (prev.includes(',')) return prev;
        return prev === '' ? '0,' : `${prev},`;
      }
      const [int = '', dec] = prev.split(',');
      if (prev.includes(',')) {
        return (dec ?? '').length >= 2 ? prev : prev + key;
      }
      if (int.length >= 7) return prev;
      return prev === '0' ? key : prev + key;
    });
  }

  const amountMinor = amountStr ? parseAmountMinor(amountStr) : null;
  const saveDisabled = !categoryId || (type === 'expense' && !necessity);

  async function save() {
    // Zero/negative blocked with inline error (§17); other requirements
    // disable the button per §9.1.
    if (!amountMinor || amountMinor <= 0) {
      setAmountError(true);
      return;
    }
    if (!categoryId) return;
    const fields = {
      amountMinor,
      categoryId,
      date,
      note: note.trim() || undefined,
      merchant: merchant.trim() || undefined,
      necessity: type === 'expense' ? necessity : undefined,
      mood: type === 'expense' ? mood : undefined,
    };
    if (editing) {
      await updateTransaction(editing.id, fields);
    } else {
      await addTransaction({ type, ...fields });
    }
    const categoryName = categories?.find((c) => c.id === categoryId)?.name ?? '';
    showToast(
      <span>
        {tr.quickAdd.saved} <span className="font-mono">{formatMinor(amountMinor)}</span>
        {' · '}
        {merchant.trim() || categoryName}
      </span>,
    );
    close();
  }

  async function oneTapTemplate(t: QuickTemplate) {
    await applyTemplate(t);
    showToast(
      <span>
        {tr.quickAdd.saved} <span className="font-mono">{formatMinor(t.amountMinor)}</span>
        {' · '}
        {t.name}
      </span>,
    );
    close();
  }

  function prefillFromTemplate(t: QuickTemplate) {
    setType('expense');
    setAmountStr(minorToInput(t.amountMinor));
    setCategoryId(t.categoryId);
    setNecessity(t.necessity);
    setNote(t.note ?? '');
    setMerchant(t.merchant ?? '');
    setDetayOpen(Boolean(t.note || t.merchant));
  }

  async function makeTemplate() {
    if (!editing) return;
    const created = await createTemplateFromTransaction(editing);
    showToast(created ? tr.quickAdd.templateCreated : tr.quickAdd.templateLimit);
  }

  async function confirmDelete() {
    if (!editing) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await deleteTransaction(editing.id);
    close();
  }

  return (
    <Sheet onClose={close} full>
      {/* Gider | Gelir toggle (top, §9.1); type is fixed while editing */}
      <div className="flex items-center justify-between">
        {editing ? (
          <h2 className="text-md font-semibold">{tr.quickAdd.editTitle}</h2>
        ) : (
          <div className="flex gap-1 rounded-full border border-grid p-1">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setCategoryId(undefined);
                }}
                aria-pressed={type === t}
                className={`rounded-full px-4 py-1.5 text-base ${
                  type === t
                    ? 'bg-ballpoint font-medium text-white'
                    : 'text-ink-soft'
                }`}
              >
                {t === 'expense' ? tr.quickAdd.expense : tr.quickAdd.income}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={close}
          aria-label={tr.common.close}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Kısayollar row — one-tap saves, long-press prefills (§9.14) */}
      {!editing && type === 'expense' && (templates?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-soft">{tr.quickAdd.templates}</p>
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
            {templates!.map((t) => (
              <TemplateChip
                key={t.id}
                template={t}
                onTap={() => void oneTapTemplate(t)}
                onLongPress={() => prefillFromTemplate(t)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Numpad-first: big mono amount (§9.1) */}
      <div className="mt-3 text-center">
        <p
          className={`font-mono text-hero font-medium ${
            amountStr ? 'text-ink' : 'text-ink-soft/50'
          } ${amountError ? 'text-redpen' : ''}`}
          aria-live="polite"
        >
          ₺{amountStr ? displayAmount(amountStr) : '0,00'}
        </p>
        {amountError && (
          <p className="mt-1 text-base text-redpen">{tr.quickAdd.amountEmpty}</p>
        )}
      </div>
      <div className="mt-3">
        <Numpad onKey={pressKey} />
      </div>

      {/* Category chips, usage-ordered (§9.1) */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {categories?.map((c) => (
          <CategoryChip
            key={c.id}
            category={c}
            selected={categoryId === c.id}
            onSelect={() => setCategoryId(c.id)}
          />
        ))}
      </div>

      {/* Bilinç etiketi — required for expenses (§9.2) */}
      {type === 'expense' && (
        <div className="mt-4">
          <div className="flex gap-2">
            {(Object.keys(NECESSITY_STYLE) as Necessity[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNecessity(n)}
                aria-pressed={necessity === n}
                className={`min-h-11 flex-1 rounded-full border text-base font-medium ${
                  necessity === n
                    ? NECESSITY_STYLE[n].on
                    : 'border-grid text-ink-soft'
                }`}
              >
                {tr.necessity[n]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-center text-xs text-ink-soft">
            {tr.necessity.hint}
          </p>
        </div>
      )}

      {/* Collapsed Detay row (§9.1) */}
      <button
        type="button"
        onClick={() => setDetayOpen((v) => !v)}
        aria-expanded={detayOpen}
        className="mt-3 flex min-h-11 w-full items-center justify-between text-base text-ink-soft"
      >
        <span>{tr.quickAdd.detail}</span>
        <span aria-hidden>{detayOpen ? '▴' : '▾'}</span>
      </button>
      {detayOpen && (
        <div className="space-y-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tr.quickAdd.note}
            className="w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none placeholder:text-ink-soft/50"
          />
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder={tr.quickAdd.merchant}
            className="w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none placeholder:text-ink-soft/50"
          />
          <label className="block text-base text-ink-soft">
            {tr.quickAdd.date}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 font-mono text-base text-ink outline-none"
            />
          </label>
          {type === 'expense' && (
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood((cur) => (cur === m ? undefined : m))}
                  aria-pressed={mood === m}
                  className={`rounded-full border px-3 py-1.5 text-base ${
                    mood === m
                      ? 'border-ballpoint bg-ballpoint/15 text-ballpoint'
                      : 'border-grid text-ink-soft'
                  }`}
                >
                  {tr.moods[m]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail-only actions: delete (two-step confirm) + Kısayol yap (§9.3) */}
      {editing && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void confirmDelete()}
            className={`min-h-11 flex-1 rounded-full border text-base font-medium ${
              confirmingDelete
                ? 'border-redpen bg-redpen text-white'
                : 'border-redpen text-redpen'
            }`}
          >
            {confirmingDelete ? tr.quickAdd.confirmDelete : tr.quickAdd.delete}
          </button>
          <button
            type="button"
            onClick={() => void makeTemplate()}
            className="min-h-11 flex-1 rounded-full border border-ink text-base font-medium text-ink"
          >
            {tr.quickAdd.makeTemplate}
          </button>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saveDisabled}
          className="min-h-12 w-full rounded-full bg-ballpoint text-md font-medium text-white disabled:opacity-40"
        >
          {tr.common.save}
        </button>
      </div>
    </Sheet>
  );
}

function CategoryChip(props: {
  category: Category;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      aria-pressed={props.selected}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-base ${
        props.selected
          ? 'border-ballpoint bg-ballpoint/15 font-medium text-ballpoint'
          : 'border-grid text-ink'
      }`}
    >
      <span aria-hidden>{props.category.emoji}</span>
      {props.category.name}
    </button>
  );
}

function TemplateChip(props: {
  template: QuickTemplate;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const timer = useRef<number>();
  const longPressed = useRef(false);

  const start = () => {
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      props.onLongPress();
    }, 450);
  };
  const cancel = () => window.clearTimeout(timer.current);

  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (!longPressed.current) props.onTap();
      }}
      className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-grid px-3 text-base text-ink"
    >
      {props.template.emoji && <span aria-hidden>{props.template.emoji}</span>}
      {props.template.name}
      <span className="font-mono text-xs text-ink-soft">
        {formatMinor(props.template.amountMinor)}
      </span>
    </button>
  );
}
