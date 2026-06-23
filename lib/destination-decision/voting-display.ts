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
  const range = parseCostRange(costText, tier)
  return Math.round((range.tierLow + range.tierHigh) / 2)
}

export type CostRangeDisplay = {
  tierLow: number
  tierHigh: number
  symbolLow: string
  symbolHigh: string
  usdLow: number | null
  usdHigh: number | null
  usdLabel: string | null
}

function usdToAffordabilityTier(usd: number): number {
  if (usd < 1800) return 1
  if (usd < 3200) return 2
  if (usd < 5200) return 3
  return 4
}

function tierSymbols(tier: number): string {
  return '$'.repeat(Math.max(1, Math.min(4, tier)))
}

function parseUsdAmounts(text: string): number[] {
  return [...text.matchAll(/\$\s*([\d,]+)/g)]
    .map(m => parseInt(m[1].replace(/,/g, ''), 10))
    .filter(n => n > 0)
}

/** Ignore daily/nightly line items — only all-in trip totals count. */
const MIN_TRIP_TOTAL_USD = 250

function parseUsdRangeOnLine(line: string): number[] {
  const amounts = parseUsdAmounts(line)
  const bareRange = line.match(/\$\s*([\d,]+)\s*[–-]\s*([\d,]+)/)
  if (bareRange) {
    amounts.push(parseInt(bareRange[1].replace(/,/g, ''), 10))
    amounts.push(parseInt(bareRange[2].replace(/,/g, ''), 10))
  }
  return [...new Set(amounts.filter(n => n >= MIN_TRIP_TOTAL_USD))]
}

/** Card COST field: first line is ~$X,XXX–X,XXX/person total; bullets are daily breakdown. */
function parseTripTotalFromCard(costText: string): number[] {
  const lines = costText.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []

  const fromFirst = parseUsdRangeOnLine(lines[0])
  if (fromFirst.length) return fromFirst

  for (const line of lines) {
    if (/\/\s*(day|night|nt)\b|per\s+(day|night)|\/night|\/day/i.test(line)) continue
    if (!/total|per person|\/person|all-in|estimate|~\$/i.test(line)) continue
    const found = parseUsdRangeOnLine(line)
    if (found.length) return found
  }

  return []
}

export function parseCostRange(
  costText: string,
  tier: DestinationTier,
  personalCost?: number | null,
  groupAvgCost?: number | null
): CostRangeDisplay {
  const amounts: number[] = []

  if (groupAvgCost && groupAvgCost >= MIN_TRIP_TOTAL_USD) {
    amounts.push(Math.round(groupAvgCost))
  }
  if (personalCost && personalCost >= MIN_TRIP_TOTAL_USD) {
    amounts.push(Math.round(personalCost))
  }

  amounts.push(...parseTripTotalFromCard(costText))

  const tripTotals = [...new Set(amounts.filter(n => n >= MIN_TRIP_TOTAL_USD))]

  let usdLow: number | null = null
  let usdHigh: number | null = null

  if (tripTotals.length >= 2) {
    usdLow = Math.min(...tripTotals)
    usdHigh = Math.max(...tripTotals)
  } else if (tripTotals.length === 1) {
    usdLow = tripTotals[0]
    usdHigh = Math.round(tripTotals[0] * 1.12)
  }

  let tierLow: number
  let tierHigh: number

  if (usdLow != null && usdHigh != null) {
    tierLow = usdToAffordabilityTier(usdLow)
    tierHigh = usdToAffordabilityTier(usdHigh)
    if (tierHigh < tierLow) tierHigh = tierLow
  } else {
    const fallback = tier === 'budget' ? 2 : tier === 'luxury' ? 4 : 3
    tierLow = fallback
    tierHigh = fallback
  }

  const fmt = (n: number) => `$${n.toLocaleString()}`
  const usdLabel =
    usdLow != null && usdHigh != null
      ? usdLow === usdHigh
        ? `${fmt(usdLow)}/person`
        : `${fmt(usdLow)} – ${fmt(usdHigh)}`
      : null

  return {
    tierLow,
    tierHigh,
    symbolLow: tierSymbols(tierLow),
    symbolHigh: tierSymbols(tierHigh),
    usdLow,
    usdHigh,
    usdLabel,
  }
}

export type WeatherMood = 'sun' | 'cloud' | 'rain' | 'snow' | 'wind' | 'mixed'

export function weatherMood(text: string): WeatherMood {
  const t = text.toLowerCase()
  if (/wind|windy|gust|breezy/.test(t)) return 'wind'
  if (/snow|cold|freezing|winter|blizzard/.test(t)) return 'snow'
  if (/rain|storm|hurricane|monsoon|wet|shower/.test(t)) return 'rain'
  if (/sun|warm|dry|clear|sunny/.test(t) && /cloud|overcast|mixed/.test(t)) return 'mixed'
  if (/sun|warm|dry|clear|sunny/.test(t)) return 'sun'
  if (/cloud|overcast|mild/.test(t)) return 'cloud'
  return 'mixed'
}

export function weatherEmoji(mood: WeatherMood): string {
  switch (mood) {
    case 'sun':
      return '☀️'
    case 'rain':
      return '🌧️'
    case 'snow':
      return '❄️'
    case 'wind':
      return '💨'
    case 'cloud':
      return '☁️'
    default:
      return '⛅'
  }
}

/** Average daytime °F parsed from card weather bullets. */
export function parseDaytimeTempF(text: string): number | null {
  if (!text.trim()) return null

  const explicit = [...text.matchAll(/(?:avg|average|daytime|highs?|around|~)\s*(\d{2,3})\s*°?\s*F/gi)]
  if (explicit.length) {
    const temps = explicit.map(m => parseInt(m[1], 10))
    return Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)
  }

  const allF = [...text.matchAll(/(\d{2,3})\s*°?\s*F/gi)].map(m => parseInt(m[1], 10))
  if (allF.length) {
    return Math.round(allF.reduce((a, b) => a + b, 0) / allF.length)
  }

  const range = text.match(/(\d{2,3})\s*[-–]\s*(\d{2,3})/)
  if (range) {
    return Math.round((parseInt(range[1], 10) + parseInt(range[2], 10)) / 2)
  }

  return null
}

export type WeatherDisplay = {
  mood: WeatherMood
  emoji: string
  tempF: number | null
  tempLabel: string | null
}

export function parseWeatherDisplay(text: string): WeatherDisplay {
  const mood = weatherMood(text)
  const tempF = parseDaytimeTempF(text)
  return {
    mood,
    emoji: weatherEmoji(mood),
    tempF,
    tempLabel: tempF != null ? `${tempF}°F avg` : null,
  }
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

export type GroupFitDisplay = {
  /** Stars from post-analysis budget/feasibility check (group_fit_yes / total). */
  avantiStars: number
  membersYes: number | null
  membersTotal: number | null
  cardSnippet: string
  worksForYou: string | null
}

export function parseGroupFitDisplay(
  card: CardSnapshot,
  groupSummary: CardSnapshot,
  worksForYou: string | null
): GroupFitDisplay {
  const yes = Number(groupSummary.group_fit_yes)
  const total = Number(groupSummary.group_fit_total)
  const cardSnippet = bullets(field(card, 'groupFit', 'group_fit'), 1)[0] || ''

  let avantiStars = groupFitStarsFromCard(card)
  if (Number.isFinite(yes) && Number.isFinite(total) && total > 0) {
    avantiStars = Math.max(1, Math.min(5, Math.round((yes / total) * 5)))
  }

  return {
    avantiStars,
    membersYes: Number.isFinite(yes) ? yes : null,
    membersTotal: Number.isFinite(total) ? total : null,
    cardSnippet,
    worksForYou,
  }
}

export type VotingColumn = {
  id: string
  name: string
  tier: DestinationTier
  card: CardSnapshot
  groupSummary: CardSnapshot
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
    group_summary?: CardSnapshot
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
      groupSummary: o.group_summary || {},
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
  const cost = parseCostRange(
    field(col.card, 'cost'),
    col.tier,
    col.personalCost,
    Number(col.groupSummary.avg_cost) || null
  )
  const costNorm = (5 - (cost.tierLow + cost.tierHigh) / 2) / 4
  const weather = parseWeatherDisplay(field(col.card, 'weather'))
  const weatherNorm = { sun: 1, mixed: 0.7, cloud: 0.5, rain: 0.3, snow: 0.4, wind: 0.55 }[weather.mood]
  const logisticsNorm = Math.min(1, logisticsSummary(col.card).length / 40)
  const actNorm = Math.min(1, activitiesSummary(col.card).length / 2)
  const fit = parseGroupFitDisplay(col.card, col.groupSummary, col.worksForYou)
  const fitNorm = (desireScore ?? fit.avantiStars) / 5

  const w = weightsTotal(weights) || 100
  return (
    (weights.cost / w) * costNorm +
    (weights.gettingThere / w) * logisticsNorm +
    (weights.weather / w) * weatherNorm +
    (weights.activities / w) * actNorm +
    (weights.groupFit / w) * fitNorm
  )
}
