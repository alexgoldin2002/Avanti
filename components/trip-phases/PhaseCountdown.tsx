'use client'

import { useEffect, useState } from 'react'
import { countdownParts } from '@/lib/submission-window'
import type { PhaseAccessMode } from '@/lib/trip-phases/types'

type PhaseCountdownProps = {
  deadlineAt: string | null
  access: PhaseAccessMode
  label?: string
  variant?: 'box' | 'inline'
  size?: 'sm' | 'lg' | 'xl'
}

export default function PhaseCountdown({
  deadlineAt,
  access,
  label = 'Time remaining',
  variant = 'inline',
  size = 'sm',
}: PhaseCountdownProps) {
  const [parts, setParts] = useState(() => countdownParts(deadlineAt))

  useEffect(() => {
    const tick = () => setParts(countdownParts(deadlineAt))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadlineAt])

  if (!deadlineAt || access === 'not_opened') return null

  const closed = access === 'expired' || (access === 'view_only' && parts.done)
  const urgent = !parts.done && parts.days === 0 && parts.hours < 6
  const display = parts.done ? 'Window closed' : parts.label

  if (variant === 'inline') {
    return (
      <span
        className={`font-serif tabular-nums ${
          size === 'xl' ? 'text-2xl sm:text-[28px]' : size === 'lg' ? 'text-xl' : 'text-sm'
        } ${
          closed ? 'text-muted-foreground' : urgent ? 'text-amber-900' : 'text-forest-deep'
        }`}
      >
        {display}
      </span>
    )
  }

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
          {display}
        </p>
      </div>
    </div>
  )
}
