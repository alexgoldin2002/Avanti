import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'
import {
  buildStayTravelerContexts,
  defaultMemberStayPrefs,
} from '@/lib/accommodation/traveler-context'
import { getConnectedSourcesSummary } from '@/lib/accommodation/live-offers'
import { fetchLiveStaysForAnalysis } from '@/lib/accommodation/live-offers'
import type { StayAnalysis } from '@/lib/accommodation/types'

async function ensureSession(supabase: ReturnType<typeof adminOrAnon>, tripId: string) {
  let { data: session } = await supabase
    .from('trip_accommodation_sessions')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle()

  if (!session) {
    const { data: created } = await supabase
      .from('trip_accommodation_sessions')
      .insert({
        trip_id: tripId,
        status: 'setup',
        vote_estimate_per_night: null,
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

    const session = await ensureSession(supabase, tripId)
    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)

    const { data: prefs } = session
      ? await supabase.from('trip_accommodation_member_prefs').select('*').eq('session_id', session.id)
      : { data: [] }

    const travelerContexts = await buildStayTravelerContexts(supabase, tripId)

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

    const analysis = session?.analysis as StayAnalysis | null
    const parsedAnalysis =
      analysis && typeof analysis === 'object' && 'stay_options' in analysis ? analysis : null

    const guestCount = Math.max(1, travelers?.length || 2)

    const livePreview = await fetchLiveStaysForAnalysis({
      trip_id: tripId,
      trip: {
        name: trip.name,
        destination: trip.destination,
        locked_tier: trip.locked_tier,
        locked_date_start: trip.locked_date_start,
        locked_date_end: trip.locked_date_end,
        start_date: trip.start_date,
        end_date: trip.end_date,
      },
      coordination_mode: 'together',
      mix_notes: null,
      vote_estimate_per_night: session?.vote_estimate_per_night ?? null,
      guest_count: guestCount,
      travelers: travelerContexts,
      member_prefs: [],
    })

    return NextResponse.json({
      session: session
        ? {
            ...session,
            analysis: parsedAnalysis,
            locked_summary: session.locked_summary || null,
          }
        : null,
      trip,
      travelers: travelers || [],
      travelerContexts,
      prefs: prefs || [],
      myPrefs: myPrefsRow,
      isOrganizer: user?.id === trip.organizer_id,
      myTravelerId,
      guestCount,
      connectedSources: getConnectedSourcesSummary(livePreview.sources),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
