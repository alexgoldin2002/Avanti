import {
  DEFAULT_BRAINSTORM_MINUTES,
  DEFAULT_ROUND_ONE_MINUTES,
  DEFAULT_ROUND_TWO_MINUTES,
  type PhaseAccessMode,
  type PhaseId,
  type PhaseSnapshot,
  type TravelerPhaseFields,
  type TripPhaseFields,
  type TripPhasesPayload,
} from './types'
import { tripHasKnownDestination } from '@/lib/step2/planning-path'

function nowMs(): number {
  return Date.now()
}

function isPast(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso).getTime() <= nowMs()
}

export function votingComplete(trip: TripPhaseFields): boolean {
  if (tripHasKnownDestination(trip)) return true
  return (
    !!trip.winning_destination_id ||
    (!!trip.destination && trip.destination !== 'TBD' && trip.voting_round != null)
  )
}

function roundOneSkipped(trip: TripPhaseFields): boolean {
  return trip.voting_round === 2 && !trip.round_one_opened_at && !trip.round_one_deadline_at
}

export function deadlineFromOpened(openedAt: string, durationMinutes: number): string {
  return new Date(new Date(openedAt).getTime() + durationMinutes * 60_000).toISOString()
}

export function getBrainstormAccess(
  trip: TripPhaseFields,
  traveler: TravelerPhaseFields | null,
  isOrganizer: boolean
): { access: PhaseAccessMode; note: string } {
  const legacyOpen = trip.invites_closed && !trip.brainstorm_opened_at

  if (!trip.invites_closed) {
    if (isOrganizer && trip.destination_planning_path) {
      return {
        access: 'active',
        note: 'You can keep working on your picks. Invite friends from Step 1 anytime — when everyone has joined, start planning there to open the group submission window.',
      }
    }
    return {
      access: 'not_opened',
      note: isOrganizer
        ? 'Close invites to open Brainstorm and start the card submission window.'
        : 'Waiting for the host to open Brainstorm.',
    }
  }

  if (!trip.brainstorm_opened_at && !legacyOpen) {
    return {
      access: 'not_opened',
      note: isOrganizer
        ? 'Open Brainstorm to start the card submission window.'
        : 'Waiting for the host to open Brainstorm.',
    }
  }

  const windowClosed =
    trip.voting_round != null ||
    !!trip.brainstorm_closed_at ||
    isPast(trip.brainstorm_deadline_at)

  if (windowClosed) {
    const submitted =
      !!traveler?.choices_submitted ||
      (Array.isArray((traveler?.step2 as Record<string, unknown> | undefined)?.submittedCardPicks) &&
        ((traveler?.step2 as Record<string, unknown>).submittedCardPicks as unknown[]).length > 0)
    return {
      access: submitted ? 'view_only' : 'expired',
      note: submitted
        ? 'Brainstorm window closed — your card choices are final.'
        : 'Brainstorm window closed — you did not submit card choices in time.',
    }
  }

  const hasSubmitted =
    !!traveler?.choices_submitted ||
    (Array.isArray((traveler?.step2 as Record<string, unknown> | undefined)?.submittedCardPicks) &&
      ((traveler?.step2 as Record<string, unknown>).submittedCardPicks as unknown[]).length > 0)

  return {
    access: 'active',
    note: hasSubmitted
      ? 'You can change your card picks until the window closes.'
      : 'Submit your trip card choices before the submission window closes.',
  }
}

export function getRoundOneAccess(
  trip: TripPhaseFields,
  traveler: TravelerPhaseFields | null,
  isOrganizer: boolean
): { access: PhaseAccessMode; note: string } {
  if (roundOneSkipped(trip)) {
    return { access: 'view_only', note: 'Round 1 was skipped — not enough cards for ranking.' }
  }
  if (!trip.voting_opened_at || trip.voting_round == null) {
    // Legacy: voting already in progress before phase timers
    if (trip.voting_round != null && !trip.voting_opened_at) {
      if (trip.voting_round !== 1) {
        return { access: 'view_only', note: 'Round 1 is complete.' }
      }
      if (traveler?.round_one_submitted) {
        return { access: 'view_only', note: 'Your rankings are in. You can review but not change them.' }
      }
      return { access: 'active', note: 'Rank destinations before the timer runs out.' }
    }
    return {
      access: 'not_opened',
      note: isOrganizer
        ? 'Open group voting once everyone has submitted cards (or when the Brainstorm window closes).'
        : 'Waiting for the host to open group voting.',
    }
  }
  if (trip.voting_round !== 1) {
    return {
      access: traveler?.round_one_submitted ? 'view_only' : 'expired',
      note: 'Round 1 is complete.',
    }
  }
  if (trip.round_one_closed_at || isPast(trip.round_one_deadline_at)) {
    return {
      access: traveler?.round_one_submitted ? 'view_only' : 'expired',
      note: 'Round 1 window closed — rankings are final.',
    }
  }
  if (traveler?.round_one_submitted) {
    return { access: 'view_only', note: 'Your rankings are in. You can review but not change them.' }
  }
  return { access: 'active', note: 'Rank destinations before the timer runs out.' }
}

export function getRoundTwoAccess(
  trip: TripPhaseFields,
  traveler: TravelerPhaseFields | null,
  isOrganizer: boolean
): { access: PhaseAccessMode; note: string } {
  if (votingComplete(trip)) {
    return {
      access: traveler?.round_two_submitted ? 'view_only' : 'expired',
      note: 'Voting is complete.',
    }
  }
  if (trip.voting_round !== 2) {
    return {
      access: 'not_opened',
      note: isOrganizer ? 'Round 2 opens after Round 1 finishes.' : 'Waiting for Round 1 to finish.',
    }
  }
  if (!trip.round_two_opened_at) {
    return {
      access: 'not_opened',
      note: 'Waiting for everyone to finish Round 1.',
    }
  }
  if (trip.round_two_closed_at || isPast(trip.round_two_deadline_at)) {
    return {
      access: traveler?.round_two_submitted ? 'view_only' : 'expired',
      note: 'Round 2 window closed — votes are final.',
    }
  }
  if (traveler?.round_two_submitted) {
    return { access: 'view_only', note: 'Your vote split is in. You can review but not change it.' }
  }
  return { access: 'active', note: 'Split your 100% across finalists before the timer runs out.' }
}

export function getRevealAccess(trip: TripPhaseFields): { access: PhaseAccessMode; note: string } {
  if (votingComplete(trip)) {
    return { access: 'view_only', note: 'Your group destination is locked in.' }
  }
  if (trip.voting_round === 2 && trip.round_two_closed_at) {
    return { access: 'active', note: 'Generating your destination reveal…' }
  }
  return { access: 'not_opened', note: 'The reveal opens after Round 2 voting ends.' }
}

export function buildPhaseSnapshots(
  trip: TripPhaseFields,
  traveler: TravelerPhaseFields | null,
  isOrganizer: boolean,
  tripId: string
): PhaseSnapshot[] {
  const brainstorm = getBrainstormAccess(trip, traveler, isOrganizer)
  const roundOne = getRoundOneAccess(trip, traveler, isOrganizer)
  const roundTwo = getRoundTwoAccess(trip, traveler, isOrganizer)
  const reveal = getRevealAccess(trip)

  return [
    {
      id: 'brainstorm',
      label: 'Brainstorm',
      path: `/trips/${tripId}/step2`,
      access: brainstorm.access,
      deadlineAt: trip.brainstorm_deadline_at ?? null,
      openedAt: trip.brainstorm_opened_at ?? null,
      closedAt: trip.brainstorm_closed_at ?? null,
      durationMinutes: trip.brainstorm_duration_minutes ?? DEFAULT_BRAINSTORM_MINUTES,
      statusNote: brainstorm.note,
    },
    {
      id: 'round_one',
      label: 'Round 1 — Rank',
      path: `/trips/${tripId}/vote/round-one`,
      access: roundOne.access,
      deadlineAt: trip.round_one_deadline_at ?? null,
      openedAt: trip.voting_opened_at ?? null,
      closedAt: trip.round_one_closed_at ?? null,
      durationMinutes: trip.round_one_duration_minutes ?? DEFAULT_ROUND_ONE_MINUTES,
      statusNote: roundOne.note,
    },
    {
      id: 'round_two',
      label: 'Round 2 — Split vote',
      path: `/trips/${tripId}/vote/round-two`,
      access: roundTwo.access,
      deadlineAt: trip.round_two_deadline_at ?? null,
      openedAt: trip.round_two_opened_at ?? null,
      closedAt: trip.round_two_closed_at ?? null,
      durationMinutes: trip.round_two_duration_minutes ?? DEFAULT_ROUND_TWO_MINUTES,
      statusNote: roundTwo.note,
    },
    {
      id: 'reveal',
      label: 'Destination reveal',
      path: `/trips/${tripId}/vote/reveal`,
      access: reveal.access,
      deadlineAt: null,
      openedAt: votingComplete(trip) ? trip.round_two_closed_at ?? trip.voting_opened_at ?? null : null,
      closedAt: null,
      durationMinutes: 0,
      statusNote: reveal.note,
    },
  ]
}

export function buildTripPhasesPayload(
  trip: TripPhaseFields,
  traveler: TravelerPhaseFields | null,
  isOrganizer: boolean,
  tripId: string
): TripPhasesPayload {
  return {
    isOrganizer,
    phases: buildPhaseSnapshots(trip, traveler, isOrganizer, tripId),
    now: new Date().toISOString(),
  }
}

export function getPhaseSnapshot(
  payload: TripPhasesPayload,
  phaseId: PhaseId
): PhaseSnapshot | undefined {
  return payload.phases.find(p => p.id === phaseId)
}

export function canEditPhase(access: PhaseAccessMode): boolean {
  return access === 'active'
}

export function canViewPhase(_access: PhaseAccessMode): boolean {
  return true
}
