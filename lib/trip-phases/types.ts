export type PhaseId = 'brainstorm' | 'round_one' | 'round_two' | 'reveal'

/** not_opened = waiting for host/schedule; active = editable; view_only = read-only history; expired = time up, final */
export type PhaseAccessMode = 'not_opened' | 'active' | 'view_only' | 'expired'

export type TripPhaseFields = {
  invites_closed?: boolean | null
  voting_round?: number | null
  winning_destination_id?: string | null
  destination?: string | null
  total_cards?: number | null
  brainstorm_duration_minutes?: number | null
  round_one_duration_minutes?: number | null
  round_two_duration_minutes?: number | null
  brainstorm_opened_at?: string | null
  brainstorm_deadline_at?: string | null
  brainstorm_closed_at?: string | null
  voting_opened_at?: string | null
  round_one_deadline_at?: string | null
  round_one_closed_at?: string | null
  round_two_opened_at?: string | null
  round_two_deadline_at?: string | null
  round_two_closed_at?: string | null
}

export type TravelerPhaseFields = {
  choices_submitted?: boolean | null
  round_one_submitted?: boolean | null
  round_two_submitted?: boolean | null
}

export type PhaseSnapshot = {
  id: PhaseId
  label: string
  path: string
  access: PhaseAccessMode
  deadlineAt: string | null
  openedAt: string | null
  closedAt: string | null
  durationMinutes: number
  /** Human-readable reason for current access mode */
  statusNote: string
}

export type TripPhasesPayload = {
  isOrganizer: boolean
  phases: PhaseSnapshot[]
  now: string
}

export const DEFAULT_BRAINSTORM_MINUTES = 48 * 60
export const DEFAULT_ROUND_ONE_MINUTES = 24 * 60
export const DEFAULT_ROUND_TWO_MINUTES = 48 * 60
