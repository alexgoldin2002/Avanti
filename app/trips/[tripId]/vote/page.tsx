'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import PhaseBanner from '@/components/trip-phases/PhaseBanner'
import { useTripPhase } from '@/lib/trip-phases/useTripPhase'
import { fetchVotingState, forceVotingKickoff } from '@/lib/voting/client-api'
import GroupDateOverlapBanner from '@/components/trip/GroupDateOverlapBanner'
import type { GroupDateOverlapResult } from '@/lib/group-date-overlap'

/** Voting lobby — opens Round 1 or Round 2 when voting has started. */
export default function VoteLobbyPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const { phase, loading: phaseLoading, isOrganizer, reload: reloadPhase } = useTripPhase(tripId, 'round_one')
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
    try {
      await forceVotingKickoff(tripId)
      await reloadPhase()
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start voting')
    } finally {
      setKickoffBusy(false)
    }
  }

  if (loading || phaseLoading) return <SuitcaseLoader message="Loading voting" />

  if (error && !data) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Group vote">
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
  let waitingOn = 'Everyone needs to submit their trip card choices from Brainstorm first.'
  if (status) {
    if (allIn) {
      waitingOn = data?.kickoffError
        ? `All ${status.eligible} travelers have submitted, but voting could not start: ${data.kickoffError}`
        : `All ${status.eligible} travelers have submitted — the host can open group voting (24-hour window).`
    } else if (status.pendingNicknames?.length) {
      waitingOn = `${status.submitted} of ${status.eligible} submitted. Still waiting on: ${status.pendingNicknames.join(', ')}.`
    } else {
      waitingOn = `${status.submitted} of ${status.eligible} travelers have submitted their card choices.`
    }
  }

  return (
    <SubpageShell backHref={`/trips/${tripId}`} title="Group vote">
      {phase && (
        <PhaseBanner tripId={tripId} phase={phase} isOrganizer={isOrganizer} onUpdated={() => void reloadPhase()} />
      )}
      {dateOverlap && dateOverlap.status !== 'ok' && (
        <GroupDateOverlapBanner result={dateOverlap} />
      )}
      <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
        <p className="font-serif text-xl mb-2">Voting hasn&apos;t started yet</p>
        <p className="text-sm text-muted-foreground mb-6">{waitingOn}</p>
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
          <button type="button" onClick={() => router.push(`/trips/${tripId}/step2`)} className="avanti-btn">
            Go to Brainstorm →
          </button>
        </div>
      </div>
    </SubpageShell>
  )
}
