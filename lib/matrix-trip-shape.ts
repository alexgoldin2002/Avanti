import { nightsBetween, parseFlexLengthMinNights } from './group-date-overlap'
import {
  recommendStopCount,
  tripSupportsThreeStops,
  type PaceTier,
} from './matrix-trip-structure-rules'
import {
  legacyStopsToTravelPace,
  prefersOnePlaceBase,
  resolveTravelPace,
  travelPaceLabel,
  travelPacePromptLine,
  type TravelPacePreferenceId,
} from './travel-pace-preference'

export type MatrixTabId = 'singles' | 'pairings' | 'triples'

export type TripShapeAnswers = {
  travelPace?: string
  /** @deprecated Legacy — migrated to travelPace */
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

/**
 * Planned trip length in nights — not the availability window.
 * Fixed dates = full span; flexible range = preferred length chip (e.g. 11–14 nights).
 */
export function estimateTripNights(answers: TripShapeAnswers): number | null {
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

/** Minimum nights to support three ~week-long bases without feeling rushed. */
export const MIN_NIGHTS_FOR_THREE_STOPS = 21

/** Show and generate three-stop routes when dates + travel pace make them practical. */
export function shouldIncludeTripleRoutes(
  answers: TripShapeAnswers,
  opts?: { q1?: string; q3?: string; chatSupplement?: string },
): boolean {
  return tripSupportsThreeStops(
    answers,
    resolveTravelPace(
      { travelPace: answers.travelPace, stops: answers.stops, q1: opts?.q1 ?? answers.q1, q3: opts?.q3 ?? answers.q3 },
      opts?.chatSupplement,
    ),
    [opts?.q1 ?? answers.q1, opts?.q3 ?? answers.q3, opts?.chatSupplement],
  )
}

/** Which itinerary-shape tabs to show in the matrix UI. */
export function resolveMatrixTabs(
  answers: TripShapeAnswers,
  opts?: { hasPairings?: boolean; hasTriples?: boolean },
): { tabs: MatrixTabId[]; defaultTab: MatrixTabId; nights: number | null; pace: PaceTier } {
  const pace = resolveTravelPace(answers)
  const rec = recommendStopCount(answers, pace)
  const nights = rec.nights ?? estimateTripNights(answers)
  const triplesFeasible = shouldIncludeTripleRoutes(answers, { q1: answers.q1, q3: answers.q3 })
  const onePlace = prefersOnePlaceBase(answers)

  const tabs: MatrixTabId[] = ['singles']

  const showPairings =
    !!opts?.hasPairings && !onePlace && rec.max >= 2 && (nights == null || nights >= 5)

  const showTriples =
    !!opts?.hasTriples && triplesFeasible && rec.max >= 3 && !onePlace && pace !== 'slow'

  if (showPairings) tabs.push('pairings')
  if (showTriples) tabs.push('triples')

  let defaultTab: MatrixTabId = 'singles'
  if (onePlace || rec.max <= 1) {
    defaultTab = 'singles'
  } else if (showTriples && pace === 'fast' && rec.max >= 3) {
    defaultTab = 'triples'
  } else if (showPairings && rec.max >= 2) {
    defaultTab = 'pairings'
  } else if (showTriples) {
    defaultTab = 'triples'
  } else if (showPairings) {
    defaultTab = 'pairings'
  }

  return { tabs, defaultTab, nights, pace }
}

/** Ignore AI triple recommendation when three-stop routes are not feasible. */
export function coerceMatrixRecommendedTab(
  tab: MatrixTabId | null | undefined,
  answers: TripShapeAnswers,
): MatrixTabId | null {
  if (!tab) return null
  if (tab === 'triples' && !shouldIncludeTripleRoutes(answers, { q1: answers.q1, q3: answers.q3 })) {
    return null
  }
  const rec = recommendStopCount(answers, resolveTravelPace(answers))
  if (tab === 'triples' && rec.max < 3) return null
  if (tab === 'pairings' && rec.max < 2) return null
  if (prefersOnePlaceBase(answers) && tab !== 'singles') return null
  return tab
}

/** Hint for the AI about which combo sections to generate. */
export function describeTripShapeHint(
  answers: TripShapeAnswers,
  opts?: { q1?: string; q3?: string; chatSupplement?: string },
): string {
  const nights = estimateTripNights(answers)
  const mode = answers.dates?.trim() || ''
  const flex = answers.flexLength?.trim() || ''
  const { start, end } = answers.fixedDates || {}
  const pace = resolveTravelPace(
    {
      travelPace: answers.travelPace,
      stops: answers.stops,
      q1: opts?.q1,
      q3: opts?.q3,
    },
    opts?.chatSupplement,
  )
  const stopRec = recommendStopCount(answers, pace)
  const paceLine = travelPaceLabel(answers.travelPace) || 'not specified'
  const triplesFeasible = shouldIncludeTripleRoutes(answers, opts)
  const paceGuidance = travelPacePromptLine(answers.travelPace)

  let nightsLine: string
  if (mode === 'Flexible — I have a range' && flex) {
    const window =
      start && end ? ` (availability window ${start} to ${end}, not trip length)` : ''
    nightsLine = `${flex} preferred${window}`
  } else if (nights != null) {
    nightsLine = `${nights} nights (~${nights + 1} days)`
  } else {
    nightsLine = 'length not pinned yet'
  }

  let guidance = `${paceGuidance} Target ${stopRec.min}${stopRec.min !== stopRec.max ? `–${stopRec.max}` : ''} stops for this trip length.`

  if (prefersOnePlaceBase(answers)) {
    guidance +=
      ' Strongly favor single-city MATRIX rows; omit PAIRINGS/TRIPLES unless dates clearly support a second base without rushing.'
  } else if (triplesFeasible) {
    guidance +=
      ' Include PAIRINGS (two cities). Include TRIPLES only when dates comfortably fit three bases.'
  } else {
    guidance += ' Include PAIRINGS when dates fit two bases. Omit TRIPLES when the trip is too short for three bases.'
  }

  return `Trip length: ${nightsLine}. Travel pace: ${paceLine} (${pace}). ${guidance}`
}

/** Explicit TRIPLES instruction injected into matrix generation tasks. */
export function triplesGenerationTaskLine(
  answers: TripShapeAnswers,
  opts?: { q1?: string; q3?: string; chatSupplement?: string },
): string {
  if (!shouldIncludeTripleRoutes(answers, opts)) {
    return 'Do NOT include a TRIPLES section — their travel pace and trip length do not support three bases.'
  }
  const nights = estimateTripNights(answers)
  const nightsBit = nights != null ? ` (${nights} nights planned)` : ''
  return `REQUIRED: Include a TRIPLES section with up to 3 ranked three-stop routes${nightsBit}. Choose routes that match their travel pace and dates — do not only mention three stops in RECOMMENDED_SHAPE without a TRIPLES section.`
}

export function matrixTabLabel(tab: MatrixTabId, pace?: PaceTier): string {
  if (tab === 'singles') return 'One city'
  if (tab === 'pairings') {
    return pace === 'slow' ? 'Two stops (relaxed)' : 'Two stops'
  }
  return pace === 'fast' ? 'Three stops (packed)' : 'Three stops'
}

/** Match a combo place string to a matrix row name for voting. */
export function matchPlaceToRowName(place: string, rowNames: string[]): string | null {
  const p = place.trim().toLowerCase()
  if (!p) return null
  const exact = rowNames.find(r => r.trim().toLowerCase() === p)
  if (exact) return exact
  const partial = rowNames.find(r => {
    const rLower = r.trim().toLowerCase()
    return rLower.includes(p) || p.includes(rLower)
  })
  return partial || null
}
