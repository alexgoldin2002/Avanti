import Anthropic from '@anthropic-ai/sdk'
import type { CompanionContext, DestinationEssentials } from './types'

const client = new Anthropic()

export async function generateDestinationEssentials(ctx: CompanionContext): Promise<DestinationEssentials> {
  const nationalities = ctx.travelerNationalities.length
    ? ctx.travelerNationalities.join(', ')
    : 'United States'

  const hotelBlock = ctx.hotelAddress
    ? `Primary hotel/base: ${ctx.hotelAddress}`
    : 'No hotel booked yet — use city center as reference.'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: 'You are a travel safety expert. Return only valid JSON with accurate emergency numbers and embassy info.',
    messages: [{
      role: 'user',
      content: `Generate destination essentials for travelers.

DESTINATION: ${ctx.trip.destination}
TRIP: ${ctx.trip.name}
DATES: ${ctx.trip.start_date} to ${ctx.trip.end_date}
TRAVELER NATIONALITIES: ${nationalities}
${hotelBlock}

Return JSON:
{
  "destination": "${ctx.trip.destination}",
  "emergency_number": "universal emergency number in country",
  "police_number": "string or null",
  "ambulance_number": "string or null",
  "general_tips": ["3-5 practical safety tips"],
  "hospitals": [{"name":"","address":"","phone":"","distance_from_hotel":"","notes":null}],
  "embassies": [{"nationality":"","name":"","address":"","phone":"","hours":"","emergency_line":null}],
  "generated_at": "${new Date().toISOString()}"
}

Include embassy/consulate for EACH listed nationality. Hospitals should be near the hotel/base.`,
    }],
  })

  const text = response.content.find(c => c.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(jsonMatch?.[0] || '{}')
  return {
    destination: ctx.trip.destination,
    emergency_number: parsed.emergency_number || '112',
    police_number: parsed.police_number || null,
    ambulance_number: parsed.ambulance_number || null,
    general_tips: Array.isArray(parsed.general_tips) ? parsed.general_tips : [],
    hospitals: Array.isArray(parsed.hospitals) ? parsed.hospitals : [],
    embassies: Array.isArray(parsed.embassies) ? parsed.embassies : [],
    generated_at: new Date().toISOString(),
  }
}
