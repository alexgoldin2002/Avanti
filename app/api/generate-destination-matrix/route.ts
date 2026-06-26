export const maxDuration = 60
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { generateDestinationMatrix, generateDestinationMatrixRows, generateDestinationMatrixRoutes, type MatrixGenerationMode } from '@/lib/generate-destination-matrix'
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

    const { tripId, answers, messages, consideringList, mode, phase, destinationNames } = await request.json()

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
    if (admin) {
      void syncTripGroupOverlap(admin, tripId).catch(() => {})
    }

    const travelerCount = resolveGroupSize({
      dbCount: travelers?.length || 0,
      answers: answers ?? {},
      chatMessages,
    })

    const chatSupplement = buildChatSupplementBlock(chatMessages)
    const genOpts = {
      trip: tripData,
      travelerCount,
      answers: answers ?? {},
      consideringList: list,
      chatSupplement,
      mode: generationMode,
    }

    const requestPhase = phase === 'matrix' || phase === 'routes' ? phase : 'full'

    if (requestPhase === 'matrix') {
      const rows = await generateDestinationMatrixRows(client, genOpts)
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Could not parse destination scores — try again' }, { status: 502 })
      }
      return NextResponse.json({ matrix: rows })
    }

    if (requestPhase === 'routes') {
      const names = (destinationNames as string[] | undefined)?.map(s => s.trim()).filter(Boolean) || []
      if (names.length < 2) {
        return NextResponse.json({ error: 'destinationNames required for routes phase' }, { status: 400 })
      }
      const routes = await generateDestinationMatrixRoutes(client, { ...genOpts, destinationNames: names })
      return NextResponse.json({
        pairings: routes.pairings,
        triples: routes.triples,
        summary: routes.summary,
        recommendedTab: routes.recommendedTab,
        recommendedShape: routes.recommendedShape,
      })
    }

    const result = await generateDestinationMatrix(client, genOpts)

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
