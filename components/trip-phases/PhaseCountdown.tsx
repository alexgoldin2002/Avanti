'use client'

import { useEffect, useState } from 'react'
import { countdownParts } from '@/lib/submission-window'
import type { PhaseAccessMode } from '@/lib/trip-phases/types'

type PhaseCountdownProps = {
  deadlineAt: string | null
  access: PhaseAccessMode
  label?: string
}

export default function PhaseCountdown({ deadlineAt, access, label = 'Time remaining' }: PhaseCountdownProps) {
  const [parts, setParts] = useState(() => countdownParts(deadlineAt))

  useEffect(() => {
    const tick = () => setParts(countdownParts(deadlineAt))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadlineAt])

  if (!deadlineAt || access === 'not_opened') return null

  const closed = access === 'expired' || access === 'view_only' && parts.done
  const urgent = !parts.done && parts.days === 0 && parts.hours < 6

  return (
    <div
      className={`avanti-box border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
        closed
          ? 'border-border bg-secondary/40'
          : urgent
          ? 'border-amber-300 bg-amber-50'
          : 'border-forest-deep/20 bg-forest-pale/40'
      }`}
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-1">{label}</p>
        <p className={`font-serif text-lg ${closed ? 'text-muted-foreground' : 'text-forest-deep'}`}>
          {parts.done ? 'Window closed' : parts.label}
        </p>
      </div>
      {!parts.done && access === 'active' && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Changes lock when the timer hits zero
        </span>
      )}
      {access === 'view_only' && !parts.done && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          View only — you already submitted
        </span>
      )}
    </div>
  )
}
