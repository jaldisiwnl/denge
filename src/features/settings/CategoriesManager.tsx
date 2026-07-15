import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../components/Sheet';
import { tr } from '../../i18n/tr';
import { CATEGORY_COLORS } from '../../db/defaults';
import {
  createCategory,
  deleteCategoryIfEmpty,
  listAllCategories,
  moveCategory,
  reassignAndArchive,
  setCategoryArchived,
  updateCategory,
} from '../../db/repo/categories';
import { countTransactionsInCategory } from '../../db/repo/transactions';
import type { Category } from '../../db/types';

type SheetState =
  | { mode: 'closed' }
  | { mode: 'new'; kind: Category['kind'] }
  | { mode: 'edit'; category: Category };

export function CategoriesManager() {
  const categories = useLiveQuery(listAllCategories);
  const [sheet, setSheet] = useState<SheetState>({ mode: 'closed' });

  const active = (kind: Category['kind']) =>
    (categories ?? []).filter((c) => !c.isArchived && c.kind === kind);
  const archived = (categories ?? []).filter((c) => c.isArchived);

  return (
    <div className="space-y-5">
      <header>
        <Link to="/ayarlar" className="text-base text-ink-soft">
          ‹ {tr.settings.title}
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold">
          {tr.categories.title}
        </h1>
      </header>

      {(['expense', 'income'] as const).map((kind) => (
        <section key={kind}>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {kind === 'expense'
              ? tr.categories.expenseSection
              : tr.categories.incomeSection}
          </h2>
          <div className="mt-1.5 divide-y divide-grid rounded-card border border-grid bg-card">
            {active(kind).map((c, i, list) => (
              <div key={c.id} className="flex min-h-11 items-center gap-2 px-3 py-2">
                <span aria-hidden>{c.emoji}</span>
                <span className="flex-1 truncate text-base">{c.name}</span>
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
                <button
                  type="button"
                  aria-label={tr.common.up}
                  disabled={i === 0}
                  onClick={() => void moveCategory(c.id, -1)}
                  className="h-9 w-9 rounded-full text-ink-soft disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={tr.common.down}
                  disabled={i === list.length - 1}
                  onClick={() => void moveCategory(c.id, 1)}
                  className="h-9 w-9 rounded-full text-ink-soft disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setSheet({ mode: 'edit', category: c })}
                  className="rounded-full border border-grid px-3 py-1 text-xs text-ink-soft"
                >
                  {tr.common.edit}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSheet({ mode: 'new', kind })}
            className="mt-2 text-base font-medium text-ballpoint"
          >
            + {tr.categories.add}
          </button>
        </section>
      ))}

      {archived.length > 0 && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {tr.categories.archivedSection}
          </h2>
          <div className="mt-1.5 divide-y divide-grid rounded-card border border-grid bg-card opacity-70">
            {archived.map((c) => (
              <div key={c.id} className="flex min-h-11 items-center gap-2 px-3 py-2">
                <span aria-hidden>{c.emoji}</span>
                <span className="flex-1 truncate text-base">{c.name}</span>
                <button
                  type="button"
                  onClick={() => void setCategoryArchived(c.id, false)}
                  className="rounded-full border border-grid px-3 py-1 text-xs text-ink-soft"
                >
                  {tr.categories.unarchive}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {sheet.mode !== 'closed' && (
        <CategorySheet
          key={sheet.mode === 'edit' ? sheet.category.id : 'new'}
          state={sheet}
          categories={categories ?? []}
          onClose={() => setSheet({ mode: 'closed' })}
        />
      )}
    </div>
  );
}

function CategorySheet(props: {
  state: Exclude<SheetState, { mode: 'closed' }>;
  categories: Category[];
  onClose: () => void;
}) {
  const editing = props.state.mode === 'edit' ? props.state.category : undefined;
  const kind = editing?.kind ?? (props.state as { kind: Category['kind'] }).kind;

  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState(editing?.emoji ?? '📦');
  const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[0]);
  const [nameError, setNameError] = useState(false);
  const [reassignTarget, setReassignTarget] = useState('');

  // Transaction count decides delete vs archive options (§9.4).
  const txCount = useLiveQuery(
    () => (editing ? countTransactionsInCategory(editing.id) : Promise.resolve(0)),
    [editing?.id],
  );

  const reassignOptions = props.categories.filter(
    (c) => !c.isArchived && c.kind === kind && c.id !== editing?.id,
  );

  async function save() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    if (editing) {
      await updateCategory(editing.id, { name: name.trim(), emoji, color });
    } else {
      await createCategory({ name: name.trim(), emoji, kind, color });
    }
    props.onClose();
  }

  return (
    <Sheet onClose={props.onClose}>
      <h2 className="text-md font-semibold">
        {editing ? tr.common.edit : tr.categories.add}
      </h2>

      <label className="mt-4 block text-base font-medium">
        {tr.categories.name}
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(false);
          }}
          className="mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none"
        />
      </label>
      {nameError && (
        <p className="mt-1 text-base text-redpen">{tr.categories.nameRequired}</p>
      )}

      <label className="mt-3 block text-base font-medium">
        {tr.categories.emoji}
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="mt-1 w-20 rounded-card border border-grid bg-card px-3 py-2.5 text-center text-md outline-none"
        />
      </label>

      <p className="mt-3 text-base font-medium">{tr.categories.color}</p>
      <div className="mt-1.5 flex gap-2">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-pressed={color === c}
            aria-label={c}
            className={`h-9 w-9 rounded-full border-2 ${
              color === c ? 'border-ink' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Archive / delete / reassign block (§9.4) */}
      {editing && (
        <div className="mt-5 space-y-2 border-t border-grid pt-4">
          {(txCount ?? 0) === 0 ? (
            <button
              type="button"
              onClick={() =>
                void deleteCategoryIfEmpty(editing.id).then(props.onClose)
              }
              className="min-h-11 w-full rounded-full border border-redpen text-base font-medium text-redpen"
            >
              {tr.categories.delete}
            </button>
          ) : (
            <>
              <p className="text-xs text-ink-soft">{tr.categories.hasTransactions}</p>
              <button
                type="button"
                onClick={() =>
                  void setCategoryArchived(editing.id, true).then(props.onClose)
                }
                className="min-h-11 w-full rounded-full border border-ink text-base font-medium text-ink"
              >
                {tr.categories.archive}
              </button>
              {reassignOptions.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={reassignTarget}
                    onChange={(e) => setReassignTarget(e.target.value)}
                    aria-label={tr.categories.reassignTo}
                    className="min-h-11 flex-1 rounded-card border border-grid bg-card px-3 text-base outline-none"
                  >
                    <option value="">{tr.categories.reassignTo}…</option>
                    {reassignOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!reassignTarget}
                    onClick={() =>
                      void reassignAndArchive(editing.id, reassignTarget).then(
                        props.onClose,
                      )
                    }
                    className="min-h-11 rounded-full border border-ink px-4 text-base font-medium text-ink disabled:opacity-40"
                  >
                    {tr.categories.reassignArchive}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

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
