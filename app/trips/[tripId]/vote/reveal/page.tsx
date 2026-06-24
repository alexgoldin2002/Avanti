'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../../components/SubpageShell'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import DestinationReveal from '@/components/voting/DestinationReveal'
import { fetchVotingResults } from '@/lib/voting/client-api'
import type { VotingResultsPayload } from '@/lib/voting/types'

export default function VoteRevealPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<VotingResultsPayload | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const json = await fetchVotingResults(tripId)
        setResults(json)
        if (json.trip.voting_round !== 2 && !json.ready) {
          router.replace(`/trips/${tripId}/vote`)
        }
      } catch {
        router.replace(`/trips/${tripId}/vote`)
      } finally {
        setLoading(false)
      }
    })()
  }, [tripId, router])

  if (loading) return <SuitcaseLoader message="Preparing reveal" />

  return (
    <SubpageShell
      backHref={`/trips/${tripId}/vote`}
      backLabel="Voting"
      eyebrow={results?.trip.name}
      title="The reveal"
      maxWidth="max-w-3xl"
    >
      <DestinationReveal tripId={tripId} initialResults={results} />
    </SubpageShell>
  )
}
