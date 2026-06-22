import { parseDestinationCards } from '@/lib/parse-destination-cards'
import { dedupeCardsByCountry, isValidDestinationCardName } from '@/lib/generate-destinations-core'
import { extractCountryFromDestinationName, getCountryDuplicateViolations } from '@/lib/destination-country-rules'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import type { ChatMessage } from '@/lib/infer-trip-context'

export type DestinationAnswersPayload = Record<string, unknown>

type FetchOptions = {
  tripId?: string
  preview?: boolean
  onStatus?: (message: string) => void
  onPartialCards?: (cards: ParsedDestinationCard[]) => void
  messages?: ChatMessage[]
}

const BATCH_RETRIES = 2

async function fetchBatchOnce(
  answers: DestinationAnswersPayload,
  batch: 'half1' | 'half2' | 'wildcard-only',
  options: FetchOptions,
  excludeCountries: string[] = [],
): Promise<ParsedDestinationCard[]> {
  const res = await fetch('/api/generate-destinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

async function fetchBatch(
  answers: DestinationAnswersPayload,
  batch: 'half1' | 'half2' | 'wildcard-only',
  options: FetchOptions,
  excludeCountries: string[] = [],
): Promise<ParsedDestinationCard[]> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= BATCH_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        options.onStatus?.('Retrying…')
      }
      return await fetchBatchOnce(answers, batch, options, excludeCountries)
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error('Failed to generate trip ideas')
      if (attempt === BATCH_RETRIES) break
    }
  }
  throw lastError ?? new Error('Failed to generate trip ideas')
}

/** Full 4-card generation for signed-in trips and homepage preview. */
export async function fetchFullDestinationCards(
  answers: DestinationAnswersPayload,
  options: FetchOptions,
): Promise<ParsedDestinationCard[]> {
  let parsed: ParsedDestinationCard[] = []

  try {
    options.onStatus?.('Finding your first destinations…')
    const firstBatch = await fetchBatch(answers, 'half1', options)
    if (firstBatch.length === 0) {
      throw new Error('No destination cards were returned. Please try again.')
    }
    parsed = firstBatch
    options.onPartialCards?.(parsed)

    options.onStatus?.('Adding final picks and a wildcard…')
    const usedCountries = firstBatch
      .map(card => extractCountryFromDestinationName(card.name))
      .filter(Boolean) as string[]

    const secondBatch = await fetchBatch(answers, 'half2', options, usedCountries)
    parsed = dedupeCardsByCountry([...firstBatch, ...secondBatch])
    options.onPartialCards?.(parsed)

    const violations = getCountryDuplicateViolations(parsed)
    const mains = parsed.filter(c => !c.isWildcard)
    const wildcard = parsed.find(c => c.isWildcard)
    const wildcardCountry = wildcard ? extractCountryFromDestinationName(wildcard.name) : null
    const mainCountries = mains
      .map(card => extractCountryFromDestinationName(card.name))
      .filter(Boolean) as string[]
    const wildcardInvalid =
      !wildcard ||
      !isValidDestinationCardName(wildcard.name) ||
      (wildcardCountry != null && mainCountries.includes(wildcardCountry))

    if (violations.length > 0 || wildcardInvalid || parsed.length < 4) {
      options.onStatus?.('Picking a wildcard…')
      const excludeAll = mainCountries
      const wildcardBatch = await fetchBatch(answers, 'wildcard-only', options, excludeAll)
      const freshWildcard = wildcardBatch.find(c => c.isWildcard) || wildcardBatch[0]
      if (freshWildcard && isValidDestinationCardName(freshWildcard.name)) {
        parsed = dedupeCardsByCountry([...mains, { ...freshWildcard, isWildcard: true }])
      } else {
        parsed = dedupeCardsByCountry([...mains, ...wildcardBatch])
      }
      options.onPartialCards?.(parsed)
    }

    if (parsed.length === 0) {
      throw new Error('No destination cards were returned. Please try again.')
    }

    return parsed
  } catch (e: unknown) {
    if (parsed.length >= 2) {
      options.onStatus?.('Showing partial results — tap Finish generating to complete the set.')
      return parsed
    }
    throw e
  }
}

/** Continue from a partial set — does not restart from scratch. */
export async function fetchRemainingDestinationCards(
  existing: ParsedDestinationCard[],
  answers: DestinationAnswersPayload,
  options: FetchOptions,
): Promise<ParsedDestinationCard[]> {
  if (existing.length >= 4) return existing
  if (existing.length === 0) return fetchFullDestinationCards(answers, options)

  let parsed = [...existing]

  try {
    const mains = () => parsed.filter(c => !c.isWildcard)
    const hasWildcard = () => parsed.some(c => c.isWildcard)
    const mainCountries = () =>
      mains()
        .map(c => extractCountryFromDestinationName(c.name))
        .filter(Boolean) as string[]

    if (mains().length < 3) {
      options.onStatus?.('Adding more destinations…')
      const batch = await fetchBatch(answers, 'half2', options, mainCountries())
      parsed = dedupeCardsByCountry([...parsed, ...batch])
      options.onPartialCards?.(parsed)
    }

    if ((!hasWildcard() || parsed.length < 4) && parsed.length < 4) {
      options.onStatus?.('Picking a wildcard…')
      const excludeAll = mainCountries()
      const wildcardBatch = await fetchBatch(answers, 'wildcard-only', options, excludeAll)
      const freshWildcard = wildcardBatch.find(c => c.isWildcard) || wildcardBatch[0]
      if (freshWildcard && isValidDestinationCardName(freshWildcard.name)) {
        const mainsOnly = parsed.filter(c => !c.isWildcard)
        parsed = dedupeCardsByCountry([...mainsOnly, { ...freshWildcard, isWildcard: true }])
      } else if (wildcardBatch.length > 0) {
        parsed = dedupeCardsByCountry([...parsed, ...wildcardBatch])
      }
      options.onPartialCards?.(parsed)
    }

    if (parsed.length === 0) {
      throw new Error('No destination cards were returned. Please try again.')
    }

    return parsed
  } catch (e: unknown) {
    if (parsed.length > existing.length) return parsed
    if (parsed.length >= 2) return parsed
    throw e
  }
}

/** Preview: full 4-card generation for anonymous homepage visitors. */
export async function fetchPreviewDestinationCards(
  answers: DestinationAnswersPayload,
  options: FetchOptions = { preview: true },
): Promise<ParsedDestinationCard[]> {
  return fetchFullDestinationCards(answers, { ...options, preview: true })
}
