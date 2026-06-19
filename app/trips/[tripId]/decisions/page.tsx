'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import SubpageShell from '../../../components/SubpageShell'

export default function DecisionsPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [decision, setDecision] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) setTrip(tripData)
      const { data: decisionData } = await supabase
        .from('destination_decisions')
        .select('*')
        .eq('trip_id', tripId)
        .maybeSingle()
      if (decisionData) setDecision(decisionData)
      setLoading(false)
    }
    load()
  }, [tripId])

  const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
    draft: { label: 'Not started', bg: 'var(--forest-mist)', color: 'var(--muted-foreground)' },
    suggestions_open: { label: 'Add suggestions', bg: 'oklch(0.94 0.04 85)', color: 'oklch(0.45 0.08 85)' },
    analyzing: { label: 'Analyzing', bg: 'var(--forest-pale)', color: 'var(--forest)' },
    meta_vote: { label: 'Set priority', bg: 'var(--forest-pale)', color: 'var(--forest-deep)' },
    voting: { label: 'Vote open', bg: 'var(--forest-pale)', color: 'var(--forest-deep)' },
    results: { label: 'Results', bg: 'var(--forest-mist)', color: 'var(--muted-foreground)' },
    confirming: { label: 'Confirm', bg: 'var(--forest-pale)', color: 'var(--forest)' },
    locked: { label: 'Locked', bg: 'var(--forest-mist)', color: 'var(--muted-foreground)' },
  }

  if (loading) return <SuitcaseLoader message="Loading decisions" />
  if (!trip) return null

  const config = decision ? statusConfig[decision.status] || statusConfig.draft : statusConfig.draft

  return (
    <SubpageShell backHref={`/trips/${tripId}`} title="Decisions" subtitle={trip.name}>
      {!decision || decision.status === 'draft' ? (
        <div className="avanti-box rounded-none border border-border bg-forest-mist px-6 py-12 text-center">
          <p className="font-serif text-lg text-foreground mb-2">No destination decision yet</p>
          <p className="text-sm text-muted-foreground m-0 mb-6">
            Complete Brainstorm, then start the group decision from Step 2.
          </p>
          <button type="button" onClick={() => router.push(`/trips/${tripId}/step2`)} className="avanti-btn avanti-btn-primary">
            Go to Brainstorm →
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}/choose`)}
          className="avanti-box group flex w-full items-center justify-between rounded-none border border-border bg-card px-5 py-4 text-left transition-all duration-200 hover:-translate-y-px hover:border-forest-deep/30 hover:[box-shadow:var(--shadow-box-hover)]"
        >
          <div>
            <p className="font-serif text-base m-0 mb-0.5 group-hover:text-forest-deep">Choose destination</p>
            <p className="text-[11px] text-muted-foreground m-0">{config.label}</p>
          </div>
          <span className="text-[11px] tracking-wide shrink-0 ml-3 px-2.5 py-1 rounded-none" style={{ color: config.color, background: config.bg }}>
            {config.label}
          </span>
        </button>
      )}
    </SubpageShell>
  )
}
