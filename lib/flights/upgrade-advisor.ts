import Anthropic from '@anthropic-ai/sdk'
import type { FlightOption } from './types'
import type { TravelerFlightContext } from './traveler-context'

const client = new Anthropic()

const UPGRADE_SYSTEM = `You are a flight upgrade strategist (inspired by upgrade-bidding best practices).
Given traveler profile data and a selected or shortlisted flight, produce practical upgrade advice.

Cover when relevant:
- Cash upgrade vs miles/points vs bid programs
- Seat map / cabin fullness signals (qualitative — you don't have live seat maps)
- Airline-specific quirks the traveler should verify
- Whether an upgrade is worth it for this group trip

Return JSON only:
{
  "verdict": "string — 1-2 sentence recommendation",
  "confidence": "high|medium|low",
  "strategies": ["string — ordered actions to try"],
  "watch_outs": ["string"],
  "prefill_checklist": ["string — profile fields that would improve this advice if missing"]
}`

export type UpgradeAdvice = {
  verdict: string
  confidence: 'high' | 'medium' | 'low'
  strategies: string[]
  watch_outs: string[]
  prefill_checklist: string[]
}

export async function buildUpgradeAdvice(input: {
  travelers: TravelerFlightContext[]
  flight: FlightOption | null
  destination: string
}): Promise<UpgradeAdvice> {
  const payload = {
    destination: input.destination,
    flight: input.flight,
    travelers: input.travelers.map(t => ({
      name: t.name,
      airlines_status: t.airlines,
      loyalty: t.loyalty,
      cabin_class: t.cabin_class,
      seat_preference: t.seat_preference,
      credit_cards: t.credit_cards,
      status_perks: t.status_perks_summary,
    })),
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: UPGRADE_SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(payload, null, 2) }],
  })

  const text = response.content.find(c => c.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  try {
    return JSON.parse(jsonMatch?.[0] || '{}') as UpgradeAdvice
  } catch {
    return {
      verdict: 'We could not generate upgrade advice right now. Check your airline app for cash upgrades, bid programs, and miles options.',
      confidence: 'low',
      strategies: [],
      watch_outs: [],
      prefill_checklist: [],
    }
  }
}
