import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json()
    const system = `You are Avanti, a smart and warm travel planning AI. A traveler is filling out their trip preferences. You can see what they have filled in so far.

Current answers:
- About the trip: ${context.q1 || 'not yet answered'}
- Departure city: ${context.departureCity || 'not yet answered'}
- Dates: ${context.dates || 'not yet answered'}
- Domestic/international: ${context.domestic || 'not yet answered'}
- Activities: ${context.activities?.join(', ') || 'not yet answered'}
- Vibe: ${context.vibe?.join(', ') || 'not yet answered'}
- Budget: ${context.budget || 'not yet answered'}
- Deal breakers: ${context.q3 || 'not yet answered'}

Answer questions about the trip planning process. Be concise, warm, and helpful. If they share details like group size, departure city breakdowns, or trip length in chat, acknowledge it — that context is included automatically when they hit Generate. If they ask about destination suggestions, tell them to hit Generate to see the full recommendations. Do not generate destination cards here — that happens on the next page.`
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system,
      messages,
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : 'Something went wrong.'
    return NextResponse.json({ message: text })
  } catch (e: any) {
    return NextResponse.json({ message: 'Something went wrong. Try again.' })
  }
}
