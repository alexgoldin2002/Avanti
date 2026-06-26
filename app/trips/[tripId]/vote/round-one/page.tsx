'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../../components/SubpageShell'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import RoundOneVoting from '@/components/voting/RoundOneVoting'
import PhaseBanner from '@/components/trip-phases/PhaseBanner'
import PhaseLockedScreen from '@/components/trip-phases/PhaseLockedScreen'
import { useTripPhase } from '@/lib/trip-phases/useTripPhase'
import { fetchVotingState, submitRoundOneVotes } from '@/lib/voting/client-api'

export default function RoundOneVotePage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const { phase, loading: phaseLoading, isOrganizer, canEdit, canView, isViewOnly, reload: reloadPhase } =
    useTripPhase(tripId, 'round_one')
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
      if (json.trip.voting_round === 2) {
        router.replace(`/trips/${tripId}/vote/round-two`)
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

  const handleSubmit = async (votes: Array<{ destinationAnalysisId: string; rank: number }>) => {
    if (!canEdit) return
    setSubmitting(true)
    try {
      const result = await submitRoundOneVotes(tripId, votes)
      await Promise.all([load(), reloadPhase()])
      if (result.advanced) router.push(`/trips/${tripId}/vote/round-two`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || phaseLoading) return <SuitcaseLoader message="Loading Round 1" />

  if (error && !data) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Round 1">
        <div className="avanti-box border border-red-200 bg-red-50 px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">Could not load voting</p>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button type="button" onClick={() => void load()} className="avanti-btn">Try again →</button>
        </div>
      </SubpageShell>
    )
  }

  if (phase && data?.trip.voting_round == null) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} backLabel="Trip" title="Round 1 — Rank">
        <PhaseBanner tripId={tripId} phase={phase} isOrganizer={isOrganizer} onUpdated={() => void reloadPhase()} />
        <PhaseLockedScreen phase={phase} backHref={`/trips/${tripId}`} />
      </SubpageShell>
    )
  }

  if (phase && !canView) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Round 1 — Rank">
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
      title="Round 1 — Rank choices"
      maxWidth="max-w-6xl"
    >
      {phase && (
        <PhaseBanner
          tripId={tripId}
          phase={phase}
          isOrganizer={isOrganizer}
          onUpdated={() => void reloadPhase()}
          hideTitle
        />
      )}
      {isViewOnly && (
        <div className="avanti-box border border-border bg-secondary/30 px-4 py-3 mb-6 text-sm text-muted-foreground">
          View only — your rankings are submitted. You can review but not change them.
        </div>
      )}
      {data && (
        <>
          {data.traveler?.round_one_submitted && !isViewOnly ? (
            <div className="avanti-box border border-forest-deep/25 bg-forest-pale px-6 py-10 text-center max-w-xl mx-auto">
              <p className="font-serif text-2xl text-forest-deep mb-3">Your rankings are in ✓</p>
              {data.roundOneStatus && data.roundOneStatus.submitted < data.roundOneStatus.eligible ? (
                <p className="text-sm text-muted-foreground mb-6">
                  {data.roundOneStatus.submitted} of {data.roundOneStatus.eligible} travelers have submitted.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mb-6">Opening Round 2…</p>
              )}
              <button type="button" onClick={() => router.push(`/trips/${tripId}/vote/round-two`)} className="avanti-btn avanti-btn-primary">
                Go to Round 2 →
              </button>
            </div>
          ) : (
            <RoundOneVoting
              tripId={tripId}
              destinations={data.roundOneDestinations}
              initialRanks={data.roundOneRanks}
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
