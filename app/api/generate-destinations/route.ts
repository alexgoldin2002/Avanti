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
import {
  buildChatSupplementBlock,
  resolveGroupSize,
  sanitizeChatMessages,
} from '@/lib/infer-trip-context'

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
      preview = false,
    } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const isPreview = preview || !tripId
    const chatMessages = sanitizeChatMessages(messages)

    let trip: Record<string, unknown> | null = null
    let dbTravelerCount = 0

    if (isPreview) {
      trip = {
        trip_type: (answers?.tripLabel as string) || 'Group trip',
        is_event_centered: false,
      }
    } else {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      trip = tripData
      const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
      dbTravelerCount = travelers?.length || 0
    }

    const travelerCount = resolveGroupSize({
      dbCount: dbTravelerCount,
      answers: answers ?? {},
      chatMessages,
    })

    const chatSupplement = buildChatSupplementBlock(chatMessages)
    const baseUserMessage = buildDestinationUserMessage(trip, travelerCount, answers ?? {}, chatSupplement)
    const userMessage = appendBatchInstructions(baseUserMessage, batch, excludeCountries)
    const conversationMessages =
      chatMessages.length > 0
        ? [...chatMessages, { role: 'user' as const, content: userMessage }]
        : [{ role: 'user' as const, content: userMessage }]

    if (!useStream) {
      const maxTokens = batch === 'wildcard-only' ? 1200 : batch === 'all' ? 3200 : 1800
      const result = await createDestinationCards(client, conversationMessages, maxTokens)
      return NextResponse.json(result)
    }

    const anthropicStream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: batch === 'wildcard-only' ? 1200 : batch === 'all' ? 3200 : 1800,
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
