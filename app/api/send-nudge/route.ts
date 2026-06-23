import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { phoneToE164 } from '@/lib/phone'
import { sendSms } from '@/lib/sms/send-sms'

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://avanti.app'
}

async function resolveRecipientPhone(
  travelerId: string,
  travelerPhone?: string | null,
): Promise<{ phone: string | null; userId: string | null; smsEnabled: boolean }> {
  const admin = tryCreateAdminClient()
  let phone = travelerPhone || null
  let userId: string | null = null
  let smsEnabled = true

  if (admin) {
    const { data: traveler } = await admin
      .from('travelers')
      .select('phone, user_id')
      .eq('id', travelerId)
      .maybeSingle()

    phone = travelerPhone || traveler?.phone || null
    userId = traveler?.user_id || null

    if (traveler?.user_id) {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('phone, sms_notifications_enabled')
        .eq('user_id', traveler.user_id)
        .maybeSingle()

      if (profile?.sms_notifications_enabled === false) {
        smsEnabled = false
      }
      phone = profile?.phone || phone
    }
  }

  return { phone, userId, smsEnabled }
}

export async function POST(request: NextRequest) {
  try {
    const {
      tripId,
      travelerId,
      travelerEmail,
      travelerPhone,
      travelerName,
      tripName,
      senderName,
    } = await request.json()

    const supabase = tryCreateAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentNudge } = await supabase
      .from('nudges')
      .select('id')
      .eq('trip_id', tripId)
      .eq('recipient_traveler_id', travelerId)
      .gte('sent_at', oneDayAgo)
      .maybeSingle()

    if (recentNudge) {
      return NextResponse.json({ error: 'Already nudged in the last 24 hours', rateLimited: true })
    }

    await supabase.from('nudges').insert({
      trip_id: tripId,
      recipient_traveler_id: travelerId,
    })

    const { phone, userId, smsEnabled } = await resolveRecipientPhone(travelerId, travelerPhone)
    const e164 = phoneToE164(phone)

    if (e164 && smsEnabled) {
      const body = `Hey ${travelerName}! ${senderName} is waiting for you to join ${tripName} on Avanti. Join here: ${siteUrl()}`
      const smsResult = await sendSms({
        to: e164,
        body,
        messageType: 'nudge',
        userId,
        tripId,
      })

      if (smsResult.ok) {
        return NextResponse.json({ success: true, smsSent: true })
      }
    }

    if (travelerEmail) {
      const mailtoLink = `mailto:${travelerEmail}?subject=${encodeURIComponent(`Reminder: Join ${tripName} on Avanti`)}&body=${encodeURIComponent(`Hey ${travelerName}! ${senderName} is waiting for you to join ${tripName} on Avanti. Click here to join: ${siteUrl()}`)}`
      return NextResponse.json({ success: true, mailtoLink })
    }

    return NextResponse.json({
      success: false,
      error: 'No email or SMS-capable phone number on file',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
