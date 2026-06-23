/** Parse Step 2 budget chip or free-text into USD min/max per person (all-in). */
export function parseBudgetRange(budget: string | undefined | null): { min: number; max: number } | null {
  if (!budget || typeof budget !== 'string') return null
  const t = budget.trim()
  if (!t) return null

  const presets: Record<string, { min: number; max: number }> = {
    'Under $1,000': { min: 500, max: 1000 },
    '$1,000–2,000': { min: 1000, max: 2000 },
    '$1,000-2,000': { min: 1000, max: 2000 },
    '$2,000–4,000': { min: 2000, max: 4000 },
    '$2,000-4,000': { min: 2000, max: 4000 },
    '$4,000–7,000': { min: 4000, max: 7000 },
    '$4,000-7,000': { min: 4000, max: 7000 },
    '$7,000+': { min: 7000, max: 12000 },
  }

  if (presets[t]) return presets[t]

  const nums = t.match(/\d[\d,]*/g)?.map(n => parseInt(n.replace(/,/g, ''), 10)).filter(n => !Number.isNaN(n))
  if (!nums?.length) return null
  if (nums.length === 1) {
    const n = nums[0]
    if (/under|less than|max/i.test(t)) return { min: Math.round(n * 0.5), max: n }
    if (/\+|plus|more than|over/i.test(t)) return { min: n, max: Math.round(n * 1.6) }
    return { min: Math.round(n * 0.85), max: n }
  }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

export function budgetFromStep2(step2: Record<string, unknown> | null | undefined): { min: number; max: number } | null {
  if (!step2) return null
  const budget = step2.budget
  if (budget === 'Other') {
    return parseBudgetRange(typeof step2.budgetOther === 'string' ? step2.budgetOther : null)
  }
  return parseBudgetRange(typeof budget === 'string' ? budget : null)
}

/**
 * Group bounds for Round 1 card budget generation:
 * - groupMinBudget = highest floor any member stated (most frugal person's minimum)
 * - groupMaxBudget = lowest ceiling any member stated (tightest person's maximum)
 */
export function computeGroupBudgetBounds(
  travelers: Array<{ step2?: Record<string, unknown> | null }>
): { groupMinBudget: number; groupMaxBudget: number; memberCount: number } | null {
  const ranges: { min: number; max: number }[] = []
  for (const t of travelers) {
    const r = budgetFromStep2(t.step2 || {})
    if (r) ranges.push(r)
  }
  if (!ranges.length) return null

  return {
    groupMinBudget: Math.max(...ranges.map(r => r.min)),
    groupMaxBudget: Math.min(...ranges.map(r => r.max)),
    memberCount: ranges.length,
  }
}

export function formatUsd(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}
