'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPostAuthPath } from '@/lib/preview-trip-storage'
import { syncUserPhoneToProfile } from '@/lib/auth/sync-user-phone'
import SuitcaseLoader from '../../components/SuitcaseLoader'

export default function AuthCompletePage() {
  const router = useRouter()

  useEffect(() => {
    const finish = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/')
        return
      }
      if (user.phone) {
        await syncUserPhoneToProfile(user.id, user.phone)
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('profile_complete')
        .eq('user_id', user.id)
        .maybeSingle()
      router.replace(getPostAuthPath(Boolean(profile?.profile_complete)))
    }
    finish()
  }, [router])

  return <SuitcaseLoader message="Signing you in" />
}
