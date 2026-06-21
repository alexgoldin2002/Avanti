'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SubpageShell from '../../components/SubpageShell'
import type { PlanningCategory } from '@/app/api/planning/suggest/route'

type SuggestResponse = {
  intro?: string
  options?: Array<Record<string, unknown>>
}

export function usePlanningPage(category: PlanningCategory) {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [data, setData] = useState<SuggestResponse | null>(null)

  const storageKey = `avanti-${category}-${tripId}`

  const load = useCallback(async () => {
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    setTrip(tripData)
    try {
      const cached = sessionStorage.getItem(storageKey)
      if (cached) setData(JSON.parse(cached))
    } catch { /* ignore */ }
    setLoading(false)
  }, [tripId, storageKey])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    if (!trip?.destination || trip.destination === 'TBD') return
    setGenerating(true)
    try {
      const res = await fetch('/api/planning/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          tier: trip.locked_tier,
          trip: {
            name: trip.name,
            destination: trip.destination,
            start_date: trip.locked_date_start || trip.start_date,
            end_date: trip.locked_date_end || trip.end_date,
            locked_tier: trip.locked_tier,
          },
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.suggestions)
      sessionStorage.setItem(storageKey, JSON.stringify(json.suggestions))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  const locked = trip?.destination && trip.destination !== 'TBD'
  const flightsLocked = !!trip?.flights_locked

  return { tripId, router, loading, trip, generating, data, generate, locked, flightsLocked }
}

export function LockedGate({
  tripId,
  router,
  requireFlights = false,
  flightsLocked = false,
}: {
  tripId: string
  router: ReturnType<typeof useRouter>
  requireFlights?: boolean
  flightsLocked?: boolean
}) {
  if (requireFlights && !flightsLocked) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Not ready yet">
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">Lock flights first</p>
          <p className="text-sm text-muted-foreground mb-6">Hotel search needs confirmed travel dates from Step 4.</p>
          <button type="button" onClick={() => router.push(`/trips/${tripId}/flights`)} className="avanti-btn avanti-btn-primary">
            Go to Flights →
          </button>
        </div>
      </SubpageShell>
    )
  }

  return (
    <SubpageShell backHref={`/trips/${tripId}`} title="Not ready yet">
      <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
        <p className="font-serif text-xl mb-2">Lock your destination first</p>
        <button type="button" onClick={() => router.push(`/trips/${tripId}/choose`)} className="avanti-btn avanti-btn-primary">
          Choose destination →
        </button>
      </div>
    </SubpageShell>
  )
}
