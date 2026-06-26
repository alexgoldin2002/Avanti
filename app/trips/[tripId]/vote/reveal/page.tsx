'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SubpageShell from '../../../../components/SubpageShell'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import DestinationReveal from '@/components/voting/DestinationReveal'
import PhaseBanner from '@/components/trip-phases/PhaseBanner'
import PhaseLockedScreen from '@/components/trip-phases/PhaseLockedScreen'
import { useTripPhase } from '@/lib/trip-phases/useTripPhase'
import { fetchVotingResults } from '@/lib/voting/client-api'
import type { VotingResultsPayload } from '@/lib/voting/types'
import { tripHasKnownDestination } from '@/lib/step2/planning-path'

export default function VoteRevealPage() {
  const { tripId } = useParams() as { tripId: string }
  const { phase, isOrganizer, reload: reloadPhase } = useTripPhase(tripId, 'reveal')
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<VotingResultsPayload | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const json = await fetchVotingResults(tripId)
        setResults(json)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [tripId])

  if (loading) return <SuitcaseLoader message="Preparing reveal" />

  const knownDestination = results?.trip && tripHasKnownDestination(results.trip)
  const votingComplete =
    knownDestination ||
    !!results?.trip.winning_destination_id ||
    (!!results?.trip.destination && results.trip.destination !== 'TBD' && results.trip.voting_round != null)

  const revealReady = results?.ready || votingComplete

  if (knownDestination && results?.trip.destination) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} backLabel="Trip" eyebrow={results.trip.name} title="Your destination">
        <div className="avanti-box border border-forest-deep/25 bg-forest-pale px-8 py-12 text-center max-w-lg mx-auto">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">Step 2A · Locked in</p>
          <p className="font-serif text-3xl text-forest-deep m-0">{results.trip.destination}</p>
          <a href={`/trips/${tripId}`} className="avanti-btn inline-block mt-8">Go to trip dashboard →</a>
        </div>
      </SubpageShell>
    )
  }

  if (phase && !revealReady) {
    return (
      <SubpageShell
        backHref={`/trips/${tripId}`}
        backLabel="Trip"
        eyebrow={results?.trip.name}
        title="Destination decision"
      >
        <PhaseBanner tripId={tripId} phase={phase} isOrganizer={isOrganizer} onUpdated={() => void reloadPhase()} />
        <PhaseLockedScreen phase={phase} backHref={`/trips/${tripId}`} />
      </SubpageShell>
    )
  }

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={results?.trip.name}
      title="The reveal"
      maxWidth="max-w-3xl"
    >
      {phase && (
        <PhaseBanner tripId={tripId} phase={phase} isOrganizer={isOrganizer} onUpdated={() => void reloadPhase()} />
      )}
      <DestinationReveal tripId={tripId} initialResults={results} />
    </SubpageShell>
  )
}
