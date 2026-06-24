'use client'

import { useState } from 'react'
import PhaseCountdown from './PhaseCountdown'
import { extendTripPhase, openTripPhase } from '@/lib/trip-phases/client-api'
import type { PhaseId, PhaseSnapshot } from '@/lib/trip-phases/types'
import { formatSubmissionWindow } from '@/lib/submission-window'

type PhaseBannerProps = {
  tripId: string
  phase: PhaseSnapshot
  isOrganizer: boolean
  onUpdated?: () => void
}

const EXTEND_OPTIONS = [
  { label: '+1 hour', minutes: 60 },
  { label: '+6 hours', minutes: 360 },
  { label: '+24 hours', minutes: 1440 },
]

export default function PhaseBanner({ tripId, phase, isOrganizer, onUpdated }: PhaseBannerProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpen = async () => {
    setBusy(true)
    setError(null)
    try {
      await openTripPhase(tripId, phase.id as PhaseId)
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open')
    } finally {
      setBusy(false)
    }
  }

  const handleExtend = async (minutes: number) => {
    if (phase.id === 'reveal') return
    setBusy(true)
    setError(null)
    try {
      await extendTripPhase(tripId, phase.id as 'brainstorm' | 'round_one' | 'round_two', minutes)
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to extend')
    } finally {
      setBusy(false)
    }
  }

  const accessLabel =
    phase.access === 'not_opened'
      ? 'Not open yet'
      : phase.access === 'active'
      ? 'Open'
      : phase.access === 'view_only'
      ? 'View only'
      : 'Closed'

  return (
    <div className="space-y-3 mb-6">
      <div className="avanti-box border border-border bg-card px-4 py-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-1">{phase.label}</p>
          <p className="text-sm text-foreground m-0">{phase.statusNote}</p>
          {phase.durationMinutes > 0 && phase.access !== 'not_opened' && (
            <p className="text-xs text-muted-foreground mt-1 mb-0">
              Window length: {formatSubmissionWindow(phase.durationMinutes)}
            </p>
          )}
        </div>
        <span
          className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 border ${
            phase.access === 'active'
              ? 'border-forest-deep/30 text-forest-deep bg-forest-pale/50'
              : phase.access === 'view_only'
              ? 'border-border text-muted-foreground'
              : phase.access === 'expired'
              ? 'border-border text-muted-foreground bg-secondary/30'
              : 'border-amber-300 text-amber-900 bg-amber-50'
          }`}
        >
          {accessLabel}
        </span>
      </div>

      <PhaseCountdown deadlineAt={phase.deadlineAt} access={phase.access} />

      {error && (
        <p className="text-sm text-destructive m-0">{error}</p>
      )}

      {isOrganizer && (
        <div className="flex flex-wrap gap-2">
          {phase.access === 'not_opened' && phase.id !== 'reveal' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleOpen()}
              className="avanti-btn avanti-btn-primary text-xs"
            >
              {busy ? 'Opening…' : `Open ${phase.label.toLowerCase()} →`}
            </button>
          )}
          {phase.id !== 'reveal' && phase.openedAt && (
            EXTEND_OPTIONS.map(opt => (
              <button
                key={opt.minutes}
                type="button"
                disabled={busy}
                onClick={() => void handleExtend(opt.minutes)}
                className="avanti-btn text-xs"
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
