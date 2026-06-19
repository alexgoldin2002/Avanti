import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 60

import {
  parseBookingFromImage,
  parseBookingFromText,
  detectMediaType,
} from '@/lib/bookings/parse-booking-core'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tripId, fileBase64, fileName, mimeType, subject, textBody } = body

    if (!tripId) {
      return NextResponse.json({ error: 'tripId required' }, { status: 400 })
    }

    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const { data: trip } = await supabase.from('trips').select('name, destination').eq('id', tripId).single()
    const tripCtx = { tripName: trip?.name, tripDestination: trip?.destination }

    if (fileBase64) {
      const base64Data = String(fileBase64).includes(',')
        ? String(fileBase64).split(',')[1]
        : fileBase64
      const name = fileName || 'upload.jpg'
      const media = detectMediaType(name, mimeType)

      if (media === 'application/pdf') {
        const parsed = await parseBookingFromText({
          subject,
          body: `[PDF uploaded: ${name}]\n\n${textBody || 'Parse from filename and any extracted text if provided in textBody.'}`,
          ...tripCtx,
        })
        return NextResponse.json({ parsed, source: 'upload' })
      }

      if (media && media !== 'application/pdf') {
        const parsed = await parseBookingFromImage({
          base64Data,
          mediaType: media,
          ...tripCtx,
        })
        return NextResponse.json({ parsed, source: name.toLowerCase().includes('screenshot') ? 'screenshot' : 'upload' })
      }

      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    if (textBody) {
      const parsed = await parseBookingFromText({ subject, body: textBody, ...tripCtx })
      return NextResponse.json({ parsed, source: 'manual' })
    }

    return NextResponse.json({ error: 'fileBase64 or textBody required' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
