import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { phoneToE164 } from '@/lib/phone'
import { sendSms } from '@/lib/sms/send-sms'

export function notifyNewBookingAsync(input: {
  tripId: string
  tripName: string
  title: string
  bookerName: string
}) {
  const admin = tryCreateAdminClient()
  if (!admin) return

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://avanti-kappa.vercel.app'
  const body = `Avanti: New booking on ${input.tripName} — ${input.title} (added by ${input.bookerName}). ${siteUrl}/trips/${input.tripId}/bookings`

  admin
    .from('travelers')
    .select('user_id, phone, name')
    .eq('trip_id', input.tripId)
    .then(async ({ data: travelers }) => {
      for (const t of travelers || []) {
        if (!t.user_id) continue
        const { data: profile } = await admin
          .from('user_profiles')
          .select('phone, sms_notifications_enabled')
          .eq('user_id', t.user_id)
          .maybeSingle()
        if (profile?.sms_notifications_enabled === false) continue
        const e164 = phoneToE164(profile?.phone || t.phone)
        if (!e164) continue
        await sendSms({
          to: e164,
          body,
          messageType: 'booking_added',
          userId: t.user_id,
          tripId: input.tripId,
        })
      }
    })
    .catch(err => console.error('notifyNewBooking:', err))
}
