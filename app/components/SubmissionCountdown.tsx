'use client'

import { useEffect, useState } from 'react'
import { countdownParts } from '@/lib/submission-window'

export function useCountdown(deadline: string | null) {
  const [parts, setParts] = useState(() => countdownParts(deadline))

  useEffect(() => {
    setParts(countdownParts(deadline))
    if (!deadline) return

    const id = setInterval(() => {
      setParts(countdownParts(deadline))
    }, 1000)

    return () => clearInterval(id)
  }, [deadline])

  return parts
}

type SubmissionCountdownProps = {
  deadline: string | null
  /** e.g. "Until voting opens" */
  label?: string
  /** Shown under the timer when window is active */
  hint?: string
  variant?: 'large' | 'compact' | 'inline'
  className?: string
}

function Unit({ value, unit, compact }: { value: number; unit: string; compact?: boolean }) {
  return (
    <div className="text-center">
      <div
        className={`font-serif tabular-nums text-forest-deep ${
          compact ? 'text-xl px-2 py-1' : 'text-3xl sm:text-4xl px-3 py-2 min-w-[3rem]'
        } avanti-box border border-border bg-card`}
      >
        {String(value).padStart(2, '0')}
      </div>
      <p className={`uppercase tracking-[0.18em] text-muted-foreground mt-1.5 m-0 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        {unit}
      </p>
    </div>
  )
}

export default function SubmissionCountdown({
  deadline,
  label = 'Time remaining',
  hint,
  variant = 'large',
  className = '',
}: SubmissionCountdownProps) {
  const { days, hours, minutes, seconds, done, label: fallbackLabel } = useCountdown(deadline)

  if (!deadline) return null

  if (done) {
    return (
      <div className={`text-center ${className}`}>
        <p className="eyebrow text-muted-foreground mb-1">{label}</p>
        <p className="font-serif text-lg text-muted-foreground m-0">Window closed</p>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <p className={`text-sm text-muted-foreground m-0 tabular-nums ${className}`}>
        {label}: <span className="text-forest-deep font-serif">{fallbackLabel}</span>
      </p>
    )
  }

  const showDays = days > 0

  return (
    <div className={`text-center ${className}`}>
      <p className="eyebrow text-muted-foreground mb-3">{label}</p>
      <div className={`flex justify-center gap-2 sm:gap-3 ${variant === 'compact' ? 'scale-90' : ''}`}>
        {showDays && <Unit value={days} unit="Days" compact={variant === 'compact'} />}
        <Unit value={hours} unit="Hours" compact={variant === 'compact'} />
        <Unit value={minutes} unit="Min" compact={variant === 'compact'} />
        <Unit value={seconds} unit="Sec" compact={variant === 'compact'} />
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-4 mb-0 max-w-sm mx-auto leading-relaxed">{hint}</p>}
    </div>
  )
}
