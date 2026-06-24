import { supabase } from '@/lib/supabase'
import type { DestinationAnalysisRow, RoundTwoPersonalContent, VotingResultsPayload } from '@/lib/voting/types'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export type VotingPayload = {
  trip: {
    voting_round: number | null
    winning_destination_id: string | null
    destination: string | null
    name: string
  }
  submissionStatus?: { eligible: number; submitted: number; pendingNicknames?: string[] }
  roundOneStatus?: { eligible: number; submitted: number; pendingNicknames?: string[] }
  roundTwoStatus?: { eligible: number; submitted: number; pendingNicknames?: string[] }
  kickoffError?: string | null
  roundOneAdvanceError?: string | null
  traveler?: {
    id: string
    choices_submitted: boolean
    round_one_submitted: boolean
    round_two_submitted: boolean
  }
  roundOneDestinations: DestinationAnalysisRow[]
  roundTwoDestinations: DestinationAnalysisRow[]
  roundOneRanks: Record<string, number>
  roundTwoAllocations: Record<string, number>
  personalized: Record<string, RoundTwoPersonalContent>
}

export async function fetchVotingState(tripId: string): Promise<VotingPayload> {
  const res = await fetch(`/api/voting/${tripId}`, { headers: await authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load voting')
  return data as VotingPayload
}

export async function submitTripCardChoices(tripId: string): Promise<{
  votingRound: number | null
  totalCards: number
}> {
  const res = await fetch('/api/voting/submit-choices', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to submit choices')
  return {
    votingRound: data.votingRound ?? null,
    totalCards: data.totalCards ?? 0,
  }
}

export async function submitRoundOneVotes(
  tripId: string,
  votes: Array<{ destinationAnalysisId: string; rank: number }>
): Promise<{ advanced: boolean; roundOneStatus?: { eligible: number; submitted: number; pendingNicknames?: string[] } }> {
  const res = await fetch('/api/voting/round-one', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId, votes }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to submit')
  return { advanced: !!data.advanced, roundOneStatus: data.roundOneStatus }
}

export async function forceVotingKickoff(tripId: string): Promise<{
  votingRound: number
  totalCards: number
}> {
  const res = await fetch('/api/voting/kickoff', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to start voting')
  return { votingRound: data.votingRound, totalCards: data.totalCards }
}

export async function submitRoundTwoVotes(
  tripId: string,
  allocations: Array<{ destinationAnalysisId: string; percentage: number }>
): Promise<{ winnerId: string | null; allComplete: boolean }> {
  const res = await fetch('/api/voting/round-two', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId, allocations }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to submit')
  return {
    winnerId: data.winnerId ?? null,
    allComplete: !!data.allComplete,
  }
}

export async function fetchVotingResults(tripId: string): Promise<VotingResultsPayload> {
  const res = await fetch(`/api/voting/${tripId}/results`, { headers: await authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load results')
  return data as VotingResultsPayload
}

export async function overrideTripDestination(
  tripId: string,
  opts: { destinationAnalysisId?: string; destinationName?: string }
): Promise<void> {
  const res = await fetch('/api/voting/override-destination', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId, ...opts }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to override destination')
}
