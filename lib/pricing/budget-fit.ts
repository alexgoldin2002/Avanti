import { budgetFromStep2, formatUsd } from '@/lib/group-budget'
import type { BudgetFit } from './types'

export type MemberBudget = {
  displayName: string
  min: number
  max: number
}

export function memberBudgetsFromTravelers(
  travelers: Array<{ nickname?: string | null; full_name?: string | null; step2?: Record<string, unknown> | null }>
): MemberBudget[] {
  const out: MemberBudget[] = []
  for (const t of travelers) {
    const range = budgetFromStep2(t.step2 || {})
    if (!range) continue
    out.push({
      displayName: t.nickname || t.full_name || 'A traveler',
      min: range.min,
      max: range.max,
    })
  }
  return out
}

/**
 * A destination fits only if every member with a stated budget can afford the
 * cheapest viable version (destination min ≤ each member's max willingness).
 */
export function assessBudgetFit(
  minPerPerson: number,
  members: MemberBudget[]
): { budgetFit: BudgetFit; message?: string } {
  if (!members.length) {
    return { budgetFit: 'unknown' }
  }

  const unaffordable = members.filter(m => minPerPerson > m.max)
  if (unaffordable.length === 0) {
    return { budgetFit: 'fits' }
  }

  if (unaffordable.length === members.length) {
    return {
      budgetFit: 'over_budget',
      message: `Does not fit within your group's budget — even the most budget-friendly version is about ${formatUsd(minPerPerson)} / person.`,
    }
  }

  const names = unaffordable.map(m => m.displayName).join(', ')
  return {
    budgetFit: 'over_budget',
    message: `Does not fit within your group's budget for ${names} — the cheapest realistic option is about ${formatUsd(minPerPerson)} / person.`,
  }
}
