const ANSWERS_KEY = 'avanti_preview_answers'
const CARDS_KEY = 'avanti_preview_cards'
const PENDING_SHARE_KEY = 'avanti_preview_pending_share'

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(key) ?? localStorage.getItem(key)
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key, value)
    localStorage.setItem(key, value)
  } catch {
    // ignore quota errors
  }
}

function removeStorage(key: string) {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(key)
  localStorage.removeItem(key)
}

export function savePreviewTrip(answers: Record<string, unknown>, cards: unknown[]) {
  writeStorage(ANSWERS_KEY, JSON.stringify(answers))
  writeStorage(CARDS_KEY, JSON.stringify(cards))
}

export function loadPreviewTrip(): { answers: Record<string, unknown> | null; cards: unknown[] | null } {
  if (typeof window === 'undefined') return { answers: null, cards: null }
  try {
    const answersRaw = readStorage(ANSWERS_KEY)
    const cardsRaw = readStorage(CARDS_KEY)
    return {
      answers: answersRaw ? JSON.parse(answersRaw) : null,
      cards: cardsRaw ? JSON.parse(cardsRaw) : null,
    }
  } catch {
    return { answers: null, cards: null }
  }
}

export function hasPreviewTrip(): boolean {
  const { answers, cards } = loadPreviewTrip()
  return Boolean(answers?.q1 && Array.isArray(cards) && cards.length > 0)
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
  return '/dashboard'
}

export function clearPreviewTrip() {
  removeStorage(ANSWERS_KEY)
  removeStorage(CARDS_KEY)
  clearPendingShare()
}

const STOP_OPTIONS = ['Just one', '2 stops', '3 stops', 'Open to anything', 'Other']

/** Shape stored on travelers.step2 — matches step 2 saveProgress. */
export function buildStep2FromPreviewAnswers(answers: Record<string, unknown>) {
  return {
    q1: String(answers.q1 || ''),
    departureCity: String(answers.departureCity || ''),
    dates: String(answers.dates || ''),
    fixedDates: (answers.fixedDates as { start: string; end: string }) || { start: '', end: '' },
    flexLength: String(answers.flexLength || ''),
    domestic: String(answers.domestic || ''),
    regions: Array.isArray(answers.regions) ? answers.regions : [],
    stops: String(answers.stops || ''),
    activities: Array.isArray(answers.activities) ? answers.activities : [],
    vibe: Array.isArray(answers.vibe) ? answers.vibe : [],
    accommodation: String(answers.accommodation || ''),
    budget: String(answers.budget || ''),
    popularity: String(answers.popularity || ''),
    q3: String(answers.q3 || ''),
    stage: 'done',
    chatMessages: [] as { role: 'user' | 'assistant'; content: string }[],
  }
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

export { STOP_OPTIONS }
