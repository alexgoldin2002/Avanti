import Anthropic from '@anthropic-ai/sdk'
import type { FlightAnalysisInput } from './traveler-context'
import type { FlightOption } from './types'

const client = new Anthropic()

export type FlightChatMessage = { role: 'user' | 'assistant'; content: string }

export type FlightChatResult = {
  reply: string
  new_options: FlightOption[]
}

const CHAT_SYSTEM = `You are Avanti's group flight agent, continuing a conversation on the flight-results screen. The group already has a destination, dates, and a list of ~8 flight options in front of them.

RULES
- Use ONLY the trip + traveler data provided. Never invent loyalty numbers, cards, or facts not given. Prices are realistic ESTIMATES to confirm at booking, never guarantees.
- Be direct and concise — a few sentences, no hype. You are a chat, so talk like one.
- When the traveler asks to SEE, COMPARE, or ADD flight options (e.g. "show me nonstop only", "anything under $700", "compare Delta vs United", "what about leaving a day later"), return new_options with 1–6 rows matching the exact FlightOption shape below. Otherwise return an empty new_options array and just answer in reply.
- Keep new_options consistent with the existing list: same origin/destination, same date pair unless the user explicitly asks for different dates, and comparable pricing. Do not duplicate rows the user already has unless asked.
- Each option must include: id (unique), airlines[], operated_by|null, origin, destination, departure_date, return_date, depart_time, arrive_time, arrive_plus_days, duration_hours, duration_label, stops, stops_label, layover_detail|null, self_transfer, price_usd, price_label, co2_kg|null, co2_delta_pct|null, cabin|null, bags_summary|null, seat_summary|null, badges[], recommended(false for chat rows), pros[], cons[].

OUTPUT: ONLY valid JSON: { "reply": "string", "new_options": [ ...FlightOption ] }. No markdown, no preamble.`

export async function runFlightChat(
  input: FlightAnalysisInput,
  currentOptions: FlightOption[],
  messages: FlightChatMessage[],
): Promise<FlightChatResult> {
  const context = {
    trip: {
      destination: input.trip.destination,
      dates: input.trip.locked_date_start && input.trip.locked_date_end
        ? { start: input.trip.locked_date_start, end: input.trip.locked_date_end }
        : { start: input.trip.start_date || input.trip.date_range_start, end: input.trip.end_date || input.trip.date_range_end },
      tier: input.trip.locked_tier,
      coordination_mode: input.coordination_mode,
      vote_estimate_per_person: input.vote_estimate_per_person,
    },
    travelers: input.travelers.map(t => ({
      id: t.id,
      name: t.name,
      departure_city: t.departure_city,
      home_airport: t.home_airport,
      cabin_class: t.cabin_class,
      seat_preference: t.seat_preference,
      loyalty: t.loyalty,
      flight_rules: t.flight_rules,
    })),
    current_options: currentOptions.map(o => ({
      id: o.id,
      airlines: o.airlines,
      stops: o.stops,
      price_usd: o.price_usd,
      duration_hours: o.duration_hours,
      depart_time: o.depart_time,
    })),
  }

  const anthMessages = [
    { role: 'user' as const, content: `CONTEXT (for grounding, do not repeat verbatim):\n${JSON.stringify(context, null, 2)}` },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: CHAT_SYSTEM,
      messages: anthMessages,
    })
    const text = response.content.find(c => c.type === 'text')?.text || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}') as Partial<FlightChatResult>
    return {
      reply: parsed.reply || "I couldn't put that together — try rephrasing what you'd like to compare.",
      new_options: Array.isArray(parsed.new_options) ? parsed.new_options : [],
    }
  } catch (err) {
    console.error('runFlightChat error:', err)
    return { reply: 'Something went wrong reaching the agent. Try again in a moment.', new_options: [] }
  }
}
