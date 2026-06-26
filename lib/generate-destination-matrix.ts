import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import {
  departureCitiesFromAnswers,
  formatDepartureCitiesForPrompt,
} from './departure-cities'
import { describeTripShapeHint, triplesGenerationTaskLine } from './matrix-trip-shape'
import { MATRIX_CHIP_RULES } from './matrix-chip-fields'
import {
  parseDestinationMatrix,
  parseDestinationMatrixRows,
  parseDestinationMatrixRoutes,
  parseSingleMatrixRowFromText,
  type DestinationMatrixRow,
} from './parse-destination-matrix'

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
(repeat for every destination — list highest SCORE first, descending)

Then output **exactly six pairings** — **two per category**, no fewer. Use ONLY cities from their list. **Cross-country pairings are fine** when both places are on the list and routing is practical — do not limit pairings to one country. Skip only absurd geography (e.g. back-to-back antipodes with no logical routing).

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
(up to 3 ranked triples; omit the entire TRIPLES section if the trip is too short for three bases)

If RECOMMENDED_SHAPE recommends three stops or ~21+ night splits across three bases, the TRIPLES section is mandatory — never recommend three stops in RECOMMENDED_SHAPE without listing routes in TRIPLES.

After all sections write:
AVANTI_MATRIX_END
Then ONE short sentence (max 25 words) naming your top pick — e.g. "Best bet: Hvar + Paros for beach, nightlife, and easy ferries."
Do NOT write a second paragraph. Do NOT repeat trip-length reasoning already in RECOMMENDED_SHAPE.

RECOMMENDED_TAB: singles | pairings | triples (use triples when three bases fit their dates)
RECOMMENDED_SHAPE: One short sentence (max 20 words) on ideal stop count for their dates — e.g. "Three ~10-night bases fit 31 nights best."

Be specific — name neighborhoods, venues, and landmarks. No generic filler.`

function buildMatrixUserMessage(
  trip: Record<string, unknown> | null,
  travelerCount: number,
  answers: Record<string, unknown>,
  consideringList: string[],
  chatSupplement = '',
): string {
  const departure = formatDepartureCitiesForPrompt(departureCitiesFromAnswers(answers))
  const fixedDates = answers.fixedDates as { start?: string; end?: string } | undefined
  const datesLine = fixedDates?.start
    ? `${fixedDates.start} to ${fixedDates.end}`
    : (answers.dates as string) || 'Not specified'
  const flexLength = answers.flexLength as string | undefined
  const activities = answers.activities as string[] | undefined
  const vibe = answers.vibe as string[] | undefined

  const tripStory = String(answers.q1 || '').trim()
  const tripType = String((trip?.trip_type as string) || 'Group trip').trim()

  const mustHaves = [
    activities?.length ? `Activities: ${activities.join(', ')}` : null,
    vibe?.length ? `Vibe: ${vibe.join(', ')}` : null,
    answers.accommodation ? `Accommodation: ${answers.accommodation}` : null,
    answers.stops ? `Trip shape: ${answers.stops}` : null,
  ]
    .filter(Boolean)
    .join('; ') || 'Not specified'

  const dealBreakers = String(answers.q3 || '').trim() || 'None stated'

  const listBlock = consideringList.map((d, i) => `${i + 1}. ${d}`).join('\n')

  const tripShapeAnswers = {
    stops: answers.stops as string | undefined,
    stopsOther: answers.stopsOther as string | undefined,
    flexLength,
    fixedDates,
    dates: answers.dates as string | undefined,
  }
  const shapeHint = describeTripShapeHint(tripShapeAnswers)
  const triplesTask = triplesGenerationTaskLine(tripShapeAnswers)

  return `<context>
Trip purpose: ${tripType} — infer the closest category among vacation, honeymoon, family, adventure, digital nomad, and cultural from the story below
About this trip: ${tripStory || 'Not specified'}
Group size: ${travelerCount} people
Travel window: ${datesLine}${flexLength ? ` (preferred length: ${flexLength})` : ''}
Budget: ${answers.budget || 'Not specified'} per person (total trip cost including flights, lodging, food, and activities)
Must-haves: ${mustHaves}
  (Score broadly against beach/water, mountains/nature, food scene, nightlife, relaxation/wellness, safety for this group, and stated activity/vibe fit — not just literal keyword matches)
Deal-breakers: ${dealBreakers}
  (Treat as hard filters where stated — e.g. long flights, extreme heat or cold, visa hassle, crowds, safety concerns, or anything they explicitly ruled out)
Departure city: ${departure || 'Not specified'}
Options I am considering:
${listBlock}
Trip shape guidance: ${shapeHint}
${chatSupplement}
</context>

<task>
Compare my destination options systematically across budget, weather, logistics, and experience quality using a weighted scoring matrix.

For each destination:
1. Match score against my must-haves and deal-breakers
2. Weather during my travel dates
3. Estimated total cost (flights + accommodation + daily expenses)
4. Flight time and layover situation from ${departure || 'my departure city'}
5. Safety assessment for my traveler profile
6. Visa and entry requirements
7. Unique selling point — the one thing this destination does better than the others
8. Biggest downside — honest assessment

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

Build a weighted scoring matrix for each destination across:
- Budget fit (~25%)
- Weather / travel-window fit (~15%)
- Logistics — flights, layovers, visa (~20%)
- Experience quality — activities, vibe, food scene, nightlife, relaxation, nature (~25%)
- Must-have match and deal-breaker compliance, including safety for their profile (~15%)

${MATRIX_CHIP_RULES}

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
(repeat for **8–10 distinct destinations** — highest SCORE first)

Then output **exactly six pairings** — **two per category**, no fewer. Use destinations from your MATRIX. **Cross-country pairings are encouraged** when they create a stronger trip (e.g. Croatia + Greece, Spain + Portugal) — do not limit to one country. Skip only absurd routing.

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
(up to 3 ranked triples; omit TRIPLES section if the trip is too short for three bases)

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
  const departure = formatDepartureCitiesForPrompt(departureCitiesFromAnswers(answers))
  const fixedDates = answers.fixedDates as { start?: string; end?: string } | undefined
  const datesLine = fixedDates?.start
    ? `${fixedDates.start} to ${fixedDates.end}`
    : (answers.dates as string) || 'Not specified'
  const flexLength = answers.flexLength as string | undefined
  const activities = answers.activities as string[] | undefined
  const vibe = answers.vibe as string[] | undefined
  const regions = answers.regions as string[] | undefined

  const tripStory = String(answers.q1 || '').trim()
  const tripType = String((trip?.trip_type as string) || 'Group trip').trim()

  const mustHaves = [
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

  const dealBreakers = String(answers.q3 || '').trim() || 'None stated'

  const tripShapeAnswers = {
    stops: answers.stops as string | undefined,
    stopsOther: answers.stopsOther as string | undefined,
    flexLength,
    fixedDates,
    dates: answers.dates as string | undefined,
  }
  const shapeHint = describeTripShapeHint(tripShapeAnswers)
  const triplesTask = triplesGenerationTaskLine(tripShapeAnswers)

  return `<context>
Trip purpose: ${tripType}
About this trip: ${tripStory || 'Not specified'}
Group size: ${travelerCount} people
Travel window: ${datesLine}${flexLength ? ` (preferred length: ${flexLength})` : ''}
Budget: ${answers.budget || 'Not specified'} per person (total trip cost including flights, lodging, food, and activities)
Must-haves: ${mustHaves}
Deal-breakers: ${dealBreakers}
Departure city: ${departure || 'Not specified'}
Trip shape guidance: ${shapeHint}
${chatSupplement}
</context>

<task>
Recommend 8–10 destinations for this group, score each in a MATRIX, then create exactly six two-stop pairings (two per TRAVEL SIMPLICITY, BUDGET, ACTIVITY VIBE) using those destinations. For BUDGET: RANK 1 = cheapest pairing, RANK 2 = splurge + budget-friendly balance. Cross-country pairings are welcome when routing works.
${triplesTask}
Output MATRIX, all three pairing sections, TRIPLES (when required above), AVANTI_MATRIX_END, RECOMMENDED_TAB, and RECOMMENDED_SHAPE.
</task>`
}

const REGENERATE_MATRIX_ROW_SYSTEM = `You are Avanti's group travel AI. Output exactly ONE destination comparison row in this format — nothing else:

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

${MATRIX_CHIP_RULES}

Pick a destination NOT in the "keep" list (except you are replacing the named destination). All costs USD, temps °F.`

const PAIRINGS_TRIPLES_OUTPUT = `Then output **exactly six pairings** — **two per category**, no fewer. Use ONLY cities from the destination list provided. **Cross-country pairings are fine** when both places are on the list and routing is practical.

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
(up to 3 ranked triples; omit the entire TRIPLES section if the trip is too short for three bases)

If RECOMMENDED_SHAPE recommends three stops or ~21+ night splits across three bases, the TRIPLES section is mandatory.

After all sections write:
AVANTI_MATRIX_END
Then ONE short sentence (max 25 words) naming your top pick.
RECOMMENDED_TAB: singles | pairings | triples (use triples when three bases fit their dates)
RECOMMENDED_SHAPE: One short sentence (max 20 words) on ideal stop count for their dates.`

const MATRIX_ROWS_ONLY_SYSTEM = `You are Avanti's group travel AI. Score destinations for a group trip comparison.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD.

${MATRIX_CHIP_RULES}

Build a weighted scoring matrix for each destination across budget fit (~25%), weather (~15%), logistics (~20%), experience quality (~25%), and must-have / deal-breaker match (~15%).

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

${PAIRINGS_TRIPLES_OUTPUT}

Be specific — name neighborhoods, venues, and landmarks. No generic filler.`

type MatrixGenOpts = {
  trip: Record<string, unknown> | null
  travelerCount: number
  answers: Record<string, unknown>
  consideringList: string[]
  chatSupplement?: string
  mode?: MatrixGenerationMode
}

function buildMatrixContextBlock(
  trip: Record<string, unknown> | null,
  travelerCount: number,
  answers: Record<string, unknown>,
  chatSupplement: string,
): string {
  const departure = formatDepartureCitiesForPrompt(departureCitiesFromAnswers(answers))
  const fixedDates = answers.fixedDates as { start?: string; end?: string } | undefined
  const datesLine = fixedDates?.start
    ? `${fixedDates.start} to ${fixedDates.end}`
    : (answers.dates as string) || 'Not specified'
  const flexLength = answers.flexLength as string | undefined
  const tripStory = String(answers.q1 || '').trim()
  const tripType = String((trip?.trip_type as string) || 'Group trip').trim()
  const dealBreakers = String(answers.q3 || '').trim() || 'None stated'
  const tripShapeAnswers = {
    stops: answers.stops as string | undefined,
    stopsOther: answers.stopsOther as string | undefined,
    flexLength,
    fixedDates,
    dates: answers.dates as string | undefined,
  }
  const shapeHint = describeTripShapeHint(tripShapeAnswers)

  return `<context>
Trip purpose: ${tripType}
About this trip: ${tripStory || 'Not specified'}
Group size: ${travelerCount} people
Travel window: ${datesLine}${flexLength ? ` (preferred length: ${flexLength})` : ''}
Budget: ${answers.budget || 'Not specified'} per person
Deal-breakers: ${dealBreakers}
Departure city: ${departure || 'Not specified'}
Trip shape guidance: ${shapeHint}
${chatSupplement}
</context>`
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
  const context = buildMatrixContextBlock(
    opts.trip,
    opts.travelerCount,
    opts.answers,
    opts.chatSupplement || '',
  )
  const tripShapeAnswers = {
    stops: opts.answers.stops as string | undefined,
    stopsOther: opts.answers.stopsOther as string | undefined,
    flexLength: opts.answers.flexLength as string | undefined,
    fixedDates: opts.answers.fixedDates as { start?: string; end?: string } | undefined,
    dates: opts.answers.dates as string | undefined,
  }
  const triplesTask = triplesGenerationTaskLine(tripShapeAnswers)
  const destList = opts.destinationNames.map((d, i) => `${i + 1}. ${d}`).join('\n')

  const userMessage = `${context}

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
  const departure = formatDepartureCitiesForPrompt(departureCitiesFromAnswers(opts.answers))
  const keepList = opts.keepNames.filter(n => n !== opts.replaceName).join('\n')

  const userMessage = `<context>
Replacing: ${opts.replaceName}
Keep these other destinations (do NOT duplicate): 
${keepList || '(none)'}
Departure: ${departure || 'Not specified'}
Budget: ${opts.answers.budget || 'Not specified'} per person
About trip: ${String(opts.answers.q1 || '').trim()}
Deal-breakers: ${String(opts.answers.q3 || '').trim() || 'None'}
${opts.chatSupplement || ''}
</context>

<task>
Suggest one fresh single-destination alternative to replace "${opts.replaceName}". Output one MATRIX row block only.
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
