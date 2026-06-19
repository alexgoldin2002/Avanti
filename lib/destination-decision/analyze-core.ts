import Anthropic from '@anthropic-ai/sdk'
import type { DestinationTier, FlightToggle, DateToggle, ScenarioMatrix, WorksForYou } from './types'

const client = new Anthropic()

export const ANALYSIS_SYSTEM_PROMPT = `You are Avanti's travel cost analyst. Given a destination option, tier, and traveler profiles, output ONLY valid JSON — no markdown.

For each traveler, estimate all-in trip cost (flights + accommodation + food + activities + local transport) in USD for a 9-scenario matrix:
- flight: direct | one_stop | cheapest
- dates: best (group optimal) | fri (leave Friday) | mon (leave Monday)

Each cell: { "cost": number, "works": "yes"|"tight"|"no" }
- yes: comfortably within budget and constraints
- tight: possible but stressful or over soft budget
- no: violates hard constraints or unrealistic

Also return group_summary with:
- avg_cost: number (mid scenario average across travelers)
- recommended_flight: direct|one_stop|cheapest
- recommended_dates: best|fri|mon
- group_fit_yes: number (count of travelers with works=yes at recommended scenario)
- group_fit_total: number
- tradeoff: one sentence

Tier guidance:
- budget: hostels/budget hotels, street food, free activities
- mid: 3-4 star hotels, mix of dining
- luxury: premium hotels, fine dining, splurge activities`

export type AnalysisInput = {
  trip: {
    name: string
    start_date?: string | null
    end_date?: string | null
    date_range_start?: string | null
    date_range_end?: string | null
    trip_type?: string | null
  }
  option: {
    name: string
    country: string | null
    tier: DestinationTier
    card_snapshot: Record<string, unknown>
  }
  travelers: Array<{
    id: string
    name: string
    departure_city: string
    budget_ceiling: number | null
  }>
}

export type AnalysisOutput = {
  group_summary: Record<string, unknown>
  per_traveler: Array<{
    traveler_id: string
    scenarios: ScenarioMatrix
    flags: Record<string, unknown>
  }>
}

function emptyCell() {
  return { cost: 0, works: 'no' as WorksForYou }
}

function defaultMatrix(): ScenarioMatrix {
  const flights: FlightToggle[] = ['direct', 'one_stop', 'cheapest']
  const dates: DateToggle[] = ['best', 'fri', 'mon']
  const matrix = {} as ScenarioMatrix
  for (const f of flights) {
    matrix[f] = {} as Record<DateToggle, { cost: number; works: WorksForYou }>
    for (const d of dates) {
      matrix[f][d] = emptyCell()
    }
  }
  return matrix
}

export async function analyzeDestinationOption(input: AnalysisInput): Promise<AnalysisOutput> {
  const userMessage = JSON.stringify({
    trip: input.trip,
    option: input.option,
    travelers: input.travelers,
    output_schema: {
      group_summary: {
        avg_cost: 'number',
        recommended_flight: 'direct|one_stop|cheapest',
        recommended_dates: 'best|fri|mon',
        group_fit_yes: 'number',
        group_fit_total: 'number',
        tradeoff: 'string',
      },
      per_traveler: [{
        traveler_id: 'uuid',
        scenarios: '9-cell matrix',
        flags: { long_haul: 'boolean', visa_required: 'boolean' },
      }],
    },
  }, null, 2)

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content.find(c => c.type === 'text')?.text || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')

    const perTraveler = (parsed.per_traveler || []).map((row: {
      traveler_id: string
      scenarios?: ScenarioMatrix
      flags?: Record<string, unknown>
    }) => ({
      traveler_id: row.traveler_id,
      scenarios: row.scenarios || defaultMatrix(),
      flags: row.flags || {},
    }))

    // Ensure every traveler has a row
    for (const t of input.travelers) {
      if (!perTraveler.find((r: { traveler_id: string }) => r.traveler_id === t.id)) {
        perTraveler.push({ traveler_id: t.id, scenarios: defaultMatrix(), flags: {} })
      }
    }

    return {
      group_summary: parsed.group_summary || {
        avg_cost: 0,
        recommended_flight: 'one_stop',
        recommended_dates: 'best',
        group_fit_yes: 0,
        group_fit_total: input.travelers.length,
        tradeoff: '',
      },
      per_traveler: perTraveler,
    }
  } catch (err) {
    console.error('analyzeDestinationOption error:', err)
    return {
      group_summary: {
        avg_cost: 0,
        recommended_flight: 'one_stop',
        recommended_dates: 'best',
        group_fit_yes: 0,
        group_fit_total: input.travelers.length,
        tradeoff: 'Analysis pending — estimates may update.',
      },
      per_traveler: input.travelers.map(t => ({
        traveler_id: t.id,
        scenarios: defaultMatrix(),
        flags: { analysis_error: true },
      })),
    }
  }
}

