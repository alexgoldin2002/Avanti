import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { getRoundOneSubmissionStatus, applyRoundOneAdvancers, allTravelersSubmittedRoundOne } from '@/lib/voting'
import { stampRoundTwoOpened } from '@/lib/trip-phases/stamp'

function validateRanks(
  votes: Array<{ destinationAnalysisId: string; rank: number }>,
  destinationIds: string[]
): string | null {
  if (votes.length !== destinationIds.length) {
    return `Rank all ${destinationIds.length} destinations`
  }
  const destSet = new Set(destinationIds)
  const ranks = new Set<number>()
  for (const v of votes) {
    if (!destSet.has(v.destinationAnalysisId)) return 'Invalid destination in ranking'
    if (!Number.isInteger(v.rank) || v.rank < 1 || v.rank > destinationIds.length) {
      return 'Each rank must be a unique number from 1 to the number of destinations'
    }
    if (ranks.has(v.rank)) return 'Each rank must be used exactly once'
    ranks.add(v.rank)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { tripId, votes } = await request.json()
    if (!tripId || !Array.isArray(votes)) {
      return NextResponse.json({ error: 'tripId and votes required' }, { status: 400 })
    }

    const supabase = supabaseFromRequest(request)
    const user = await requireUser(supabase)
    const traveler = await findTravelerForUser(supabase, tripId, user.id)
    if (!traveler) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const { data: destinations, error: destErr } = await supabase
      .from('destination_analysis')
      .select('id')
      .eq('trip_id', tripId)
      .eq('pushed_to_vote', true)

    if (destErr) return NextResponse.json({ error: destErr.message }, { status: 500 })

    const destinationIds = (destinations || []).map(d => d.id)
    const rankError = validateRanks(votes, destinationIds)
    if (rankError) return NextResponse.json({ error: rankError }, { status: 400 })

    const db = tryCreateAdminClient() ?? supabase

    const phaseCheck = await assertPhaseEditable(db, tripId, traveler.id, user.id, 'round_one')
    if (!phaseCheck.ok) {
      return NextResponse.json({ error: phaseCheck.error }, { status: phaseCheck.status })
    }

    const rows = votes.map((v: { destinationAnalysisId: string; rank: number }) => ({
      trip_id: tripId,
      traveler_id: traveler.id,
      destination_analysis_id: v.destinationAnalysisId,
      rank: v.rank,
    }))

    const { error: upsertErr } = await db.from('round_one_votes').upsert(rows, {
      onConflict: 'trip_id,traveler_id,destination_analysis_id',
    })
    if (upsertErr) {
      const hint = upsertErr.message.includes('rank')
        ? ' Run the ranked voting migration in Supabase (rank column on round_one_votes).'
        : ''
      return NextResponse.json({ error: upsertErr.message + hint }, { status: 500 })
    }

    const { error: travelerErr } = await db
      .from('travelers')
      .update({ round_one_submitted: true })
      .eq('id', traveler.id)
    if (travelerErr) return NextResponse.json({ error: travelerErr.message }, { status: 500 })

    let advanced = false
    if (await allTravelersSubmittedRoundOne(db, tripId)) {
      await applyRoundOneAdvancers(db, tripId)
      await stampRoundTwoOpened(db, tripId)
      advanced = true
    }

    const roundOneStatus = await getRoundOneSubmissionStatus(db, tripId)

    return NextResponse.json({ ok: true, advanced, roundOneStatus })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
