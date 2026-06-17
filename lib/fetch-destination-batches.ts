import { parseDestinationCards } from '@/lib/parse-destination-cards'
import { dedupeCardsByCountry } from '@/lib/generate-destinations-core'
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
    const hasValidWildcard = parsed.some(c => c.isWildcard)
    if (violations.length > 0 || !hasValidWildcard || parsed.length < 4) {
      options.onStatus?.('Picking a wildcard…')
      const mains = parsed.filter(c => !c.isWildcard)
      const excludeAll = mains
        .map(card => extractCountryFromDestinationName(card.name))
        .filter(Boolean) as string[]
      const wildcardBatch = await fetchBatch(answers, 'wildcard-only', options, excludeAll)
      parsed = dedupeCardsByCountry([...mains, ...wildcardBatch])
      options.onPartialCards?.(parsed)
    }

    if (parsed.length === 0) {
      throw new Error('No destination cards were returned. Please try again.')
    }

    return parsed
  } catch (e: unknown) {
    if (parsed.length >= 2) {
      options.onStatus?.('Showing partial results — tap Try again to finish the set.')
      return parsed
    }
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
