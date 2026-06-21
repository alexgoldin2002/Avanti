import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { googleFlightsUrl, kayakFlightsUrl } from '@/lib/booking/search-links'
import { searchDuffelOffers } from '@/lib/duffel/search-offers'

export const maxDuration = 60

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const origin = request.nextUrl.searchParams.get('origin')
    const destination = request.nextUrl.searchParams.get('destination')
    const departDate = request.nextUrl.searchParams.get('departDate')
    const returnDate = request.nextUrl.searchParams.get('returnDate')

    if (!origin || !destination || !departDate || !returnDate) {
      return NextResponse.json(
        { error: 'origin, destination, departDate, returnDate required' },
        { status: 400 }
      )
    }

    const searchParams = { origin, destination, departDate, returnDate }
    const live = await searchDuffelOffers(searchParams)

    return NextResponse.json({
      ...live,
      searchLinks: {
        google: googleFlightsUrl(searchParams),
        kayak: kayakFlightsUrl(searchParams),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
