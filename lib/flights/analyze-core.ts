import Anthropic from '@anthropic-ai/sdk'
import type { FlightAnalysisInput } from './traveler-context'
import type { FlightAnalysis } from './types'
import type { CoordinationMode } from './types'
import { DRIFT_THRESHOLD, GROUP_AIRLINE_CALL_THRESHOLD } from './types'

export type { FlightAnalysisInput }

const client = new Anthropic()

const SYSTEM = `You are Avanti's group flight analyst. Given a locked destination, date range, coordination mode, and traveler profiles, output ONLY valid JSON — no markdown.

Produce 3–5 flight scenarios comparing:
- Nonstop vs 1-stop vs multi-stop ("full send" nonstop vs broken up)
- Airlines matching preferences and status tiers
- Free bag perks from credit cards and airline status
- Total duration and segment breakdown per person
- Outbound AND return: depart/arrive local times, arrival vs hotel check-in (~3pm), whether they get a full day or lose it (red-eye, late night, early departure)
- Ground transport if city center is far from airport: train, taxi, rideshare, bus — time and cost for each
- When each group member arrives; spread in hours; meetup at hub, before trip, or at destination
- Cost vs time tradeoff label per scenario
- Cheapest leave/return window inside the date range vs peak dates
- For "together" mode: optimal group routing (shared hub if needed), routing order, and solo-vs-group cost delta per person
- For "independent" mode: each person's best solo path and arrival spread
- For "mix" mode: respect wants_group_routing per member

If group has more than ${GROUP_AIRLINE_CALL_THRESHOLD} travelers, set group_size_note explaining airlines often require calling for group fares — they book that themselves.

Compare avg per-person cost to vote_estimate_per_person if provided. If any recommended scenario exceeds estimate by more than ${Math.round(DRIFT_THRESHOLD * 100)}%, set price_drift_warning.

Use realistic USD estimates. Mark exactly one scenario recommended: true.`

export async function analyzeFlightScenarios(input: FlightAnalysisInput): Promise<FlightAnalysis> {
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

  const payload = {
    trip: { ...input.trip, effective_dates: { start: dateStart, end: dateEnd } },
    coordination_mode: input.coordination_mode,
    mix_notes: input.mix_notes,
    vote_estimate_per_person: input.vote_estimate_per_person,
    traveler_count: input.travelers.length,
    group_airline_call_note: input.travelers.length > GROUP_AIRLINE_CALL_THRESHOLD,
    travelers: input.travelers.map(t => ({
      id: t.id,
      name: t.name,
      departure_city: t.departure_city,
      credit_cards: t.credit_cards,
      airlines_status: t.airlines,
      card_perks: t.card_perks_summary,
      status_perks: t.status_perks_summary,
      passport_on_file: t.passport_on_file,
      tsa_on_file: t.tsa_on_file,
    })),
    member_prefs: input.member_prefs,
    output_schema: {
      generated_at: 'ISO datetime',
      coordination_mode: 'together|independent|mix',
      destination: 'string',
      destination_airport: 'IATA + name',
      date_range: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' },
      vote_estimate_per_person: 'number|null',
      price_drift_warning: 'string|null',
      summary: '2-3 sentences',
      scenarios: [{
        id: 'scenario-a',
        label: 'string',
        departure_date: 'YYYY-MM-DD',
        return_date: 'YYYY-MM-DD',
        total_group_cost_usd: 'number',
        avg_per_person_usd: 'number',
        cost_vs_vote_estimate_pct: 'number|null',
        cost_vs_time_label: 'string',
        recommended: 'boolean',
        group_size_note: 'string|null',
        solo_vs_group_delta_usd: 'number|null',
        cheapest_date_window: { leave: 'string', return: 'string', savings_vs_peak_usd: 'number', note: 'string' },
        routing_order_note: 'string|null',
        member_plans: [{
          traveler_id: 'uuid',
          traveler_name: 'string',
          departure_city: 'string',
          airline: 'string',
          flight_type: 'nonstop|one_stop|multi_stop',
          duration_hours: 'number',
          segments: [{ from: 'string', to: 'string', airline: 'string', duration_hours: 'number' }],
          price_usd: 'number',
          bags_included: 'string',
          status_perks_used: ['string'],
          card_perks_used: ['string'],
          outbound: {
            depart_local: 'string',
            arrive_local: 'string',
            arrival_vs_checkin: 'full_day|afternoon_ok|late_night|lose_day|early_departure',
            day_impact: 'string',
          },
          return_leg: 'same shape as outbound',
          ground_transport: [{ mode: 'train|taxi|rideshare|bus', duration_min: 'number', cost_usd: 'number', notes: 'string' }],
          meets_group: 'at_destination|hub_en_route|independent|before_trip',
        }],
        group_sync: {
          first_arrival: 'string',
          last_arrival: 'string',
          spread_hours: 'number',
          meetup_options: [{ where: 'hub|destination|before', city: 'string', note: 'string' }],
          everyone_same_day: 'boolean',
        },
      }],
    },
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(payload, null, 2) }],
    })

    const text = response.content.find(c => c.type === 'text')?.text || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}') as FlightAnalysis

    parsed.generated_at = parsed.generated_at || new Date().toISOString()
    parsed.coordination_mode = (parsed.coordination_mode || input.coordination_mode) as CoordinationMode
    parsed.destination = parsed.destination || input.trip.destination
    parsed.date_range = parsed.date_range || { start: dateStart, end: dateEnd }
    parsed.vote_estimate_per_person = input.vote_estimate_per_person
    parsed.scenarios = parsed.scenarios || []

    if (!parsed.price_drift_warning && input.vote_estimate_per_person) {
      const rec = parsed.scenarios.find(s => s.recommended) || parsed.scenarios[0]
      if (rec) {
        const pct = (rec.avg_per_person_usd - input.vote_estimate_per_person) / input.vote_estimate_per_person
        if (pct > DRIFT_THRESHOLD) {
          parsed.price_drift_warning = `Flight estimates are ~${Math.round(pct * 100)}% above what the group voted on in Step 3. Consider adjusting dates, tier, or reopening the destination decision.`
        }
      }
    }

    return parsed
  } catch (err) {
    console.error('analyzeFlightScenarios error:', err)
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
    }
  }
}
