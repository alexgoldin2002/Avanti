export const maxDuration = 300
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import {
  generateDestinationMatrix,
  generateDestinationMatrixRows,
  generateDestinationMatrixRoutes,
  generateBrainstormMatrixRow,
  generateConsideringMatrixRow,
  generateMatrixPairingCategory,
  generateMatrixTriples,
  generateMatrixRecommendations,
  generateTripSynthesis,
  assertStep2InputsComplete,
  Step2InputValidationError,
  type MatrixGenerationMode,
} from '@/lib/generate-destination-matrix'
import type { PairingCategory } from '@/lib/matrix-pairing-categories'
import { isDestinationPlanningPath, type DestinationPlanningPath } from '@/lib/step2/planning-path'
import {
  enrichMatrixChipRows,
  enrichMatrixPairings,
  type DestinationMatrixRow,
} from '@/lib/parse-destination-matrix'
import { syncTripGroupOverlap } from '@/lib/group-date-overlap/sync-trip-overlap'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import {
  buildChatSupplementBlock,
  resolveGroupSize,
  sanitizeChatMessages,
} from '@/lib/infer-trip-context'
import { buildOrganizerDestinationProfile } from '@/lib/step2c/trip-generation-context'
import { enrichMatrixRowsWithClimate } from '@/lib/weather/enrich-cards'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PAIRING_CATEGORIES = new Set<PairingCategory>([
  'travel_simplicity',
  'budget',
  'activity_vibe',
])

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI service is not configured' }, { status: 500 })
    }

    const {
      tripId,
      answers,
      messages,
      consideringList,
      mode,
      phase,
      destinationNames,
      destinationName,
      existingNames,
      pairingCategory,
      existingPairings,
      matrixRows,
      tripBrief: tripBriefInput,
      preview = false,
      planningPath: planningPathRaw,
    } = await request.json()

    const isPreview = preview === true || !tripId
    const list = (consideringList as string[] | undefined)?.map(s => s.trim()).filter(Boolean) || []
    const chatMessages = sanitizeChatMessages(messages)
    const answersRecord = (answers ?? {}) as Record<string, unknown>
    const tripBriefFromBody =
      typeof tripBriefInput === 'string' && tripBriefInput.trim()
        ? tripBriefInput.trim()
        : typeof answersRecord.tripBrief === 'string'
          ? answersRecord.tripBrief.trim()
          : ''

    let tripData: Record<string, unknown>
    let generationMode: MatrixGenerationMode
    let travelerCount: number
    let organizerProfile = null

    if (isPreview) {
      const planningPath = planningPathRaw as DestinationPlanningPath
      if (!isDestinationPlanningPath(planningPath) || planningPath === 'known') {
        return NextResponse.json({ error: 'Valid planningPath required for preview' }, { status: 400 })
      }
      generationMode =
        mode === 'brainstorm' || mode === 'considering'
          ? mode
          : planningPath === 'brainstorm'
            ? 'brainstorm'
            : 'considering'
      tripData = {
        trip_type: String(answersRecord.tripLabel || answersRecord.q1 || 'Group trip').slice(0, 80) || 'Group trip',
        destination_planning_path: planningPath,
      }
      travelerCount = resolveGroupSize({ dbCount: 0, answers: answersRecord, chatMessages })
    } else {
      if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

      const userClient = supabaseFromRequest(request)
      let userId: string
      try {
        userId = (await requireUser(userClient)).id
      } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const supabase = tryCreateAdminClient() ?? userClient

      const { data: loadedTrip, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single()

      if (tripError || !loadedTrip) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
      }

      tripData = loadedTrip
      const path = loadedTrip.destination_planning_path
      if (path !== 'considering' && path !== 'brainstorm') {
        return NextResponse.json({ error: 'This trip is not on a matrix planning path' }, { status: 400 })
      }

      generationMode =
        mode === 'brainstorm' || mode === 'considering'
          ? mode
          : path === 'brainstorm'
            ? 'brainstorm'
            : 'considering'

      const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
      travelerCount = resolveGroupSize({
        dbCount: travelers?.length || 0,
        answers: answersRecord,
        chatMessages,
      })

      organizerProfile = await buildOrganizerDestinationProfile(supabase, userId)
    }

    const requestPhase = typeof phase === 'string' ? phase : 'full'

    if (requestPhase === 'synthesis' || requestPhase === 'full') {
      try {
        assertStep2InputsComplete(answersRecord, generationMode, list.length)
      } catch (e) {
        if (e instanceof Step2InputValidationError) {
          return NextResponse.json({ error: e.message }, { status: 400 })
        }
        throw e
      }
    }

    if (generationMode === 'considering' && list.length < 2 && requestPhase !== 'synthesis') {
      return NextResponse.json({ error: 'Add at least 2 destinations to compare' }, { status: 400 })
    }

    const chatSupplement = buildChatSupplementBlock(chatMessages)
    const genOpts = {
      trip: tripData,
      travelerCount,
      answers: answersRecord,
      consideringList: list,
      chatSupplement,
      mode: generationMode,
      tripBrief: tripBriefFromBody || undefined,
      organizerProfile,
    }

    if (requestPhase === 'synthesis') {
      const tripBrief = await generateTripSynthesis(client, genOpts)
      if (!tripBrief) {
        return NextResponse.json(
          { error: 'Could not complete trip analysis — try again', tripBrief: null },
          { status: 502 },
        )
      }
      return NextResponse.json({ tripBrief })
    }

    if (requestPhase === 'matrix-row') {
      const row =
        generationMode === 'considering'
          ? await generateConsideringMatrixRow(client, {
              ...genOpts,
              destinationName: String(destinationName || '').trim(),
            })
          : await generateBrainstormMatrixRow(client, {
              ...genOpts,
              existingNames: Array.isArray(existingNames)
                ? existingNames.map(String).filter(Boolean)
                : [],
            })

      if (!row) {
        return NextResponse.json({ error: 'Could not parse destination — try again' }, { status: 502 })
      }
      enrichMatrixChipRows([row])
      const [enriched] = await enrichMatrixRowsWithClimate([row], tripData)
      return NextResponse.json({ row: enriched })
    }

    if (requestPhase === 'pairing-category') {
      const category = pairingCategory as PairingCategory
      if (!PAIRING_CATEGORIES.has(category)) {
        return NextResponse.json({ error: 'pairingCategory required' }, { status: 400 })
      }
      const names = (destinationNames as string[] | undefined)?.map(s => s.trim()).filter(Boolean) || []
      if (names.length < 2) {
        return NextResponse.json({ error: 'destinationNames required' }, { status: 400 })
      }
      const rows = Array.isArray(matrixRows) ? (matrixRows as DestinationMatrixRow[]) : []
      const pairings = await generateMatrixPairingCategory(client, {
        ...genOpts,
        destinationNames: names,
        category,
        existingPairings: Array.isArray(existingPairings)
          ? existingPairings.map(String).filter(Boolean)
          : [],
        matrixRows: rows,
      })
      enrichMatrixPairings(pairings)
      return NextResponse.json({ pairings })
    }

    if (requestPhase === 'triples') {
      const names = (destinationNames as string[] | undefined)?.map(s => s.trim()).filter(Boolean) || []
      if (names.length < 3) {
        return NextResponse.json({ error: 'destinationNames required' }, { status: 400 })
      }
      const rows = Array.isArray(matrixRows) ? (matrixRows as DestinationMatrixRow[]) : []
      const triples = await generateMatrixTriples(client, {
        ...genOpts,
        destinationNames: names,
        existingPairings: Array.isArray(existingPairings)
          ? existingPairings.map(String).filter(Boolean)
          : [],
        matrixRows: rows,
      })
      enrichMatrixChipRows(triples)
      return NextResponse.json({ triples })
    }

    if (requestPhase === 'recommendations') {
      const names = (destinationNames as string[] | undefined)?.map(s => s.trim()).filter(Boolean) || []
      if (names.length === 0) {
        return NextResponse.json({ error: 'destinationNames required' }, { status: 400 })
      }
      const rows = Array.isArray(matrixRows) ? (matrixRows as DestinationMatrixRow[]) : []
      const recs = await generateMatrixRecommendations(client, {
        ...genOpts,
        destinationNames: names,
        matrixRows: rows,
      })
      return NextResponse.json(recs)
    }

    if (requestPhase === 'matrix') {
      const rows = await generateDestinationMatrixRows(client, genOpts)
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Could not parse destination scores — try again' }, { status: 502 })
      }
      const enriched = await enrichMatrixRowsWithClimate(rows, tripData)
      return NextResponse.json({ matrix: enriched })
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

    const admin = !isPreview ? tryCreateAdminClient() : null
    if (admin && tripId) {
      void syncTripGroupOverlap(admin, tripId).catch(() => {})
    }

    const result = await generateDestinationMatrix(client, genOpts)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Could not parse comparison matrix — try again' }, { status: 502 })
    }

    const enrichedRows = await enrichMatrixRowsWithClimate(result.rows, tripData)

    return NextResponse.json({
      matrix: enrichedRows,
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
