import Anthropic from '@anthropic-ai/sdk'
import type { CompanionContext, CountryAppsGuide } from './types'

const client = new Anthropic()

export async function generateCountryApps(ctx: CompanionContext): Promise<CountryAppsGuide> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    system: 'You know local apps used in every country. Return only valid JSON.',
    messages: [{
      role: 'user',
      content: `List essential local apps for travelers in ${ctx.trip.destination}.

Include rideshare/taxi apps (local Uber equivalents), public transit apps, food delivery, maps, payments, translation.
Include useful phone numbers for transit/taxi if no app.

Return JSON:
{
  "destination": "${ctx.trip.destination}",
  "country": "country name",
  "apps": [
    {"name":"","category":"rideshare|transit|food_delivery|maps|payments|translation|other","description":"","platforms":["iOS","Android"],"download_note":null}
  ],
  "transit_numbers": ["phone numbers for taxis/transit hotlines"],
  "tips": ["2-3 tips on which apps to install before arrival"],
  "generated_at": "${new Date().toISOString()}"
}`,
    }],
  })

  const text = response.content.find(c => c.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(jsonMatch?.[0] || '{}')
  return {
    destination: ctx.trip.destination,
    country: parsed.country || ctx.trip.destination,
    apps: Array.isArray(parsed.apps) ? parsed.apps : [],
    transit_numbers: Array.isArray(parsed.transit_numbers) ? parsed.transit_numbers : [],
    tips: Array.isArray(parsed.tips) ? parsed.tips : [],
    generated_at: new Date().toISOString(),
  }
}
