import { NextRequest, NextResponse } from 'next/server'
import { debugTypicalWeather } from '@/lib/weather/climate-summary'
import { formatDateRange } from '@/lib/group-date-overlap'

/** Quick Open-Meteo smoke test — dev only. */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const params = request.nextUrl.searchParams
  const destination = params.get('destination') || 'Medellín, Colombia'
  const country = params.get('country')
  const start = params.get('start') || '2026-04-10'
  const end = params.get('end') || '2026-04-27'

  const window = { start, end, label: formatDateRange(start, end) }
  const debug = await debugTypicalWeather({
    destinationName: destination,
    countryHint: country,
    window,
  })

  return NextResponse.json(debug)
}
