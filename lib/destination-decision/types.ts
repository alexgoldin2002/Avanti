export const DESTINATION_DECISION_STATUSES = [
  'draft',
  'suggestions_open',
  'analyzing',
  'meta_vote',
  'voting',
  'results',
  'confirming',
  'locked',
  'cancelled',
] as const

export type DestinationDecisionStatus = (typeof DESTINATION_DECISION_STATUSES)[number]

export const BUDGET_STRICTNESS = ['hard', 'soft', 'open'] as const
export type BudgetStrictness = (typeof BUDGET_STRICTNESS)[number]

export const GROUP_PRIORITY = ['budget', 'experience', 'balance'] as const
export type GroupPriority = (typeof GROUP_PRIORITY)[number]

export const DESTINATION_TIERS = ['budget', 'mid', 'luxury'] as const
export type DestinationTier = (typeof DESTINATION_TIERS)[number]

export const FLIGHT_TOGGLES = ['direct', 'one_stop', 'cheapest'] as const
export type FlightToggle = (typeof FLIGHT_TOGGLES)[number]

export const DATE_TOGGLES = ['best', 'fri', 'mon'] as const
export type DateToggle = (typeof DATE_TOGGLES)[number]

export const WORKS_FOR_YOU = ['yes', 'tight', 'no'] as const
export type WorksForYou = (typeof WORKS_FOR_YOU)[number]

export type ScenarioCell = {
  cost: number
  works: WorksForYou
}

export type ScenarioMatrix = Record<
  FlightToggle,
  Record<DateToggle, ScenarioCell>
>

export type DestinationDecision = {
  id: string
  trip_id: string
  status: DestinationDecisionStatus
  submission_deadline: string | null
  analysis_started_at: string | null
  analysis_completed_at: string | null
  voting_deadline: string | null
  confirm_deadline: string | null
  budget_strictness: BudgetStrictness
  group_priority_mode: GroupPriority | null
  locked_option_id: string | null
  winner_option_id: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DestinationOption = {
  id: string
  decision_id: string
  trip_id: string
  name: string
  country: string | null
  tier: DestinationTier
  source: 'ai_card' | 'member_suggestion'
  source_traveler_id: string | null
  card_snapshot: Record<string, unknown>
  group_summary: Record<string, unknown>
  sort_order: number
  created_at: string
}

export const DEFAULT_SUBMISSION_HOURS = 48
export const DEFAULT_VOTING_HOURS = 72
export const DEFAULT_CONFIRM_HOURS = 48
export const ANALYSIS_BUFFER_MINUTES = 45
