import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'
import { fetchLiveStaysForAnalysis } from '@/lib/accommodation/live-offers'
import { getConnectedSourcesSummary } from '@/lib/accommodation/live-offers'
import { getAffiliateStatus } from '@/lib/booking/affiliate'
import { isLiteApiConfigured } from '@/lib/liteapi/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = adminOrAnon(request)

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const { count } = await supabase
      .from('travelers')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId)

    const live = await fetchLiveStaysForAnalysis({
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
      vote_estimate_per_night: null,
      guest_count: Math.max(1, count || 2),
      travelers: [],
      member_prefs: [],
    })

    return NextResponse.json({
      live: {
        liteapi: isLiteApiConfigured(),
        offers_available: live.offers.length,
        error: live.error,
      },
      affiliate: getAffiliateStatus(),
      rapid: Boolean(
        process.env.EXPEDIA_RAPID_API_KEY?.trim() && process.env.EXPEDIA_RAPID_API_SECRET?.trim()
      ),
      comparison: {
        google_hotels: true,
        airbnb: true,
      },
      connected: getConnectedSourcesSummary(live.sources),
      note: 'Claude chat connectors (Expedia on Claude, Booking.com Connector, Wyndham, DirectBooker) are not callable from a web app. Avanti uses LiteAPI + affiliate links + AI for the same coverage.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
