import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 60

import { createAdminClient, tryCreateAdminClient } from '@/lib/supabase-admin'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import {
  createTripBooking,
  ensureTripInbox,
  resolveTravelerForUser,
} from '@/lib/bookings/create-booking'
import type { ParsedBooking } from '@/lib/bookings/types'
import { notifyNewBookingAsync } from '@/lib/bookings/notify-booking'
import { mergeBookingsIntoItinerary } from '@/lib/bookings/merge-itinerary'
import type { ItineraryData } from '@/lib/bookings/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const inbox = await ensureTripInbox(supabase, tripId)

    const { data: bookings } = await supabase
      .from('trip_bookings')
      .select('*')
      .eq('trip_id', tripId)
      .order('starts_at', { ascending: true, nullsFirst: false })

    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)

    const admin = tryCreateAdminClient()
    const enriched = await Promise.all((bookings || []).map(async b => {
      const { data: files } = await supabase
        .from('trip_booking_files')
        .select('*')
        .eq('booking_id', b.id)

      const traveler = travelers?.find(t => t.id === b.booked_by_traveler_id)
      let fileUrls: Array<{ id: string; url: string | null; display_name: string | null; file_type: string }> = []

      if (admin && files?.length) {
        const { getSignedBookingFileUrl } = await import('@/lib/bookings/storage')
        fileUrls = await Promise.all(
          files.map(async f => ({
            id: f.id,
            url: await getSignedBookingFileUrl(admin, f.storage_path),
            display_name: f.display_name,
            file_type: f.file_type,
          }))
        )
      }

      return {
        ...b,
        booker: traveler
          ? {
              name: traveler.name || traveler.email?.split('@')[0],
              email: traveler.email,
              phone: traveler.phone || null,
            }
          : null,
        files: fileUrls,
      }
    }))

    return NextResponse.json({ inboxAddress: inbox.address, bookings: enriched })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      tripId,
      parsed,
      source,
      fileBase64,
      fileName,
      mimeType,
    } = body as {
      tripId: string
      parsed: ParsedBooking
      source: 'email_forward' | 'upload' | 'screenshot' | 'manual'
      fileBase64?: string
      fileName?: string
      mimeType?: string
    }

    if (!tripId || !parsed?.display_title) {
      return NextResponse.json({ error: 'tripId and parsed.display_title required' }, { status: 400 })
    }

    const supabase = supabaseFromRequest(request)
    const user = await requireUser(supabase)
    const admin = createAdminClient()

    const travelerId = await resolveTravelerForUser(supabase, tripId, user.id)

    let file: { buffer: Buffer; fileName: string; mimeType: string } | undefined
    if (fileBase64) {
      const raw = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64
      file = {
        buffer: Buffer.from(raw, 'base64'),
        fileName: fileName || 'confirmation.jpg',
        mimeType: mimeType || 'image/jpeg',
      }
    }

    const { bookingId, created } = await createTripBooking(admin, {
      tripId,
      userId: user.id,
      travelerId,
      parsed,
      source: source || 'upload',
      file,
    })

    const { data: trip } = await supabase.from('trips').select('name, options').eq('id', tripId).single()
    const { data: traveler } = travelerId
      ? await supabase.from('travelers').select('name, email').eq('id', travelerId).single()
      : { data: null }

    if (created) {
      notifyNewBookingAsync({
        tripId,
        tripName: trip?.name || 'Your trip',
        title: parsed.display_title,
        bookerName: traveler?.name || traveler?.email?.split('@')[0] || 'Someone',
      })
    }

    // Merge into saved itinerary if present
    const existingItinerary = trip?.options?.itinerary as ItineraryData | undefined
    if (existingItinerary?.days) {
      const { data: allBookings } = await admin.from('trip_bookings').select('*').eq('trip_id', tripId)
      const merged = mergeBookingsIntoItinerary(existingItinerary, (allBookings || []) as never[])
      await admin.from('trips').update({
        options: { ...(trip?.options || {}), itinerary: merged },
      }).eq('id', tripId)
    }

    return NextResponse.json({ bookingId, created })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
