import { inferPaceTier, type PaceTier } from './matrix-trip-structure-rules'

export type TravelPacePreferenceId = 'pack_it_in' | 'balanced' | 'one_place'

export const TRAVEL_PACE_OPTIONS: {
  id: TravelPacePreferenceId
  label: string
  description: string
}[] = [
  {
    id: 'pack_it_in',
    label: 'Pack it in',
    description: 'Fit in as much as I can — happy to move every few days if it means seeing more.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'See a good amount without living out of a suitcase — some travel, plenty of downtime.',
  },
  {
    id: 'one_place',
    label: 'Stay put',
    description: 'Sink into one place — minimize travel days, repacking, and constant hotel changes.',
  },
]

const LEGACY_STOP_OPTIONS = ['Just one', '2 stops', '3 stops', 'Open to anything', 'Other'] as const

export function isTravelPacePreference(value: unknown): value is TravelPacePreferenceId {
  return value === 'pack_it_in' || value === 'balanced' || value === 'one_place'
}

export function travelPaceToTier(id: TravelPacePreferenceId): PaceTier {
  if (id === 'pack_it_in') return 'fast'
  if (id === 'one_place') return 'slow'
  return 'moderate'
}

export function travelPaceLabel(id: string | undefined): string {
  return TRAVEL_PACE_OPTIONS.find(o => o.id === id)?.label ?? ''
}

export function travelPaceDescription(id: string | undefined): string {
  return TRAVEL_PACE_OPTIONS.find(o => o.id === id)?.description ?? ''
}

/** Map old "how many stops" answers to the new pace preference. */
export function legacyStopsToTravelPace(stops?: string): TravelPacePreferenceId | undefined {
  if (!stops?.trim()) return undefined
  const s = stops.trim().toLowerCase()
  if (s.includes('just one') || s === '1') return 'one_place'
  if (s.includes('3 stop')) return 'pack_it_in'
  if (s.includes('2 stop') || s.includes('open')) return 'balanced'
  return undefined
}

export function isLegacyStopOption(stops: string): boolean {
  return (LEGACY_STOP_OPTIONS as readonly string[]).includes(stops)
}

/** Explicit form choice wins; then legacy stops; then free-text inference. */
export function resolveTravelPace(
  answers: {
    travelPace?: string
    stops?: string
    q1?: string
    q3?: string
  },
  chatSupplement?: string,
): PaceTier {
  if (isTravelPacePreference(answers.travelPace)) {
    return travelPaceToTier(answers.travelPace)
  }
  const legacy = legacyStopsToTravelPace(answers.stops)
  if (legacy) return travelPaceToTier(legacy)
  return inferPaceTier(answers.q1, answers.q3, chatSupplement)
}

export function prefersOnePlaceBase(answers: { travelPace?: string; stops?: string }): boolean {
  if (answers.travelPace === 'one_place') return true
  const legacy = legacyStopsToTravelPace(answers.stops)
  return legacy === 'one_place'
}

export function travelPacePromptLine(id: string | undefined): string {
  if (!isTravelPacePreference(id)) {
    return 'Travel pace not specified — infer stop count from trip length and their story.'
  }
  if (id === 'pack_it_in') {
    return 'They want to pack the trip in — cover more ground and accept moving every few days. You choose the right number of stops from their dates.'
  }
  if (id === 'one_place') {
    return 'They want to stay put — prioritize one deep base; only suggest multi-stop routes if dates clearly support it without rushing.'
  }
  return 'They want a balance — see a good amount without constant moving. You choose the right number of stops from their dates.'
}
