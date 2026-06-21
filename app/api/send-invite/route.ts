import { NextRequest, NextResponse } from 'next/server'
import { sendSms } from '@/lib/sms/send-sms'

export async function POST(request: NextRequest) {
  try {
    const { phone, tripName, inviteUrl } = await request.json()

    if (!phone || !tripName || !inviteUrl) {
      return NextResponse.json({ error: 'Missing phone, trip name, or invite link' }, { status: 400 })
    }

    const body = `You've been invited to join ${tripName} on Avanti. Join here: ${inviteUrl}`
    const result = await sendSms({
      to: phone,
      body,
      messageType: 'invite',
    })

    if (result.skipped) {
      return NextResponse.json({
        success: false,
        skipped: true,
        error: 'SMS is not configured yet',
      })
    }

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, smsSent: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
