import { NextRequest, NextResponse } from 'next/server'
import { requireUser, supabaseFromRequest } from '@/lib/destination-decision/supabase-server'
import { bookingComUrl, expediaHotelsUrl, googleHotelsUrl, vrboUrl } from '@/lib/booking/search-links'
import { getAffiliateStatus, isVrboAffiliateConfigured } from '@/lib/booking/affiliate'

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
    const affiliateConfigured = isVrboAffiliateConfigured()
    const rapidConfigured = Boolean(
      process.env.EXPEDIA_RAPID_API_KEY?.trim() && process.env.EXPEDIA_RAPID_API_SECRET?.trim()
    )

    const linkParams = { destination, checkIn, checkOut, adults, pubref: tripId }

    const linkCtx = { pubref: tripId, label: 'rentals' }

    return NextResponse.json({
      configured: true,
      affiliateConfigured,
      affiliate: getAffiliateStatus(),
      liveInventory: rapidConfigured,
      searchLinks: {
        vrbo: vrboUrl({ ...linkParams, ...linkCtx }),
        google: googleHotelsUrl({ destination, checkIn, checkOut, adults }),
        booking: bookingComUrl({ destination, checkIn, checkOut, adults, ...linkCtx }),
        expedia: expediaHotelsUrl({ destination, checkIn, checkOut, adults, ...linkCtx }),
      },
      checkIn,
      checkOut,
      adults,
      destination,
      message: rapidConfigured
        ? 'Live VRBO inventory via Expedia Rapid is configured — in-app checkout coming next.'
        : affiliateConfigured
          ? 'VRBO search opens with affiliate tracking. Add confirmation to your trip vault after booking.'
          : 'Add affiliate env vars in Vercel (see docs/booking-partners-spec.md) for commission tracking.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
