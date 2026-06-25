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
import {
  departureCitiesFromAnswers,
  formatDepartureCitiesForPrompt,
} from './departure-cities'

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
- Only mention hurricanes, monsoons, floods, or other disasters if there is a real threat during their exact dates — never say "no hurricane risk" or reassure about disasters when there is none.
- Are there major events, festivals, religious holidays, or government holidays during their dates that could impact availability, prices, or crowds — either as a risk or as a bonus opportunity?

6. CULTURAL CONSIDERATIONS:
- Alcohol accessibility and local customs around drinking
- Dress codes, tipping norms, photography taboos, and local sensitivities — note in VIBE CHECK or FOOTNOTES when relevant
- Unusual laws or customs that could affect this group specifically
- Political stability and safety environment
- Ethical tourism: flag overtourism hotspots, exploitative animal experiences, and cultural sites that require respectful behavior — in FOOTNOTES when triggered

7. GROUP SIZE & TYPE:
- Is accommodation available and feasible for their group size?
- Does the destination cater well to their type of trip?

8. THE WILDCARD:
- Must be genuinely different from the other three — different region, different vibe
- Should feel like insider knowledge — a place locals love that most tourists skip; off-the-beaten-path but safe and enriching, not reckless
- Must have a real reason it fits this group specifically
- Must come with an honest one-sentence tradeoff

9. SPECIFICITY — every card must earn trust with concrete detail:
- Name neighborhoods, landmarks, markets, trails, and districts — never write "explore the local culture" without saying where
- ACTIVITIES bullets must reference real places (e.g. "Mercado de San Miguel" not "visit a food market")
- COST and LOGISTICS use realistic USD ranges, not vague "affordable" or "moderate"
- Generic filler is forbidden — if you cannot name it, do not include it

10. COMPARISON & FINAL SELECTION — before writing cards, compare your top candidates:
- Score each finalist 1–10 against their must-haves, deal-breakers, budget, travel time, activity match, safety, weather, and group type; only write cards for strong scorers (7+)
- Each card needs a clear unique selling point — the one thing THIS destination does better than the other three in your set; express it in HIGHLIGHT
- TRADEOFF must state the honest biggest downside for this group — not a minor inconvenience; do not soften

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
HIGHLIGHT: [2-3 words — unique selling point: what this place does best vs the other three cards]
CONSIDER: [2-3 words — one honest thing to know]
OVERVIEW: [2-3 sentences. What this destination IS — landscape, culture, reputation, trip feel. Written for any traveler reading a brochure. No "your group", no departure cities, no budget, no hotels or resorts.]
BEST KNOWN FOR: [3-5 short phrases under 5 words each — signature experiences or reputation icons]
SYNOPSIS: [2-3 sentences. Why this fits THIS specific group — reference their inputs. Group-specific only.]
LOGISTICS: [3 bullets: routing from departure city, total travel time, ease of getting there. If multi-stop trip: include logical city/region order, transit between stops, and time cost.]
COST: [First line: ~$X,XXX–X,XXX/person total (range includes ~10–15% buffer). Then 4 bullets: flights round-trip, lodging/night, food/day, activities/day. Note what share of budget goes to travel vs. being there.]
WEATHER: [Forecast for their exact travel dates: temps in °F, conditions, rain, humidity, night temps. Spell out place names — never use abbreviations like TCI. Do NOT mention hurricanes or disasters unless there is a real dated threat — never say "no hurricane risk" or similar.]
ACTIVITIES: [4-5 bullets with named places — mix well-known highlights and one hidden-gem or local-favorite pick. Never mention resorts, hotels, or "arranged by property".]
GROUP FIT: [2-3 bullets: accommodation for their size, organized group activity availability, appropriateness for their trip type]
VIBE CHECK: [1 sentence on pace, dress code, and social energy — e.g. "Upscale-casual — dress up for dinner, sandals by day"]
TRADEOFF: [1 honest sentence — the biggest downside for THIS group; required on every card]
FOOTNOTES: [Only if triggered: safety, political situation, unusual laws, alcohol restrictions, visa, health risks, dress/tipping/taboo notes, overtourism, exploitative animal tourism. Omit entirely if nothing to flag.]
---

[Repeat for destinations 2 and 3]

---
WILDCARD:
NAME: [City/Region, Country — a real place only. Never put notes like "skipped" or "excluded" in NAME. Must be a country not used in any other card. Insider pick — locals love it, most tourists skip it.]
HIGHLIGHT: [2-3 words — what makes this insider pick special]
CONSIDER: [2-3 words]
OVERVIEW: [2-3 sentences — the place itself, for any reader. No group references or hotels.]
BEST KNOWN FOR: [3-5 short phrases under 5 words each]
SYNOPSIS: [2-3 sentences — enthusiastic, why this group specifically. Place feel only in overview.]
LOGISTICS: [3 bullets]
COST: [First line: ~$X,XXX–X,XXX/person total (range includes ~10–15% buffer). Then 4 bullets: flights, lodging/night, food/day, activities/day. Note travel vs. being-there split.]
WEATHER: [Same rules as above — dates, temps, conditions only; disasters only if a real threat]
ACTIVITIES: [4-5 bullets with named places — include one hidden-gem or local-favorite; no resort or hotel tie-ins]
GROUP FIT: [2-3 bullets]
VIBE CHECK: [1 sentence on pace, dress, and social energy]
TRADEOFF: [1 honest sentence — biggest downside for this group; do not soften]
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

const ADVENTURE_ACTIVITY_PATTERN =
  /\b(hiking|diving|surfing|climbing|kayak|skiing|snorkel|trek|adventure|rafting|zip.?line|scuba|cycling)\b/i

function buildTripTypeRule(
  trip: Record<string, unknown> | null,
  answers: Record<string, unknown>,
  activities?: string[],
): string {
  const tripType = String((trip?.trip_type as string) || (answers.tripLabel as string) || '').toLowerCase()
  const q1 = String(answers.q1 || '').toLowerCase()
  const combined = `${tripType} ${q1}`
  const activityStr = (activities || []).join(' ').toLowerCase()
  const rules: string[] = []

  if (/family|multigenerational|with kids|kids/.test(combined)) {
    rules.push(
      'TRIP TYPE FIT: Family/multigenerational — prioritize kid-friendly pacing in GROUP FIT; note stroller/accessibility honestly. Do not lead with adult-only nightlife unless they asked.',
    )
  }

  if (
    /bachelorette|bachelor|girls trip|guys trip|birthday party/.test(combined) ||
    (activities || []).some(a => /nightlife|party|bar/i.test(a))
  ) {
    rules.push(
      'TRIP TYPE FIT: Celebration trip — weigh nightlife, group dining, and organized group activities in GROUP FIT and ACTIVITIES. Flag crowd or dress-code realities in CONSIDER.',
    )
  }

  if (/honeymoon|couples|romantic|anniversary/.test(combined)) {
    rules.push(
      'TRIP TYPE FIT: Couples/romantic — prioritize dining, pace, and intimacy over packed sightseeing; note party-heavy destinations honestly in TRADEOFF.',
    )
  }

  if (ADVENTURE_ACTIVITY_PATTERN.test(activityStr) || ADVENTURE_ACTIVITY_PATTERN.test(combined)) {
    rules.push(
      'TRIP TYPE FIT: Adventure activities selected — assess honest difficulty, fitness level, and season fit in GROUP FIT or FOOTNOTES. Do not oversell beyond their stated level.',
    )
  }

  return rules.length ? `\n${rules.join('\n')}` : ''
}

function buildMultiStopRule(stops: string | undefined): string {
  const normalized = (stops || '').trim()
  if (!normalized || normalized === 'Just one') return ''

  if (normalized === 'Open to anything') {
    return `\nMULTI-STOP: Open to multi-stop — if this destination works as a hub, note a logical 2–3 stop routing in LOGISTICS (order, transit time, cost between stops).`
  }

  if (/^\d+\s*stops?$/i.test(normalized) || normalized === 'Other') {
    return `\nMULTI-STOP: They want ${normalized} — in LOGISTICS, suggest how to split nights across cities/regions, transit between stops (train/flight/drive), and whether trip length is enough. Flag if multi-stop eats too many days.`
  }

  return `\nMULTI-STOP: Stops preference "${normalized}" — address multi-city routing in LOGISTICS when this destination supports it.`
}

export function buildDestinationUserMessage(
  trip: Record<string, unknown> | null,
  travelerCount: number,
  answers: Record<string, unknown>,
  chatSupplement = '',
): string {
  const departure = formatDepartureCitiesForPrompt(departureCitiesFromAnswers(answers))

  const fixedDates = answers.fixedDates as { start?: string; end?: string } | undefined
  const datesLine = fixedDates?.start
    ? `${fixedDates.start} to ${fixedDates.end}`
    : (answers.dates as string) || 'Not specified'

  const regions = answers.regions as string[] | undefined
  const activities = answers.activities as string[] | undefined
  const vibe = answers.vibe as string[] | undefined

  const flexLength = answers.flexLength as string | undefined
  const travelTimeRule = buildTravelTimeRule(flexLength, departure, regions, answers.domestic as string | undefined)
  const tripTypeRule = buildTripTypeRule(trip, answers, activities)
  const multiStopRule = buildMultiStopRule(answers.stops as string | undefined)

  const eventLine = trip?.is_event_centered
    ? `Yes — ${trip.event_name} on ${trip.event_date_end && trip.event_date_end !== trip.event_date ? `${trip.event_date} to ${trip.event_date_end}` : trip.event_date} in ${trip.event_location}`
    : 'No specific event'

  const contextBlock = `<context>
TRIP TYPE: ${(trip?.trip_type as string) || 'Group trip'}
GROUP SIZE: ${travelerCount} people
EVENT: ${eventLine}
About this trip: ${answers.q1 || 'Not specified'}

Must-haves:
- Activities: ${activities?.join(', ') || 'Not specified'}
- Vibe: ${vibe?.join(', ') || 'Not specified'}
- Accommodation: ${answers.accommodation || 'No preference'}
- Budget per person: ${answers.budget || 'Not specified'}
- Popularity preference: ${answers.popularity || 'No preference'}

Deal-breakers: ${answers.q3 || 'None stated'}

Logistics:
- Departure: ${departure}
- Dates: ${datesLine}${flexLength ? ` (preferred length: ${flexLength})` : ''}
- Domestic/international: ${answers.domestic || 'No preference'}${regions?.length ? ` — regions: ${regions.join(', ')}` : ''}
- Number of stops: ${answers.stops || 'flexible'}${travelTimeRule}${tripTypeRule}${multiStopRule}${chatSupplement}
</context>`

  const taskBlock = `<task>
Generate 4 destination cards (3 main + 1 wildcard).
Before writing, internally score each candidate on budget fit, travel time, activity match, safety, weather, and group type fit — only include strong matches.
Each card must have a distinct unique selling point vs the other three (express in HIGHLIGHT).
WILDCARD must feel like insider knowledge — a place locals love that most tourists skip; different region and vibe from the three mains.
Flag ethical tourism concerns (exploitative animal experiences, severe overtourism) in FOOTNOTES when relevant for a destination.
Use the exact output format from your system instructions.
Maximum ONE destination per country — United States may appear on up to two cards.
All 4 cards must be in at least 3 different countries (typically 4 different countries).
Name specific neighborhoods, landmarks, and places in ACTIVITIES — include one hidden-gem per card.
</task>`

  return `${contextBlock}\n\n${taskBlock}`
}

export type DestinationBatch = 'all' | 'half1' | 'half2' | 'single-main' | 'wildcard-only'

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
  if (batch === 'single-main') {
    const exclude = excludeCountries.filter(Boolean)
    return `${userMessage}

Generate ONLY ONE main destination card (not a wildcard). Stop after that card's closing --- line.
${exclude.length ? `Countries already used — do NOT repeat: ${exclude.join(', ')}.` : 'Pick a strong fit for this group.'}
NAME must be a real place (City/Region, Country) — never meta text like "skipped" or "excluded".`
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
  let messages = conversationMessages

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: DESTINATION_SYSTEM_PROMPT,
      messages,
    })
    const fullText = response.content[0].type === 'text' ? response.content[0].text : ''
    const { cards, closing } = parseDestinationCards(fullText)
    const deduped = dedupeCardsByCountry(cards)

    if (deduped.length > 0 || attempt === 1) {
      return {
        message: fullText,
        cards: deduped,
        closing,
      }
    }

    messages = [
      ...conversationMessages,
      { role: 'assistant', content: fullText },
      {
        role: 'user',
        content:
          'Your response had no parseable destination cards. Reply with ONLY the card blocks — no preamble. Start immediately with DESTINATIONS: and use the exact NAME/HIGHLIGHT/CONSIDER/etc format with --- separators.',
      },
    ]
  }

  return { message: '', cards: [], closing: '' }
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
