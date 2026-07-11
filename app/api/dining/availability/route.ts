import { NextRequest, NextResponse } from 'next/server'
import {
  isOpenTableConfigured,
  searchOpenTableAvailability,
  openTableBookingUrl,
} from '@/lib/booking/opentable-client'
import {
  isResyConfigured,
  searchResyAvailability,
  resyBookingUrl,
} from '@/lib/booking/resy-client'

type RequestBody = {
  destination?: string
  date?: string
  time?: string
  partySize?: number
  restaurants?: { name?: string }[]
}

export type DiningAvailabilitySlot = {
  dateTime: string
  partySize: number
  bookingUrl: string
}

export type DiningAvailabilityResult = {
  name: string
  opentable: DiningAvailabilitySlot[]
  resy: DiningAvailabilitySlot[]
}

export type DiningAvailabilityResponse = {
  configured: { opentable: boolean; resy: boolean }
  results: DiningAvailabilityResult[]
}

export async function POST(request: NextRequest) {
  const configured = {
    opentable: isOpenTableConfigured(),
    resy: isResyConfigured(),
  }

  // No provider configured → tell the client to fall back to search links.
  if (!configured.opentable && !configured.resy) {
    return NextResponse.json<DiningAvailabilityResponse>({ configured, results: [] })
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const destination = body.destination?.trim()
  const date = body.date?.trim()
  const time = body.time?.trim() || '19:00'
  const partySize = body.partySize && body.partySize > 0 ? body.partySize : 2
  const restaurants = (body.restaurants || []).filter(r => r?.name?.trim())

  if (!destination || !date || restaurants.length === 0) {
    return NextResponse.json({ error: 'Missing destination, date, or restaurants' }, { status: 400 })
  }

  try {
    const results = await Promise.all(
      restaurants.map(async (r): Promise<DiningAvailabilityResult> => {
        const name = r.name!.trim()
        const input = { name, destination, date, time, partySize }

        const [otMatches, resyMatches] = await Promise.all([
          configured.opentable ? searchOpenTableAvailability(input) : Promise.resolve([]),
          configured.resy ? searchResyAvailability(input) : Promise.resolve([]),
        ])

        const ot = otMatches[0]
        const resy = resyMatches[0]

        return {
          name,
          opentable: ot
            ? ot.slots.map(slot => ({
                dateTime: slot.dateTime,
                partySize: slot.partySize,
                bookingUrl: openTableBookingUrl(ot, slot),
              }))
            : [],
          resy: resy
            ? resy.slots.map(slot => ({
                dateTime: slot.dateTime,
                partySize: slot.partySize,
                bookingUrl: resyBookingUrl(resy, slot),
              }))
            : [],
        }
      }),
    )
    return NextResponse.json<DiningAvailabilityResponse>({ configured, results })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Availability lookup failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
