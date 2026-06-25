export type RoundOneContent = {
  overview: string
  best_known_for: string[]
  activities: string[]
  weather: string
}

export type RoundTwoPersonalContent = {
  personal_fit_summary: string
  top_picks_for_you: string[]
  watch_out_for: string
  fit_score: number
}

import type { DestinationPriceEstimate } from '@/lib/pricing/types'

export type DestinationAnalysisRow = {
  id: string
  trip_id: string
  submitter_traveler_id: string | null
  destination_name: string
  country: string | null
  card_snapshot: Record<string, unknown>
  pushed_to_vote: boolean
  advanced_to_round_two: boolean
  round_one_content: RoundOneContent | null
  price_estimate: DestinationPriceEstimate | null
  /** @deprecated Legacy group-budget overlap — no longer shown on Round 1 cards */
  feasibility_floor: number | null
  /** @deprecated Legacy group-budget overlap — no longer shown on Round 1 cards */
  highest_member_max: number | null
  created_at: string
}

export type RoundOneVoteRow = {
  id: string
  trip_id: string
  traveler_id: string
  destination_analysis_id: string
  rank: number
}

export type RoundOneTallyEntry = {
  destinationAnalysisId: string
  destinationName: string
  rankSum: number
}

export type RoundTwoVoteRow = {
  id: string
  trip_id: string
  traveler_id: string
  destination_analysis_id: string
  percentage: number
}

export type RoundTwoTallyEntry = {
  destinationAnalysisId: string
  destinationName: string
  averagePercentage: number
  voteCount: number
}

export type VotingResultsPayload = {
  trip: {
    id: string
    name: string
    destination: string | null
    winning_destination_id: string | null
    voting_round: number | null
  }
  tally: RoundTwoTallyEntry[]
  roundTwoStatus: { eligible: number; submitted: number; pendingNicknames: string[] }
  winner: DestinationAnalysisRow | null
  finalistOptions: DestinationAnalysisRow[]
  allVotingCards: DestinationAnalysisRow[]
  isOrganizer: boolean
  ready: boolean
}
