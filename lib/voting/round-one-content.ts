import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import type { RoundOneContent } from './types'
import { PLACEHOLDER_ROUND_ONE, STALE_PERSONAL_MARKERS } from './constants'
import { resolveRoundOneWeather } from '@/lib/weather/round-one-weather'

function destinationShortName(destinationName: string): string {
  return destinationName.split(',')[0]?.trim() || destinationName
}

function destinationNameTokens(destinationName: string): string[] {
  const short = destinationShortName(destinationName)
  const tokens = [short, short.split('+')[0]?.trim(), short.split(/\s+/)[0]?.trim()].filter(
    (token): token is string => !!token && token.length >= 4
  )
  return [...new Set(tokens)]
}

/** Split bullet-ish card fields into list items. */
export function splitListField(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return []

  const fromLines = raw
    .split(/\n/)
    .map(line => line.replace(/^[\s\-•*·]+/, '').trim())
    .filter(line => line.length > 0)

  if (fromLines.length > 1) return fromLines

  return raw
    .split(/\s*[·|]\s*|\s*,\s(?=[A-Za-z])/)
    .map(part => part.trim())
    .filter(part => part.length > 0 && part.length < 160)
}

export function isPlaceholderRoundOneContent(content: unknown): boolean {
  if (!content || typeof content !== 'object') return true
  const c = content as RoundOneContent
  return (
    c.overview === PLACEHOLDER_ROUND_ONE.overview ||
    c.best_known_for?.join('|') === PLACEHOLDER_ROUND_ONE.best_known_for.join('|')
  )
}

/** Detect cached demo copy or content that ignores the destination. */
export function isStaleRoundOneContent(content: unknown, destinationName: string): boolean {
  if (isPlaceholderRoundOneContent(content)) return true
  const c = content as RoundOneContent
  const blob = [c.overview, ...(c.best_known_for || []), ...(c.activities || []), c.weather]
    .filter(Boolean)
    .join(' ')
  const isSantorini = /santorini/i.test(destinationName)

  if (!isSantorini && STALE_PERSONAL_MARKERS.some(marker => blob.includes(marker))) {
    return true
  }

  const tokens = destinationNameTokens(destinationName)
  if (
    tokens.length > 0 &&
    !tokens.some(token => blob.toLowerCase().includes(token.toLowerCase()))
  ) {
    return true
  }

  return false
}

export function buildRoundOneContentFromSnapshot(
  cardSnapshot: Record<string, unknown> | null | undefined
): RoundOneContent | null {
  if (!cardSnapshot || typeof cardSnapshot !== 'object') return null

  const card = cardSnapshot as Partial<ParsedDestinationCard>
  const overview = (card.overview || card.synopsis || '').trim()
  if (!overview) return null

  const bestKnownFor = splitListField(card.bestKnownFor)
  const best_known_for = [
    ...bestKnownFor,
    ...(card.highlight?.trim() ? [card.highlight.trim()] : []),
    ...(card.consider?.trim() ? [card.consider.trim()] : []),
  ].filter((item, index, arr) => arr.indexOf(item) === index)

  const activities = splitListField(card.activities)

  if (!activities.length && best_known_for.length <= 1) {
    return {
      overview,
      best_known_for: best_known_for.length ? best_known_for.slice(0, 5) : ['Local culture', 'Scenic views'],
      activities: ['Explore the city center', 'Try regional cuisine', 'Outdoor adventures nearby'],
      weather: '',
    }
  }

  return {
    overview,
    best_known_for: best_known_for.length
      ? best_known_for.slice(0, 5)
      : ['Local culture', 'Scenic views', 'Regional cuisine'],
    activities: activities.length
      ? activities.slice(0, 6)
      : ['Explore the city center', 'Try regional cuisine', 'Outdoor adventures nearby'],
    weather: '',
  }
}

export function resolveRoundOneContent(input: {
  roundOneContent: RoundOneContent | null | undefined
  cardSnapshot?: Record<string, unknown> | null
  destinationName: string
  climateWeather?: string | null
  hasTravelWindow?: boolean
}): RoundOneContent {
  const fromSnapshot = buildRoundOneContentFromSnapshot(input.cardSnapshot)
  const stored = input.roundOneContent

  let base: RoundOneContent
  if (stored && !isStaleRoundOneContent(stored, input.destinationName)) {
    base = stored
  } else if (fromSnapshot && !isStaleRoundOneContent(fromSnapshot, input.destinationName)) {
    base = fromSnapshot
  } else {
    base = stored && !isPlaceholderRoundOneContent(stored) ? stored : fromSnapshot || PLACEHOLDER_ROUND_ONE
  }

  const weather = resolveRoundOneWeather({
    climateLine: input.climateWeather,
    hasTravelWindow: input.hasTravelWindow ?? false,
  })

  return { ...base, weather }
}
