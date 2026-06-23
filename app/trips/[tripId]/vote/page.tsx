'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import RoundOneVoting from '@/components/voting/RoundOneVoting'
import RoundTwoVoting from '@/components/voting/RoundTwoVoting'
import type { DestinationAnalysisRow, RoundTwoPersonalContent } from '@/lib/voting/types'
import {
  fetchVotingState,
  forceVotingKickoff,
  submitRoundOneVotes,
  submitRoundTwoVotes,
  type VotingPayload,
} from '@/lib/voting/client-api'
import {
  PLACEHOLDER_DESTINATION,
  PLACEHOLDER_ROUND_ONE,
  PLACEHOLDER_ROUND_TWO_PERSONAL,
} from '@/components/voting/DestinationCard'

const PLACEHOLDER_DESTINATIONS: DestinationAnalysisRow[] = [
  {
    id: 'placeholder-1',
    trip_id: 'placeholder',
    submitter_traveler_id: null,
    destination_name: 'Santorini, Greece',
    country: 'Greece',
    card_snapshot: PLACEHOLDER_DESTINATION,
    pushed_to_vote: true,
    advanced_to_round_two: true,
    round_one_content: PLACEHOLDER_ROUND_ONE,
    feasibility_floor: 900,
    highest_member_max: 2100,
    created_at: new Date().toISOString(),
  },
  {
    id: 'placeholder-2',
    trip_id: 'placeholder',
    submitter_traveler_id: null,
    destination_name: 'Lisbon, Portugal',
    country: 'Portugal',
    card_snapshot: { ...PLACEHOLDER_DESTINATION, name: 'Lisbon, Portugal', synopsis: 'Tile-lined hills, Atlantic breezes, and a food scene built for groups.' },
    pushed_to_vote: true,
    advanced_to_round_two: true,
    round_one_content: {
      ...PLACEHOLDER_ROUND_ONE,
      overview: 'A walkable coastal capital blending historic neighborhoods, day-trip beaches, and a lively but manageable nightlife scene.',
      best_known_for: ['Pastéis de nata', 'Tram 28', 'Alfama viewpoints', 'Day trips to Sintra'],
      activities: ['Food tours', 'Sunset at Miradouro', 'Beach day in Cascais', 'Fado nights', 'Wine bars in Bairro Alto'],
      weather: 'Late June: ~78°F, dry, cooling Atlantic breeze in evenings.',
    },
    feasibility_floor: 900,
    highest_member_max: 2100,
    created_at: new Date().toISOString(),
  },
  {
    id: 'placeholder-3',
    trip_id: 'placeholder',
    submitter_traveler_id: null,
    destination_name: 'Cartagena, Colombia',
    country: 'Colombia',
    card_snapshot: { ...PLACEHOLDER_DESTINATION, name: 'Cartagena, Colombia', synopsis: 'Walled old city color, Caribbean heat, and celebration energy.' },
    pushed_to_vote: true,
    advanced_to_round_two: false,
    round_one_content: {
      ...PLACEHOLDER_ROUND_ONE,
      overview: 'A colorful Caribbean port city with a preserved colonial core, beach clubs, and a festive group-trip atmosphere.',
      best_known_for: ['Old City walls', 'Rooftop pools', 'Caribbean cuisine', 'Island day trips'],
      activities: ['Old Town walking', 'Rosario Islands boat day', 'Rooftop dinners', 'Salsa clubs', 'Street food tours'],
      weather: 'Late June: ~88°F, humid, brief tropical showers possible.',
    },
    feasibility_floor: 900,
    highest_member_max: 2100,
    created_at: new Date().toISOString(),
  },
]

function placeholderPayload(round: 1 | 2): VotingPayload {
  const roundTwo = PLACEHOLDER_DESTINATIONS.filter(d => d.advanced_to_round_two)
  const personalized: Record<string, RoundTwoPersonalContent> = {}
  for (const d of roundTwo) personalized[d.id] = PLACEHOLDER_ROUND_TWO_PERSONAL
  return {
    trip: { voting_round: round, winning_destination_id: null, destination: null, name: 'Preview trip' },
    roundOneDestinations: PLACEHOLDER_DESTINATIONS,
    roundTwoDestinations: roundTwo,
    roundOneRanks: {},
    roundTwoAllocations: {},
    personalized,
  }
}

export default function VotePage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<VotingPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [kickoffBusy, setKickoffBusy] = useState(false)
  const [usePlaceholder, setUsePlaceholder] = useState(false)
  const [previewRound, setPreviewRound] = useState<1 | 2>(1)

  const load = useCallback(async () => {
    try {
      const json = await fetchVotingState(tripId)
      setData(json)
      setError(null)
    } catch (e) {
      setUsePlaceholder(true)
      setData(placeholderPayload(previewRound))
      setError(e instanceof Error ? e.message : null)
    } finally {
      setLoading(false)
    }
  }, [tripId, previewRound])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (usePlaceholder) setData(placeholderPayload(previewRound))
  }, [usePlaceholder, previewRound])

  if (loading) return <SuitcaseLoader message="Loading voting" />

  const trip = data?.trip
  const round = usePlaceholder ? previewRound : trip?.voting_round

  if (!round) {
    const status = data?.submissionStatus
    const allIn = status ? status.submitted >= status.eligible && status.eligible > 0 : false
    let waitingOn = 'Everyone needs to submit their trip card choices from Brainstorm first.'
    if (status) {
      if (allIn) {
        waitingOn = data?.kickoffError
          ? `All ${status.eligible} travelers have submitted, but voting could not start: ${data.kickoffError}`
          : `All ${status.eligible} travelers have submitted — tap below to start the group vote.`
      } else if (status.pendingNicknames?.length) {
        waitingOn = `${status.submitted} of ${status.eligible} submitted. Still waiting on: ${status.pendingNicknames.join(', ')}.`
      } else {
        waitingOn = `${status.submitted} of ${status.eligible} travelers have submitted their card choices.`
      }
    }

    const handleKickoff = async () => {
      setKickoffBusy(true)
      try {
        await forceVotingKickoff(tripId)
        setLoading(true)
        await load()
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Failed to start voting')
      } finally {
        setKickoffBusy(false)
      }
    }

    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Group vote">
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">Voting hasn&apos;t started yet</p>
          <p className="text-sm text-muted-foreground mb-6">{waitingOn}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {allIn && (
              <button
                type="button"
                disabled={kickoffBusy}
                onClick={() => void handleKickoff()}
                className="avanti-btn avanti-btn-primary"
              >
                {kickoffBusy ? 'Starting…' : 'Start group vote →'}
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

  if (trip?.winning_destination_id) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Winner">
        <div className="avanti-box border border-forest-deep/25 bg-forest-pale px-6 py-10 text-center">
          <p className="eyebrow text-forest mb-2">Destination locked</p>
          <p className="font-serif text-3xl text-forest-deep mb-4">{trip.destination || 'Your destination'}</p>
          <button type="button" onClick={() => router.push(`/trips/${tripId}/flights`)} className="avanti-btn avanti-btn-primary">
            Plan flights →
          </button>
        </div>
      </SubpageShell>
    )
  }

  const handleRoundOne = async (votes: Array<{ destinationAnalysisId: string; rank: number }>) => {
    if (usePlaceholder) {
      setPreviewRound(2)
      setData(placeholderPayload(2))
      return
    }
    setSubmitting(true)
    try {
      const result = await submitRoundOneVotes(tripId, votes)
      await load()
      if (result.advanced) return
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRoundTwo = async (
    allocations: Array<{ destinationAnalysisId: string; percentage: number }>
  ) => {
    if (usePlaceholder) {
      alert('Preview mode — winner would be calculated here.')
      return
    }
    setSubmitting(true)
    try {
      await submitRoundTwoVotes(tripId, allocations)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={trip?.name}
      title="Group vote"
      maxWidth="max-w-6xl"
    >
      {usePlaceholder && (
        <div className="avanti-box border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-900">
          Showing placeholder layout{error ? ` (${error})` : ''}. Run the voting migration to use live data.
          <div className="flex gap-2 mt-3">
            <button type="button" className="text-xs uppercase tracking-wider underline" onClick={() => setPreviewRound(1)}>Preview Round 1</button>
            <button type="button" className="text-xs uppercase tracking-wider underline" onClick={() => setPreviewRound(2)}>Preview Round 2</button>
          </div>
        </div>
      )}

      {round === 1 && data && data.traveler?.round_one_submitted && (
        <div className="avanti-box border border-forest-deep/25 bg-forest-pale px-6 py-10 text-center max-w-xl mx-auto">
          <p className="eyebrow text-forest mb-2">Round 1</p>
          <p className="font-serif text-2xl text-forest-deep mb-3">Your rankings are in ✓</p>
          {data.roundOneStatus && data.roundOneStatus.submitted < data.roundOneStatus.eligible ? (
            <p className="text-sm text-muted-foreground mb-6">
              {data.roundOneStatus.submitted} of {data.roundOneStatus.eligible} travelers have submitted.
              {data.roundOneStatus.pendingNicknames?.length
                ? ` Still waiting on ${data.roundOneStatus.pendingNicknames.join(', ')}.`
                : ' Waiting on the rest of the group.'}
            </p>
          ) : data.roundOneAdvanceError ? (
            <p className="text-sm text-muted-foreground mb-6">
              Everyone has voted, but Round 2 could not start: {data.roundOneAdvanceError}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mb-6">Opening Round 2…</p>
          )}
          <button type="button" onClick={() => void load()} className="avanti-btn">
            Refresh →
          </button>
        </div>
      )}

      {round === 1 && data && !data.traveler?.round_one_submitted && (
        <RoundOneVoting
          tripId={tripId}
          destinations={data.roundOneDestinations}
          initialRanks={data.roundOneRanks}
          submitting={submitting}
          onSubmit={handleRoundOne}
        />
      )}

      {round === 2 && data && (
        <RoundTwoVoting
          tripId={tripId}
          destinations={data.roundTwoDestinations}
          personalizedByDest={data.personalized}
          initialAllocations={data.roundTwoAllocations}
          submitting={submitting}
          onSubmit={handleRoundTwo}
        />
      )}
    </SubpageShell>
  )
}
