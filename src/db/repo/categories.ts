import { db } from '../db';
import type { Category } from '../types';

/** Active categories, optionally filtered by kind, in manual sort order. */
export async function listCategories(
  kind?: Category['kind'],
): Promise<Category[]> {
  const all = await db.categories.orderBy('sortOrder').toArray();
  return all.filter((c) => !c.isArchived && (!kind || c.kind === kind));
}
