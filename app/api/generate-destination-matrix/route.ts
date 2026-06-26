export const maxDuration = 60
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { generateDestinationMatrix, type MatrixGenerationMode } from '@/lib/generate-destination-matrix'
import { syncTripGroupOverlap } from '@/lib/group-date-overlap/sync-trip-overlap'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
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

    const { tripId, answers, messages, consideringList, mode } = await request.json()

    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

    const userClient = supabaseFromRequest(request)
    try {
      await requireUser(userClient)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const list = (consideringList as string[] | undefined)?.map(s => s.trim()).filter(Boolean) || []
    const chatMessages = sanitizeChatMessages(messages)
    const supabase = tryCreateAdminClient() ?? userClient

    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    if (tripError || !tripData) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    const path = tripData.destination_planning_path
    if (path !== 'considering' && path !== 'brainstorm') {
      return NextResponse.json({ error: 'This trip is not on a matrix planning path' }, { status: 400 })
    }

    const generationMode: MatrixGenerationMode =
      mode === 'brainstorm' || mode === 'considering'
        ? mode
        : path === 'brainstorm'
          ? 'brainstorm'
          : 'considering'

    if (generationMode === 'considering' && list.length < 2) {
      return NextResponse.json({ error: 'Add at least 2 destinations to compare' }, { status: 400 })
    }

    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    const admin = tryCreateAdminClient()
    if (admin) await syncTripGroupOverlap(admin, tripId)

    const travelerCount = resolveGroupSize({
      dbCount: travelers?.length || 0,
      answers: answers ?? {},
      chatMessages,
    })

    const chatSupplement = buildChatSupplementBlock(chatMessages)
    const result = await generateDestinationMatrix(client, {
      trip: tripData,
      travelerCount,
      answers: answers ?? {},
      consideringList: list,
      chatSupplement,
      mode: generationMode,
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Could not parse comparison matrix — try again' }, { status: 502 })
    }

    return NextResponse.json({
      matrix: result.rows,
      pairings: result.pairings,
      triples: result.triples,
      summary: result.summary,
      recommendedTab: result.recommendedTab,
      recommendedShape: result.recommendedShape,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
