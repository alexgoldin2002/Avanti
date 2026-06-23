'use client'

import { useState } from 'react'
import { submitTripCardChoices } from '@/lib/voting/client-api'

type SubmitChoicesButtonProps = {
  tripId: string
  selectedCount: number
  requiredCount?: number
  alreadySubmitted?: boolean
  disabled?: boolean
  onSuccess?: (result: { votingRound: number | null; totalCards: number }) => void
}

export default function SubmitChoicesButton({
  tripId,
  selectedCount,
  requiredCount = 2,
  alreadySubmitted = false,
  disabled = false,
  onSuccess,
}: SubmitChoicesButtonProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = selectedCount === requiredCount && !disabled

  const handleClick = async () => {
    if (!canSubmit || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await submitTripCardChoices(tripId)
      onSuccess?.(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: '8px', marginBottom: '32px' }}>
      {error && (
        <p style={{ fontSize: '12px', color: '#a32d2d', textAlign: 'center', marginBottom: '12px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!canSubmit || busy}
        onClick={() => void handleClick()}
        style={{
          width: '100%',
          padding: '16px',
          border: 'none',
          background: 'var(--forest-deep)',
          color: '#fafaf8',
          fontSize: '10px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          cursor: canSubmit && !busy ? 'pointer' : 'not-allowed',
          opacity: canSubmit && !busy ? 1 : 0.5,
          fontFamily: 'var(--font-cormorant), Georgia, serif',
        }}
      >
        {busy
          ? 'Submitting…'
          : alreadySubmitted
            ? 'Update my trip card choices →'
            : 'Submit my trip card choices to the vote'}
      </button>
      {selectedCount !== requiredCount && (
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'center', marginTop: '10px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Select exactly {requiredCount} cards to submit ({selectedCount} selected)
        </p>
      )}
    </div>
  )
}
