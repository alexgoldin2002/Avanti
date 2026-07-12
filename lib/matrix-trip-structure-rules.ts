import { nightsBetween, parseFlexLengthMinNights } from './group-date-overlap'

export type PaceTier = 'fast' | 'moderate' | 'slow'

type TripShapeAnswers = {
  travelPace?: string
  stops?: string
  stopsOther?: string
  flexLength?: string
  fixedDates?: { start?: string; end?: string }
  dates?: string
  q1?: string
  q3?: string
}

function nightsFromFlexLength(flex: string): number | null {
  if (!flex.trim()) return null
  if (flex.includes('3–4') || flex.includes('3-4')) return 4
  if (flex.includes('5–7') || flex.includes('5-7')) return 6
  if (flex.includes('8–10') || flex.includes('8-10')) return 9
  if (flex.includes('11–14') || flex.includes('11-14')) return 12
  if (/2\+?\s*weeks/i.test(flex)) return 16
  return parseFlexLengthMinNights(flex)
}

function estimateTripNights(answers: TripShapeAnswers): number | null {
  const mode = answers.dates?.trim() || ''
  const flex = answers.flexLength?.trim() || ''
  const { start, end } = answers.fixedDates || {}

  if (mode === 'Fixed dates') {
    if (start && end) {
      const n = nightsBetween(start, end)
      return n > 0 ? n : null
    }
    return null
  }

  if (mode === 'Flexible — I have a range' || mode === 'Completely flexible') {
    return nightsFromFlexLength(flex)
  }

  const flexNights = nightsFromFlexLength(flex)
  if (flexNights != null) return flexNights
  if (start && end) {
    const n = nightsBetween(start, end)
    return n > 0 ? n : null
  }
  return null
}

const FAST_SIGNALS = [
  'fit in as much as possible',
  'see everything',
  'efficient',
  'maximize',
  "don't mind moving around",
  'do not mind moving around',
  "we're go-getters",
  'we are go-getters',
  'packed itinerary',
  'packed',
  'move every',
  'cover as much',
]

const SLOW_SIGNALS = [
  'relaxed',
  'slow travel',
  'not rushed',
  'recharge',
  "don't want to feel like we're rushing",
  'do not want to feel like we are rushing',
  "don't want to rush",
  'soak it in',
  'one place deeply',
  "we're not big planners",
  'we are not big planners',
  'sink in',
  'depth over breadth',
  'no repacking',
]

const MODERATE_SIGNALS = [
  'mix of both',
  'some downtime but want to explore',
  'balanced',
  'flexible',
]

/** Infer pace from free-text (q1, deal-breakers, chat) — defaults to moderate. */
export function inferPaceTier(...texts: Array<string | undefined | null>): PaceTier {
  const combined = texts
    .filter((t): t is string => !!t?.trim())
    .join(' ')
    .toLowerCase()

  if (!combined.trim()) return 'moderate'

  let fast = 0
  let slow = 0
  let moderate = 0

  for (const phrase of FAST_SIGNALS) {
    if (combined.includes(phrase)) fast += 1
  }
  for (const phrase of SLOW_SIGNALS) {
    if (combined.includes(phrase)) slow += 1
  }
  for (const phrase of MODERATE_SIGNALS) {
    if (combined.includes(phrase)) moderate += 1
  }

  if (fast > slow && fast > 0) return 'fast'
  if (slow > fast && slow > 0) return 'slow'
  if (moderate > 0 && fast === 0 && slow === 0) return 'moderate'
  return 'moderate'
}

function normalizeStops(stops?: string, stopsOther?: string): string {
  const raw = (stops === 'Other' ? stopsOther : stops) || ''
  return raw.trim().toLowerCase()
}

/** Base stop-count band from planned trip length (nights). */
export function baseStopRange(nights: number): { min: number; max: number; label: string } {
  const days = nights + 1
  if (days <= 3) return { min: 1, max: 1, label: '1 city' }
  if (days <= 6) return { min: 1, max: 1, label: '1 city (2 only with Tier-1 transit + fast pace)' }
  if (days <= 9) return { min: 2, max: 2, label: '2 cities' }
  if (days <= 13) return { min: 2, max: 2, label: '2 cities or 2 countries' }
  if (days <= 17) return { min: 2, max: 3, label: '2 countries or 3 cities' }
  if (days <= 21) return { min: 3, max: 3, label: '3 stops' }
  return { min: 3, max: 4, label: '4 stops' }
}

export function applyPaceToStopRange(
  range: { min: number; max: number },
  pace: PaceTier,
): { min: number; max: number } {
  const delta = pace === 'fast' ? 1 : pace === 'slow' ? -1 : 0
  return {
    min: Math.max(1, range.min + delta),
    max: Math.max(1, range.max + delta),
  }
}

export function recommendStopCount(
  answers: TripShapeAnswers,
  pace: PaceTier,
): { min: number; max: number; nights: number | null; pace: PaceTier } {
  const nights = estimateTripNights(answers)
  if (nights == null) {
    return { min: 1, max: 2, nights: null, pace }
  }
  const base = baseStopRange(nights)
  const adjusted = applyPaceToStopRange(base, pace)
  return { ...adjusted, nights, pace }
}

/** Whether three-stop routes are practical after pace + length rules. */
export function tripSupportsThreeStops(
  answers: TripShapeAnswers,
  pace?: PaceTier,
  freeTextSources: Array<string | undefined | null> = [],
): boolean {
  if (answers.travelPace === 'one_place') return false
  const stops = normalizeStops(answers.stops, answers.stopsOther)
  if (stops.includes('just one') || stops === '1') return false

  const tier =
    pace ??
    explicitTravelPaceTier(answers.travelPace) ??
    legacyStopsToPaceTier(answers.stops) ??
    inferPaceTier(...freeTextSources)
  const rec = recommendStopCount(answers, tier)
  return rec.max >= 3
}

function explicitTravelPaceTier(travelPace?: string): PaceTier | null {
  if (travelPace === 'pack_it_in') return 'fast'
  if (travelPace === 'one_place') return 'slow'
  if (travelPace === 'balanced') return 'moderate'
  return null
}

function legacyStopsToPaceTier(stops?: string): PaceTier | null {
  if (!stops?.trim()) return null
  const s = stops.trim().toLowerCase()
  if (s.includes('just one') || s === '1') return 'slow'
  if (s.includes('3 stop')) return 'fast'
  if (s.includes('2 stop') || s.includes('open')) return 'moderate'
  return null
}

function travelPaceDisplayLabel(travelPace?: string): string {
  if (travelPace === 'pack_it_in') return 'Pack it in'
  if (travelPace === 'balanced') return 'Balanced'
  if (travelPace === 'one_place') return 'Stay put'
  return ''
}

export const MATRIX_TRIP_STRUCTURE_RULES = `TRIP STRUCTURE RULES

Step 1 — Use explicit travel pace from the form when present (pack it in / balanced / stay put). Otherwise infer from free-text (trip story, deal-breakers, chat).

FAST (pack it in): willing to take early trains, move every 2–3 days, optimize for coverage. Unlock one extra stop vs. default when transit allows.
MODERATE (default): move every 3–4 days, balance exploration with rest. Use the base stop count.
SLOW (sink in): prefer depth over breadth, avoid constant repacking, okay missing places. Subtract one stop vs. default; prioritize saturation over variety.

Fast signals: "fit in as much as possible," "see everything," "don't mind moving around," "packed," "maximize," "efficient," "go-getters"
Slow signals: "relaxed," "slow travel," "not rushed," "soak it in," "recharge," "don't want to rush," "one place deeply"
Moderate signals: "mix of both," "some downtime but want to explore," "balanced," "flexible" — or no pace signals at all

Step 2 — Determine base stop count from trip length (use planned nights/days, not availability window alone).

1–3 days → 1 city
4–6 days → 1 city (2 cities only with Tier-1 transit + fast pace)
7–9 days → 2 cities
10–13 days → 2 cities or 2 countries
14–17 days → 2 countries or 3 cities
18–21 days → 3 stops
22+ days → 4 stops

Step 3 — Apply pace modifier to the base recommendation.

FAST: add one stop if transit efficiency allows
MODERATE: use base as-is
SLOW: subtract one stop; prefer depth in fewer places

Step 4 — Transit efficiency tiers (pairings/triples must respect these).

Tier 1 (train <2.5hrs, minimal jet lag): Tokyo/Kyoto/Osaka, Paris/Amsterdam, Rome/Florence, NYC/Boston/DC, Barcelona/Madrid, London/Edinburgh — viable when days allow
Tier 2 (short flight or long train, ~half day lost): Paris/Barcelona, London/Paris, Tokyo/Hiroshima, Prague/Vienna — viable for 10+ day trips
Tier 3 (full flight, ~full day lost): Italy/Greece, Spain/Morocco, Japan/South Korea — only for 14+ day trips

Step 5 — Continent-scale country rule.

USA, Canada, Australia, China, India, Brazil, Russia → treat as a continent. Never recommend crossing them in one trip. Recommend one city or one region only, regardless of length.

Step 6 — Minimum days per stop.

Each city: at least 2 full days after transit
Each country anchor: at least 3 full days
If a stop cannot meet minimums, remove it — do not over-pack the itinerary

Step 7 — Routing validation.

Stops must form a geographic line or loop. Reject backtracking to a previous city or crossing the same region twice.

When recommending pairings/triples, allocate nights per stop in ROUTING and respect the detected pace tier.`

export function describeTripStructureContext(
  answers: Record<string, unknown>,
  chatSupplement: string,
): string {
  const tripStory = String(answers.q1 || '').trim()
  const dealBreakers = String(answers.q3 || '').trim()
  const pace =
    explicitTravelPaceTier(answers.travelPace as string | undefined) ??
    legacyStopsToPaceTier(answers.stops as string | undefined) ??
    inferPaceTier(tripStory, dealBreakers, chatSupplement)

  const tripShapeAnswers = {
    travelPace: answers.travelPace as string | undefined,
    stops: answers.stops as string | undefined,
    stopsOther: answers.stopsOther as string | undefined,
    flexLength: answers.flexLength as string | undefined,
    fixedDates: answers.fixedDates as { start?: string; end?: string } | undefined,
    dates: answers.dates as string | undefined,
    q1: tripStory,
    q3: dealBreakers,
  }

  const rec = recommendStopCount(tripShapeAnswers, pace)
  const nightsLine =
    rec.nights != null
      ? `${rec.nights} nights (~${rec.nights + 1} days planned)`
      : 'length not pinned yet'

  const paceLabel =
    pace === 'fast'
      ? 'FAST — pack it in; may add one stop when transit allows'
      : pace === 'slow'
        ? 'SLOW — stay put; prefer fewer stops and more depth'
        : 'MODERATE — balanced pace'

  const explicitPace = travelPaceDisplayLabel(answers.travelPace as string | undefined)

  return `Travel pace: ${explicitPace || paceLabel}
Recommended stop count for this trip: ${rec.min}${rec.min !== rec.max ? `–${rec.max}` : ''} stops (${nightsLine})

${MATRIX_TRIP_STRUCTURE_RULES}`
}
