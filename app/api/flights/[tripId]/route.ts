import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'
import {
  buildFlightTravelerContexts,
  defaultMemberPrefs,
} from '@/lib/flights/traveler-context'
import type { FlightAnalysis, CoordinationMode } from '@/lib/flights/types'
import { buildAgentBrief } from '@/lib/flights/travel-agent'

async function ensureSession(supabase: ReturnType<typeof adminOrAnon>, tripId: string) {
  let { data: session } = await supabase
    .from('trip_flight_sessions')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle()

  if (!session) {
    const { data: created } = await supabase
      .from('trip_flight_sessions')
      .insert({
        trip_id: tripId,
        status: 'setup',
        vote_estimate_per_person: null,
      })
      .select()
      .single()
    session = created
  }

  return session
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = adminOrAnon(request)

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    // Note: a not-yet-locked destination is NOT an error here — return the trip so the
    // Flights page can render its own "set your destination first" state instead of a
    // blank screen. Analysis endpoints still guard on a locked destination separately.

    const session = await ensureSession(supabase, tripId)
    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)

    const { data: prefs } = session
      ? await supabase.from('trip_flight_member_prefs').select('*').eq('session_id', session.id)
      : { data: [] }

    const travelerContexts = await buildFlightTravelerContexts(supabase, tripId)

    const { data: { user } } = await supabase.auth.getUser()
    let myTravelerId: string | null = null
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('user_id', user.id)
        .maybeSingle()
      const me = travelers?.find(
        t => t.user_id === user.id || t.email?.toLowerCase() === profile?.email?.toLowerCase()
      )
      myTravelerId = me?.id ?? null
    }

    const myPrefsRow = prefs?.find(p => p.traveler_id === myTravelerId) || null

    const analysis = session?.analysis as FlightAnalysis | null
    const parsedAnalysis =
      analysis && typeof analysis === 'object' && 'scenarios' in analysis ? analysis : null

    // "What your travel agent knows" preview — same data the model receives.
    const agentBrief = buildAgentBrief({
      trip: {
        name: trip.name,
        destination: trip.destination,
        locked_tier: trip.locked_tier,
        date_range_start: trip.date_range_start,
        date_range_end: trip.date_range_end,
        start_date: trip.start_date,
        end_date: trip.end_date,
        locked_date_start: trip.locked_date_start,
        locked_date_end: trip.locked_date_end,
        group_overlap_start: trip.group_overlap_start,
        group_overlap_end: trip.group_overlap_end,
        group_overlap_nights: trip.group_overlap_nights,
      },
      coordination_mode: (session?.coordination_mode as CoordinationMode) || 'independent',
      mix_notes: session?.mix_notes ?? null,
      vote_estimate_per_person: session?.vote_estimate_per_person ?? null,
      travelers: travelerContexts,
      member_prefs: travelerContexts.map(ctx => ({
        ...defaultMemberPrefs(ctx),
        traveler_id: ctx.id,
        traveler_name: ctx.name,
      })),
    })

    return NextResponse.json({
      session: session
        ? {
            ...session,
            analysis: parsedAnalysis,
          }
        : null,
      trip,
      travelers: travelers || [],
      travelerContexts,
      prefs: prefs || [],
      myPrefs: myPrefsRow,
      isOrganizer: user?.id === trip.organizer_id,
      myTravelerId,
      voteEstimate: session?.vote_estimate_per_person ?? null,
      agentBrief,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
