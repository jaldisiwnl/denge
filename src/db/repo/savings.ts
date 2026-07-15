import { db } from '../db';
import type { SavingsGoal } from '../types';
import type { ISODate, Minor } from '../../lib/types';

export async function listGoals(): Promise<SavingsGoal[]> {
  const all = await db.savingsGoals.toArray();
  return all.filter((g) => !g.isArchived);
}

export async function createGoal(input: {
  name: string;
  emoji?: string;
  targetAmountMinor?: Minor;
  deadline?: ISODate;
}): Promise<SavingsGoal> {
  const goal: SavingsGoal = {
    id: crypto.randomUUID(),
    name: input.name,
    emoji: input.emoji ?? '🎯',
    targetAmountMinor: input.targetAmountMinor,
    deadline: input.deadline,
    createdAt: new Date().toISOString(),
    isArchived: false,
  };
  await db.savingsGoals.add(goal);
  return goal;
}
