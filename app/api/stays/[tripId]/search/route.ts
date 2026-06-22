import { NextRequest, NextResponse } from 'next/server'
import { requireUser, supabaseFromRequest } from '@/lib/destination-decision/supabase-server'
import { searchLiveStays } from '@/lib/liteapi/search-stays'
import { bookingComUrl, expediaHotelsUrl, googleHotelsUrl, vrboUrl } from '@/lib/booking/search-links'
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

    const checkIn = trip.locked_date_start || trip.start_date
    const checkOut = trip.locked_date_end || trip.end_date
    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: 'Lock flight dates first (Step 4).' }, { status: 400 })
    }

    const { count } = await supabase
      .from('travelers')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId)

    const adults = Math.max(1, count || 2)
    const destination = String(trip.destination)

    const live = await searchLiveStays({
      destination,
      checkIn,
      checkOut,
      adults,
      tier: trip.locked_tier,
    })

    const linkCtx = { pubref: tripId, label: 'stays' }
    const searchLinks = {
      google: googleHotelsUrl({ destination, checkIn, checkOut, adults }),
      booking: bookingComUrl({ destination, checkIn, checkOut, adults, ...linkCtx }),
      expedia: expediaHotelsUrl({ destination, checkIn, checkOut, adults, ...linkCtx }),
      vrbo: vrboUrl({ destination, checkIn, checkOut, adults, ...linkCtx }),
    }

    return NextResponse.json({ ...live, searchLinks, affiliate: getAffiliateStatus(), checkIn, checkOut, adults })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
