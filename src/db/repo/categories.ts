import { db } from '../db';
import type { Category } from '../types';
import type { UUID } from '../../lib/types';
import { countTransactionsInCategory, reassignCategory } from './transactions';

/** Active categories, optionally filtered by kind, in manual sort order. */
export async function listCategories(
  kind?: Category['kind'],
): Promise<Category[]> {
  const all = await db.categories.orderBy('sortOrder').toArray();
  return all.filter((c) => !c.isArchived && (!kind || c.kind === kind));
}

/** Every category incl. archived — for the manager and for name lookups. */
export function listAllCategories(): Promise<Category[]> {
  return db.categories.orderBy('sortOrder').toArray();
}

export interface CategoryDraft {
  name: string;
  emoji: string;
  kind: Category['kind'];
  color: string;
}

export async function createCategory(draft: CategoryDraft): Promise<Category> {
  const all = await db.categories.toArray();
  const category: Category = {
    id: crypto.randomUUID(),
    ...draft,
    sortOrder: Math.max(0, ...all.map((c) => c.sortOrder)) + 1,
    isArchived: false,
  };
  await db.categories.add(category);
  return category;
}

export async function updateCategory(
  id: UUID,
  patch: Partial<CategoryDraft>,
): Promise<void> {
  await db.categories.update(id, patch);
}

export async function setCategoryArchived(
  id: UUID,
  isArchived: boolean,
): Promise<void> {
  await db.categories.update(id, { isArchived });
}

/** Hard delete is only allowed for categories with zero transactions (§9.4). */
export async function deleteCategoryIfEmpty(id: UUID): Promise<boolean> {
  if ((await countTransactionsInCategory(id)) > 0) return false;
  await db.categories.delete(id);
  return true;
}

/** Reassign-then-archive flow (§9.4): history moves, category retires. */
export async function reassignAndArchive(
  fromId: UUID,
  toId: UUID,
): Promise<void> {
  await db.transaction('rw', db.transactions, db.categories, async () => {
    await reassignCategory(fromId, toId);
    await db.categories.update(fromId, { isArchived: true });
  });
}

/** Swaps sortOrder with the neighbor within the same kind's active list. */
export async function moveCategory(id: UUID, direction: -1 | 1): Promise<void> {
  const category = await db.categories.get(id);
  if (!category) return;
  const siblings = await listCategories(category.kind);
  const index = siblings.findIndex((c) => c.id === id);
  const neighbor = siblings[index + direction];
  if (!neighbor) return;
  await db.transaction('rw', db.categories, () =>
    Promise.all([
      db.categories.update(id, { sortOrder: neighbor.sortOrder }),
      db.categories.update(neighbor.id, { sortOrder: category.sortOrder }),
    ]),
  );
}
