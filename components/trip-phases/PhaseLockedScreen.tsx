'use client'

import type { PhaseSnapshot } from '@/lib/trip-phases/types'

type PhaseLockedScreenProps = {
  phase: PhaseSnapshot
  backHref: string
  backLabel?: string
}

export default function PhaseLockedScreen({
  phase,
  backHref,
  backLabel = 'Back to trip',
}: PhaseLockedScreenProps) {
  return (
    <div className="avanti-box border border-border bg-card px-6 py-12 text-center max-w-lg mx-auto">
      <p className="eyebrow text-muted-foreground mb-2">{phase.label}</p>
      <p className="font-serif text-2xl text-forest-deep mb-3">
        {phase.access === 'not_opened' ? 'Not open yet' : 'This stage is closed'}
      </p>
      <p className="text-sm text-muted-foreground mb-8">{phase.statusNote}</p>
      <a href={backHref} className="avanti-btn">
        {backLabel} →
      </a>
    </div>
  )
}
