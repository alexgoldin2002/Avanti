import type { SupabaseClient } from '@supabase/supabase-js'
import {
  departureCitiesFromAnswers,
  formatDepartureCitiesForPrompt,
} from '@/lib/departure-cities'
import { describeTripShapeHint } from '@/lib/matrix-trip-shape'
import { describeRoutingRealismHint } from '@/lib/matrix-geo-rules'
import {
  describeTripStructureContext,
} from '@/lib/matrix-trip-structure-rules'
import { travelPaceLabel } from '@/lib/travel-pace-preference'
import { ageBandFromDateOfBirth } from '@/lib/infer-trip-context'

export type MatrixGenerationMode = 'considering' | 'brainstorm'

export class Step2InputValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Step2InputValidationError'
  }
}

export const SINGLE_RESPONDENT_CONSTRAINT = `SINGLE-RESPONDENT CONSTRAINT: At this stage you only know (1) group size, (2) Step 1 trip type, (3) this one traveler's Step 2 answers and profile. Other members' preferences are unknown unless stated in Q1, Q3, or chat. Do not assume unanimous agreement — flag tradeoffs honestly in TRADEOFF and GROUP FIT.`

export const BUDGET_SEMANTICS = `BUDGET SEMANTICS: Stated per-person budget is a soft guide, not a hard elimination filter. Prefer in-budget options in scoring and ranking. Options modestly over budget are allowed when otherwise strong fits — surface honest BUDGET FIT and TRADEOFF when over (e.g. "Slightly above your range — summer peak adds ~15%").`

export type OrganizerDestinationProfile = {
  ageBand: string | null
  countryOfResidence: string | null
  passportOnFile: boolean
  accessibilityNotes: string[]
  dietary: string[]
  allergies: string[]
  accessibilityFreeText: string | null
}

type ProfileExtras = {
  accessibility?: {
    mobility?: string[]
    sensory?: string[]
    assistance?: string[]
    allergies?: string[]
    dietary?: string[]
    notes?: string
  }
}

export async function buildOrganizerDestinationProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<OrganizerDestinationProfile | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('date_of_birth, country_of_residence, passport_number, benefits_profile')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) return null

  const benefits = (profile.benefits_profile || {}) as { profile_extras?: ProfileExtras }
  const extras = benefits.profile_extras || {}
  const accessibility = extras.accessibility || {}

  return {
    ageBand: ageBandFromDateOfBirth(profile.date_of_birth as string | null | undefined),
    countryOfResidence: (profile.country_of_residence as string | null) || null,
    passportOnFile: Boolean((profile.passport_number as string | null)?.trim()),
    accessibilityNotes: [
      ...(accessibility.mobility || []),
      ...(accessibility.sensory || []),
      ...(accessibility.assistance || []),
    ],
    dietary: accessibility.dietary || [],
    allergies: accessibility.allergies || [],
    accessibilityFreeText: accessibility.notes?.trim() || null,
  }
}

function formatOrganizerProfileBlock(profile: OrganizerDestinationProfile | null): string {
  if (!profile) return 'Organizer profile: not available (preview or no profile on file).'
  const parts = [
    profile.ageBand ? `Age band: ${profile.ageBand}` : null,
    profile.countryOfResidence ? `Country of residence: ${profile.countryOfResidence}` : null,
    profile.passportOnFile ? 'Passport on file: yes' : 'Passport on file: no',
    profile.accessibilityNotes.length
      ? `Accessibility: ${profile.accessibilityNotes.join('; ')}`
      : null,
    profile.dietary.length ? `Dietary: ${profile.dietary.join('; ')}` : null,
    profile.allergies.length ? `Allergies: ${profile.allergies.join('; ')}` : null,
    profile.accessibilityFreeText ? `Accessibility notes: ${profile.accessibilityFreeText}` : null,
  ].filter(Boolean)
  return parts.length ? `Organizer profile:\n${parts.join('\n')}` : 'Organizer profile: no structured accessibility or dietary fields on file.'
}

function formatEventAnchorBlock(trip: Record<string, unknown> | null): string {
  if (!trip?.is_event_centered) return ''
  const name = String(trip.event_name || 'Event').trim()
  const location = String(trip.event_location || 'Not specified').trim()
  const start = String(trip.event_date || '').trim()
  const end = String(trip.event_date_end || '').trim()
  const dates = end && end !== start ? `${start} to ${end}` : start || 'Not specified'
  return `EVENT ANCHOR (hard constraint): ${name} on ${dates} in ${location}.
Leisure travel must be realistic relative to this anchor — stay event-centric; do not suggest routes that ignore the event geography (e.g. no Barcelona + Sydney when the event is in Florence).`
}

function formatOverlapBlock(trip: Record<string, unknown> | null): string {
  const start = trip?.group_overlap_start as string | undefined
  const end = trip?.group_overlap_end as string | undefined
  const nights = trip?.group_overlap_nights as number | undefined
  if (!start || !end) return 'Group date overlap: not computed yet — use organizer travel window below.'
  return `Group date overlap (when everyone can travel): ${start} to ${end}${nights ? ` (~${nights} nights)` : ''}.`
}

function buildMustHavesLine(answers: Record<string, unknown>): string {
  const activities = answers.activities as string[] | undefined
  const vibe = answers.vibe as string[] | undefined
  const domestic = String(answers.domestic || '')
  const regions = answers.regions as string[] | undefined

  return [
    activities?.length ? `Activities: ${activities.join(', ')}` : null,
    vibe?.length ? `Vibe: ${vibe.join(', ')}` : null,
    answers.accommodation ? `Accommodation: ${answers.accommodation}` : null,
    answers.travelPace ? `Travel pace: ${travelPaceLabel(String(answers.travelPace))}` : null,
    domestic ? `Scope: ${domestic}` : null,
    domestic === 'International' && regions?.length
      ? `Regions of interest: ${regions.join(', ')}`
      : domestic === 'Domestic only'
        ? 'Regions: US-only (international regions ignored)'
        : null,
    answers.popularity ? `Popularity preference: ${answers.popularity}` : null,
  ]
    .filter(Boolean)
    .join('; ') || 'Not specified'
}

function formatDateContext(answers: Record<string, unknown>): {
  availabilityLine: string
  preferredNightsLine: string
} {
  const datesMode = String(answers.dates || '').trim()
  const flexLength = String(answers.flexLength || '').trim()
  const fixed = answers.fixedDates as { start?: string; end?: string } | undefined

  let availabilityLine = datesMode || 'Not specified'
  if (fixed?.start && fixed?.end) {
    availabilityLine = `${fixed.start} to ${fixed.end}${datesMode ? ` (${datesMode})` : ''}`
  }

  let preferredNightsLine = 'Not specified'
  if (datesMode === 'Fixed dates' && fixed?.start && fixed?.end) {
    preferredNightsLine = `Fixed trip span: ${fixed.start} to ${fixed.end}`
  } else if (flexLength) {
    preferredNightsLine = `Preferred trip length: ${flexLength} (availability window above is NOT the trip length)`
  }

  return { availabilityLine, preferredNightsLine }
}

export function assertStep2InputsComplete(
  answers: Record<string, unknown>,
  mode: MatrixGenerationMode,
  consideringCount = 0,
): void {
  const missing: string[] = []

  if (!String(answers.q1 || '').trim()) missing.push('q1')
  if (!String(answers.q3 ?? '').trim()) missing.push('q3')

  const dep = departureCitiesFromAnswers(answers)
  if (!dep.length) missing.push('departureCities')

  const dates = String(answers.dates || '')
  if (!dates) missing.push('dates')

  const fixed = answers.fixedDates as { start?: string; end?: string } | undefined
  if (dates === 'Fixed dates' && (!fixed?.start || !fixed?.end)) missing.push('fixedDates')
  if (dates === 'Flexible — I have a range' && (!fixed?.start || !fixed?.end || !answers.flexLength)) {
    missing.push('flexLength')
  }

  if (!answers.travelPace) missing.push('travelPace')

  const activities = answers.activities as string[] | undefined
  if (!activities?.length) missing.push('activities')

  const vibe = answers.vibe as string[] | undefined
  if (!vibe?.length) missing.push('vibe')

  if (!answers.accommodation) missing.push('accommodation')
  if (!answers.budget) missing.push('budget')

  if (mode === 'brainstorm') {
    if (!answers.domestic) missing.push('domestic')
    if (answers.domestic === 'International') {
      const regions = answers.regions as string[] | undefined
      if (!regions?.length) missing.push('regions')
    }
    if (!answers.popularity) missing.push('popularity')
  } else if (consideringCount < 2) {
    missing.push('consideringList')
  }

  if (missing.length) {
    throw new Step2InputValidationError(`Missing required Step 2 inputs: ${missing.join(', ')}`)
  }
}

export type AssembleTripContextOpts = {
  trip: Record<string, unknown> | null
  travelerCount: number
  answers: Record<string, unknown>
  chatSupplement?: string
  mode?: MatrixGenerationMode
  consideringList?: string[]
  organizerProfile?: OrganizerDestinationProfile | null
}

/** Full context block for synthesis and all matrix phases. */
export function assembleTripGenerationContext(opts: AssembleTripContextOpts): string {
  const mode = opts.mode ?? 'brainstorm'
  const chatSupplement = opts.chatSupplement || ''
  const departure = formatDepartureCitiesForPrompt(departureCitiesFromAnswers(opts.answers))
  const tripStory = String(opts.answers.q1 || '').trim()
  const tripType = String((opts.trip?.trip_type as string) || opts.answers.tripLabel || 'Group trip').trim()
  const dealBreakers = String(opts.answers.q3 || '').trim() || 'None stated'
  const mustHaves = buildMustHavesLine(opts.answers)
  const { availabilityLine, preferredNightsLine } = formatDateContext(opts.answers)

  const tripShapeAnswers = {
    travelPace: opts.answers.travelPace as string | undefined,
    stops: opts.answers.stops as string | undefined,
    stopsOther: opts.answers.stopsOther as string | undefined,
    flexLength: opts.answers.flexLength as string | undefined,
    fixedDates: opts.answers.fixedDates as { start?: string; end?: string } | undefined,
    dates: opts.answers.dates as string | undefined,
    q1: tripStory,
    q3: dealBreakers,
  }

  const shapeHint = describeTripShapeHint(tripShapeAnswers, {
    q1: tripStory,
    q3: dealBreakers,
    chatSupplement,
  })
  const routingHint = describeRoutingRealismHint(departure)

  const consideringBlock = opts.consideringList?.length
    ? `Places they are considering (score every one — do not skip):\n${opts.consideringList.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n`
    : ''

  const purposeSuffix =
    mode === 'considering'
      ? ' — infer the closest category among vacation, honeymoon, family, adventure, digital nomad, and cultural from the story below'
      : ''

  const eventBlock = formatEventAnchorBlock(opts.trip)
  const overlapBlock = formatOverlapBlock(opts.trip)
  const profileBlock = formatOrganizerProfileBlock(opts.organizerProfile ?? null)

  return `<context>
Trip purpose: ${tripType}${purposeSuffix}
About this trip: ${tripStory || 'Not specified'}
Group size: ${opts.travelerCount} people
Availability window: ${availabilityLine}
Preferred trip length: ${preferredNightsLine}
${overlapBlock}
Budget: ${opts.answers.budget || 'Not specified'} per person (total trip cost including flights, lodging, food, activities, and ground transport)
Must-haves: ${mustHaves}
  (Score broadly against beach/water, mountains/nature, food scene, nightlife, relaxation/wellness, safety for this group, and stated activity/vibe fit — not just literal keyword matches)
Deal-breakers: ${dealBreakers}
  (Treat as hard filters where explicitly stated — e.g. long flights, extreme heat or cold, visa hassle, crowds, safety concerns)
Departure city: ${departure || 'Not specified'}
${eventBlock ? `${eventBlock}\n` : ''}${profileBlock}
${consideringBlock}Trip shape guidance: ${shapeHint}
Routing realism: ${routingHint}

${describeTripStructureContext(opts.answers, chatSupplement)}

${SINGLE_RESPONDENT_CONSTRAINT}

${BUDGET_SEMANTICS}
${chatSupplement}
</context>`
}
