import { DESTINATION_CONSIDERATIONS } from '@/lib/travel-considerations/destinations'
import { MATRIX_CHIP_RULES } from '@/lib/matrix-chip-fields'
import { MATRIX_GEO_RULES } from '@/lib/matrix-geo-rules'
import { MATRIX_TRIP_STRUCTURE_RULES } from '@/lib/matrix-trip-structure-rules'

const MATRIX_SCORING_WEIGHTS = `Build a weighted scoring matrix for each destination across:
- Budget fit (~25%)
- Weather / travel-window fit (~15%)
- Logistics — flights, layovers, visa (~20%)
- Experience quality — activities, vibe, food scene, nightlife, relaxation, nature (~25%)
- Must-have match and deal-breaker compliance, including safety for their profile (~15%)

SCORE is the rounded weighted composite (1–10), not a single-dimension guess. Heavily penalize any stated deal-breaker.`

const VERBAL_FACTORS = `VERBAL FACTOR CHECKLIST (cross-check every item against every other item):
- Group size and whether destinations cater to groups this size (accommodation, organized activities, getting around)
- Free-text trip story (who, why, vibe) — extract highlights and constraints
- Departure city/cities — flight cost, ease of access, time and money to get there
- Availability window vs preferred trip length (these are DIFFERENT — weather, stop count, and routing use preferred nights, not the full availability window)
- Domestic vs international scope and regions of interest
- Travel pace — how much moving around they want; you choose feasible stop count from pace + trip length
- Activity selections — contradictions imply balance; match activities to dates and destination (no beach in Antarctica, no NYC pool party in deep winter)
- Vibe vs trip type (corporate vs Mykonos party scene; college grad vs family reunion)
- Accommodation preference vs group size (EU hotel room economics vs Airbnb; US hotel capacity)
- Budget per person — all-in (flights, hotels, food, taxis, activities); soft guide not hard ceiling
- Deal-breakers and anything else from Q3 — hard filters where stated
- Proximity between multi-stop destinations; days on ground vs travel time; weighted fly-vs-ground expense
- Organized activity availability; audience appropriateness; safety/identity; daily expenses; off-beaten-path vs touristy
- Weather for travel window; extreme weather risk; festivals/holidays affecting cost or experience
- Alcohol/customs/laws; time available vs time needed to see a place honestly (Rome in 2 days vs Florence)
- Ease of access from departure; realistic routing (no Chicago → Barcelona + Sydney)`

const LEGACY_TEN_FACTOR = `LEGACY INTERNAL REASONING FACTORS (apply non-linearly):
1. HARD CONSTRAINTS — budget (soft guide), safety/identity, deal-breakers, unusual laws
2. LOGISTICS & TRAVEL TIME — ease of access, days on ground vs transit, multi-stop proximity, fly-vs-ground cost weight
3. ACTIVITIES & AUDIENCE FIT — group size activities, trip type fit, touristy vs off-beaten-path, enough to do for nights allocated
4. DAILY EXPENSES — luxury vs budget tier, value per dollar
5. WEATHER & TIMING — real temps in °F for dates, seasonal risks, festivals/holidays as risk or opportunity
6. CULTURAL CONSIDERATIONS — alcohol, dress codes, ethical tourism, overtourism
7. GROUP SIZE & TYPE — accommodation feasibility, destination catering
8. WILDCARD / DIVERSITY — when popularity allows off-beaten-path, include under-radar options with honest tradeoffs
9. SPECIFICITY — neighborhoods, venues, landmarks; no generic filler
10. COMPARISON — score finalists; honest tradeoffs; unique selling points`

function formatConsiderationsCatalog(): string {
  return DESTINATION_CONSIDERATIONS.map(
    section => `${section.title}:\n${section.items.map(item => `- ${item}`).join('\n')}`,
  ).join('\n\n')
}

export const MATRIX_REASONING_FRAMEWORK = `${VERBAL_FACTORS}

${LEGACY_TEN_FACTOR}

${MATRIX_SCORING_WEIGHTS}

${MATRIX_CHIP_RULES}

${MATRIX_GEO_RULES}

${MATRIX_TRIP_STRUCTURE_RULES}

MARKETING CONSIDERATION CATALOG:
${formatConsiderationsCatalog()}`

export const SYNTHESIS_NON_LINEAR_PREAMBLE = `You now have the COMPLETE input bundle. Do not proceed until you have read every field.

This reasoning is NOT linear. Cross-check every factor against every other factor.
When something conflicts, revisit earlier conclusions and adjust.
Keep going back and forth until the brief is internally consistent.
Only then output TRIP_BRIEF.

Example loops:
- beach activity + winter dates → eliminate cold-coast options → re-check budget → re-check departure routing → re-check group size vs party destinations → re-check travel pace vs trip length
- contradicting activity chips → resolve as "balance" → re-check vibe vs corporate trip type
- wheelchair profile + adventure activity → re-check destination accessibility → adjust shortlist
- event-centered trip → hard-anchor recommendations to event geography`

export const TRIP_BRIEF_OUTPUT_SCHEMA = `Output ONLY this block (no preamble, no markdown fences):

TRIP_BRIEF_START
STORY_HIGHLIGHTS: ...
GROUP_PROFILE: size=N; type=...; age_signal=...; accessibility=...
HARD_FILTERS: ...
DATE_WINDOW: availability=...; preferred_nights=...; overlap=...
ROUTING_REALITY: departure=...; max_reasonable_flight_hours=...; forbidden_combos=...
PACE_AND_STOPS: pace=...; target_stops=min-max; rationale=...
BUDGET_REALITY: per_person=...; fly_vs_ground_weight=...; tight_or_comfortable=...
ACTIVITY_RESOLUTION: contradictions=...; balance=...
WEATHER_WINDOW: ...
SAFETY_AND_IDENTITY: ...
ACCOMMODATION_FIT: ...
CANDIDATE_REGIONS: ...
CANDIDATE_CITIES_SHORTLIST: 8-12 "City, Country — one-line why" (brainstorm) OR score-order of given places (considering)
GIVEN_DESTINATIONS: ... (considering path only — user's list)
SUGGESTED_ADJACENTS: ... (considering path only — optional alternatives inspired by their picks, with why)
PAIRING_LOGIC: realistic 2-stop and 3-stop combo types for this group
RECOMMENDED_SHAPE: one sentence on ideal stop count
TRIP_BRIEF_END`

export const SYNTHESIS_SYSTEM_PROMPT = `You are Avanti's group travel AI. Perform deep non-linear trip analysis before any destination cards are generated.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD.

${SYNTHESIS_NON_LINEAR_PREAMBLE}

${MATRIX_REASONING_FRAMEWORK}

For event-centered trips: EVENT ANCHOR is a hard constraint — recommendations must stay realistic relative to event location and dates.

For considering path (2B): analyze the user's given destinations first; you may suggest SUGGESTED_ADJACENTS inspired by their ideas but primary scoring targets their list.

For brainstorm path (2C): build CANDIDATE_CITIES_SHORTLIST from scratch (8–12 cities).

Budget is a soft guide — note when options may run slightly over with honest rationale.

${TRIP_BRIEF_OUTPUT_SCHEMA}`

export function buildSynthesisUserMessage(assembledContext: string, mode: 'considering' | 'brainstorm'): string {
  const modeTask =
    mode === 'considering'
      ? 'Analyze their given destinations using the complete input bundle. Score-order their places in CANDIDATE_CITIES_SHORTLIST. Add GIVEN_DESTINATIONS and optional SUGGESTED_ADJACENTS.'
      : 'Brainstorm from scratch: build CANDIDATE_CITIES_SHORTLIST with 8–12 cities. Omit GIVEN_DESTINATIONS unless noting none.'

  return `${assembledContext}

<task>
${modeTask}
Perform non-linear cross-factor reasoning internally, then output TRIP_BRIEF only.
</task>`
}
