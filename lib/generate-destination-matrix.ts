import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import {
  departureCitiesFromAnswers,
  formatDepartureCitiesForPrompt,
} from './departure-cities'
import { describeTripShapeHint, triplesGenerationTaskLine, type MatrixTabId } from './matrix-trip-shape'
import { MATRIX_CHIP_RULES } from './matrix-chip-fields'
import {
  parseDestinationMatrix,
  parseDestinationMatrixRows,
  parseDestinationMatrixRoutes,
  parseMatrixRecommendations,
  parseMatrixTriples,
  parsePairingsForCategory,
  parseSingleMatrixRowFromText,
  type DestinationMatrixCombo,
  type DestinationMatrixRow,
} from './parse-destination-matrix'
import type { PairingCategory } from './matrix-pairing-categories'
import { MATRIX_GEO_RULES, describeRoutingRealismHint } from './matrix-geo-rules'
import { truncateBlurb } from './matrix-display-helpers'
import {
  describeTripStructureContext,
  MATRIX_TRIP_STRUCTURE_RULES,
} from './matrix-trip-structure-rules'

/** Shared scoring rubric — used in monolithic and batched matrix generation. */
export const MATRIX_SCORING_WEIGHTS = `Build a weighted scoring matrix for each destination across:
- Budget fit (~25%)
- Weather / travel-window fit (~15%)
- Logistics — flights, layovers, visa (~20%)
- Experience quality — activities, vibe, food scene, nightlife, relaxation, nature (~25%)
- Must-have match and deal-breaker compliance, including safety for their profile (~15%)

SCORE is the rounded weighted composite (1–10), not a single-dimension guess. Heavily penalize any stated deal-breaker.`

/** Per-destination checklist injected into batched single-row calls. */
export const MATRIX_SINGLE_DESTINATION_TASK = `For this destination, address:
1. Match score against must-haves and deal-breakers
2. Weather during travel dates
3. Estimated total cost (flights + accommodation + daily expenses)
4. Flight time and layovers from their departure city
5. Safety for this traveler profile
6. Visa and entry requirements if relevant
7. Unique selling point — what this place does better than alternatives
8. Biggest downside — honest assessment`

export const MATRIX_SYSTEM_PROMPT = `You are Avanti's group travel AI. Compare a fixed list of destinations the group is already considering — do NOT suggest new places or add alternatives.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD.

Before writing, classify the trip purpose (vacation, honeymoon, family, adventure, digital nomad, cultural, or closest fit) from their story and trip type.

Build a weighted scoring matrix for each destination across:
- Budget fit (~25%)
- Weather / travel-window fit (~15%)
- Logistics — flights, layovers, visa (~20%)
- Experience quality — activities, vibe, food scene, nightlife, relaxation, nature (~25%)
- Must-have match and deal-breaker compliance, including safety for their profile (~15%)

SCORE is the rounded weighted composite (1–10), not a single-dimension guess. Heavily penalize any stated deal-breaker.

${MATRIX_CHIP_RULES}

${MATRIX_GEO_RULES}

${MATRIX_TRIP_STRUCTURE_RULES}

For EACH destination, address every comparison dimension in the task. Weave safety and visa/entry into LOGISTICS, GROUP FIT, or TRADEOFF — be honest and specific.

Output ONLY in this exact format:

MATRIX:
---
NAME: City, Country
SCORE: 8
HIGHLIGHT: Direct flights
CONSIDER: Peak crowds
SYNOPSIS: 2–3 sentences on why it fits or doesn't
BUDGET FIT: First line ONLY: ~$X,XXX–$X,XXX per person. Then breakdown line(s) with flights/lodging/food/activities bullets, ending with — **bold budget verdict**
WEATHER: During their travel dates, in °F
ACTIVITIES: Bullet list of 3–4 specific things to do there
LOGISTICS: Flights/travel time and layovers from their departure city; note visa/entry if relevant
GROUP FIT: Why it works for this group type/size; note safety for their profile if relevant
VIBE: One sentence atmosphere match
TRADEOFF: Honest biggest downside for this group
---
(repeat for every **unique** destination — each city appears once only — list highest SCORE first, descending)

Then output **exactly six pairings** — **two per category**, no fewer. Use ONLY cities from their list. Each pairing is exactly two single cities in a **realistic travel corridor** from their departure city (see ITINERARY SHAPE and ROUTING REALISM rules). Same-country pairings (e.g. Lisbon + Porto) are ideal; adjacent countries in one region (e.g. Spain + Portugal) are fine. Do NOT pair distant continents.

Do NOT use HIGHLIGHT or CONSIDER on pairings. **Do NOT put the category name in PAIRING TITLE** — the section header already names the category. PAIRING TITLE should be the city pair only (e.g. "Paros · Mykonos") or leave it blank.

**Travel simplicity (top 2):** Easiest routing — direct flights, minimal connections, simple ferry/train between stops.

**Budget (top 2):** RANK 1 = **cheapest pairing** (lowest combined total per-person cost on the list). RANK 2 = **splurge + balance** (the most expensive/splurge-worthy destination paired with a budget-friendly stop that offsets it — e.g. Mykonos + Puglia, Santorini + Paros). Do NOT put two cheap pairings here.

**Activity & vibe mix (top 2):** Strongest contrast in experiences — complementary, not redundant.

Each pairing block:
---
RANK: 1 or 2
PLACES: City A, Country | City B, Country
PAIRING TITLE: City A · City B
SCORE: 1–10
SYNOPSIS: 2–3 sentences — why this pair fits **this category**
ROUTING: Nights in each place + how to travel between them
BUDGET FIT: First line ONLY: ~$X,XXX–$X,XXX per person. Then breakdown bullets ending with — **bold budget verdict**
TRADEOFF: One sentence — biggest downside
---

TRAVEL SIMPLICITY PAIRINGS:
(exactly two blocks — RANK 1 and RANK 2)

BUDGET PAIRINGS:
RANK 1 — Cheapest pairing: lowest combined total per-person cost of any two-stop route on the list.
RANK 2 — Splurge + balance: most expensive/splurge stop on the list + a budget-friendly counterweight that keeps the trip within budget.
(exactly two blocks — must follow RANK 1 and RANK 2 roles above; never two budget+budget pairs)

ACTIVITY VIBE PAIRINGS:
(exactly two blocks — RANK 1 and RANK 2)

Include a TRIPLES section when their trip length supports three bases (~21+ nights) OR they chose "3 stops". Omit TRIPLES for short trips (≤14 nights) or when they want just one destination:

TRIPLES:
---
RANK: 1
PLACES: City A | City B | City C
SCORE: 8
HIGHLIGHT: Easiest travel
CONSIDER: Similar offerings
SYNOPSIS: ...
ROUTING: Night split across all three + transit between
BUDGET FIT: First line ~$X,XXX–$X,XXX per person total, then bullets
TRADEOFF: ...
---
(up to 3 ranked triples — each must be a **different set of three cities**, not reorderings of the same three; omit the entire TRIPLES section if the trip is too short for three bases)

If RECOMMENDED_SHAPE recommends three stops or ~21+ night splits across three bases, the TRIPLES section is mandatory — never recommend three stops in RECOMMENDED_SHAPE without listing routes in TRIPLES.

After all sections write:
AVANTI_MATRIX_END
Then ONE short sentence (max 25 words) naming your top pick — e.g. "Best bet: Hvar + Paros for beach, nightlife, and easy ferries."
Do NOT write a second paragraph. Do NOT repeat trip-length reasoning already in RECOMMENDED_SHAPE.

RECOMMENDED_TAB: singles | pairings | triples (use triples when three bases fit their dates)
RECOMMENDED_SHAPE: One short sentence (max 20 words) on ideal stop count for their dates — e.g. "Three ~10-night bases fit 31 nights best."

Be specific — name neighborhoods, venues, and landmarks. No generic filler.`

function buildMustHavesLine(answers: Record<string, unknown>): string {
  const activities = answers.activities as string[] | undefined
  const vibe = answers.vibe as string[] | undefined
  const regions = answers.regions as string[] | undefined

  return [
    activities?.length ? `Activities: ${activities.join(', ')}` : null,
    vibe?.length ? `Vibe: ${vibe.join(', ')}` : null,
    answers.accommodation ? `Accommodation: ${answers.accommodation}` : null,
    answers.stops ? `Trip shape: ${answers.stops}` : null,
    answers.domestic ? `Scope: ${answers.domestic}` : null,
    regions?.length ? `Regions of interest: ${regions.join(', ')}` : null,
    answers.popularity ? `Popularity preference: ${answers.popularity}` : null,
  ]
    .filter(Boolean)
    .join('; ') || 'Not specified'
}

function buildMatrixContextBlock(
  trip: Record<string, unknown> | null,
  travelerCount: number,
  answers: Record<string, unknown>,
  chatSupplement: string,
  opts: { consideringList?: string[]; mode?: MatrixGenerationMode } = {},
): string {
  const mode = opts.mode ?? 'brainstorm'
  const departure = formatDepartureCitiesForPrompt(departureCitiesFromAnswers(answers))
  const fixedDates = answers.fixedDates as { start?: string; end?: string } | undefined
  const datesLine = fixedDates?.start
    ? `${fixedDates.start} to ${fixedDates.end}`
    : (answers.dates as string) || 'Not specified'
  const flexLength = answers.flexLength as string | undefined
  const tripStory = String(answers.q1 || '').trim()
  const tripType = String((trip?.trip_type as string) || answers.tripLabel || 'Group trip').trim()
  const dealBreakers = String(answers.q3 || '').trim() || 'None stated'
  const mustHaves = buildMustHavesLine(answers)
  const tripShapeAnswers = {
    stops: answers.stops as string | undefined,
    stopsOther: answers.stopsOther as string | undefined,
    flexLength,
    fixedDates,
    dates: answers.dates as string | undefined,
  }
  const shapeHint = describeTripShapeHint(tripShapeAnswers, {
    q1: tripStory,
    q3: dealBreakers,
    chatSupplement,
  })
  const routingHint = describeRoutingRealismHint(departure)
  const consideringBlock = opts.consideringList?.length
    ? `Options I am considering:\n${opts.consideringList.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n`
    : ''
  const purposeSuffix =
    mode === 'considering'
      ? ' — infer the closest category among vacation, honeymoon, family, adventure, digital nomad, and cultural from the story below'
      : ''

  return `<context>
Trip purpose: ${tripType}${purposeSuffix}
About this trip: ${tripStory || 'Not specified'}
Group size: ${travelerCount} people
Travel window: ${datesLine}${flexLength ? ` (preferred length: ${flexLength})` : ''}
Budget: ${answers.budget || 'Not specified'} per person (total trip cost including flights, lodging, food, and activities)
Must-haves: ${mustHaves}
  (Score broadly against beach/water, mountains/nature, food scene, nightlife, relaxation/wellness, safety for this group, and stated activity/vibe fit — not just literal keyword matches)
Deal-breakers: ${dealBreakers}
  (Treat as hard filters where stated — e.g. long flights, extreme heat or cold, visa hassle, crowds, safety concerns, or anything they explicitly ruled out)
Departure city: ${departure || 'Not specified'}
${consideringBlock}Trip shape guidance: ${shapeHint}
Routing realism: ${routingHint}

${describeTripStructureContext(answers, chatSupplement)}
${chatSupplement}
</context>`
}

function buildMatrixUserMessage(
  trip: Record<string, unknown> | null,
  travelerCount: number,
  answers: Record<string, unknown>,
  consideringList: string[],
  chatSupplement = '',
): string {
  const context = buildMatrixContextBlock(trip, travelerCount, answers, chatSupplement, {
    consideringList,
    mode: 'considering',
  })
  const triplesTask = triplesGenerationTaskLine({
    stops: answers.stops as string | undefined,
    stopsOther: answers.stopsOther as string | undefined,
    flexLength: answers.flexLength as string | undefined,
    fixedDates: answers.fixedDates as { start?: string; end?: string } | undefined,
    dates: answers.dates as string | undefined,
  }, tripShapePromptOpts(answers, chatSupplement))

  return `${context}

<task>
Compare my destination options systematically across budget, weather, logistics, and experience quality using a weighted scoring matrix.

${MATRIX_SINGLE_DESTINATION_TASK}

Create a comparison matrix and **exactly six pairings** (two each in TRAVEL SIMPLICITY, BUDGET, and ACTIVITY VIBE sections). For BUDGET: RANK 1 must be the cheapest pairing; RANK 2 must be splurge + budget balance — not two value pairs.
HIGHLIGHT and CONSIDER on single-destination MATRIX rows must be 2–4 word noun-phrase labels only — never sentences or fragments; never repeat the same CONSIDER twice. Pairings use PAIRING TITLE instead (no HIGHLIGHT/CONSIDER on pairings).
${triplesTask}
Evaluate every destination in my list — do not add, remove, or substitute options. Output MATRIX, all three pairing sections, TRIPLES (when required above), AVANTI_MATRIX_END, RECOMMENDED_TAB, and RECOMMENDED_SHAPE.
</task>`
}

export type MatrixGenerationMode = 'considering' | 'brainstorm'

export const BRAINSTORM_MATRIX_SYSTEM_PROMPT = `You are Avanti's group travel AI. Recommend destinations and multi-stop routes for a group that wants help brainstorming — you choose the places.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD.

Before writing, classify the trip purpose (vacation, honeymoon, family, adventure, digital nomad, cultural, or closest fit) from their story and trip type.

${MATRIX_SCORING_WEIGHTS}

${MATRIX_CHIP_RULES}

${MATRIX_GEO_RULES}

${MATRIX_TRIP_STRUCTURE_RULES}

Output ONLY in this exact format:

MATRIX:
---
NAME: City, Country
SCORE: 8
HIGHLIGHT: Direct flights
CONSIDER: Peak crowds
SYNOPSIS: 2–3 sentences on why it fits this group
BUDGET FIT: First line ONLY: ~$X,XXX–$X,XXX per person. Then breakdown line(s) with flights/lodging/food/activities bullets, ending with — **bold budget verdict**
WEATHER: During their travel dates, in °F
ACTIVITIES: Bullet list of 3–4 specific things to do there
LOGISTICS: Flights/travel time and layovers from their departure city; note visa/entry if relevant
GROUP FIT: Why it works for this group type/size
VIBE: One sentence atmosphere match
TRADEOFF: Honest biggest downside for this group
---
(repeat for **8–10 distinct unique cities** — never duplicate a city — highest SCORE first)

Then output **exactly six pairings** — **two per category**, no fewer. Use destinations from your MATRIX. Each pairing is exactly two single cities in a **realistic travel corridor** from their departure city. Same-country or same-region pairings only — do NOT pair Europe with South America, Europe with Oceania, or other distant-continent combos for a typical 2-week trip.

Do NOT use HIGHLIGHT or CONSIDER on pairings. PAIRING TITLE = city pair only (e.g. "Paros · Mykonos") or leave blank.

**Travel simplicity (top 2):** Easiest routing — direct flights, minimal connections, simple ferry/train between stops.

**Budget (top 2):** RANK 1 = **cheapest pairing** (lowest combined total per-person cost). RANK 2 = **splurge + balance** (most expensive/splurge destination + budget-friendly offset — e.g. Mykonos + Puglia). Do NOT submit two cheap pairs.

**Activity & vibe mix (top 2):** Strongest contrast in experiences — complementary, not redundant.

Each pairing block:
---
RANK: 1 or 2
PLACES: City A, Country | City B, Country
PAIRING TITLE: City A · City B
SCORE: 1–10
SYNOPSIS: 2–3 sentences — why this pair fits **this category**
ROUTING: Nights in each place + how to travel between them
BUDGET FIT: First line ONLY: ~$X,XXX–$X,XXX per person. Then breakdown bullets ending with — **bold budget verdict**
TRADEOFF: One sentence — biggest downside
---

TRAVEL SIMPLICITY PAIRINGS:
(exactly two blocks — RANK 1 and RANK 2)

BUDGET PAIRINGS:
RANK 1 — Cheapest pairing: lowest combined total per-person cost of any two-stop route on the list.
RANK 2 — Splurge + balance: most expensive/splurge stop on the list + a budget-friendly counterweight that keeps the trip within budget.
(exactly two blocks — must follow RANK 1 and RANK 2 roles above; never two budget+budget pairs)

ACTIVITY VIBE PAIRINGS:
(exactly two blocks — RANK 1 and RANK 2)

Include a TRIPLES section when their trip length supports three bases (~21+ nights) OR they chose "3 stops". Omit TRIPLES for short trips or one-stop-only preferences:

TRIPLES:
---
RANK: 1
PLACES: City A | City B | City C
SCORE: 8
SYNOPSIS: ...
ROUTING: Night split across all three + transit between
BUDGET FIT: First line ~$X,XXX–$X,XXX per person total, then bullets
TRADEOFF: ...
---
(up to 3 ranked triples — each must be a **different set of three cities**, not reorderings of the same three; omit TRIPLES section if the trip is too short for three bases)

If RECOMMENDED_SHAPE recommends three stops or ~21+ night splits across three bases, the TRIPLES section is mandatory — never recommend three stops in RECOMMENDED_SHAPE without listing routes in TRIPLES.

After all sections write:
AVANTI_MATRIX_END
Then ONE short sentence (max 25 words) naming your top pick.
RECOMMENDED_TAB: singles | pairings | triples (use triples when three bases fit their dates)
RECOMMENDED_SHAPE: One short sentence (max 20 words) on ideal stop count for their dates.

Be specific — name neighborhoods, venues, and landmarks. No generic filler.`

function buildBrainstormMatrixUserMessage(
  trip: Record<string, unknown> | null,
  travelerCount: number,
  answers: Record<string, unknown>,
  chatSupplement = '',
): string {
  const context = buildMatrixContextBlock(trip, travelerCount, answers, chatSupplement, {
    mode: 'brainstorm',
  })
  const triplesTask = triplesGenerationTaskLine({
    stops: answers.stops as string | undefined,
    stopsOther: answers.stopsOther as string | undefined,
    flexLength: answers.flexLength as string | undefined,
    fixedDates: answers.fixedDates as { start?: string; end?: string } | undefined,
    dates: answers.dates as string | undefined,
  }, tripShapePromptOpts(answers, chatSupplement))

  return `${context}

<task>
Recommend 8–10 **unique single-city** destinations (each city once in MATRIX), score each using the weighted matrix, then create exactly six two-city pairings in **realistic regional corridors** (two per TRAVEL SIMPLICITY, BUDGET, ACTIVITY VIBE).

${MATRIX_SINGLE_DESTINATION_TASK}

No duplicate cities in MATRIX; no duplicate pairs across categories; no distant-continent pairings for a ~2-week trip.
${triplesTask}
Output MATRIX, all three pairing sections, TRIPLES (when required above), AVANTI_MATRIX_END, RECOMMENDED_TAB, and RECOMMENDED_SHAPE.
</task>`
}

const REGENERATE_MATRIX_ROW_SYSTEM = `You are Avanti's group travel AI. Output exactly ONE destination comparison row.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD.

Before writing, classify the trip purpose from their story and trip type.

${MATRIX_SCORING_WEIGHTS}

${MATRIX_CHIP_RULES}

${MATRIX_GEO_RULES}

Output exactly ONE block in this format — nothing else:
---
NAME: City, Country
SCORE: 8
HIGHLIGHT: 2-4 word label
CONSIDER: 2-4 word label
SYNOPSIS: 2–3 sentences
BUDGET FIT: First line ONLY: ~$X,XXX–$X,XXX per person. Then breakdown bullets ending with — **bold budget verdict**
WEATHER: During their travel dates, in °F
ACTIVITIES: 3–4 bullets
LOGISTICS: Flights from their departure city
GROUP FIT: Why it fits this group
VIBE: One sentence
TRADEOFF: Biggest downside
---

Pick a destination NOT in the "keep" list (except when replacing a named destination). All costs USD, temps °F.`

function formatExistingPairingsBlock(labels: string[]): string {
  if (!labels.length) return ''
  return `\nPairings already used in other categories (do NOT repeat these city pairs in any order):\n${labels.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n`
}

/** Condensed step-1 scores passed into pairing/triple phases. */
export function formatScoredDestinationsBlock(rows: DestinationMatrixRow[]): string {
  if (!rows.length) return ''
  const lines = rows.map(row => {
    const logistics = truncateBlurb(row.logistics, 100)
    const weather = truncateBlurb(row.weather, 70)
    const group = truncateBlurb(row.groupFit, 70)
    const tradeoff = truncateBlurb(row.tradeoff, 70)
    const chips = [row.highlight, row.consider].filter(Boolean).join(' / ')
    return `- ${row.name} — score ${row.overallScore}/10${chips ? ` (${chips})` : ''} | Logistics: ${logistics} | Weather: ${weather} | Group: ${group} | Tradeoff: ${tradeoff}`
  })
  return `\nScored destinations from step 1 (use these flight/weather/group notes when picking routes — do not contradict them):\n${lines.join('\n')}\n`
}

const PAIRINGS_TRIPLES_OUTPUT = `Then output **exactly six pairings** — **two per category**, no fewer. Use ONLY cities from the destination list provided. Each pairing is exactly two single cities in a **realistic travel corridor** — same country or adjacent countries in one region. Each unordered city pair appears **once total** across all categories. Do NOT pair distant continents (Europe + South America, Europe + Oceania, etc.).

Do NOT use HIGHLIGHT or CONSIDER on pairings. **Do NOT put the category name in PAIRING TITLE** — the section header already names the category. PAIRING TITLE should be the city pair only (e.g. "Paros · Mykonos") or leave it blank.

**Travel simplicity (top 2):** Easiest routing — direct flights, minimal connections, simple ferry/train between stops.

**Budget (top 2):** RANK 1 = **cheapest pairing** (lowest combined total per-person cost on the list). RANK 2 = **splurge + balance** (the most expensive/splurge-worthy destination paired with a budget-friendly stop that offsets it). Do NOT put two cheap pairings here.

**Activity & vibe mix (top 2):** Strongest contrast in experiences — complementary, not redundant.

Each pairing block:
---
RANK: 1 or 2
PLACES: City A, Country | City B, Country
PAIRING TITLE: City A · City B
SCORE: 1–10
SYNOPSIS: 2–3 sentences — why this pair fits **this category**
ROUTING: Nights in each place + how to travel between them
BUDGET FIT: First line ONLY: ~$X,XXX–$X,XXX per person. Then breakdown bullets ending with — **bold budget verdict**
TRADEOFF: One sentence — biggest downside
---

TRAVEL SIMPLICITY PAIRINGS:
(exactly two blocks — RANK 1 and RANK 2)

BUDGET PAIRINGS:
RANK 1 — Cheapest pairing: lowest combined total per-person cost of any two-stop route on the list.
RANK 2 — Splurge + balance: most expensive/splurge stop on the list + a budget-friendly counterweight.
(exactly two blocks)

ACTIVITY VIBE PAIRINGS:
(exactly two blocks — RANK 1 and RANK 2)

Include a TRIPLES section when their trip length supports three bases (~21+ nights) OR they chose "3 stops". Omit TRIPLES for short trips (≤14 nights) or when they want just one destination:

TRIPLES:
---
RANK: 1
PLACES: City A | City B | City C
SCORE: 8
SYNOPSIS: ...
ROUTING: Night split across all three + transit between
BUDGET FIT: First line ~$X,XXX–$X,XXX per person total, then bullets
TRADEOFF: ...
---
(up to 3 ranked triples — each must be a **different set of three cities**, not reorderings of the same three; omit the entire TRIPLES section if the trip is too short for three bases)

If RECOMMENDED_SHAPE recommends three stops or ~21+ night splits across three bases, the TRIPLES section is mandatory.

After all sections write:
AVANTI_MATRIX_END
Then ONE short sentence (max 25 words) naming your top pick.
RECOMMENDED_TAB: singles | pairings | triples (use triples when three bases fit their dates)
RECOMMENDED_SHAPE: One short sentence (max 20 words) on ideal stop count for their dates.`

const MATRIX_ROWS_ONLY_SYSTEM = `You are Avanti's group travel AI. Score destinations for a group trip comparison.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD.

${MATRIX_CHIP_RULES}

${MATRIX_GEO_RULES}

${MATRIX_SCORING_WEIGHTS}

Output ONLY in this exact format — no pairings, no triples:

MATRIX:
---
NAME: City, Country
SCORE: 8
HIGHLIGHT: Direct flights
CONSIDER: Peak crowds
SYNOPSIS: 2–3 sentences
BUDGET FIT: First line ONLY: ~$X,XXX–$X,XXX per person. Then breakdown bullets ending with — **bold budget verdict**
WEATHER: During their travel dates, in °F
ACTIVITIES: Bullet list of 3–4 specific things to do there
LOGISTICS: Flights/travel time and layovers from their departure city; note visa/entry if relevant
GROUP FIT: Why it works for this group type/size; note safety if relevant
VIBE: One sentence atmosphere match
TRADEOFF: Honest biggest downside for this group
---
(repeat for every destination — list highest SCORE first, descending)

AVANTI_MATRIX_END
Then ONE short sentence (max 25 words) naming your top single destination.`

const MATRIX_ROUTES_SYSTEM = `You are Avanti's group travel AI. Create multi-stop route pairings and triples from a fixed destination list.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD.

${MATRIX_CHIP_RULES}

${MATRIX_GEO_RULES}

${MATRIX_TRIP_STRUCTURE_RULES}

${PAIRINGS_TRIPLES_OUTPUT}

Be specific — name neighborhoods, venues, and landmarks. No generic filler.`

type MatrixGenOpts = {
  trip: Record<string, unknown> | null
  travelerCount: number
  answers: Record<string, unknown>
  consideringList: string[]
  chatSupplement?: string
  mode?: MatrixGenerationMode
  matrixRows?: DestinationMatrixRow[]
}

function tripShapePromptOpts(
  answers: Record<string, unknown>,
  chatSupplement = '',
): { q1?: string; q3?: string; chatSupplement?: string } {
  return {
    q1: String(answers.q1 || ''),
    q3: String(answers.q3 || ''),
    chatSupplement,
  }
}

async function callClaude(client: Anthropic, system: string, userMessage: string, maxTokens: number): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    temperature: 0,
    system,
    messages: [{ role: 'user', content: userMessage }],
  })
  return response.content
    .filter(b => b.type === 'text')
    .map(b => (b.type === 'text' ? b.text : ''))
    .join('\n')
}

const PARSE_RETRY_ATTEMPTS = 3

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

/** Retry Claude calls when the model response fails to parse. */
async function callClaudeUntilParsed<T>(
  client: Anthropic,
  system: string,
  userMessage: string,
  maxTokens: number,
  parse: (text: string) => T | null,
  label: string,
): Promise<T | null> {
  let lastPreview = ''
  for (let attempt = 0; attempt < PARSE_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(900 * attempt)
    const text = await callClaude(client, system, userMessage, maxTokens)
    lastPreview = text.slice(0, 400)
    const parsed = parse(text)
    if (parsed != null) return parsed
    console.warn(`generate-destination-matrix: ${label} parse failed`, {
      attempt: attempt + 1,
      textPreview: lastPreview,
    })
  }
  return null
}

/** Phase 1 — score single destinations only (keeps serverless calls under timeout). */
export async function generateDestinationMatrixRows(
  client: Anthropic,
  opts: MatrixGenOpts,
): Promise<DestinationMatrixRow[]> {
  const mode = opts.mode ?? (opts.consideringList.length > 0 ? 'considering' : 'brainstorm')
  const context = buildMatrixContextBlock(
    opts.trip,
    opts.travelerCount,
    opts.answers,
    opts.chatSupplement || '',
    {
      mode,
      consideringList: mode === 'considering' ? opts.consideringList : undefined,
    },
  )

  const listBlock =
    mode === 'considering'
      ? opts.consideringList.map((d, i) => `${i + 1}. ${d}`).join('\n')
      : ''

  const task =
    mode === 'considering'
      ? `Score every destination in my list — do not add, remove, or substitute options:\n${listBlock}`
      : 'Recommend **6 distinct destinations** for this group and score each in the MATRIX.'

  const userMessage = `${context}\n\n<task>\n${task}\nOutput MATRIX rows only, then AVANTI_MATRIX_END and one summary sentence.\n</task>`

  const text = await callClaude(client, MATRIX_ROWS_ONLY_SYSTEM, userMessage, mode === 'brainstorm' ? 7000 : 5000)
  return parseDestinationMatrixRows(text)
}

/** Phase 2 — pairings and triples from scored destinations. */
export async function generateDestinationMatrixRoutes(
  client: Anthropic,
  opts: MatrixGenOpts & { destinationNames: string[] },
): Promise<Omit<ReturnType<typeof parseDestinationMatrix>, 'rows' | 'rawBlock'>> {
  const mode = opts.mode ?? (opts.consideringList.length > 0 ? 'considering' : 'brainstorm')
  const context = buildMatrixContextBlock(
    opts.trip,
    opts.travelerCount,
    opts.answers,
    opts.chatSupplement || '',
    {
      mode,
      consideringList: mode === 'considering' ? opts.consideringList : undefined,
    },
  )
  const tripShapeAnswers = {
    stops: opts.answers.stops as string | undefined,
    stopsOther: opts.answers.stopsOther as string | undefined,
    flexLength: opts.answers.flexLength as string | undefined,
    fixedDates: opts.answers.fixedDates as { start?: string; end?: string } | undefined,
    dates: opts.answers.dates as string | undefined,
  }
  const triplesTask = triplesGenerationTaskLine(
    tripShapeAnswers,
    tripShapePromptOpts(opts.answers, opts.chatSupplement || ''),
  )
  const destList = opts.destinationNames.map((d, i) => `${i + 1}. ${d}`).join('\n')
  const scoredBlock = formatScoredDestinationsBlock(opts.matrixRows ?? [])

  const userMessage = `${context}
${scoredBlock}
Destinations from the matrix (use ONLY these — do not add new places):
${destList}

<task>
Create exactly six two-stop pairings (two per TRAVEL SIMPLICITY, BUDGET, ACTIVITY VIBE) using the destinations above. For BUDGET: RANK 1 = cheapest pairing, RANK 2 = splurge + budget-friendly balance.
${triplesTask}
Output all pairing sections, TRIPLES (when required above), AVANTI_MATRIX_END, RECOMMENDED_TAB, and RECOMMENDED_SHAPE.
</task>`

  const text = await callClaude(client, MATRIX_ROUTES_SYSTEM, userMessage, 7000)
  return parseDestinationMatrixRoutes(text)
}

export const BRAINSTORM_MATRIX_DESTINATION_COUNT = 6

const PAIRING_CATEGORY_TASKS: Record<PairingCategory, { header: string; task: string }> = {
  travel_simplicity: {
    header: 'TRAVEL SIMPLICITY PAIRINGS',
    task: 'Pick the two easiest two-stop routes — direct flights, minimal connections, simple ferry/train between stops.',
  },
  budget: {
    header: 'BUDGET PAIRINGS',
    task: 'RANK 1 = cheapest pairing (lowest combined per-person cost). RANK 2 = splurge + balance (most expensive stop paired with a budget-friendly counterweight). Never two budget-only pairs.',
  },
  activity_vibe: {
    header: 'ACTIVITY VIBE PAIRINGS',
    task: 'Pick the two pairings with the strongest contrast in experiences — complementary vibes, not redundant.',
  },
}

const SINGLE_MATRIX_ROW_SYSTEM = REGENERATE_MATRIX_ROW_SYSTEM

/** One brainstorm destination — small enough to stay under serverless timeouts. */
export async function generateBrainstormMatrixRow(
  client: Anthropic,
  opts: MatrixGenOpts & { existingNames: string[] },
): Promise<DestinationMatrixRow | null> {
  const context = buildMatrixContextBlock(
    opts.trip,
    opts.travelerCount,
    opts.answers,
    opts.chatSupplement || '',
    { mode: 'brainstorm' },
  )
  const keepList = opts.existingNames.length
    ? opts.existingNames.map((n, i) => `${i + 1}. ${n}`).join('\n')
    : '(none yet)'

  const userMessage = `${context}

<task>
Suggest ONE new **unique single-city** destination for this group that is NOT already listed below.

${MATRIX_SINGLE_DESTINATION_TASK}

Output a single MATRIX row block only.
Already suggested:
${keepList}
</task>`

  return callClaudeUntilParsed(
    client,
    SINGLE_MATRIX_ROW_SYSTEM,
    userMessage,
    1800,
    parseSingleMatrixRowFromText,
    'brainstorm matrix row',
  )
}

/** Score one fixed destination from a considering list. */
export async function generateConsideringMatrixRow(
  client: Anthropic,
  opts: MatrixGenOpts & { destinationName: string },
): Promise<DestinationMatrixRow | null> {
  const context = buildMatrixContextBlock(
    opts.trip,
    opts.travelerCount,
    opts.answers,
    opts.chatSupplement || '',
    { mode: 'considering', consideringList: opts.consideringList },
  )

  const userMessage = `${context}

<task>
Score ONLY "${opts.destinationName}" for this group — do not suggest alternatives.

${MATRIX_SINGLE_DESTINATION_TASK}

Output one MATRIX row block only.
</task>`

  return callClaudeUntilParsed(
    client,
    SINGLE_MATRIX_ROW_SYSTEM,
    userMessage,
    1800,
    parseSingleMatrixRowFromText,
    `considering matrix row (${opts.destinationName})`,
  )
}

/** Two pairings for one category — travel simplicity, budget, or activity/vibe. */
export async function generateMatrixPairingCategory(
  client: Anthropic,
  opts: MatrixGenOpts & {
    destinationNames: string[]
    category: PairingCategory
    existingPairings?: string[]
  },
): Promise<DestinationMatrixCombo[]> {
  const { header, task } = PAIRING_CATEGORY_TASKS[opts.category]
  const mode = opts.mode ?? (opts.consideringList.length > 0 ? 'considering' : 'brainstorm')
  const context = buildMatrixContextBlock(
    opts.trip,
    opts.travelerCount,
    opts.answers,
    opts.chatSupplement || '',
    {
      mode,
      consideringList: mode === 'considering' ? opts.consideringList : undefined,
    },
  )
  const destList = opts.destinationNames.map((d, i) => `${i + 1}. ${d}`).join('\n')
  const usedPairings = formatExistingPairingsBlock(opts.existingPairings ?? [])
  const scoredBlock = formatScoredDestinationsBlock(opts.matrixRows ?? [])

  const system = `You are Avanti's group travel AI. Output ONLY a ${header} section with exactly two ranked pairing blocks.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD.

${MATRIX_GEO_RULES}

${MATRIX_TRIP_STRUCTURE_RULES}

${MATRIX_CHIP_RULES}

Each pairing block:
---
RANK: 1 or 2
PLACES: City A, Country | City B, Country
PAIRING TITLE: City A · City B
SCORE: 1–10
SYNOPSIS: 2–3 sentences
ROUTING: Nights in each place + how to travel between them — realistic from their departure city, no backtracking across oceans
BUDGET FIT: First line ONLY: ~$X,XXX–$X,XXX per person. Then breakdown bullets ending with — **bold budget verdict**
TRADEOFF: One sentence
---

Do NOT use HIGHLIGHT or CONSIDER on pairings. Use ONLY destinations from the provided list. Each unordered city pair must be unique.`

  const userMessage = `${context}
${scoredBlock}${usedPairings}
Destinations (use ONLY these):
${destList}

<task>
${task}
Use realistic regional corridors from their departure city — same country or adjacent countries in one region only.
Output ${header}: with exactly two --- blocks (RANK 1 and RANK 2). Nothing else.
</task>`

  const pairings = await callClaudeUntilParsed(
    client,
    system,
    userMessage,
    2800,
    text => {
      const parsed = parsePairingsForCategory(text, opts.category)
      return parsed.length > 0 ? parsed : null
    },
    `${opts.category} pairings`,
  )
  return pairings ?? []
}

/** Up to three three-stop routes when the trip length supports them. */
export async function generateMatrixTriples(
  client: Anthropic,
  opts: MatrixGenOpts & { destinationNames: string[]; existingPairings?: string[] },
): Promise<DestinationMatrixCombo[]> {
  const mode = opts.mode ?? (opts.consideringList.length > 0 ? 'considering' : 'brainstorm')
  const context = buildMatrixContextBlock(
    opts.trip,
    opts.travelerCount,
    opts.answers,
    opts.chatSupplement || '',
    {
      mode,
      consideringList: mode === 'considering' ? opts.consideringList : undefined,
    },
  )
  const tripShapeAnswers = {
    stops: opts.answers.stops as string | undefined,
    stopsOther: opts.answers.stopsOther as string | undefined,
    flexLength: opts.answers.flexLength as string | undefined,
    fixedDates: opts.answers.fixedDates as { start?: string; end?: string } | undefined,
    dates: opts.answers.dates as string | undefined,
  }
  const destList = opts.destinationNames.map((d, i) => `${i + 1}. ${d}`).join('\n')
  const usedPairings = formatExistingPairingsBlock(opts.existingPairings ?? [])
  const scoredBlock = formatScoredDestinationsBlock(opts.matrixRows ?? [])

  const system = `You are Avanti's group travel AI. Output ONLY a TRIPLES section with up to 3 ranked three-stop routes.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD.

${MATRIX_GEO_RULES}

${MATRIX_TRIP_STRUCTURE_RULES}

Each block:
---
RANK: 1
PLACES: City A, Country | City B, Country | City C, Country
SCORE: 8
SYNOPSIS: ...
ROUTING: Night split across all three + realistic transit between from their departure city
BUDGET FIT: First line ~$X,XXX–$X,XXX per person total, then bullets
TRADEOFF: ...
---

Use ONLY destinations from the provided list. Each route must use a different set of three cities — not reorderings of the same three.`

  const userMessage = `${context}
${scoredBlock}${usedPairings}
Destinations (use ONLY these):
${destList}

<task>
${triplesGenerationTaskLine(tripShapeAnswers, tripShapePromptOpts(opts.answers, opts.chatSupplement || ''))}
Prefer three cities in one region or a sensible travel loop — no random multi-continent stitching.
Output TRIPLES: with up to 3 ranked blocks. Nothing else.
</task>`

  const text = await callClaude(client, system, userMessage, 3500)
  return parseMatrixTriples(text)
}

/** Short summary + recommended tab/shape after matrix and routes are built. */
export async function generateMatrixRecommendations(
  client: Anthropic,
  opts: MatrixGenOpts & { destinationNames: string[] },
): Promise<{ summary: string; recommendedTab: MatrixTabId | null; recommendedShape: string }> {
  const mode = opts.mode ?? (opts.consideringList.length > 0 ? 'considering' : 'brainstorm')
  const context = buildMatrixContextBlock(
    opts.trip,
    opts.travelerCount,
    opts.answers,
    opts.chatSupplement || '',
    {
      mode,
      consideringList: mode === 'considering' ? opts.consideringList : undefined,
    },
  )
  const destList = opts.destinationNames.map((d, i) => `${i + 1}. ${d}`).join('\n')
  const scoredBlock = formatScoredDestinationsBlock(opts.matrixRows ?? [])

  const userMessage = `${context}
${scoredBlock}
Destinations scored:
${destList}

<task>
Write AVANTI_MATRIX_END, then ONE short sentence (max 25 words) naming your top pick for this group.
Then RECOMMENDED_TAB: singles | pairings | triples
Then RECOMMENDED_SHAPE: one short sentence (max 20 words) on ideal stop count for their dates.
</task>`

  const text = await callClaude(
    client,
    'You are Avanti\'s group travel AI. Output only AVANTI_MATRIX_END, one summary sentence, RECOMMENDED_TAB, and RECOMMENDED_SHAPE.',
    userMessage,
    400,
  )
  return parseMatrixRecommendations(text)
}

export async function generateDestinationMatrix(
  client: Anthropic,
  opts: {
    trip: Record<string, unknown> | null
    travelerCount: number
    answers: Record<string, unknown>
    consideringList: string[]
    chatSupplement?: string
    mode?: MatrixGenerationMode
  }
): Promise<ReturnType<typeof parseDestinationMatrix>> {
  const mode = opts.mode ?? (opts.consideringList.length > 0 ? 'considering' : 'brainstorm')
  const userMessage =
    mode === 'brainstorm'
      ? buildBrainstormMatrixUserMessage(
          opts.trip,
          opts.travelerCount,
          opts.answers,
          opts.chatSupplement || '',
        )
      : buildMatrixUserMessage(
          opts.trip,
          opts.travelerCount,
          opts.answers,
          opts.consideringList,
          opts.chatSupplement || '',
        )

  const messages: MessageParam[] = [{ role: 'user', content: userMessage }]

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 12000,
    temperature: 0,
    system: mode === 'brainstorm' ? BRAINSTORM_MATRIX_SYSTEM_PROMPT : MATRIX_SYSTEM_PROMPT,
    messages,
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b.type === 'text' ? b.text : ''))
    .join('\n')

  return parseDestinationMatrix(text)
}

export async function regenerateMatrixDestinationRow(
  client: Anthropic,
  opts: {
    trip: Record<string, unknown> | null
    travelerCount: number
    answers: Record<string, unknown>
    replaceName: string
    keepNames: string[]
    chatSupplement?: string
    mode?: MatrixGenerationMode
  },
): Promise<DestinationMatrixRow | null> {
  const mode = opts.mode ?? 'brainstorm'
  const context = buildMatrixContextBlock(
    opts.trip,
    opts.travelerCount,
    opts.answers,
    opts.chatSupplement || '',
    { mode },
  )
  const keepList = opts.keepNames.filter(n => n !== opts.replaceName).join('\n')

  const userMessage = `${context}

<task>
Suggest one fresh single-city alternative to replace "${opts.replaceName}".

${MATRIX_SINGLE_DESTINATION_TASK}

Keep these other destinations (do NOT duplicate):
${keepList || '(none)'}

Output one MATRIX row block only.
</task>`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    temperature: 0,
    system: REGENERATE_MATRIX_ROW_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b.type === 'text' ? b.text : ''))
    .join('\n')

  return parseSingleMatrixRowFromText(text)
}
