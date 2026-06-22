'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_WEIGHTS,
  WEIGHT_LABELS,
  weightsTotal,
  type InterestWeights,
} from '@/lib/destination-decision/voting-display'

type InterestWeightsProps = {
  value: InterestWeights
  onChange: (weights: InterestWeights) => void
  onSave: () => void
  saving?: boolean
  saved?: boolean
  disabled?: boolean
}

export default function InterestWeights({
  value,
  onChange,
  onSave,
  saving = false,
  saved = false,
  disabled = false,
}: InterestWeightsProps) {
  const [local, setLocal] = useState(value)
  const total = weightsTotal(local)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const setKey = (key: keyof InterestWeights, n: number) => {
    const next = { ...local, [key]: Math.max(0, Math.min(100, n)) }
    setLocal(next)
    onChange(next)
  }

  return (
    <div className="border-t border-border pt-8 mt-8">
      <p className="font-serif text-xl text-foreground mb-1">My weight of interest levels</p>
      <p className="text-sm text-muted-foreground mb-6">
        How much each row matters to you — must add up to 100%.
      </p>

      <div className="flex flex-wrap items-end justify-center gap-2 sm:gap-3 mb-4">
        {WEIGHT_LABELS.map(({ key, label }, i) => (
          <div key={key} className="flex items-end gap-2 sm:gap-3">
            <div className="text-center min-w-[72px] sm:min-w-[88px]">
              <label className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] text-muted-foreground block mb-2 leading-tight">
                {label}
              </label>
              <div className="avanti-box border border-border bg-card px-2 py-3">
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={disabled}
                  value={local[key]}
                  onChange={e => setKey(key, parseInt(e.target.value, 10) || 0)}
                  className="w-full text-center font-serif text-xl sm:text-2xl text-forest-deep bg-transparent border-none outline-none tabular-nums"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            </div>
            {i < WEIGHT_LABELS.length - 1 && (
              <span className="text-lg text-muted-foreground pb-4 hidden sm:inline">+</span>
            )}
          </div>
        ))}
        <div className="flex items-end gap-2 pb-1 pl-1">
          <span className="text-lg text-muted-foreground hidden sm:inline">=</span>
          <div className="text-center min-w-[64px]">
            <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-2">Total</p>
            <p
              className={`font-serif text-2xl tabular-nums ${
                total === 100 ? 'text-forest-deep' : 'text-red-600'
              }`}
            >
              {total}%
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          disabled={disabled || saving || total !== 100}
          onClick={onSave}
          className="avanti-btn avanti-btn-primary"
        >
          {saving ? 'Saving…' : saved ? 'Weights saved ✓' : 'Save my weights →'}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setLocal({ ...DEFAULT_WEIGHTS })
            onChange({ ...DEFAULT_WEIGHTS })
          }}
          className="avanti-btn avanti-btn-ghost text-sm"
        >
          Reset to even split
        </button>
      </div>
      {total !== 100 && (
        <p className="text-xs text-red-600 text-center mt-3 mb-0">
          Adjust the percentages so they total exactly 100%.
        </p>
      )}
    </div>
  )
}
