import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import {
  extractCountryFromDestinationName,
  formatCountryViolations,
  getCountryDuplicateViolations,
  isUnitedStatesCountry,
  normalizeCountryKey,
} from './destination-country-rules'
import { parseDestinationCards, type ParsedDestinationCard } from './parse-destination-cards'

export const DESTINATION_SYSTEM_PROMPT = `You are Avanti's group travel AI. Recommend destinations that are genuinely right for this specific group. Reason carefully before writing anything.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD. NEVER CELSIUS. NEVER OTHER CURRENCIES WITHOUT USD CONVERSION.

IMPORTANT: At this stage you only have one traveler's answers. Treat them as representative of the group's general direction.

═══════════════════════════════
BEFORE YOU WRITE ANYTHING — reason through all of these internally:
═══════════════════════════════

1. HARD CONSTRAINTS — eliminate destinations that fail any of these before anything else:
- Budget ceiling: total cost (flights + accommodation + food + activities) must fit within stated budget
- Safety: if traveler flagged identity-based concerns (religion, ethnicity, gender, sexuality, nationality) eliminate destinations with documented risk for those identities. Assess political stability and geopolitical risk.
- Deal breakers: if they said no to something, eliminate destinations that require it
- Unusual laws: flag destinations with alcohol restrictions, dress code enforcement, or laws that could affect this group

2. LOGISTICS & TRAVEL TIME:
- How easy or hard is it to get to from their departure city?
- How much time is spent traveling vs. days actually on the ground?
- For trips of 7 nights or fewer: prefer destinations within ~8 hours flying each way from their departure city. Long-haul (10+ hours each way — Asia, South Pacific, Australia, New Zealand) is only a good fit if the group explicitly selected that region; if you include one, be honest in CONSIDER and LOGISTICS (e.g. ~5 days on ground after long flights — a stretch, not ideal).
- If multi-stop: are the destinations close to each other or does moving between them eat trip days?
- Weighted expense: how much does getting there cost vs. how much does being there cost? A cheap destination with expensive flights may not be the best value.

3. ACTIVITIES & AUDIENCE FIT:
- Does this destination have enough organized activities for a group this size?
- Is it appropriate for the type of group (couples, bachelorette, family, etc.)?
- Are activities touristy and easy or off the beaten path? Match to their nervousness vs. adventurousness.
- Does the destination actually have enough to do for the number of days they have? Be honest if a place needs more time than they've allocated.

4. DAILY EXPENSES:
- Assess daily costs based on their budget tier (luxury vs. budget vs. mid-range)
- How does the destination perform on value — food, accommodation, activities per dollar?

5. WEATHER & TIMING:
- What is the weather actually like during their specific travel dates? Give real temperatures in °F.
- Is there risk of extreme weather (hurricane season, monsoon, extreme heat, floods)?
- Are there major events, festivals, religious holidays, or government holidays during their dates that could impact availability, prices, or crowds — either as a risk or as a bonus opportunity?

6. CULTURAL CONSIDERATIONS:
- Alcohol accessibility and local customs around drinking
- Unusual laws or customs that could affect this group specifically
- Political stability and safety environment

7. GROUP SIZE & TYPE:
- Is accommodation available and feasible for their group size?
- Does the destination cater well to their type of trip?

8. THE WILDCARD:
- Must be genuinely different from the other three — different region, different vibe
- Must have a real reason it fits this group specifically
- Must come with an honest one-sentence tradeoff
- Should feel like insider knowledge

ABSOLUTE RULES — THESE ARE HARD CONSTRAINTS, NOT SUGGESTIONS:
CRITICAL: Do not write any reasoning, thinking, or preamble text before the output. Start your response immediately with DESTINATIONS: — no introduction, no explanation, no thinking out loud.
- ENFORCED: Maximum ONE destination per country. Before writing each NAME line, check that no other card already uses that country.
- FORBIDDEN EXAMPLE: "Riviera Maya, Mexico" and "Los Cabos, Mexico" in the same response — pick only ONE destination in Mexico.
- United States is the ONLY country that may appear on more than one card (e.g. Hawaii and New York is allowed).
- All 4 cards must be in at least 3 different countries (typically 4 different countries).
- Never repeat information across sections
- Never state things self-evident from the destination name

═══════════════════════════════
OUTPUT FORMAT — use exactly this
═══════════════════════════════

DESTINATIONS:

---
NAME: [City/Region + Country]
HIGHLIGHT: [2-3 words — single best thing for this group]
CONSIDER: [2-3 words — one honest thing to know]
SYNOPSIS: [2-3 sentences. Why this fits THIS group. Reference their actual inputs.]
LOGISTICS: [3 bullets: routing from departure city, total travel time, ease of getting there]
COST: [First line: ~$X,XXX–X,XXX/person total. Then 3 bullets: flights, accommodation/night, food + activities/day. Note how much of budget goes to travel vs. being there.]
WEATHER: [2 bullets: actual temp in °F for their dates, any weather risk or festival bonus]
ACTIVITIES: [4-5 bullets: specific named activities and places. Flag if off beaten path or touristy. Note if enough to fill their trip length.]
GROUP FIT: [2-3 bullets: accommodation for their size, organized group activity availability, appropriateness for their trip type]
FOOTNOTES: [Only if triggered: safety flags, political situation, unusual laws, alcohol restrictions, visa, health risks. Omit entirely if nothing to flag.]
---

[Repeat for destinations 2 and 3]

---
WILDCARD:
NAME: [City/Region, Country — a real place only. Never put notes like "skipped" or "excluded" in NAME. Must be a country not used in any other card.]
HIGHLIGHT: [2-3 words]
CONSIDER: [2-3 words]
SYNOPSIS: [2-3 sentences — enthusiastic, different voice]
LOGISTICS: [3 bullets]
COST: [Total + breakdown]
WEATHER: [2 bullets]
ACTIVITIES: [4-5 bullets]
GROUP FIT: [2-3 bullets]
TRADEOFF: [1 honest sentence — do not soften]
FOOTNOTES: [If triggered]
---

AVANTI_CARDS_END

BREVITY: One short line per bullet (under 15 words). Skip FOOTNOTES unless critical. No preamble — start with DESTINATIONS: immediately.`

const LONG_HAUL_REGIONS = new Set([
  'East Asia',
  'Southeast Asia',
  'South Pacific',
  'Africa',
  'Middle East',
])

function isShortTrip(flexLength?: string): boolean {
  return !!flexLength && /^(3[–-]4|5[–-]7)\s*night/i.test(flexLength)
}

function buildTravelTimeRule(
  flexLength: string | undefined,
  departure: string,
  regions: string[] | undefined,
  domestic: string | undefined,
): string {
  if (!isShortTrip(flexLength)) return ''

  const selected = regions?.filter(Boolean) ?? []
  const wantsLongHaul = selected.some(r => LONG_HAUL_REGIONS.has(r) || r === 'Anywhere')
  const regionLine = selected.length ? selected.join(', ') : 'no region specified'

  if (domestic === 'International' && wantsLongHaul) {
    return `\nTRAVEL TIME: ${flexLength} from ${departure}; they chose ${regionLine}. Long-haul is allowed but a stretch — you MAY suggest Asia/Pacific/Middle East/Africa if it fits. Be upfront: ~13h flights each way means roughly 4–5 full days on the ground. Flag it in CONSIDER (e.g. "Long flight haul") and LOGISTICS. Do not sell it as easy.`
  }

  return `\nTRAVEL TIME: ${flexLength} from ${departure}. Prefer ≤8h flights each way. Avoid 10+ hour destinations (Japan, NZ, Australia, etc.) unless they selected that region — otherwise they'd only get ~4–5 days on the ground.`
}

export function buildDestinationUserMessage(
  trip: Record<string, unknown> | null,
  travelerCount: number,
  answers: Record<string, unknown>,
  chatSupplement = '',
): string {
  const departure =
    Array.isArray(answers.departureCity)
      ? (answers.departureCity as string[]).join(', ')
      : Array.isArray(answers.departureCities)
        ? (answers.departureCities as string[]).join(', ')
        : (answers.departureCity as string) || 'Not specified'

  const fixedDates = answers.fixedDates as { start?: string; end?: string } | undefined
  const datesLine = fixedDates?.start
    ? `${fixedDates.start} to ${fixedDates.end}`
    : (answers.dates as string) || 'Not specified'

  const regions = answers.regions as string[] | undefined
  const activities = answers.activities as string[] | undefined
  const vibe = answers.vibe as string[] | undefined

  const flexLength = answers.flexLength as string | undefined
  const travelTimeRule = buildTravelTimeRule(flexLength, departure, regions, answers.domestic as string | undefined)

  return `Please generate destination suggestions for this group.

TRIP TYPE: ${(trip?.trip_type as string) || 'Group trip'}
GROUP SIZE: ${travelerCount} people
EVENT: ${trip?.is_event_centered ? `Yes — ${trip.event_name} on ${trip.event_date_end && trip.event_date_end !== trip.event_date ? `${trip.event_date} to ${trip.event_date_end}` : trip.event_date} in ${trip.event_location}` : 'No specific event'}

About this trip: ${answers.q1 || 'Not specified'}
Departure: ${departure}
Dates: ${datesLine}${flexLength ? ` (preferred: ${flexLength})` : ''}
Domestic/international: ${answers.domestic || 'No preference'}${regions?.length ? ` — regions: ${regions.join(', ')}` : ''}
Number of stops: ${answers.stops || 'flexible'}
Activities wanted: ${activities?.join(', ') || 'Not specified'}
Vibe: ${vibe?.join(', ') || 'Not specified'}
Accommodation: ${answers.accommodation || 'No preference'}
Budget per person: ${answers.budget || 'Not specified'}
Popularity preference: ${answers.popularity || 'No preference'}
Deal breakers: ${answers.q3 || 'None stated'}${travelTimeRule}${chatSupplement}

Generate 4 destination cards now (3 main + 1 wildcard). Remember: only ONE card per country (United States excepted). All 4 cards must be in 4 different countries.`
}

export type DestinationBatch = 'all' | 'half1' | 'half2' | 'wildcard-only'

export function appendBatchInstructions(
  userMessage: string,
  batch: DestinationBatch,
  excludeCountries: string[] = [],
): string {
  if (batch === 'half1') {
    return `${userMessage}

Generate ONLY the first TWO main destination cards. Do NOT write a third main card or WILDCARD yet. Stop after the second card's closing --- line.`
  }
  if (batch === 'half2') {
    const exclude = excludeCountries.filter(Boolean)
    return `${userMessage}

Generate ONE more main destination card PLUS the WILDCARD card (2 cards total).
${exclude.length ? `Countries already used — do NOT repeat: ${exclude.join(', ')}.` : ''}
The WILDCARD must be in a country not used in any other card. NAME must be a real place (City/Region, Country) — never meta text like "skipped" or "excluded".`
  }
  if (batch === 'wildcard-only') {
    const exclude = excludeCountries.filter(Boolean)
    return `${userMessage}

Generate ONLY the WILDCARD card (one card). Use the WILDCARD: block format.
Countries already used — do NOT repeat: ${exclude.join(', ')}.
NAME must be a real destination (City/Region, Country). No meta commentary in NAME.`
  }
  return userMessage
}

export async function createDestinationCards(
  client: Anthropic,
  conversationMessages: MessageParam[],
  maxTokens = 3200,
) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: DESTINATION_SYSTEM_PROMPT,
    messages: conversationMessages,
  })
  const fullText = response.content[0].type === 'text' ? response.content[0].text : ''
  const { cards, closing } = parseDestinationCards(fullText)
  return {
    message: fullText,
    cards: dedupeCardsByCountry(cards),
    closing,
  }
}

function buildCorrectionMessage(violations: ReturnType<typeof getCountryDuplicateViolations>): string {
  return `Your previous output violated a hard rule: maximum ONE destination per country. United States is the only exception.

Duplicate countries detected: ${formatCountryViolations(violations)}

Regenerate ALL 4 destination cards from scratch. Each card must be in a DIFFERENT country (except multiple US destinations are allowed). Do not repeat any country that already appears in your previous output.

Start immediately with DESTINATIONS: and use the exact same output format.`
}

export function destinationOutputIsValid(fullText: string): boolean {
  const { cards } = parseDestinationCards(fullText)
  if (cards.length < 4) return false
  return getCountryDuplicateViolations(cards).length === 0
}

export function isValidDestinationCardName(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length < 4) return false
  if (
    /\.\.\.|skipped|excluded|do not use|cannot use|already used|wait,|wait —|duplicate|not used|is already/i.test(
      trimmed
    )
  ) {
    return false
  }
  if (!trimmed.includes(',')) return false
  return true
}

/** Keep the first card per non-US country; drop later duplicates. */
export function dedupeCardsByCountry(cards: ParsedDestinationCard[]): ParsedDestinationCard[] {
  const seen = new Set<string>()
  const result: ParsedDestinationCard[] = []

  for (const card of cards) {
    if (!isValidDestinationCardName(card.name)) continue

    const country = extractCountryFromDestinationName(card.name)
    if (!country) {
      result.push(card)
      continue
    }
    const key = normalizeCountryKey(country)
    if (isUnitedStatesCountry(key)) {
      result.push(card)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    result.push(card)
  }

  return result
}

/** Generate destination cards, validating country uniqueness and retrying if needed. */
export async function generateValidatedDestinationText(
  client: Anthropic,
  conversationMessages: MessageParam[],
  maxAttempts = 2,
): Promise<string> {
  let messages = conversationMessages
  let lastText = ''

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: DESTINATION_SYSTEM_PROMPT,
      messages,
    })

    lastText = response.content[0].type === 'text' ? response.content[0].text : ''
    const { cards } = parseDestinationCards(lastText)
    const violations = getCountryDuplicateViolations(cards)

    if (cards.length >= 4 && violations.length === 0) {
      return lastText
    }

    if (attempt < maxAttempts - 1) {
      messages = [
        ...conversationMessages,
        { role: 'assistant', content: lastText },
        {
          role: 'user',
          content: violations.length > 0
            ? buildCorrectionMessage(violations)
            : `You returned ${cards.length} cards but 4 are required (3 main + 1 wildcard). Regenerate all 4 cards now using the exact format.`,
        },
      ]
    }
  }

  return lastText
}

/** After streaming a first pass, validate and optionally regenerate before returning to the client. */
export async function ensureValidDestinationText(
  client: Anthropic,
  conversationMessages: MessageParam[],
  streamedText: string,
): Promise<string> {
  if (destinationOutputIsValid(streamedText)) return streamedText

  const deduped = dedupeCardsByCountry(parseDestinationCards(streamedText).cards)
  if (deduped.length >= 4) return streamedText

  const { cards } = parseDestinationCards(streamedText)
  const violations = getCountryDuplicateViolations(cards)

  const correctionMessages: MessageParam[] = [
    ...conversationMessages,
    { role: 'assistant', content: streamedText },
    {
      role: 'user',
      content: violations.length > 0
        ? buildCorrectionMessage(violations)
        : `You returned ${cards.length} cards but 4 are required. Regenerate all 4 cards now.`,
    },
  ]

  // One retry only — a second full call often exceeds Vercel's 60s limit after streaming.
  return generateValidatedDestinationText(client, correctionMessages, 1)
}
