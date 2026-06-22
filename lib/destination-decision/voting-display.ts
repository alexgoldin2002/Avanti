import type { DestinationTier } from './types'

export type InterestWeights = {
  cost: number
  gettingThere: number
  weather: number
  activities: number
  groupFit: number
}

export const DEFAULT_WEIGHTS: InterestWeights = {
  cost: 20,
  gettingThere: 20,
  weather: 20,
  activities: 20,
  groupFit: 20,
}

export const WEIGHT_LABELS: { key: keyof InterestWeights; label: string }[] = [
  { key: 'cost', label: 'Cost range' },
  { key: 'gettingThere', label: 'Getting there' },
  { key: 'weather', label: 'Weather' },
  { key: 'activities', label: 'Activities' },
  { key: 'groupFit', label: 'Group fit' },
]

export function normalizeWeights(input: Partial<InterestWeights> | null | undefined): InterestWeights {
  if (!input) return { ...DEFAULT_WEIGHTS }
  const merged = { ...DEFAULT_WEIGHTS, ...input }
  const sum = WEIGHT_LABELS.reduce((acc, { key }) => acc + (merged[key] || 0), 0)
  if (sum === 100) return merged
  if (sum <= 0) return { ...DEFAULT_WEIGHTS }
  return WEIGHT_LABELS.reduce(
    (acc, { key }) => {
      acc[key] = Math.round((merged[key] / sum) * 100)
      return acc
    },
    {} as InterestWeights
  )
}

export function weightsTotal(weights: InterestWeights): number {
  return WEIGHT_LABELS.reduce((acc, { key }) => acc + weights[key], 0)
}

export function priorityFromWeights(weights: InterestWeights): 'budget' | 'experience' | 'balance' {
  const experience = weights.activities + weights.weather + weights.groupFit
  const budget = weights.cost
  if (budget >= experience + 10) return 'budget'
  if (experience >= budget + 10) return 'experience'
  return 'balance'
}

type CardSnapshot = Record<string, unknown>

function field(card: CardSnapshot, ...keys: string[]): string {
  for (const key of keys) {
    const val = card[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}

function bullets(text: string, max = 2): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 2)
    .slice(0, max)
}

export function costRangeLabel(tier: DestinationTier, costText: string): string {
  const firstLine = costText.split('\n')[0] || ''
  const match = firstLine.match(/\$[\d,]+/)
  if (match) return match[0]
  if (tier === 'budget') return '$$'
  if (tier === 'luxury') return '$$$$'
  return '$$$'
}

export function costDollarCount(tier: DestinationTier, costText: string): number {
  const label = costRangeLabel(tier, costText)
  if (label.startsWith('$')) {
    const n = (label.match(/\$/g) || []).length
    if (n >= 2) return Math.min(n, 4)
  }
  if (tier === 'budget') return 2
  if (tier === 'luxury') return 4
  return 3
}

export type WeatherMood = 'sun' | 'cloud' | 'rain' | 'snow' | 'mixed'

export function weatherMood(text: string): WeatherMood {
  const t = text.toLowerCase()
  if (/snow|cold|freezing|winter/.test(t)) return 'snow'
  if (/rain|storm|hurricane|monsoon|wet/.test(t)) return 'rain'
  if (/sun|warm|dry|clear|sunny/.test(t) && /cloud|overcast|mixed/.test(t)) return 'mixed'
  if (/sun|warm|dry|clear|sunny/.test(t)) return 'sun'
  if (/cloud|overcast|mild/.test(t)) return 'cloud'
  return 'mixed'
}

export function logisticsSummary(card: CardSnapshot): string {
  const text = field(card, 'logistics')
  const items = bullets(text, 1)
  return items[0] || 'See details'
}

export function activitiesSummary(card: CardSnapshot): string[] {
  return bullets(field(card, 'activities'), 2)
}

export function groupFitStarsFromCard(card: CardSnapshot): number {
  const text = field(card, 'groupFit', 'group_fit').toLowerCase()
  if (/excellent|perfect|ideal|great/.test(text)) return 5
  if (/good|strong|solid/.test(text)) return 4
  if (/ok|okay|decent|workable/.test(text)) return 3
  if (/tight|stretch/.test(text)) return 2
  if (/poor|difficult|hard/.test(text)) return 1
  return 3
}

export type VotingColumn = {
  id: string
  name: string
  tier: DestinationTier
  card: CardSnapshot
  personalCost: number | null
  worksForYou: string | null
}

/** One column per destination name — prefer mid tier for display. */
export function columnsForVoting(
  options: Array<{
    id: string
    name: string
    tier: DestinationTier
    card_snapshot: CardSnapshot
    personalCost?: number | null
    worksForYou?: string | null
  }>
): VotingColumn[] {
  const byName = new Map<string, VotingColumn>()
  const tierRank: Record<DestinationTier, number> = { budget: 1, mid: 2, luxury: 0 }

  for (const o of options) {
    const existing = byName.get(o.name)
    const col: VotingColumn = {
      id: o.id,
      name: o.name,
      tier: o.tier,
      card: o.card_snapshot || {},
      personalCost: o.personalCost ?? null,
      worksForYou: o.worksForYou ?? null,
    }
    if (!existing || tierRank[o.tier] > tierRank[existing.tier]) {
      byName.set(o.name, col)
    }
  }

  return [...byName.values()]
}

export function weightedScore(
  col: VotingColumn,
  weights: InterestWeights,
  desireScore: number | undefined
): number {
  const cost = costDollarCount(col.tier, field(col.card, 'cost'))
  const costNorm = (5 - cost) / 4
  const logisticsNorm = Math.min(1, logisticsSummary(col.card).length / 40)
  const weatherNorm = { sun: 1, mixed: 0.7, cloud: 0.5, rain: 0.3, snow: 0.4 }[weatherMood(field(col.card, 'weather'))]
  const actNorm = Math.min(1, activitiesSummary(col.card).length / 2)
  const fitNorm = (desireScore ?? groupFitStarsFromCard(col.card)) / 5

  const w = weightsTotal(weights) || 100
  return (
    (weights.cost / w) * costNorm +
    (weights.gettingThere / w) * logisticsNorm +
    (weights.weather / w) * weatherNorm +
    (weights.activities / w) * actNorm +
    (weights.groupFit / w) * fitNorm
  )
}
