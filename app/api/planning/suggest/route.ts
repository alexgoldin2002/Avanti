import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const client = new Anthropic()

export type PlanningCategory = 'accommodation' | 'activities' | 'dining'

const PROMPTS: Record<PlanningCategory, string> = {
  accommodation: `Suggest 4 hotel/stay options for this group trip. Match the locked tier (budget/mid/luxury). Include mix of hotel and boutique/Airbnb-style where appropriate. Return ONLY JSON: {"intro":"one sentence","options":[{"name":"...","type":"hotel|airbnb|resort","area":"neighborhood","price_per_night_usd":number,"why":"one sentence","group_fit":"one sentence"}]}`,
  activities: `Suggest 6 group activities for this trip. Mix must-do highlights with one unique local experience. Return ONLY JSON: {"intro":"one sentence","options":[{"name":"...","duration":"half day|full day|2h","cost_per_person_usd":number,"why":"one sentence","best_for":"who in group loves this"}]}`,
  dining: `Suggest 6 real, currently-operating restaurants for this group in the destination. Use actual restaurant names that exist there. Mix price points within the tier, include one splurge and one casual, and cover a couple of different neighborhoods. If dietary needs are given, every pick must have strong options for them. If preferred cuisines are given, lean into them. Return ONLY JSON: {"intro":"one sentence","options":[{"name":"exact restaurant name","cuisine":"...","price_level":"$|$$|$$$","area":"neighborhood","why":"one sentence","best_for":"which meal/occasion","reservation_tip":"how far ahead + which platform (Resy/OpenTable/walk-in)"}]}`,
}

type DiningContext = {
  partySize?: number
  dietary?: string
  cuisines?: string
  area?: string
}

function diningContextBlock(ctx: DiningContext): string {
  const lines: string[] = []
  if (ctx.partySize && ctx.partySize > 0) lines.push(`PARTY SIZE: ${ctx.partySize} people`)
  if (ctx.dietary?.trim()) lines.push(`DIETARY NEEDS: ${ctx.dietary.trim()}`)
  if (ctx.cuisines?.trim()) lines.push(`PREFERRED CUISINES / VIBE: ${ctx.cuisines.trim()}`)
  if (ctx.area?.trim()) lines.push(`FOCUS NEIGHBORHOOD / NEAR: ${ctx.area.trim()}`)
  return lines.length ? `\n${lines.join('\n')}` : ''
}

export async function POST(request: NextRequest) {
  try {
    const { trip, category, tier, dining } = await request.json() as {
      trip: { name: string; destination: string; start_date?: string; end_date?: string; locked_tier?: string }
      category: PlanningCategory
      tier?: string
      dining?: DiningContext
    }

    if (!trip?.destination || !category || !PROMPTS[category]) {
      return NextResponse.json({ error: 'trip.destination and valid category required' }, { status: 400 })
    }

    const tierLabel = tier || trip.locked_tier || 'mid'
    const dates =
      trip.start_date && trip.end_date
        ? `${trip.start_date} to ${trip.end_date}`
        : 'flexible dates'

    const contextBlock = category === 'dining' && dining ? diningContextBlock(dining) : ''

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: 'You are Avanti, a luxury group travel planner. Output valid JSON only.',
      messages: [{
        role: 'user',
        content: `${PROMPTS[category]}

TRIP: ${trip.name}
DESTINATION: ${trip.destination}
DATES: ${dates}
TIER: ${tierLabel}${contextBlock}`,
      }],
    })

    const text = response.content.find(c => c.type === 'text')?.text || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')

    return NextResponse.json({ suggestions: parsed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
