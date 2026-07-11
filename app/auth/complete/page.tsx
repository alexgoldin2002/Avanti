'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolvePostAuthPath } from '@/lib/preview-trip-storage'
import { syncUserPhoneToProfile } from '@/lib/auth/sync-user-phone'
import SuitcaseLoader from '../../components/SuitcaseLoader'

async function resolveSessionFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    window.history.replaceState(null, '', '/auth/complete')
    if (error) {
      throw new Error(error.message)
    }
    return true
  }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  if (hash.includes('access_token=')) {
    const { error } = await supabase.auth.getSession()
    window.history.replaceState(null, '', '/auth/complete')
    if (error) {
      throw new Error(error.message)
    }
    return true
  }

  return false
}

export default function AuthCompletePage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const finish = async () => {
      // Capture the deep-link destination before the URL is cleaned up below.
      const nextParam = new URLSearchParams(window.location.search).get('next')
      try {
        await resolveSessionFromUrl()

        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.replace('/auth?mode=signin&error=Could%20not%20complete%20sign-in.%20Please%20try%20again.')
          return
        }

        const user = session.user
        if (user.phone) {
          await syncUserPhoneToProfile(user.id, user.phone)
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('profile_complete')
          .eq('user_id', user.id)
          .maybeSingle()

        router.replace(resolvePostAuthPath(Boolean(profile?.profile_complete), nextParam))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sign-in failed. Please try again.'
        setErrorMessage(message)
        setTimeout(() => {
          router.replace(`/auth?mode=signin&error=${encodeURIComponent(message)}`)
        }, 2500)
      }
    }

    void finish()
  }, [router])

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-6">
        <p className="text-sm text-forest-deep text-center max-w-md">{errorMessage}</p>
      </div>
    )
  }

  return <SuitcaseLoader message="Signing you in" />
}
