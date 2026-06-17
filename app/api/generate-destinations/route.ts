export const maxDuration = 60
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  appendBatchInstructions,
  buildDestinationUserMessage,
  createDestinationCards,
  dedupeCardsByCountry,
  DESTINATION_SYSTEM_PROMPT,
  type DestinationBatch,
} from '@/lib/generate-destinations-core'
import { parseDestinationCards } from '@/lib/parse-destination-cards'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI service is not configured' }, { status: 500 })
    }

    const {
      tripId,
      answers,
      messages,
      stream: useStream = true,
      batch = 'all' as DestinationBatch,
      excludeCountries = [] as string[],
    } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    const travelerCount = travelers?.length || 0

    const baseUserMessage = buildDestinationUserMessage(trip, travelerCount, answers)
    const userMessage = appendBatchInstructions(baseUserMessage, batch, excludeCountries)
    const conversationMessages =
      messages?.length > 0
        ? [...messages, { role: 'user' as const, content: userMessage }]
        : [{ role: 'user' as const, content: userMessage }]

    if (!useStream) {
      const maxTokens = batch === 'all' ? 3200 : 2200
      const result = await createDestinationCards(client, conversationMessages, maxTokens)
      return NextResponse.json(result)
    }

    const anthropicStream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: batch === 'all' ? 3200 : 2200,
      system: DESTINATION_SYSTEM_PROMPT,
      messages: conversationMessages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let streamedText = ''
        try {
          for await (const chunk of anthropicStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              streamedText += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          const parsed = dedupeCardsByCountry(parseDestinationCards(streamedText).cards)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            done: true,
            fullText: streamedText,
            cards: parsed,
          })}\n\n`))
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Generation failed'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: unknown) {
    console.error('generate-destinations error:', error)
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
