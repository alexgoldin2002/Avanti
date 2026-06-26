'use client'

import PhaseCountdown from './PhaseCountdown'
import type { PhaseSnapshot } from '@/lib/trip-phases/types'

type PhaseLockedScreenProps = {
  phase: PhaseSnapshot
  backHref: string
  backLabel?: string
  /** Show another phase timer (e.g. brainstorm while waiting for voting). */
  secondaryPhase?: PhaseSnapshot | null
}

export default function PhaseLockedScreen({
  phase,
  backHref,
  backLabel = 'Go back to trip dashboard',
  secondaryPhase,
}: PhaseLockedScreenProps) {
  const isNotOpened = phase.access === 'not_opened'
  const showTimer =
    !!phase.deadlineAt &&
    (phase.access === 'active' || phase.access === 'view_only' || phase.access === 'expired')

  return (
    <div className="avanti-box border border-border bg-card px-6 py-12 text-center max-w-lg mx-auto">
      <p className="eyebrow text-muted-foreground mb-2">{phase.label}</p>
      <p className="font-serif text-2xl text-forest-deep mb-3">
        {isNotOpened
          ? 'This step has not been opened yet by the host'
          : phase.access === 'expired'
          ? 'This stage is closed'
          : 'Not open yet'}
      </p>
      <p className="text-sm text-muted-foreground mb-6">{phase.statusNote}</p>

      {showTimer && (
        <div className="mb-6">
          <PhaseCountdown
            deadlineAt={phase.deadlineAt}
            access={phase.access === 'expired' ? 'expired' : phase.access}
            variant="box"
            size="lg"
            label="Time remaining"
          />
        </div>
      )}

      {secondaryPhase?.deadlineAt && secondaryPhase.access === 'active' && (
        <div className="mb-6">
          <PhaseCountdown
            deadlineAt={secondaryPhase.deadlineAt}
            access={secondaryPhase.access}
            variant="box"
            size="lg"
            label={`${secondaryPhase.label} — time remaining`}
          />
        </div>
      )}

      <a href={backHref} className="avanti-btn">
        {backLabel} →
      </a>
    </div>
  )
}
