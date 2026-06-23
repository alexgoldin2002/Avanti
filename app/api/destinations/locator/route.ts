import { NextRequest, NextResponse } from 'next/server'
import { buildLocatorPayload } from '@/lib/destination-locator/geocode'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get('name')?.trim()
    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    const payload = await buildLocatorPayload(name)
    if (!payload) {
      return NextResponse.json({ error: 'Could not locate destination' }, { status: 404 })
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
