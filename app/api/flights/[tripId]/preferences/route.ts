import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireUser } from '@/lib/destination-decision/supabase-server'
import type { DirectPreference, CostVsTime } from '@/lib/flights/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const body = await request.json()
    const supabase = adminOrAnon(request)
    const user = await requireUser(supabase)

    const { data: session } = await supabase
      .from('trip_flight_sessions')
      .select('id, status, coordination_mode')
      .eq('trip_id', tripId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.status === 'locked') {
      return NextResponse.json({ error: 'Flights already locked' }, { status: 400 })
    }

    const { data: travelers } = await supabase.from('travelers').select('id, email, user_id').eq('trip_id', tripId)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('user_id', user.id)
      .maybeSingle()

    const me = travelers?.find(
      t => t.user_id === user.id || t.email?.toLowerCase() === profile?.email?.toLowerCase()
    )
    if (!me) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const directPreference = (body.directPreference || body.direct_preference || 'one_stop_ok') as DirectPreference
    const costVsTime = (body.costVsTime || body.cost_vs_time || 'balance') as CostVsTime

    await supabase.from('trip_flight_member_prefs').upsert(
      {
        session_id: session.id,
        traveler_id: me.id,
        user_id: user.id,
        direct_preference: directPreference,
        preferred_airlines: body.preferredAirlines || body.preferred_airlines || [],
        avoid_airlines: body.avoidAirlines || body.avoid_airlines || [],
        cost_vs_time: costVsTime,
        wants_group_routing:
          session.coordination_mode === 'mix'
            ? body.wantsGroupRouting ?? body.wants_group_routing ?? null
            : session.coordination_mode === 'together'
              ? true
              : session.coordination_mode === 'independent'
                ? false
                : null,
        notes: body.notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,traveler_id' }
    )

    const { data: allPrefs } = await supabase
      .from('trip_flight_member_prefs')
      .select('traveler_id')
      .eq('session_id', session.id)

    const allSubmitted = (travelers?.length || 0) > 0 && (allPrefs?.length || 0) >= (travelers?.length || 0)
    if (allSubmitted && session.status === 'preferences') {
      await supabase
        .from('trip_flight_sessions')
        .update({ status: 'review', updated_at: new Date().toISOString() })
        .eq('id', session.id)
    }

    return NextResponse.json({ ok: true, allSubmitted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
