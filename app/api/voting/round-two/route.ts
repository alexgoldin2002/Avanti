import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import { applyRoundTwoWinner, allTravelersSubmittedRoundTwo } from '@/lib/voting'

export async function POST(request: NextRequest) {
  try {
    const { tripId, allocations } = await request.json()
    if (!tripId || !Array.isArray(allocations)) {
      return NextResponse.json({ error: 'tripId and allocations required' }, { status: 400 })
    }

    const total = allocations.reduce((s: number, a: { percentage: number }) => s + (a.percentage || 0), 0)
    if (total !== 100) {
      return NextResponse.json({ error: 'Allocations must sum to 100' }, { status: 400 })
    }

    const supabase = supabaseFromRequest(request)
    const user = await requireUser(supabase)
    const traveler = await findTravelerForUser(supabase, tripId, user.id)
    if (!traveler) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const rows = allocations.map((a: { destinationAnalysisId: string; percentage: number }) => ({
      trip_id: tripId,
      traveler_id: traveler.id,
      destination_analysis_id: a.destinationAnalysisId,
      percentage: a.percentage,
    }))

    await supabase.from('round_two_votes').upsert(rows, {
      onConflict: 'trip_id,traveler_id,destination_analysis_id',
    })

    await supabase.from('travelers').update({ round_two_submitted: true }).eq('id', traveler.id)

    let winnerId: string | null = null
    if (await allTravelersSubmittedRoundTwo(supabase, tripId)) {
      winnerId = await applyRoundTwoWinner(supabase, tripId)
    }

    return NextResponse.json({ ok: true, winnerId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
