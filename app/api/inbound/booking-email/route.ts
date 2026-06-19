import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 120

import { createAdminClient } from '@/lib/supabase-admin'
import { parseBookingFromText } from '@/lib/bookings/parse-booking-core'
import { tokenFromInboxAddress } from '@/lib/bookings/inbox'
import {
  createTripBooking,
  resolveTripFromInboxToken,
  resolveUserFromEmail,
  resolveTravelerForUser,
} from '@/lib/bookings/create-booking'
import { notifyNewBookingAsync } from '@/lib/bookings/notify-booking'

/** Postmark / generic inbound email webhook */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-inbound-secret')
    if (process.env.INBOUND_EMAIL_SECRET && secret !== process.env.INBOUND_EMAIL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const admin = createAdminClient()

    const fromEmail =
      payload.FromFull?.Email ||
      payload.from ||
      payload.From ||
      ''
    const toRaw =
      payload.ToFull?.[0]?.Email ||
      payload.To ||
      payload.to ||
      ''
    const subject = payload.Subject || payload.subject || ''
    const textBody =
      payload.TextBody ||
      payload.text ||
      payload.stripped_text ||
      ''
    const htmlBody = payload.HtmlBody || payload.html || ''

    const token = tokenFromInboxAddress(String(toRaw))
    if (!token) {
      return NextResponse.json({ error: 'Unknown inbox address' }, { status: 400 })
    }

    const tripId = await resolveTripFromInboxToken(admin, token)
    if (!tripId) {
      return NextResponse.json({ error: 'Trip not found for token' }, { status: 404 })
    }

    const { data: trip } = await admin.from('trips').select('name, destination, options').eq('id', tripId).single()

    const bodyForParse = textBody || htmlBody.replace(/<[^>]+>/g, ' ').slice(0, 15000)
    const parsed = await parseBookingFromText({
      subject,
      body: bodyForParse,
      tripName: trip?.name,
      tripDestination: trip?.destination,
    })

    const userId = fromEmail ? await resolveUserFromEmail(admin, fromEmail) : null
    const travelerId = userId ? await resolveTravelerForUser(admin, tripId, userId) : null

    let fileBuffer: Buffer | undefined
    let fileName = 'email.txt'
    let fileMime = 'text/plain'

    const attachments = payload.Attachments || payload.attachments || []
    for (const att of attachments) {
      const content = att.Content || att.content
      const name = att.Name || att.name || 'attachment'
      const type = att.ContentType || att.content_type || 'application/octet-stream'
      if (content && (type.includes('pdf') || type.startsWith('image/'))) {
        fileBuffer = Buffer.from(content, 'base64')
        fileName = name
        fileMime = type
        break
      }
    }

    if (!fileBuffer && bodyForParse) {
      fileBuffer = Buffer.from(bodyForParse.slice(0, 50000), 'utf-8')
      fileName = 'email-body.txt'
    }

    const { bookingId, created } = await createTripBooking(admin, {
      tripId,
      userId,
      travelerId,
      parsed,
      source: 'email_forward',
      file: fileBuffer
        ? { buffer: fileBuffer, fileName, mimeType: fileMime }
        : undefined,
      rawParsed: { subject, from: fromEmail, parsed },
    })

    if (created) {
      notifyNewBookingAsync({
        tripId,
        tripName: trip?.name || 'Your trip',
        title: parsed.display_title,
        bookerName: fromEmail.split('@')[0] || 'Someone',
      })
    }

    return NextResponse.json({ ok: true, bookingId, created })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('inbound booking email:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
