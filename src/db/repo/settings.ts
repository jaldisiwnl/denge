import { db } from '../db';
import type { Settings } from '../types';

export function getSettings(): Promise<Settings | undefined> {
  return db.settings.get('singleton');
}

export async function updateSettings(
  patch: Partial<Omit<Settings, 'id'>>,
): Promise<void> {
  await db.settings.update('singleton', patch);
}
