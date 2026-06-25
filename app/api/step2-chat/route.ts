import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function formatDates(context: Record<string, unknown>): string {
  const dates = (context.dates as string) || 'not yet answered'
  const fixed = context.fixedDates as { start?: string; end?: string } | undefined
  const flexLength = context.flexLength as string | undefined

  if (fixed?.start && fixed?.end) {
    const range = `${fixed.start} to ${fixed.end}`
    return flexLength ? `${range} (${flexLength})` : range
  }
  return flexLength ? `${dates} (${flexLength})` : dates
}

function buildStep2ChatSystem(context: Record<string, unknown>): string {
  const regions = context.regions as string[] | undefined
  const activities = context.activities as string[] | undefined
  const vibe = context.vibe as string[] | undefined

  return `You are Avanti, a smart and warm travel planning AI. A traveler is filling out their trip preferences on Step 2 Brainstorm.

<context>
Trip type: ${context.trip_type || 'not yet answered'}
About the trip: ${context.q1 || 'not yet answered'}
Departure city: ${context.departureCity || 'not yet answered'}
Dates: ${formatDates(context)}
Domestic/international: ${context.domestic || 'not yet answered'}${regions?.length ? ` — regions: ${regions.join(', ')}` : ''}
Number of stops: ${context.stops || 'not yet answered'}
Activities: ${activities?.join(', ') || 'not yet answered'}
Vibe: ${vibe?.join(', ') || 'not yet answered'}
Accommodation: ${context.accommodation || 'not yet answered'}
Budget: ${context.budget || 'not yet answered'}
Popularity preference: ${context.popularity || 'not yet answered'}
Deal breakers: ${context.q3 || 'not yet answered'}
</context>

<task>
Answer questions about the trip planning process. Be concise, warm, and helpful.

When asked about a region, country, travel style, or season:
- Give specific facts: typical weather patterns, vibe, realistic USD cost ranges, safety notes
- Name neighborhoods or areas when relevant — never generic "explore local culture" advice

When asked for destination picks or card recommendations:
- Tell them to hit Generate to see full destination cards — you cannot generate cards here

If they share extra details in chat (group size, trip length, constraints):
- Acknowledge it — that context is included automatically when they hit Generate

Hard rules:
- NEVER output destination cards, DESTINATIONS:, NAME:, or card block format
- ALL costs in USD, temperatures in °F
- Keep responses under 500 tokens
</task>`
}

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: buildStep2ChatSystem(context || {}),
      messages,
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : 'Something went wrong.'
    return NextResponse.json({ message: text })
  } catch (e: any) {
    return NextResponse.json({ message: 'Something went wrong. Try again.' })
  }
}
