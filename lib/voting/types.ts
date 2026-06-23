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
  feasibility_floor: number | null
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
