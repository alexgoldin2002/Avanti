'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BackLink } from '../../components/SubpageShell'

function PendingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tripName = searchParams.get('trip') || 'the trip'
  const tripId = searchParams.get('tripId')

  useEffect(() => {
    const checkApproval = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('travelers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'approved')

      if (tripId) query = query.eq('trip_id', tripId)

      const { data: traveler } = await query.maybeSingle()
      if (traveler) router.push(`/trips/${traveler.trip_id}`)
    }

    checkApproval()
    const interval = setInterval(checkApproval, 3000)
    return () => clearInterval(interval)
  }, [router, tripId])

  return (
    <main className="mx-auto w-full max-w-md px-6 pt-10 pb-16 flex-1">
      <BackLink href="/dashboard" />
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="avanti-box mb-6 grid h-14 w-14 place-items-center rounded-none border border-border bg-forest-pale text-2xl">
        ⏳
      </div>
      <h1 className="font-serif text-3xl font-light text-foreground mb-3">Waiting for approval</h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
        You&apos;ve requested to join <strong className="font-normal text-foreground">{tripName}</strong>.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The trip organizer will approve your request shortly.
      </p>
      <div className="avanti-box mt-8 w-full rounded-none border border-border bg-forest-mist px-5 py-4">
        <p className="text-xs text-muted-foreground m-0 leading-relaxed">
          Checking for approval automatically — this page will update the moment you&apos;re approved.
        </p>
      </div>
      <div className="mt-6 flex items-center justify-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-forest animate-pulse" />
        <p className="eyebrow text-muted-foreground m-0">Waiting...</p>
      </div>
      </div>
    </main>
  )
}

export default function PendingPage() {
  return (
    <Suspense fallback={null}>
      <PendingContent />
    </Suspense>
  )
}
