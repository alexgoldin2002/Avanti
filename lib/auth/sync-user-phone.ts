import { supabase } from '@/lib/supabase'
import { e164ToDisplay, phoneToE164 } from '@/lib/phone'

export async function syncUserPhoneToProfile(userId: string, phone: string | null | undefined) {
  const e164 = phoneToE164(phone)
  if (!e164) return

  const displayPhone = e164ToDisplay(e164)
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('user_profiles')
      .update({ phone: displayPhone })
      .eq('user_id', userId)
    return
  }

  await supabase.from('user_profiles').insert({
    user_id: userId,
    phone: displayPhone,
    sms_notifications_enabled: true,
    profile_complete: false,
  })
}
