'use client'

import { useState } from 'react'
import { extendSubmissionWindow } from '@/lib/destination-decision/client-api'
import { formatSubmissionWindow, submissionWindowToMinutes } from '@/lib/submission-window'

type ExtendSubmissionWindowProps = {
  tripId: string
  closed?: boolean
  onExtended: (result: { submissionDeadline: string; status: string; reopened?: boolean }) => void
}

const PRESETS = [
  { label: '+12 hours', days: 0, hours: 12, minutes: 0 },
  { label: '+24 hours', days: 0, hours: 24, minutes: 0 },
  { label: '+2 days', days: 2, hours: 0, minutes: 0 },
] as const

export default function ExtendSubmissionWindow({
  tripId,
  closed = false,
  onExtended,
}: ExtendSubmissionWindowProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [days, setDays] = useState('0')
  const [hours, setHours] = useState('24')
  const [minutes, setMinutes] = useState('0')

  const extend = async (window: { days?: number; hours?: number; minutes?: number }) => {
    setBusy(true)
    setError(null)
    try {
      const result = await extendSubmissionWindow(tripId, window)
      onExtended(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to extend window')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="avanti-box border border-amber-200/80 bg-amber-50/80 px-5 py-5 text-left">
      <p className="text-[10px] uppercase tracking-[0.2em] text-amber-900/70 mb-1">Host only</p>
      <p className="font-serif text-lg text-foreground mb-1">
        {closed ? 'Reopen submission window' : 'Add more time'}
      </p>
      <p className="text-sm text-muted-foreground mb-4 m-0 leading-relaxed">
        {closed
          ? 'Give the group more time to generate and submit Brainstorm cards.'
          : 'Extend how long everyone has to submit their trip cards.'}
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map(preset => (
          <button
            key={preset.label}
            type="button"
            disabled={busy}
            onClick={() => extend({ days: preset.days, hours: preset.hours, minutes: preset.minutes })}
            className="avanti-btn avanti-btn-primary text-[10px] !px-3 !py-2"
          >
            {busy ? '…' : preset.label}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowCustom(v => !v)}
          className="avanti-btn avanti-btn-ghost text-[10px] !px-3 !py-2"
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Days', value: days, set: setDays },
            { label: 'Hours', value: hours, set: setHours },
            { label: 'Min', value: minutes, set: setMinutes },
          ].map(field => (
            <div key={field.label}>
              <label className="text-[10px] text-muted-foreground block mb-1">{field.label}</label>
              <input
                type="number"
                min={0}
                value={field.value}
                onChange={e => field.set(e.target.value)}
                className="avanti-input w-full text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              extend({
                days: parseInt(days, 10) || 0,
                hours: parseInt(hours, 10) || 0,
                minutes: parseInt(minutes, 10) || 0,
              })
            }
            className="col-span-3 avanti-btn avanti-btn-primary w-full mt-1"
          >
            Add{' '}
            {formatSubmissionWindow(
              submissionWindowToMinutes({
                days: parseInt(days, 10) || 0,
                hours: parseInt(hours, 10) || 0,
                minutes: parseInt(minutes, 10) || 0,
              })
            )}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-700 m-0">{error}</p>}
    </div>
  )
}
