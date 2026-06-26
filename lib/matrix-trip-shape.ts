import { nightsBetween, parseFlexLengthMinNights } from './group-date-overlap'

export type MatrixTabId = 'singles' | 'pairings' | 'triples'

type TripShapeAnswers = {
  stops?: string
  stopsOther?: string
  flexLength?: string
  fixedDates?: { start?: string; end?: string }
  dates?: string
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

function normalizeStops(stops?: string, stopsOther?: string): string {
  const raw = (stops === 'Other' ? stopsOther : stops) || ''
  return raw.trim().toLowerCase()
}

/** Minimum nights to support three ~week-long bases without feeling rushed. */
export const MIN_NIGHTS_FOR_THREE_STOPS = 21

/** True only when the host picked "3 stops" on Step 2. */
export function hostWantsThreeStops(answers: TripShapeAnswers): boolean {
  return answers.stops === '3 stops'
}

/** Long enough for three bases, excluding one-stop-only trips. */
export function tripFeasibleForThreeStops(answers: TripShapeAnswers): boolean {
  const stops = normalizeStops(answers.stops, answers.stopsOther)
  if (stops.includes('just one') || stops === '1') return false

  const flex = answers.flexLength || ''
  if (/2\+?\s*weeks/i.test(flex)) return true

  const nights = estimateTripNights(answers)
  if (nights != null) return nights >= MIN_NIGHTS_FOR_THREE_STOPS

  return false
}

/** Show and generate three-stop routes when explicitly chosen or dates make them practical. */
export function shouldIncludeTripleRoutes(answers: TripShapeAnswers): boolean {
  return hostWantsThreeStops(answers) || tripFeasibleForThreeStops(answers)
}

/** Which itinerary-shape tabs to show in the matrix UI. */
export function resolveMatrixTabs(
  answers: TripShapeAnswers,
  opts?: { hasPairings?: boolean; hasTriples?: boolean },
): { tabs: MatrixTabId[]; defaultTab: MatrixTabId; nights: number | null } {
  const nights = estimateTripNights(answers)
  const stops = normalizeStops(answers.stops, answers.stopsOther)
  const includeTriples = shouldIncludeTripleRoutes(answers)

  const tabs: MatrixTabId[] = ['singles']

  const wantsOne = stops.includes('just one') || stops === '1'
  const wantsTwo = stops.includes('2 stop')
  const wantsThree = hostWantsThreeStops(answers)
  const open = stops.includes('open')

  const showPairings =
    !!opts?.hasPairings &&
    !wantsOne &&
    (wantsTwo || wantsThree || open || nights == null || nights >= 5)

  const showTriples = includeTriples

  if (showPairings) tabs.push('pairings')
  if (showTriples) tabs.push('triples')

  let defaultTab: MatrixTabId = 'singles'
  if (wantsOne) {
    defaultTab = 'singles'
  } else if (wantsThree && showTriples) {
    defaultTab = 'triples'
  } else if (wantsTwo && showPairings) {
    defaultTab = 'pairings'
  } else if (nights != null) {
    if (nights <= 5) defaultTab = 'singles'
    else if (showTriples && nights >= MIN_NIGHTS_FOR_THREE_STOPS && (open || wantsThree)) {
      defaultTab = 'triples'
    } else if (showPairings) defaultTab = 'pairings'
  } else if (showPairings) {
    defaultTab = 'pairings'
  }

  return { tabs, defaultTab, nights }
}

/** Ignore AI triple recommendation when three-stop routes are not feasible. */
export function coerceMatrixRecommendedTab(
  tab: MatrixTabId | null | undefined,
  answers: TripShapeAnswers,
): MatrixTabId | null {
  if (!tab) return null
  if (tab === 'triples' && !shouldIncludeTripleRoutes(answers)) return null
  return tab
}

/** Hint for the AI about which combo sections to generate. */
export function describeTripShapeHint(answers: TripShapeAnswers): string {
  const nights = estimateTripNights(answers)
  const stops = normalizeStops(answers.stops, answers.stopsOther)
  const mode = answers.dates?.trim() || ''
  const flex = answers.flexLength?.trim() || ''
  const { start, end } = answers.fixedDates || {}

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

  let guidance =
    'Infer the best stop count from their dates and trip shape preference. Short trips (≤5 nights) favor one base; ~6–9 nights often suit two stops.'

  const triplesFeasible =
    shouldIncludeTripleRoutes(answers) &&
    (nights == null || nights >= MIN_NIGHTS_FOR_THREE_STOPS || hostWantsThreeStops(answers))

  if (stops.includes('just one')) {
    guidance = 'They prefer one base — lean single-destination; pairings only if helpful context.'
  } else if (stops.includes('2 stop')) {
    guidance = triplesFeasible
      ? 'They want two stops — prioritize ranked PAIRINGS, but also include a TRIPLES section if dates comfortably fit three ~week-long bases.'
      : 'They want two stops — prioritize ranked PAIRINGS and recommend a pairing tab if dates fit.'
  } else if (stops.includes('3 stop')) {
    guidance = 'They chose three stops — include a TRIPLES section with up to 3 ranked three-stop routes.'
  } else if (stops.includes('open')) {
    guidance = triplesFeasible
      ? 'They are open on stop count — decide from dates and geography. Short trips favor one base; ~6–14 nights often suit two stops; ~21+ nights can support three bases — include TRIPLES when dates allow.'
      : 'They are open on stop count — decide from dates and geography. A ~week trip often works best as two stops; shorter favors one. Omit TRIPLES when the trip is too short for three bases.'
  } else if (triplesFeasible) {
    guidance += ` ~${nights ?? MIN_NIGHTS_FOR_THREE_STOPS}+ nights can support three bases — include a TRIPLES section with up to 3 ranked routes.`
  } else {
    guidance += ' Omit TRIPLES when the trip is too short for three bases.'
  }

  return `Trip length: ${nightsLine}. Stops preference: ${answers.stops || 'not specified'}${answers.stops === 'Other' && answers.stopsOther ? ` (${answers.stopsOther})` : ''}. ${guidance}`
}

/** Explicit TRIPLES instruction injected into matrix generation tasks. */
export function triplesGenerationTaskLine(answers: TripShapeAnswers): string {
  if (!shouldIncludeTripleRoutes(answers)) {
    return 'Do NOT include a TRIPLES section — the planned trip length is too short for three bases.'
  }
  const nights = estimateTripNights(answers)
  const nightsBit = nights != null ? ` (${nights} nights planned)` : ''
  return `REQUIRED: Include a TRIPLES section with up to 3 ranked three-stop routes${nightsBit}. When three bases fit the dates, list concrete routes here — do not only mention three stops in RECOMMENDED_SHAPE without a TRIPLES section.`
}

export function matrixTabLabel(tab: MatrixTabId): string {
  if (tab === 'singles') return 'One stop'
  if (tab === 'pairings') return 'Pairings'
  return 'Three stops'
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
