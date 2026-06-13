import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parsePlanResponse } from '@/lib/parse-plan-response'

export const maxDuration = 60

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[plan-conversation] ANTHROPIC_API_KEY is not configured')
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[plan-conversation] Supabase env vars missing')
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const { tripId, messages, userMessage } = await request.json()
    console.log('[plan-conversation] request', { tripId, messageCount: messages?.length, userMessageLength: userMessage?.length })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: trip, error: tripError } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (tripError) {
      console.error('[plan-conversation] trip fetch failed', { tripId, error: tripError.message })
      return NextResponse.json({ error: 'Trip not found', details: tripError.message }, { status: 404 })
    }
    if (!trip) {
      console.error('[plan-conversation] trip not found', { tripId })
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    const systemPrompt = `You are Avanti's group travel AI. Recommend destinations for a specific group.

When the user asks you to generate destination cards, respond immediately using the CARDS format below. Do not ask follow-up questions if stops, budget, and accommodation are already provided.

When generating cards use this exact format:

CARDS:
---
DESTINATION: [Name]
TAGLINE: [One sentence why it fits this specific group]
GETTING THERE: [Routing and hours from their departure cities]
COST: [Total trip cost per person in USD — flights, accommodation, food, activities]
WEATHER: [Temp in °F and conditions for their travel window]
ACTIVITIES: [2–3 sentences specific to this group's interests]
FLEXIBILITY: [High/Medium/Low — one sentence reason]
FOOTNOTES: [Only if triggered: unusual laws, safety advisories, peak pricing >30%, weather risk. Omit entirely if nothing to flag.]
---
DESTINATION: [Name]
[same format]
---
DESTINATION: [Name]
[same format]
---
WILDCARD:
DESTINATION: [Name]
TAGLINE: [Enthusiastic — different voice from the main three]
GETTING THERE: [Routing]
COST: [Total trip cost per person in USD]
WEATHER: [Temp °F and conditions]
ACTIVITIES: [What makes it genuinely exciting for this group]
FLEXIBILITY: [High/Medium/Low]
TRADEOFF: [One honest sentence about what it doesn't deliver vs the main three]
FOOTNOTES: [If triggered]
---

For refinement messages after cards are shown, respond conversationally in plain text unless the user asks for new cards — then regenerate using the CARDS format above.

All temperatures in Fahrenheit. All costs in USD. Never Celsius. Never euros.`

    const conversationMessages = userMessage
      ? [...(messages || []), { role: 'user', content: userMessage }]
      : (messages || [])

    console.log('[plan-conversation] calling Anthropic', { model: 'claude-sonnet-4-6', messageCount: conversationMessages.length })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversationMessages
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      console.error('[plan-conversation] unexpected response type', { type: content.type })
      return NextResponse.json({ text: 'Something went wrong', cards: null })
    }

    const text = content.text
    const parsed = parsePlanResponse(text)
    console.log('[plan-conversation] response received', {
      textLength: text.length,
      hasCards: Boolean(parsed.cards?.length),
      hasOptions: Boolean(parsed.options?.length),
      openText: parsed.openText,
    })

    if (parsed.cards?.length) {
      console.log('[plan-conversation] parsed cards', { cardCount: parsed.cards.length })
    }

    return NextResponse.json({
      message: text,
      text: parsed.text,
      cards: parsed.cards,
      options: parsed.options,
      openText: parsed.openText,
    })
  } catch (error) {
    console.error('[plan-conversation] unhandled error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
