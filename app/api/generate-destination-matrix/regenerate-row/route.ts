export const maxDuration = 60
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import {
  regenerateMatrixDestinationRow,
  type MatrixGenerationMode,
} from '@/lib/generate-destination-matrix'
import { enrichMatrixChipRows } from '@/lib/parse-destination-matrix'
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

    const { tripId, answers, messages, replaceName, keepNames, mode } = await request.json()

    if (!tripId || !replaceName) {
      return NextResponse.json({ error: 'tripId and replaceName required' }, { status: 400 })
    }

    const userClient = supabaseFromRequest(request)
    try {
      await requireUser(userClient)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      return NextResponse.json({ error: 'Matrix regeneration is not available for this trip' }, { status: 400 })
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
    const generationMode: MatrixGenerationMode =
      mode === 'brainstorm' || mode === 'considering'
        ? mode
        : path === 'brainstorm'
          ? 'brainstorm'
          : 'considering'

    const row = await regenerateMatrixDestinationRow(client, {
      trip: tripData,
      travelerCount,
      answers: answers ?? {},
      replaceName: String(replaceName),
      keepNames: Array.isArray(keepNames) ? keepNames.map(String) : [],
      chatSupplement,
      mode: generationMode,
    })

    if (!row) {
      return NextResponse.json({ error: 'Could not parse replacement destination — try again' }, { status: 502 })
    }

    enrichMatrixChipRows([row])

    return NextResponse.json({ row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
