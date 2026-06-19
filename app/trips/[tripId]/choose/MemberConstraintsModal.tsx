'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  tripId: string
  travelerId: string
  initialDeparture: string
  initialBudget: string
  onComplete: () => void
}

export default function MemberConstraintsModal({
  tripId,
  travelerId,
  initialDeparture,
  initialBudget,
  onComplete,
}: Props) {
  const [departure, setDeparture] = useState(initialDeparture)
  const [budget, setBudget] = useState(initialBudget)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!departure.trim()) return
    setSaving(true)
    const { data: traveler } = await supabase
      .from('travelers')
      .select('step2')
      .eq('id', travelerId)
      .single()

    const step2 = (traveler?.step2 as Record<string, unknown>) || {}
    await supabase
      .from('travelers')
      .update({
        departure_city: departure.trim(),
        step2: {
          ...step2,
          departureCity: departure.trim(),
          budget: budget.trim() || step2.budget,
        },
      })
      .eq('id', travelerId)

    setSaving(false)
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="avanti-box max-w-md w-full bg-card border border-border p-6">
        <p className="font-serif text-xl mb-1">Your trip details</p>
        <p className="text-sm text-muted-foreground mb-5">
          We need your departure city and budget so Avanti can personalize costs before you vote.
        </p>
        <label className="block mb-4">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Departure city</span>
          <input
            className="avanti-input w-full mt-1"
            value={departure}
            onChange={e => setDeparture(e.target.value)}
            placeholder="e.g. New York, NY"
          />
        </label>
        <label className="block mb-6">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget ceiling (optional)</span>
          <input
            className="avanti-input w-full mt-1"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            placeholder="e.g. $2500 all-in"
          />
        </label>
        <button
          type="button"
          disabled={saving || !departure.trim()}
          onClick={save}
          className="avanti-btn avanti-btn-primary w-full"
        >
          {saving ? 'Saving…' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
