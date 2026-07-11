import type { DestinationMatrixCombo, DestinationMatrixRow } from '@/lib/parse-destination-matrix'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import type { DestinationPlanningPath } from '@/lib/step2/planning-path'
import type { MatrixTabId } from '@/lib/matrix-trip-shape'
import { safeNextPath } from '@/lib/auth/oauth'

const ANSWERS_KEY = 'avanti_preview_answers'
const CARDS_KEY = 'avanti_preview_cards'
const META_KEY = 'avanti_preview_meta'
const PENDING_SHARE_KEY = 'avanti_preview_pending_share'

const PREVIEW_STORAGE_KEYS = [ANSWERS_KEY, CARDS_KEY, META_KEY, PENDING_SHARE_KEY]

let legacyLocalPreviewPurged = false

/** Drop old localStorage preview data — anonymous try-it should not persist across visits. */
function purgeLegacyLocalPreviewStorage() {
  if (typeof window === 'undefined' || legacyLocalPreviewPurged) return
  legacyLocalPreviewPurged = true
  for (const key of PREVIEW_STORAGE_KEYS) {
    localStorage.removeItem(key)
  }
}

export type PreviewTripMeta = {
  planningPath?: DestinationPlanningPath
  consideringList?: string[]
  knownDestination?: string
  knownDates?: {
    mode: string
    fixedDates: { start: string; end: string }
    flexLength: string
  }
  matrixRows?: DestinationMatrixRow[]
  matrixPairings?: DestinationMatrixCombo[]
  matrixTriples?: DestinationMatrixCombo[]
  matrixSummary?: string
  matrixRecommendedTab?: MatrixTabId | null
  matrixRecommendedShape?: string
}

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  purgeLegacyLocalPreviewStorage()
  return sessionStorage.getItem(key)
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') return
  purgeLegacyLocalPreviewStorage()
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // ignore quota errors
  }
}

function removeStorage(key: string) {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(key)
  localStorage.removeItem(key)
}

export function savePreviewTrip(
  answers: Record<string, unknown>,
  cards: ParsedDestinationCard[],
  meta?: PreviewTripMeta,
) {
  writeStorage(ANSWERS_KEY, JSON.stringify(answers))
  writeStorage(CARDS_KEY, JSON.stringify(cards))
  if (meta) {
    writeStorage(META_KEY, JSON.stringify(meta))
  }
}

export function loadPreviewTrip(): {
  answers: Record<string, unknown> | null
  cards: ParsedDestinationCard[] | null
  meta: PreviewTripMeta | null
} {
  if (typeof window === 'undefined') return { answers: null, cards: null, meta: null }
  try {
    const answersRaw = readStorage(ANSWERS_KEY)
    const cardsRaw = readStorage(CARDS_KEY)
    const metaRaw = readStorage(META_KEY)
    return {
      answers: answersRaw ? JSON.parse(answersRaw) : null,
      cards: cardsRaw ? JSON.parse(cardsRaw) : null,
      meta: metaRaw ? JSON.parse(metaRaw) : null,
    }
  } catch {
    return { answers: null, cards: null, meta: null }
  }
}

export function hasPreviewTrip(): boolean {
  const { answers, cards, meta } = loadPreviewTrip()
  const hasMatrix = (meta?.matrixRows?.length ?? 0) > 0
  const hasCards = Array.isArray(cards) && cards.length > 0
  const hasKnown = meta?.planningPath === 'known' && Boolean(meta?.knownDestination?.trim())
  return Boolean(answers?.q1 && (hasMatrix || hasCards || hasKnown))
}

export function hasPreviewAnswers(): boolean {
  const { answers } = loadPreviewTrip()
  return Boolean(answers?.q1)
}

export function markPendingShare() {
  writeStorage(PENDING_SHARE_KEY, '1')
}

export function isPendingShare(): boolean {
  return readStorage(PENDING_SHARE_KEY) === '1'
}

export function clearPendingShare() {
  removeStorage(PENDING_SHARE_KEY)
}

/** Where to send the user right after auth. */
export function getPostAuthPath(profileComplete: boolean): string {
  if (!profileComplete) return '/profile'
  if (isPendingShare()) return '/dashboard?share=1'
  return '/dashboard'
}

/**
 * Post-auth destination that honors a `next` deep link (the page the visitor
 * originally tried to open). Falls back to the default landing when `next` is
 * missing/unsafe. Users must still complete their profile first.
 */
export function resolvePostAuthPath(profileComplete: boolean, next?: string | null): string {
  if (!profileComplete) return '/profile'
  const safe = safeNextPath(next)
  if (safe) return safe
  return getPostAuthPath(profileComplete)
}

export function clearPreviewTrip() {
  removeStorage(ANSWERS_KEY)
  removeStorage(CARDS_KEY)
  removeStorage(META_KEY)
  clearPendingShare()
}

const STOP_OPTIONS = ['Just one', '2 stops', '3 stops', 'Open to anything', 'Other']

/** Shape stored on travelers.step2 — matches step 2 saveProgress. */
export function buildStep2FromPreviewAnswers(
  answers: Record<string, unknown>,
  meta?: PreviewTripMeta | null,
) {
  const step2: Record<string, unknown> = {
    q1: String(answers.q1 || ''),
    departureCity: String(answers.departureCity || ''),
    departureCities: Array.isArray(answers.departureCities) ? answers.departureCities : [],
    dates: String(answers.dates || ''),
    fixedDates: (answers.fixedDates as { start: string; end: string }) || { start: '', end: '' },
    flexLength: String(answers.flexLength || ''),
    domestic: String(answers.domestic || ''),
    regions: Array.isArray(answers.regions) ? answers.regions : [],
    stops: String(answers.stops || ''),
    stopsOther: String(answers.stopsOther || ''),
    activities: Array.isArray(answers.activities) ? answers.activities : [],
    vibe: Array.isArray(answers.vibe) ? answers.vibe : [],
    accommodation: String(answers.accommodation || ''),
    budget: String(answers.budget || ''),
    popularity: String(answers.popularity || ''),
    q3: String(answers.q3 || ''),
    stage: 'done',
    chatMessages: [] as { role: 'user' | 'assistant'; content: string }[],
  }

  if (meta?.consideringList?.length) {
    step2.consideringList = meta.consideringList
  }
  if (meta?.matrixRows?.length) {
    step2.matrix = meta.matrixRows
    step2.matrixPairings = meta.matrixPairings ?? []
    step2.matrixTriples = meta.matrixTriples ?? []
    step2.matrixSummary = meta.matrixSummary ?? ''
    step2.matrixRecommendedTab = meta.matrixRecommendedTab ?? null
    step2.matrixRecommendedShape = meta.matrixRecommendedShape ?? ''
  }

  if (meta?.knownDestination) {
    step2.knownDestination = meta.knownDestination
  }
  if (meta?.knownDates) {
    step2.knownDates = meta.knownDates
  }

  return step2
}

export function inferTripNameFromPreview(q1: string): string {
  const first = q1.split('\n')[0]?.trim() || 'Our trip'
  if (first.length <= 60) return first
  return `${first.slice(0, 57)}...`
}

export function inferTripTypeFromPreview(q1: string): string {
  const t = q1.toLowerCase()
  if (t.includes('bachelorette')) return 'Bachelorette'
  if (t.includes('bachelor')) return 'Bachelor'
  if (t.includes('birthday')) return 'Birthday trip'
  if (t.includes('girls trip') || t.includes('girls\' trip')) return 'Girls trip'
  if (t.includes('boys trip') || t.includes('guys trip')) return 'Boys trip'
  if (t.includes('family')) return 'Family'
  if (t.includes('honeymoon')) return 'Honeymoon'
  if (t.includes('graduation')) return 'Vacation'
  if (t.includes('reunion')) return 'Vacation'
  return 'Vacation'
}

export function getCreateFormDefaultsFromPreview(answers: Record<string, unknown>) {
  const q1 = String(answers.q1 || '')
  const fixedDates = (answers.fixedDates as { start: string; end: string }) || { start: '', end: '' }
  const dates = String(answers.dates || '')
  const flexLength = String(answers.flexLength || '')

  const defaults: {
    name: string
    trip_type: string
    destination_type: 'open' | 'set'
    destination: string
    date_type: 'exact' | 'flexible'
    start_date: string
    end_date: string
    date_range_start: string
    date_range_end: string
    date_flexibility_nights: number
  } = {
    name: inferTripNameFromPreview(q1),
    trip_type: inferTripTypeFromPreview(q1),
    destination_type: 'open',
    destination: '',
    date_type: 'exact',
    start_date: '',
    end_date: '',
    date_range_start: '',
    date_range_end: '',
    date_flexibility_nights: 5,
  }

  if (dates === 'Fixed dates' && fixedDates.start && fixedDates.end) {
    defaults.date_type = 'exact'
    defaults.start_date = fixedDates.start
    defaults.end_date = fixedDates.end
  } else if (dates === 'Flexible — I have a range' && fixedDates.start && fixedDates.end) {
    defaults.date_type = 'flexible'
    defaults.date_range_start = fixedDates.start
    defaults.date_range_end = fixedDates.end
    const nightMatch = flexLength.match(/(\d+)/)
    if (nightMatch) defaults.date_flexibility_nights = Number(nightMatch[1])
  }

  return defaults
}

export function getCreateFormDefaultsFromPreviewWithMeta(
  answers: Record<string, unknown>,
  meta?: PreviewTripMeta | null,
) {
  const defaults = getCreateFormDefaultsFromPreview(answers)
  if (meta?.planningPath === 'known' && meta.knownDestination) {
    defaults.destination_type = 'set'
    defaults.destination = meta.knownDestination
    if (meta.knownDates?.mode === 'Fixed dates' && meta.knownDates.fixedDates.start) {
      defaults.date_type = 'exact'
      defaults.start_date = meta.knownDates.fixedDates.start
      defaults.end_date = meta.knownDates.fixedDates.end
    } else if (meta.knownDates?.mode === 'Flexible — I have a range') {
      defaults.date_type = 'flexible'
      defaults.date_range_start = meta.knownDates.fixedDates.start
      defaults.date_range_end = meta.knownDates.fixedDates.end
    }
  }
  return defaults
}

export const TRIP_REGION_OPTIONS = [
  'Europe',
  'Caribbean',
  'Latin America',
  'Southeast Asia',
  'East Asia',
  'Middle East',
  'Africa',
  'South Pacific',
  'Australia',
  'Antarctica',
  'Anywhere',
] as const

export const TRIP_ACTIVITY_OPTIONS = [
  'Pool/beach',
  'Tours/museums/historical',
  'Food & dining',
  'Sightseeing',
  'Roaming the streets',
  'Nature focused (ie. hiking)',
  'Adventurous physical activities (ie. zip lining)',
  'Shopping',
  'Arts & music',
  'Spa/relaxation',
  'Sports/fishing',
] as const

export { STOP_OPTIONS }
