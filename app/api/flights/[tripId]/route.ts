import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'
import {
  buildFlightTravelerContexts,
} from '@/lib/flights/traveler-context'
import type { FlightAnalysis } from '@/lib/flights/types'

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

    if (!trip.destination || trip.destination === 'TBD') {
      return NextResponse.json({ error: 'Lock destination first' }, { status: 400 })
    }

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
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
