import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { analyzeGroupDateOverlap, travelerProfilesFromRows } from '@/lib/group-date-overlap'
import { syncTripGroupOverlap } from '@/lib/group-date-overlap/sync-trip-overlap'

const OVERLAP_SELECT =
  'group_overlap_start, group_overlap_end, group_overlap_nights, group_overlap_status, group_overlap_computed_at'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)
    const traveler = await findTravelerForUser(userClient, tripId, user.id)
    if (!traveler) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const db = tryCreateAdminClient() ?? userClient
    const result = await syncTripGroupOverlap(db, tripId)

    const { data: trip } = await userClient
      .from('trips')
      .select(OVERLAP_SELECT)
      .eq('id', tripId)
      .single()

    return NextResponse.json({ result, overlap: trip })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

/** Recompute and store group max overlap after Step 2 date changes. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  return GET(request, { params })
}
