'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../../components/SubpageShell'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import RoundTwoVoting from '@/components/voting/RoundTwoVoting'
import PhaseBanner from '@/components/trip-phases/PhaseBanner'
import PhaseLockedScreen from '@/components/trip-phases/PhaseLockedScreen'
import { useTripPhase } from '@/lib/trip-phases/useTripPhase'
import { fetchVotingState, submitRoundTwoVotes } from '@/lib/voting/client-api'

export default function RoundTwoVotePage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const { phase, loading: phaseLoading, isOrganizer, canEdit, canView, isViewOnly, reload: reloadPhase } =
    useTripPhase(tripId, 'round_two')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchVotingState>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const json = await fetchVotingState(tripId)
      setData(json)
      setError(null)
      const t = json.trip
      if (t.winning_destination_id || (t.destination && t.destination !== 'TBD' && json.traveler?.round_two_submitted)) {
        router.replace(`/trips/${tripId}/vote/reveal`)
        return
      }
      if (t.voting_round === 1) {
        router.replace(`/trips/${tripId}/vote/round-one`)
        return
      }
      if (t.voting_round == null) {
        router.replace(`/trips/${tripId}/vote`)
        return
      }
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : 'Failed to load voting')
    } finally {
      setLoading(false)
    }
  }, [tripId, router])

  useEffect(() => {
    void load()
  }, [load])

  const handleSubmit = async (
    allocations: Array<{ destinationAnalysisId: string; percentage: number }>
  ) => {
    if (!canEdit) return
    setSubmitting(true)
    try {
      await submitRoundTwoVotes(tripId, allocations)
      router.push(`/trips/${tripId}/vote/reveal`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || phaseLoading) return <SuitcaseLoader message="Loading Round 2" />

  if (error && !data) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Round 2">
        <div className="avanti-box border border-red-200 bg-red-50 px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">Could not load voting</p>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button type="button" onClick={() => void load()} className="avanti-btn">Try again →</button>
        </div>
      </SubpageShell>
    )
  }

  if (phase && !canView) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Round 2 — Split vote">
        {phase && <PhaseBanner tripId={tripId} phase={phase} isOrganizer={isOrganizer} onUpdated={() => void reloadPhase()} />}
        <PhaseLockedScreen phase={phase} backHref={`/trips/${tripId}`} />
      </SubpageShell>
    )
  }

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={data?.trip.name}
      title="Round 2 — Split your vote"
      maxWidth="max-w-6xl"
    >
      {phase && (
        <PhaseBanner tripId={tripId} phase={phase} isOrganizer={isOrganizer} onUpdated={() => void reloadPhase()} />
      )}
      {isViewOnly && (
        <div className="avanti-box border border-border bg-secondary/30 px-4 py-3 mb-6 text-sm text-muted-foreground">
          View only — your vote split is submitted. You can review but not change it.
        </div>
      )}
      {data && (
        <>
          {data.traveler?.round_two_submitted && !canEdit ? (
            <div className="avanti-box border border-forest-deep/25 bg-forest-pale px-6 py-10 text-center max-w-xl mx-auto">
              <p className="font-serif text-2xl text-forest-deep mb-3">Your votes are in ✓</p>
              <button
                type="button"
                onClick={() => router.push(`/trips/${tripId}/vote/reveal`)}
                className="avanti-btn avanti-btn-primary"
              >
                Go to reveal →
              </button>
            </div>
          ) : (
            <RoundTwoVoting
              tripId={tripId}
              destinations={data.roundTwoDestinations}
              personalizedByDest={data.personalized}
              initialAllocations={data.roundTwoAllocations}
              submitting={submitting}
              readOnly={!canEdit}
              onSubmit={handleSubmit}
            />
          )}
        </>
      )}
    </SubpageShell>
  )
}
