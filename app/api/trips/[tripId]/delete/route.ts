import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { deleteTripData } from '@/lib/trip-delete-core'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const userClient = supabaseFromRequest(request)
    await requireOrganizer(userClient, tripId)

    // Prefer service role when configured; otherwise use the organizer's session (needs expenses GRANTs).
    const db = tryCreateAdminClient() ?? userClient
    const result = await deleteTripData(db, tripId)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
