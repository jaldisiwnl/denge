import { db } from '../db';

// Presence-only flags (§8.8). Key conventions:
//   cleanDay:<ISODate>          — "Bu gün harcama yoktu"
//   gapDismissed:<from>_<to>    — recovery card dismissed / flow completed
//   streakCelebrated:<n>@<from> — milestone toast already shown

export async function setFlag(key: string): Promise<void> {
  await db.uiFlags.put({ key });
}

export async function hasFlag(key: string): Promise<boolean> {
  return (await db.uiFlags.get(key)) !== undefined;
}

export async function listFlagKeys(prefix: string): Promise<string[]> {
  const rows = await db.uiFlags.where('key').startsWith(prefix).toArray();
  return rows.map((r) => r.key);
}
