import { phoneToE164 } from '@/lib/phone'
import { tryCreateAdminClient } from '@/lib/supabase-admin'

type SendSmsOptions = {
  to: string
  body: string
  messageType?: string
  userId?: string | null
  tripId?: string | null
}

type SendSmsResult = {
  ok: boolean
  sid?: string
  error?: string
  skipped?: boolean
}

export async function sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
  const to = phoneToE164(options.to)
  if (!to) {
    return { ok: false, error: 'Invalid phone number' }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: 'SMS not configured', skipped: true }
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: from,
      Body: options.body,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  const status = response.ok ? 'sent' : 'failed'
  const errorMessage = response.ok ? null : payload?.message || 'Failed to send SMS'

  try {
    const admin = tryCreateAdminClient()
    if (admin) {
      await admin.from('sms_messages').insert({
        user_id: options.userId || null,
        phone: to,
        body: options.body,
        message_type: options.messageType || null,
        trip_id: options.tripId || null,
        status,
        provider_message_id: payload?.sid || null,
        error_message: errorMessage,
      })
    }
  } catch {
    // Logging should not block delivery.
  }

  if (!response.ok) {
    return { ok: false, error: errorMessage }
  }

  return { ok: true, sid: payload?.sid }
}
