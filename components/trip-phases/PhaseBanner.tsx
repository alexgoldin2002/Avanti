'use client'

import { useState } from 'react'
import PhaseCountdown from './PhaseCountdown'
import { closeTripPhaseEarly, extendTripPhase, openTripPhase } from '@/lib/trip-phases/client-api'
import type { PhaseId, PhaseSnapshot } from '@/lib/trip-phases/types'
import { STEP2_WORKSPACE_PANEL, STEP2_WORKSPACE_BOX, STEP2_WORKSPACE_BOX_PAD_COMPACT } from '@/components/step2/workspace-layout'

type PhaseBannerProps = {
  tripId: string
  phase: PhaseSnapshot
  isOrganizer: boolean
  onUpdated?: () => void
  /** Hide phase title — use when the page shell already shows the heading. */
  hideTitle?: boolean
  /** Step 2 workspace layout — larger type, reference-style host controls. */
  workspace?: boolean
}

const CLOSE_WARNINGS: Record<string, string> = {
  brainstorm:
    'Close the submission window early? Travelers who have not submitted their card choices will be locked out of destination voting.',
  round_one:
    'Close Round 1 early? Travelers who have not submitted rankings will be locked out.',
  round_two:
    'Close Round 2 early? Travelers who have not submitted their vote split will be locked out.',
}

function HostTimerIconButton({
  icon,
  label,
  onClick,
  disabled,
  variant = 'default',
}: {
  icon: 'plus' | 'minus'
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'muted'
}) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        className={`inline-flex items-center justify-center w-[18px] h-[18px] border bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-default transition-colors ${
          variant === 'muted'
            ? 'border-border text-muted-foreground hover:bg-secondary/30 hover:text-foreground'
            : 'border-foreground/25 text-foreground hover:bg-forest-pale/40 hover:border-forest-deep/40'
        }`}
      >
        <i className={`ti ti-${icon} text-[10px] leading-none`} aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-max max-w-[220px] px-3 py-2 bg-foreground text-cream text-[11px] normal-case tracking-normal leading-snug text-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 font-serif"
      >
        {label}
      </span>
    </span>
  )
}

function isWindowOpen(phase: PhaseSnapshot): boolean {
  if (!phase.deadlineAt || phase.closedAt) return false
  return new Date(phase.deadlineAt).getTime() > Date.now()
}

export default function PhaseBanner({
  tripId,
  phase,
  isOrganizer,
  onUpdated,
  hideTitle = false,
  workspace = false,
}: PhaseBannerProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddTime, setShowAddTime] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [addTime, setAddTime] = useState({ days: 0, hours: 0, minutes: 0 })

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

  const handleExtend = async () => {
    if (phase.id === 'reveal') return
    const minutes = addTime.days * 24 * 60 + addTime.hours * 60 + addTime.minutes
    if (minutes <= 0) {
      setError('Enter at least some time to add')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await extendTripPhase(tripId, phase.id as 'brainstorm' | 'round_one' | 'round_two', minutes)
      setShowAddTime(false)
      setAddTime({ days: 0, hours: 0, minutes: 0 })
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to extend')
    } finally {
      setBusy(false)
    }
  }

  const handleCloseEarly = async () => {
    if (phase.id === 'reveal') return
    setBusy(true)
    setError(null)
    try {
      await closeTripPhaseEarly(tripId, phase.id as 'brainstorm' | 'round_one' | 'round_two')
      setShowCloseConfirm(false)
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close window')
    } finally {
      setBusy(false)
    }
  }

  const windowOpen = isWindowOpen(phase)
  const showTimerRow = phase.id !== 'reveal' && windowOpen && phase.access === 'active'
  const hostControls = isOrganizer && showTimerRow

  const accessLabel =
    phase.access === 'not_opened'
      ? 'Not open yet'
      : phase.access === 'active'
      ? 'Open'
      : phase.access === 'view_only'
      ? 'View only'
      : 'Closed'

  const accessBadge =
    phase.access === 'view_only' ? (
      <span
        className="relative group inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground cursor-default"
        title={phase.statusNote}
      >
        <i className="ti ti-lock text-[10px]" aria-hidden />
        View only
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-max max-w-[240px] px-3 py-2 bg-foreground text-cream text-[11px] normal-case tracking-normal leading-snug text-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 font-serif"
        >
          {phase.statusNote}
        </span>
      </span>
    ) : phase.access !== 'not_opened' ? (
      <span
        className={`text-[10px] uppercase tracking-[0.18em] ${
          phase.access === 'active' ? 'text-forest-deep' : 'text-muted-foreground'
        }`}
      >
        {accessLabel}
      </span>
    ) : null

  const addTimeLabel = 'Add more time to the submission window'
  const closeEarlyLabel =
    phase.id === 'brainstorm'
      ? 'Close the submission window early'
      : phase.id === 'round_one'
      ? 'Close Round 1 early'
      : 'Close Round 2 early'

  return (
    <div
      className={
        workspace
          ? `mb-4 ${STEP2_WORKSPACE_PANEL} ${STEP2_WORKSPACE_BOX} ${STEP2_WORKSPACE_BOX_PAD_COMPACT}`
          : 'mb-6'
      }
    >
      {hideTitle ? (
        accessBadge && <div className={workspace ? 'mb-0.5' : 'mb-3'}>{accessBadge}</div>
      ) : (
        <div className={workspace ? 'mb-1' : 'mb-3'}>
          <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-0 ${workspace ? 'mb-0' : 'mb-2'}`}>
            <h1
              className={`font-serif font-light text-foreground m-0 tracking-[0.02em] ${
                workspace ? 'text-[28px] sm:text-[30px] leading-none' : 'text-[28px] leading-none'
              }`}
            >
              {phase.label}
            </h1>
            {accessBadge}
          </div>
          {phase.access !== 'view_only' && phase.statusNote && (
            <p
              className={`text-muted-foreground m-0 max-w-lg ${
                workspace ? 'text-[13px] leading-tight mt-0.5' : 'text-sm leading-relaxed'
              }`}
            >
              {phase.statusNote}
            </p>
          )}
        </div>
      )}

      {hideTitle && phase.access === 'view_only' && phase.statusNote && (
        <p className="text-sm text-muted-foreground m-0 mb-3 leading-relaxed">{phase.statusNote}</p>
      )}

      {showTimerRow && (
        <div className={`flex flex-wrap items-center gap-x-2.5 ${workspace ? 'gap-y-0 mb-0' : 'gap-y-1 mb-3'}`}>
          <PhaseCountdown
            deadlineAt={phase.deadlineAt}
            access={phase.access}
            variant="inline"
            size="lg"
          />
          {hostControls && (
            <div className="flex items-center gap-1">
              <HostTimerIconButton
                icon="plus"
                label={addTimeLabel}
                disabled={busy}
                onClick={() => {
                  setShowAddTime(v => !v)
                  setError(null)
                }}
              />
              <HostTimerIconButton
                icon="minus"
                label={closeEarlyLabel}
                disabled={busy}
                variant="muted"
                onClick={() => setShowCloseConfirm(true)}
              />
            </div>
          )}
        </div>
      )}

      {showAddTime && hostControls && (
        <div className="flex flex-wrap items-end gap-3 mb-3 pb-3 border-b border-border/60">
          {(['days', 'hours', 'minutes'] as const).map(unit => (
            <label key={unit} className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground min-w-[56px]">
              {unit}
              <input
                type="number"
                min={0}
                value={addTime[unit]}
                onChange={e =>
                  setAddTime(prev => ({
                    ...prev,
                    [unit]: Math.max(0, parseInt(e.target.value || '0', 10)),
                  }))
                }
                className="mt-1 block w-full border-b border-border bg-transparent py-1 text-sm text-foreground outline-none font-serif"
              />
            </label>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleExtend()}
            className="text-[10px] uppercase tracking-[0.15em] text-cream bg-forest-deep border border-forest-deep px-3 py-1.5 cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Apply'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive m-0 mb-2">{error}</p>}

      {isOrganizer && phase.access === 'not_opened' && phase.id !== 'reveal' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleOpen()}
          className="avanti-btn avanti-btn-primary text-xs"
        >
          {busy ? 'Opening…' : `Open ${phase.label.toLowerCase()} →`}
        </button>
      )}

      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-[100] p-6">
          <div className="bg-cream w-full max-w-[400px] p-7 font-serif">
            <h2 className="text-xl font-light text-foreground m-0 mb-3 text-center">Close window early?</h2>
            <p className="text-sm text-muted-foreground m-0 mb-6 text-center leading-relaxed">
              {CLOSE_WARNINGS[phase.id] ?? 'Are you sure? This cannot be undone.'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCloseEarly()}
                className="w-full border border-forest-deep bg-forest-deep text-cream py-3 text-[10px] uppercase tracking-[0.2em] cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Closing…' : 'Yes, close now →'}
              </button>
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="w-full border border-border bg-transparent text-muted-foreground py-3 text-[10px] uppercase tracking-[0.2em] cursor-pointer"
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
