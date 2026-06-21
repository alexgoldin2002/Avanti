import type { SupabaseClient } from '@supabase/supabase-js'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { phoneToE164 } from '@/lib/phone'
import { sendSms } from '@/lib/sms/send-sms'

export type DecisionNotifyEvent =
  | 'decision_started'
  | 'voting_open'
  | 'confirm_open'
  | 'destination_locked'

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://avanti-kappa.vercel.app'
}

function messageForEvent(
  event: DecisionNotifyEvent,
  tripName: string,
  chooseUrl: string,
  detail?: string
): string {
  switch (event) {
    case 'decision_started':
      return `Avanti: ${tripName} — add your destination idea or get ready to vote. ${chooseUrl}`
    case 'voting_open':
      return `Avanti: Voting is open for ${tripName}. Pick your destination: ${chooseUrl}`
    case 'confirm_open':
      return `Avanti: Results are in for ${tripName}. Confirm your spot: ${chooseUrl}`
    case 'destination_locked':
      return `Avanti: Destination locked for ${tripName}${detail ? ` — ${detail}` : ''}. Plan flights: ${chooseUrl.replace('/choose', '/flights')}`
    default:
      return `Avanti update for ${tripName}: ${chooseUrl}`
  }
}

/** Notify trip members via SMS (when configured). Dedupes per event in decision.settings. */
export async function notifyDecisionEvent(
  supabase: SupabaseClient,
  input: {
    tripId: string
    decisionId: string
    event: DecisionNotifyEvent
    tripName: string
    detail?: string
  }
): Promise<{ sent: number; skipped: number }> {
  const admin = tryCreateAdminClient()
  if (!admin) return { sent: 0, skipped: 0 }

  const { data: decision } = await admin
    .from('destination_decisions')
    .select('settings')
    .eq('id', input.decisionId)
    .single()

  const settings = (decision?.settings as Record<string, unknown>) || {}
  const sentEvents = (settings.notifications_sent as string[]) || []
  if (sentEvents.includes(input.event)) {
    return { sent: 0, skipped: 1 }
  }

  const { data: travelers } = await admin
    .from('travelers')
    .select('id, name, email, phone, user_id')
    .eq('trip_id', input.tripId)

  const chooseUrl = `${siteUrl()}/trips/${input.tripId}/choose`
  const body = messageForEvent(input.event, input.tripName, chooseUrl, input.detail)

  let sent = 0
  for (const t of travelers || []) {
    let phone = t.phone as string | null
    let userId = t.user_id as string | null
    let smsEnabled = true

    if (t.user_id) {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('phone, sms_notifications_enabled')
        .eq('user_id', t.user_id)
        .maybeSingle()
      if (profile?.sms_notifications_enabled === false) smsEnabled = false
      phone = profile?.phone || phone
      userId = t.user_id
    }

    const e164 = phoneToE164(phone)
    if (!e164 || !smsEnabled) continue

    const result = await sendSms({
      to: e164,
      body,
      messageType: `decision_${input.event}`,
      userId,
      tripId: input.tripId,
    })
    if (result.ok) sent++
  }

  await admin
    .from('destination_decisions')
    .update({
      settings: {
        ...settings,
        notifications_sent: [...sentEvents, input.event],
      },
    })
    .eq('id', input.decisionId)

  return { sent, skipped: sentEvents.includes(input.event) ? 1 : 0 }
}

/** Fire-and-forget wrapper for API routes. */
export function notifyDecisionEventAsync(
  supabase: SupabaseClient,
  input: Parameters<typeof notifyDecisionEvent>[1]
) {
  notifyDecisionEvent(supabase, input).catch(err => {
    console.error('notifyDecisionEvent failed:', err)
  })
}
