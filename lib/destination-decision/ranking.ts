import type { GroupPriority } from './types'
import { personalCostFromScenarios } from './scenario-utils'

export type RankableOption = {
  id: string
  name: string
  tier: string
  group_summary: Record<string, unknown>
  desire_scores: number[]
  approve_count: number
  voter_count: number
  feasibility_yes: number
  member_count: number
}

export function computeCompositeScore(
  option: RankableOption,
  priority: GroupPriority
): number {
  const avgCost = Number(option.group_summary.avg_cost) || 5000
  const desireAvg = option.desire_scores.length
    ? option.desire_scores.reduce((a, b) => a + b, 0) / option.desire_scores.length
    : 0
  const approveRate = option.voter_count > 0 ? option.approve_count / option.voter_count : 0
  const costScore = Math.max(0, 1 - avgCost / 8000)

  switch (priority) {
    case 'budget':
      return costScore * 0.6 + (desireAvg / 5) * 0.25 + approveRate * 0.15
    case 'experience':
      return (desireAvg / 5) * 0.6 + approveRate * 0.25 + costScore * 0.15
    case 'balance':
    default:
      return (desireAvg / 5) * 0.45 + costScore * 0.35 + approveRate * 0.2
  }
}

export function rankOptions(
  options: RankableOption[],
  priority: GroupPriority
): Array<RankableOption & { score: number; rank: number }> {
  const scored = options
    .map(o => ({ ...o, score: computeCompositeScore(o, priority) }))
    .sort((a, b) => b.score - a.score)

  return scored.map((o, i) => ({ ...o, rank: i + 1 }))
}

export function pickWinner(
  options: RankableOption[],
  priority: GroupPriority
): RankableOption | null {
  const ranked = rankOptions(options, priority)
  const eligible = ranked.filter(o => {
    const approveRate = o.voter_count > 0 ? o.approve_count / o.voter_count : 0
    const feasibility = o.member_count > 0 ? o.feasibility_yes / o.member_count : 0
    return approveRate >= 0.5 && feasibility >= 0.5
  })
  return eligible[0] || ranked[0] || null
}

export function aggregateGroupPriority(
  votes: Array<{ priority: GroupPriority }>
): GroupPriority {
  if (!votes.length) return 'balance'
  const counts = { budget: 0, experience: 0, balance: 0 }
  for (const v of votes) counts[v.priority]++
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0][0] as GroupPriority
}

export function personalCost(
  scenarios: import('./types').ScenarioMatrix,
  toggles: { flight?: import('./types').FlightToggle; dates?: import('./types').DateToggle }
): { cost: number; works: string } {
  const cell = personalCostFromScenarios(scenarios, toggles)
  return { cost: cell.cost, works: cell.works }
}
