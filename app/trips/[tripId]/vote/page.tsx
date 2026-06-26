'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import PhaseBanner from '@/components/trip-phases/PhaseBanner'
import PhaseLockedScreen from '@/components/trip-phases/PhaseLockedScreen'
import { useTripPhase } from '@/lib/trip-phases/useTripPhase'
import { getPhaseSnapshot } from '@/lib/trip-phases/state'
import { fetchVotingState, forceVotingKickoff } from '@/lib/voting/client-api'
import GroupDateOverlapBanner from '@/components/trip/GroupDateOverlapBanner'
import type { GroupDateOverlapResult } from '@/lib/group-date-overlap'

/** Voting lobby — opens Round 1 or Round 2 when voting has started. */
export default function VoteLobbyPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const { phase, payload, loading: phaseLoading, isOrganizer, reload: reloadPhase } = useTripPhase(tripId, 'round_one')
  const brainstormPhase = payload ? getPhaseSnapshot(payload, 'brainstorm') : undefined
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchVotingState>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kickoffBusy, setKickoffBusy] = useState(false)
  const [dateOverlap, setDateOverlap] = useState<GroupDateOverlapResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const json = await fetchVotingState(tripId)
      setData(json)
      setError(null)
      try {
        const overlapRes = await fetch(`/api/trips/${tripId}/date-overlap`)
        if (overlapRes.ok) setDateOverlap(await overlapRes.json())
      } catch { /* optional */ }
      const round = json.trip.voting_round
      if (round === 1) {
        router.replace(`/trips/${tripId}/vote/round-one`)
        return
      }
      if (round === 2) {
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

  const handleKickoff = async () => {
    setKickoffBusy(true)
    setError(null)
    try {
      const result = await forceVotingKickoff(tripId)
      await reloadPhase()
      if (result.votingRound === 1) {
        router.replace(`/trips/${tripId}/vote/round-one`)
        return
      }
      if (result.votingRound === 2) {
        router.replace(`/trips/${tripId}/vote/round-two`)
        return
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start voting')
    } finally {
      setKickoffBusy(false)
    }
  }

  if (loading || phaseLoading) return <SuitcaseLoader message="Loading voting" />

  if (error && !data) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="1st round voting">
        <div className="avanti-box border border-red-200 bg-red-50 px-6 py-10 text-center max-w-xl mx-auto">
          <p className="font-serif text-xl mb-2">Could not load voting</p>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button type="button" onClick={() => void load()} className="avanti-btn avanti-btn-primary">Try again →</button>
        </div>
      </SubpageShell>
    )
  }

  const status = data?.submissionStatus
  const allIn = status ? status.submitted >= status.eligible && status.eligible > 0 : false
  let waitingDetail = 'Everyone needs to submit their trip card choices from Brainstorm first.'
  if (status) {
    if (allIn) {
      waitingDetail = data?.kickoffError
        ? `All ${status.eligible} travelers have submitted, but voting could not start: ${data.kickoffError}`
        : `All ${status.eligible} travelers have submitted — the host can open group voting when ready.`
    } else if (status.pendingNicknames?.length) {
      waitingDetail = `${status.submitted} of ${status.eligible} submitted. Still waiting on: ${status.pendingNicknames.join(', ')}.`
    } else {
      waitingDetail = `${status.submitted} of ${status.eligible} travelers have submitted their card choices.`
    }
  }

  return (
    <SubpageShell backHref={`/trips/${tripId}`} backLabel="Trip" title="1st round voting">
      {phase && (
        <PhaseBanner tripId={tripId} phase={phase} isOrganizer={isOrganizer} onUpdated={() => void reloadPhase()} />
      )}
      {dateOverlap && dateOverlap.status !== 'ok' && (
        <GroupDateOverlapBanner result={dateOverlap} />
      )}

      {error && (
        <p className="text-sm text-destructive text-center max-w-lg mx-auto mb-4">{error}</p>
      )}

      {phase && phase.access === 'not_opened' ? (
        <>
          <PhaseLockedScreen
            phase={phase}
            backHref={`/trips/${tripId}`}
            secondaryPhase={brainstormPhase?.access === 'active' ? brainstormPhase : null}
          />
          <p className="text-sm text-muted-foreground text-center max-w-lg mx-auto mt-4">{waitingDetail}</p>
          {isOrganizer && allIn && dateOverlap?.status !== 'no_overlap' && dateOverlap?.status !== 'too_short' && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                disabled={kickoffBusy}
                onClick={() => void handleKickoff()}
                className="avanti-btn avanti-btn-primary"
              >
                {kickoffBusy ? 'Opening…' : 'Open group voting →'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center max-w-lg mx-auto">
          <p className="font-serif text-xl mb-2">Voting hasn&apos;t started yet</p>
          <p className="text-sm text-muted-foreground mb-6">{waitingDetail}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isOrganizer && allIn && dateOverlap?.status !== 'no_overlap' && dateOverlap?.status !== 'too_short' && (
              <button
                type="button"
                disabled={kickoffBusy}
                onClick={() => void handleKickoff()}
                className="avanti-btn avanti-btn-primary"
              >
                {kickoffBusy ? 'Opening…' : 'Open group voting →'}
              </button>
            )}
            <button type="button" onClick={() => router.push(`/trips/${tripId}`)} className="avanti-btn">
              Go back to trip dashboard →
            </button>
          </div>
        </div>
      )}
    </SubpageShell>
  )
}
