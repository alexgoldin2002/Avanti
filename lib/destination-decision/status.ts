import type { DestinationDecisionStatus } from './types'

/** Valid status transitions for the destination decision state machine. */
const TRANSITIONS: Record<DestinationDecisionStatus, DestinationDecisionStatus[]> = {
  draft: ['suggestions_open', 'cancelled'],
  suggestions_open: ['analyzing', 'cancelled'],
  analyzing: ['meta_vote', 'cancelled'],
  meta_vote: ['voting', 'cancelled'],
  voting: ['results', 'cancelled'],
  results: ['confirming', 'cancelled'],
  confirming: ['locked', 'cancelled'],
  locked: [],
  cancelled: [],
}

export function canTransition(
  from: DestinationDecisionStatus,
  to: DestinationDecisionStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(
  from: DestinationDecisionStatus,
  to: DestinationDecisionStatus
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid destination decision transition: ${from} → ${to}`)
  }
}

/** User-facing label for dashboard and /choose header. */
export const STATUS_LABELS: Record<DestinationDecisionStatus, string> = {
  draft: 'Not started',
  suggestions_open: 'Add suggestions',
  analyzing: 'Avanti is analyzing',
  meta_vote: 'Set group priority',
  voting: 'Vote on destinations',
  results: 'Results',
  confirming: 'Confirm your spot',
  locked: 'Destination locked',
  cancelled: 'Cancelled',
}

/** Which UI panel to render on /choose for each status. */
export function getChooseView(status: DestinationDecisionStatus): string {
  switch (status) {
    case 'draft':
      return 'setup'
    case 'suggestions_open':
      return 'suggestions'
    case 'analyzing':
      return 'analyzing'
    case 'meta_vote':
      return 'meta_vote'
    case 'voting':
      return 'vote'
    case 'results':
      return 'results'
    case 'confirming':
      return 'confirm'
    case 'locked':
      return 'locked'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'setup'
  }
}

/** Advance status based on deadlines and completion flags (cron + API). */
export function nextStatusFromClock(input: {
  status: DestinationDecisionStatus
  now: Date
  submissionDeadline: Date | null
  analysisCompletedAt: Date | null
  analysisStartedAt: Date | null
  votingDeadline: Date | null
  confirmDeadline: Date | null
  analysisBufferMinutes: number
  allOptionsAnalyzed: boolean
}): DestinationDecisionStatus | null {
  const {
    status,
    now,
    submissionDeadline,
    analysisCompletedAt,
    analysisStartedAt,
    votingDeadline,
    confirmDeadline,
    analysisBufferMinutes,
    allOptionsAnalyzed,
  } = input

  if (status === 'suggestions_open' && submissionDeadline && now >= submissionDeadline) {
    return 'analyzing'
  }

  if (status === 'analyzing') {
    const bufferMs = analysisBufferMinutes * 60 * 1000
    const started = analysisStartedAt ?? now
    const bufferElapsed = now.getTime() - started.getTime() >= bufferMs
    if (allOptionsAnalyzed && (bufferElapsed || analysisCompletedAt)) {
      return 'meta_vote'
    }
  }

  if (status === 'meta_vote' && votingDeadline && now >= votingDeadline) {
    // meta_vote shares opening with voting in practice; voting_deadline set when meta opens
    return 'voting'
  }

  if (status === 'voting' && votingDeadline && now >= votingDeadline) {
    return 'results'
  }

  if (status === 'results') {
    return 'confirming'
  }

  if (status === 'confirming' && confirmDeadline && now >= confirmDeadline) {
    // organizer must still lock manually; no auto-lock
    return null
  }

  return null
}
