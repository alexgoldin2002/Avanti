import { NextRequest, NextResponse } from 'next/server'
import { requireUser, supabaseFromRequest } from '@/lib/destination-decision/supabase-server'
import { getYourGuideSearchUrl } from '@/lib/booking/search-links'
import { searchActivities } from '@/lib/getyourguide/search-tours'
import { getAffiliateStatus } from '@/lib/booking/affiliate'

export const maxDuration = 60

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip?.destination || trip.destination === 'TBD') {
      return NextResponse.json({ error: 'Lock a destination first.' }, { status: 400 })
    }

    const destination = String(trip.destination)
    const startDate = trip.locked_date_start || trip.start_date || null
    const endDate = trip.locked_date_end || trip.end_date || null

    const live = await searchActivities({
      destination,
      startDate,
      endDate,
      limit: 12,
      pubref: tripId,
    })

    return NextResponse.json({
      ...live,
      fallbackSearchUrl: getYourGuideSearchUrl(destination, undefined, { pubref: tripId, label: 'activities' }),
      affiliate: getAffiliateStatus(),
      destination,
      startDate,
      endDate,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
