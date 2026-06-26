import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { openBrainstormTimestamps } from '@/lib/trip-phases/finalize'
import { isDestinationPlanningPath } from '@/lib/step2/planning-path'

type PlanningPathBody = {
  path: string
  knownDestinations?: string[]
}

/** Organizer picks Step 2 path and unlocks planning. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const body = (await request.json()) as PlanningPathBody
    const path = body.path

    if (!isDestinationPlanningPath(path)) {
      return NextResponse.json({ error: 'Invalid planning path' }, { status: 400 })
    }

    const userClient = supabaseFromRequest(request)
    await requireOrganizer(userClient, tripId)
    const supabase = tryCreateAdminClient() ?? userClient

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    if (trip.destination_planning_path) {
      return NextResponse.json({ error: 'Planning path already set for this trip' }, { status: 409 })
    }

    const now = new Date()

    if (path === 'known') {
      const places = (body.knownDestinations || [])
        .map(s => s.trim())
        .filter(Boolean)
      if (places.length === 0) {
        return NextResponse.json({ error: 'Enter at least one destination' }, { status: 400 })
      }

      const destinationLabel = places.join(' · ')
      const closedAt = now.toISOString()

      const { error } = await supabase
        .from('trips')
        .update({
          invites_closed: true,
          destination_planning_path: 'known',
          destination: destinationLabel,
          winning_destination_id: null,
          brainstorm_closed_at: closedAt,
          updated_at: closedAt,
        })
        .eq('id', tripId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({
        ok: true,
        path,
        redirectTo: `/trips/${tripId}`,
        destination: destinationLabel,
      })
    }

    const patch = {
      ...openBrainstormTimestamps(trip, now),
      destination_planning_path: path,
    }

    const { error } = await supabase.from('trips').update(patch).eq('id', tripId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      path,
      redirectTo: `/trips/${tripId}/step2`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
