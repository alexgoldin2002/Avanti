import Anthropic from '@anthropic-ai/sdk'
import type { FlightAnalysisInput } from './traveler-context'
import type { FlightAnalysis, FlightOption } from './types'
import type { CoordinationMode } from './types'
import { DRIFT_THRESHOLD, GROUP_AIRLINE_CALL_THRESHOLD } from './types'
import { TRAVEL_AGENT_SYSTEM, TRAVEL_AGENT_ENRICH_SYSTEM } from './travel-agent'
import { fetchLiveOffersForAnalysis } from './live-offers'

export type { FlightAnalysisInput }

const client = new Anthropic()

const OUTPUT_SCHEMA = {
  generated_at: 'ISO datetime',
  coordination_mode: 'together|independent|mix',
  destination: 'string',
  destination_airport: 'IATA + name',
  date_range: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' },
  recommended_dates: { departure_date: 'YYYY-MM-DD', return_date: 'YYYY-MM-DD', why: 'string — one line' },
  vote_estimate_per_person: 'number|null',
  price_drift_warning: 'string|null',
  summary: '2-3 sentences: recommended pick + why, and the 1-2 alternatives trade-off',
  booking_reminder: 'string — remind the group to confirm total, dates, and card before booking',
  data_disclaimer: 'string',
  travel_hacks: ['string — route-specific tips to verify'],
  flight_options: [{
    id: 'opt-1',
    airlines: ['string marketing carrier(s)'],
    operated_by: 'string|null',
    origin: 'IATA',
    destination: 'IATA',
    departure_date: 'YYYY-MM-DD',
    return_date: 'YYYY-MM-DD',
    depart_time: 'e.g. 7:15 PM',
    arrive_time: 'e.g. 11:15 PM',
    arrive_plus_days: 'number — 0 unless overnight',
    duration_hours: 'number',
    duration_label: 'e.g. 11 hr 30 min',
    stops: 'number — 0 for nonstop',
    stops_label: 'Nonstop|1 stop|2 stops',
    layover_detail: 'string|null — e.g. 2h 40m YYZ',
    self_transfer: 'boolean',
    price_usd: 'number — per person round trip (group avg if origins differ)',
    price_label: 'round trip',
    co2_kg: 'number|null',
    co2_delta_pct: 'number|null — vs typical for route',
    cabin: 'string|null',
    bags_summary: 'string|null',
    seat_summary: 'string|null',
    badges: ['best|cheapest|fastest'],
    recommended: 'boolean — true only on the single best option',
    pros: ['string'],
    cons: ['string'],
    member_breakdown: [{ traveler_id: 'uuid', traveler_name: 'string', origin: 'IATA', price_usd: 'number', note: 'string|null' }],
  }],
  scenarios: '[] — legacy, leave empty',
}

/**
 * Parse the model's JSON. If the response was truncated mid-array (which cuts off
 * the closing brackets), salvage whatever complete flight_options we can so the
 * user still gets a list instead of an empty "no options" screen.
 */
function safeParseAnalysis(raw: string): FlightAnalysis {
  try {
    return JSON.parse(raw) as FlightAnalysis
  } catch {
    const start = raw.indexOf('"flight_options"')
    if (start !== -1) {
      const arrOpen = raw.indexOf('[', start)
      if (arrOpen !== -1) {
        const objs: string[] = []
        let depth = 0
        let objStart = -1
        for (let i = arrOpen + 1; i < raw.length; i++) {
          const ch = raw[i]
          if (ch === '{') { if (depth === 0) objStart = i; depth++ }
          else if (ch === '}') {
            depth--
            if (depth === 0 && objStart !== -1) {
              const candidate = raw.slice(objStart, i + 1)
              try { JSON.parse(candidate); objs.push(candidate) } catch { /* skip partial */ }
              objStart = -1
            }
          } else if (ch === ']' && depth === 0) {
            break
          }
        }
        if (objs.length > 0) {
          try {
            return JSON.parse(`{"flight_options":[${objs.join(',')}]}`) as FlightAnalysis
          } catch { /* fall through */ }
        }
      }
    }
    return {} as FlightAnalysis
  }
}

/** Keep live fare fields intact after AI enrichment. */
function mergeEnrichedOptions(live: FlightOption[], enriched: FlightOption[]): FlightOption[] {
  const liveById = new Map(live.map(o => [o.id, o]))
  const merged: FlightOption[] = enriched
    .filter(e => liveById.has(e.id))
    .map(e => {
      const base = liveById.get(e.id)!
      return {
        ...base,
        badges: e.badges?.length ? e.badges : base.badges,
        recommended: e.recommended ?? base.recommended,
        pros: e.pros?.length ? e.pros : base.pros,
        cons: e.cons?.length ? e.cons : base.cons,
        member_breakdown: e.member_breakdown ?? base.member_breakdown,
        co2_delta_pct: e.co2_delta_pct ?? base.co2_delta_pct,
        seat_summary: e.seat_summary ?? base.seat_summary,
        self_transfer: e.self_transfer ?? base.self_transfer,
      }
    })

  if (merged.length >= 3) return merged

  const mergedIds = new Set(merged.map(o => o.id))
  for (const option of live) {
    if (!mergedIds.has(option.id)) merged.push(option)
  }
  return merged.slice(0, 8)
}

function buildTravelerPayload(input: FlightAnalysisInput) {
  return input.travelers.map(t => ({
    id: t.id,
    name: t.name,
    departure_city: t.departure_city,
    home_airport: t.home_airport,
    backup_airports: t.backup_airports,
    seat_preference: t.seat_preference,
    cabin_class: t.cabin_class,
    credit_cards: t.credit_cards,
    airlines_status: t.airlines,
    loyalty: t.loyalty,
    card_perks: t.card_perks_summary,
    status_perks: t.status_perks_summary,
    preferred_currency: t.preferred_currency,
    passport_on_file: t.passport_on_file,
    tsa_precheck_or_global_entry: t.tsa_on_file,
    flight_rules: t.flight_rules,
    accessibility_needs: t.accessibility_notes,
  }))
}

function applyPriceDrift(
  parsed: FlightAnalysis,
  voteEstimate: number | null
): void {
  if (parsed.price_drift_warning || !voteEstimate) return
  const recPrice =
    parsed.flight_options?.find(o => o.recommended)?.price_usd ??
    parsed.flight_options?.[0]?.price_usd ??
    parsed.scenarios.find(s => s.recommended)?.avg_per_person_usd ??
    parsed.scenarios[0]?.avg_per_person_usd ??
    null
  if (recPrice == null) return
  const pct = (recPrice - voteEstimate) / voteEstimate
  if (pct > DRIFT_THRESHOLD) {
    const label = parsed.fare_source === 'live' ? 'Live flight prices' : 'Flight estimates'
    parsed.price_drift_warning = `${label} are ~${Math.round(pct * 100)}% above what the group voted on in Step 3. Consider adjusting dates, tier, or reopening the destination decision.`
  }
}

function finalizeAnalysis(
  parsed: FlightAnalysis,
  input: FlightAnalysisInput,
  dateStart: string,
  dateEnd: string,
  fareSource: 'live' | 'estimate' | 'mixed',
  liveSources?: { duffel?: boolean; google?: boolean }
): FlightAnalysis {
  parsed.generated_at = parsed.generated_at || new Date().toISOString()
  parsed.coordination_mode = (parsed.coordination_mode || input.coordination_mode) as CoordinationMode
  parsed.destination = parsed.destination || input.trip.destination
  parsed.date_range = parsed.date_range || { start: dateStart, end: dateEnd }
  parsed.vote_estimate_per_person = input.vote_estimate_per_person
  parsed.scenarios = parsed.scenarios || []
  parsed.flight_options = parsed.flight_options || []
  parsed.fare_source = fareSource
  parsed.live_sources = liveSources

  if (fareSource === 'mixed' && !parsed.data_disclaimer) {
    parsed.data_disclaimer =
      'Prices combine live airline fares (Duffel) and Google Flights search (Bright Data). Totals can change quickly — confirm on the airline site before booking.'
  } else if (fareSource === 'live' && !parsed.data_disclaimer) {
    parsed.data_disclaimer =
      'Prices are live search results and can change quickly. Confirm the total fare, dates, and baggage on the airline site before booking.'
  } else if (fareSource === 'estimate' && !parsed.data_disclaimer) {
    parsed.data_disclaimer =
      'Prices are AI estimates for planning. Confirm the live fare, dates, and total on the airline or search site before booking.'
  }

  applyPriceDrift(parsed, input.vote_estimate_per_person)
  return parsed
}

export type FlightRefinement = {
  stops?: 'any' | 'nonstop' | 'one_or_fewer'
  include_airlines?: string[]
  max_price_usd?: number | null
  depart_window?: string | null
  max_duration_hours?: number | null
  cabin?: string | null
  note?: string | null
}

async function callFlightAgent(
  system: string,
  payload: Record<string, unknown>,
  maxTokens = 16000
): Promise<FlightAnalysis> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: JSON.stringify(payload, null, 2) }],
  })
  const text = response.content.find(c => c.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return safeParseAnalysis(jsonMatch?.[0] || '{}')
}

export async function analyzeFlightScenarios(
  input: FlightAnalysisInput,
  refine?: FlightRefinement,
): Promise<FlightAnalysis> {
  const dateStart =
    input.trip.locked_date_start ||
    input.trip.start_date ||
    input.trip.date_range_start ||
    ''
  const dateEnd =
    input.trip.locked_date_end ||
    input.trip.end_date ||
    input.trip.date_range_end ||
    ''

  const live = await fetchLiveOffersForAnalysis(input)
  const useLive = live.configured && live.options.length >= 3

  const fareSourceForLive = (): 'live' | 'mixed' => {
    const { duffel, google } = live.sources
    const hasDuffel = duffel && live.options.some(o => o.id.startsWith('live-'))
    const hasGoogle = google && live.options.some(o => o.id.startsWith('google-'))
    return hasDuffel && hasGoogle ? 'mixed' : 'live'
  }

  const basePayload = {
    trip: { ...input.trip, effective_dates: { start: dateStart, end: dateEnd } },
    coordination_mode: input.coordination_mode,
    mix_notes: input.mix_notes,
    vote_estimate_per_person: input.vote_estimate_per_person,
    traveler_count: input.travelers.length,
    group_airline_call_note: input.travelers.length > GROUP_AIRLINE_CALL_THRESHOLD,
    travelers: buildTravelerPayload(input),
    member_prefs: input.member_prefs,
    refine: refine || null,
    output_schema: OUTPUT_SCHEMA,
  }

  try {
    if (useLive) {
      const enrichPayload = {
        ...basePayload,
        fare_source: fareSourceForLive(),
        live_sources: live.sources,
        destination_airport_hint: live.destinationIata,
        origins_searched: live.originsSearched,
        live_flight_options: live.options,
      }

      const parsed = await callFlightAgent(TRAVEL_AGENT_ENRICH_SYSTEM, enrichPayload, 12000)
      parsed.flight_options = mergeEnrichedOptions(live.options, parsed.flight_options || [])
      parsed.destination_airport =
        parsed.destination_airport ||
        (live.destinationIata ? `${live.destinationIata}` : 'TBD')
      parsed.recommended_dates = parsed.recommended_dates || {
        departure_date: live.options[0]?.departure_date || dateStart,
        return_date: live.options[0]?.return_date || dateEnd,
        why: 'Live fares searched for your locked trip dates.',
      }

      return finalizeAnalysis(
        parsed,
        input,
        dateStart,
        dateEnd,
        fareSourceForLive(),
        live.sources
      )
    }

    const estimatePayload = {
      ...basePayload,
      fare_source: 'estimate',
      live_fare_hints: live.options.length
        ? {
            configured: live.configured,
            sources: live.sources,
            destination_iata: live.destinationIata,
            sample_offers: live.options.slice(0, 3),
            note: 'Use these live samples to calibrate estimates if present; otherwise estimate from route/season.',
          }
        : null,
    }

    const parsed = await callFlightAgent(TRAVEL_AGENT_SYSTEM, estimatePayload)
    return finalizeAnalysis(parsed, input, dateStart, dateEnd, 'estimate')
  } catch (err) {
    console.error('analyzeFlightScenarios error:', err)

    if (live.options.length >= 3) {
      return finalizeAnalysis(
        {
          generated_at: new Date().toISOString(),
          coordination_mode: input.coordination_mode,
          destination: input.trip.destination,
          destination_airport: live.destinationIata || 'TBD',
          date_range: { start: dateStart, end: dateEnd },
          vote_estimate_per_person: input.vote_estimate_per_person,
          price_drift_warning: null,
          scenarios: [],
          flight_options: live.options,
          recommended_dates: {
            departure_date: live.options[0].departure_date,
            return_date: live.options[0].return_date,
            why: 'Live fares for your trip dates.',
          },
          summary: 'Showing live flight search results. AI enrichment unavailable — try again for pros/cons and group notes.',
          booking_reminder: 'Confirm total fare, dates, and baggage on the airline site before booking.',
        },
        input,
        dateStart,
        dateEnd,
        fareSourceForLive(),
        live.sources
      )
    }

    return {
      generated_at: new Date().toISOString(),
      coordination_mode: input.coordination_mode,
      destination: input.trip.destination,
      destination_airport: 'TBD',
      date_range: { start: dateStart, end: dateEnd },
      vote_estimate_per_person: input.vote_estimate_per_person,
      price_drift_warning: null,
      scenarios: [],
      summary: 'Analysis could not complete — try again in a moment.',
      fare_source: 'estimate',
    }
  }
}
