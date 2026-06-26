import { supabase } from '@/lib/supabase'
import { parseDestinationCards } from '@/lib/parse-destination-cards'
import { dedupeCardsByCountry, isValidDestinationCardName } from '@/lib/generate-destinations-core'
import { extractCountryFromDestinationName } from '@/lib/destination-country-rules'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import type { ChatMessage } from '@/lib/infer-trip-context'

export type DestinationAnswersPayload = Record<string, unknown>

export const GENERATION_TIME_HINT =
  'Avanti will take 2–3 minutes to generate your trip cards.'

type FetchOptions = {
  tripId?: string
  preview?: boolean
  onStatus?: (message: string) => void
  onPartialCards?: (cards: ParsedDestinationCard[]) => void
  messages?: ChatMessage[]
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

type CardBatch = 'single-main' | 'wildcard-only'

const PER_CARD_RETRIES = 5
const MAIN_CARD_COUNT = 3
const TOTAL_CARDS = 4

function usedCountries(cards: ParsedDestinationCard[]): string[] {
  return cards
    .map(c => extractCountryFromDestinationName(c.name))
    .filter(Boolean) as string[]
}

function countryKey(card: ParsedDestinationCard): string | null {
  return extractCountryFromDestinationName(card.name)
}

function conflictsExisting(card: ParsedDestinationCard, existing: ParsedDestinationCard[]): boolean {
  const key = countryKey(card)
  if (!key) return false
  return usedCountries(existing).includes(key)
}

function pickMainCard(cards: ParsedDestinationCard[], existing: ParsedDestinationCard[]): ParsedDestinationCard | null {
  for (const card of cards) {
    if (card.isWildcard) continue
    if (!isValidDestinationCardName(card.name)) continue
    if (conflictsExisting(card, existing)) continue
    return card
  }
  return null
}

function pickWildcardCard(cards: ParsedDestinationCard[], existing: ParsedDestinationCard[]): ParsedDestinationCard | null {
  const used = usedCountries(existing)
  const wildcard = cards.find(c => c.isWildcard && isValidDestinationCardName(c.name))
  if (wildcard) {
    const key = countryKey(wildcard)
    if (!key || !used.includes(key)) return { ...wildcard, isWildcard: true }
  }
  for (const card of cards) {
    if (!isValidDestinationCardName(card.name)) continue
    const key = countryKey(card)
    if (key && used.includes(key)) continue
    return { ...card, isWildcard: true }
  }
  return null
}

async function fetchBatchOnce(
  answers: DestinationAnswersPayload,
  batch: CardBatch,
  options: FetchOptions,
  excludeCountries: string[] = [],
): Promise<ParsedDestinationCard[]> {
  const res = await fetch('/api/generate-destinations', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      tripId: options.tripId,
      preview: options.preview,
      answers,
      messages: options.messages ?? [],
      stream: false,
      batch,
      excludeCountries,
    }),
  })

  if (!res.ok) {
    if (res.status === 504) {
      throw new Error('Generation timed out. Please try again.')
    }
    const errBody = await res.json().catch(() => null)
    throw new Error(errBody?.error || 'Failed to generate trip ideas')
  }

  const data = await res.json()
  if (data.error) throw new Error(data.error)

  return dedupeCardsByCountry(
    data.cards?.length ? data.cards : parseDestinationCards(data.message || '').cards,
  )
}

async function fetchBatchWithRetries(
  answers: DestinationAnswersPayload,
  batch: CardBatch,
  options: FetchOptions,
  excludeCountries: string[] = [],
): Promise<ParsedDestinationCard[]> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= PER_CARD_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        options.onStatus?.('Retrying…')
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt))
      }
      return await fetchBatchOnce(answers, batch, options, excludeCountries)
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error('Failed to generate trip ideas')
      if (attempt === PER_CARD_RETRIES) break
    }
  }
  throw lastError ?? new Error('Failed to generate trip ideas')
}

async function fetchOneMainCard(
  answers: DestinationAnswersPayload,
  options: FetchOptions,
  existing: ParsedDestinationCard[],
  slotLabel: string,
): Promise<ParsedDestinationCard> {
  const exclude = usedCountries(existing)
  options.onStatus?.(`Researching destination ${slotLabel}…`)

  for (let attempt = 0; attempt <= PER_CARD_RETRIES; attempt++) {
    if (attempt > 0) {
      options.onStatus?.(`Retrying destination ${slotLabel}…`)
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt))
    }
    try {
      const batch = await fetchBatchOnce(answers, 'single-main', options, exclude)
      const card = pickMainCard(batch, existing)
      if (card) return card
    } catch {
      /* try again */
    }
  }

  throw new Error(`Could not generate destination ${slotLabel}. Tap Finish generating to try again.`)
}

async function fetchOneWildcardCard(
  answers: DestinationAnswersPayload,
  options: FetchOptions,
  existing: ParsedDestinationCard[],
): Promise<ParsedDestinationCard> {
  const exclude = usedCountries(existing)
  options.onStatus?.('Picking your wildcard…')

  for (let attempt = 0; attempt <= PER_CARD_RETRIES; attempt++) {
    if (attempt > 0) {
      options.onStatus?.('Retrying wildcard…')
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt))
    }
    try {
      const batch = await fetchBatchWithRetries(answers, 'wildcard-only', options, exclude)
      const card = pickWildcardCard(batch, existing)
      if (card) return card
    } catch {
      /* try again */
    }
  }

  throw new Error('Could not generate the wildcard card. Tap Finish generating to try again.')
}

/** Build a full set of 4 cards one at a time (3 mains + wildcard). */
async function buildFourCardsSequentially(
  answers: DestinationAnswersPayload,
  options: FetchOptions,
  seed: ParsedDestinationCard[] = [],
): Promise<ParsedDestinationCard[]> {
  let parsed = dedupeCardsByCountry([...seed])

  const mains = () => parsed.filter(c => !c.isWildcard)
  const hasWildcard = () => parsed.some(c => c.isWildcard)

  while (mains().length < MAIN_CARD_COUNT) {
    const slot = mains().length + 1
    const card = await fetchOneMainCard(answers, options, parsed, `${slot} of ${MAIN_CARD_COUNT}`)
    parsed = dedupeCardsByCountry([...parsed, card])
    options.onPartialCards?.(parsed)
  }

  if (!hasWildcard()) {
    const wildcard = await fetchOneWildcardCard(answers, options, parsed)
    parsed = dedupeCardsByCountry([...parsed, wildcard])
    options.onPartialCards?.(parsed)
  }

  if (parsed.length < TOTAL_CARDS) {
    throw new Error('Could not finish all 4 cards — tap Finish generating to try again.')
  }

  return parsed.slice(0, TOTAL_CARDS)
}

/** Full 4-card generation for signed-in trips and homepage preview. */
export async function fetchFullDestinationCards(
  answers: DestinationAnswersPayload,
  options: FetchOptions,
): Promise<ParsedDestinationCard[]> {
  options.onStatus?.(GENERATION_TIME_HINT)
  return buildFourCardsSequentially(answers, options)
}

/** Continue from a partial set — fills missing slots one card at a time. */
export async function fetchRemainingDestinationCards(
  existing: ParsedDestinationCard[],
  answers: DestinationAnswersPayload,
  options: FetchOptions,
): Promise<ParsedDestinationCard[]> {
  if (existing.length >= TOTAL_CARDS) return existing.slice(0, TOTAL_CARDS)
  if (existing.length === 0) return fetchFullDestinationCards(answers, options)

  options.onStatus?.(`Finishing your set (${existing.length} of ${TOTAL_CARDS} ready)…`)
  return buildFourCardsSequentially(answers, options, existing)
}

/** Replace one card in an existing set — keeps the other three unchanged. */
export async function regenerateSingleDestinationCard(
  existing: ParsedDestinationCard[],
  cardIndex: number,
  answers: DestinationAnswersPayload,
  options: FetchOptions,
): Promise<ParsedDestinationCard[]> {
  if (cardIndex < 0 || cardIndex >= existing.length) {
    throw new Error('Invalid card index')
  }

  const target = existing[cardIndex]
  const withoutTarget = existing.filter((_, i) => i !== cardIndex)
  const isWildcardSlot = !!target.isWildcard

  options.onStatus?.(
    isWildcardSlot ? 'Regenerating wildcard…' : `Regenerating ${target.name}…`,
  )

  const replacement = isWildcardSlot
    ? await fetchOneWildcardCard(answers, options, withoutTarget)
    : await fetchOneMainCard(answers, options, withoutTarget, `${cardIndex + 1}`)

  const next = [...existing]
  next[cardIndex] = replacement
  return dedupeCardsByCountry(next).slice(0, TOTAL_CARDS)
}

/** Preview: full 4-card generation for anonymous homepage visitors. */
export async function fetchPreviewDestinationCards(
  answers: DestinationAnswersPayload,
  options: FetchOptions = { preview: true },
): Promise<ParsedDestinationCard[]> {
  return fetchFullDestinationCards(answers, { ...options, preview: true })
}
