'use client'

import { useMemo, useState } from 'react'
import type { DestinationAnalysisRow, RoundTwoPersonalContent } from '@/lib/voting/types'
import { GroupDestinationCard, PLACEHOLDER_ROUND_TWO_PERSONAL } from '@/components/voting/DestinationCard'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'

type RoundTwoVotingProps = {
  tripId: string
  destinations: DestinationAnalysisRow[]
  personalizedByDest?: Record<string, RoundTwoPersonalContent>
  initialAllocations?: Record<string, number>
  onSubmit: (allocations: Array<{ destinationAnalysisId: string; percentage: number }>) => Promise<void>
  submitting?: boolean
}

function shortDestinationName(name: string): string {
  const parts = name.split(',').map(s => s.trim())
  return parts[0] || name
}

export default function RoundTwoVoting({
  tripId,
  destinations,
  personalizedByDest = {},
  initialAllocations = {},
  onSubmit,
  submitting = false,
}: RoundTwoVotingProps) {
  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const d of destinations) {
      init[d.id] = initialAllocations[d.id] ?? 0
    }
    return init
  })

  const total = useMemo(
    () => Object.values(allocations).reduce((sum, n) => sum + n, 0),
    [allocations]
  )
  const remaining = 100 - total
  const canSubmit = total === 100 && destinations.length > 0

  const setAllocation = (id: string, value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)))
    setAllocations(prev => ({ ...prev, [id]: clamped }))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    await onSubmit(
      destinations.map(d => ({
        destinationAnalysisId: d.id,
        percentage: allocations[d.id] || 0,
      }))
    )
  }

  return (
    <div className="pb-28">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,320px)_1fr] gap-6 lg:gap-8 items-start">
        {/* Allocation sidebar — stays visible beside the cards */}
        <aside className="avanti-box border border-forest-deep/25 bg-card lg:sticky lg:top-4 z-10">
          <div className="border-b border-border px-5 py-4 bg-forest-pale/60">
            <p className="font-serif text-lg text-forest-deep m-0 mb-1">Your percentages</p>
            <p className="text-sm text-muted-foreground m-0">
              Split <strong>100%</strong> across destinations — higher % means you want to go there more.
            </p>
          </div>

          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Remaining</span>
              <span
                className="font-serif text-3xl tabular-nums"
                style={{ color: remaining === 0 ? 'var(--forest-deep)' : remaining < 0 ? '#a32d2d' : '#1a1a1a' }}
              >
                {remaining}%
              </span>
            </div>
            <div className="h-2 bg-forest-mist rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-200 rounded-full"
                style={{
                  width: `${Math.min(100, total)}%`,
                  background: total === 100 ? 'var(--forest-deep)' : total > 100 ? '#a32d2d' : '#6b9080',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 mb-0">
              {total}% allocated · must total exactly 100% to submit
            </p>
          </div>

          <ul className="list-none m-0 p-0 divide-y divide-border">
            {destinations.map(d => {
              const pct = allocations[d.id] || 0
              return (
                <li key={d.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-serif text-foreground m-0 truncate">
                      {shortDestinationName(d.destination_name)}
                    </p>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={e => setAllocation(d.id, Number(e.target.value))}
                      className="w-full mt-2"
                      aria-label={`Percentage for ${d.destination_name}`}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={e => setAllocation(d.id, Number(e.target.value))}
                      className="avanti-input w-14 text-center tabular-nums px-1"
                      aria-label={`Percentage for ${d.destination_name}`}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Destination cards */}
        <div className="flex flex-col gap-8 min-w-0">
          <div className="avanti-box border border-forest-deep/20 bg-forest-pale px-5 py-4 lg:hidden">
            <p className="font-serif text-lg text-forest-deep m-0 mb-1">Round 2 — Final vote</p>
            <p className="text-sm text-muted-foreground m-0">
              Use the panel above to assign percentages, then review each destination below.
            </p>
          </div>

          {destinations.map(d => {
            const personal = personalizedByDest[d.id] || PLACEHOLDER_ROUND_TWO_PERSONAL
            const card = (d.card_snapshot || {}) as ParsedDestinationCard
            const pct = allocations[d.id] || 0
            return (
              <section key={d.id} className="avanti-box border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-forest-mist/30">
                  <p className="font-serif text-lg text-forest-deep m-0 truncate">
                    {d.destination_name}
                  </p>
                  <span className="text-sm tabular-nums text-forest-deep font-serif shrink-0">
                    Your vote: {pct}%
                  </span>
                </div>
                <GroupDestinationCard card={{ ...card, name: d.destination_name }} tripId={tripId} hideMap />
                <div className="border-t border-border px-5 py-5 bg-forest-mist/40">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <p className="eyebrow text-forest m-0">Personalized for you</p>
                    <span className="text-xs tracking-wider uppercase text-forest-deep font-serif">
                      Match: {personal.fit_score}/10
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-3">{personal.personal_fit_summary}</p>
                  <ul className="text-sm text-muted-foreground space-y-1 mb-3 list-none p-0 m-0">
                    {personal.top_picks_for_you.map(item => (
                      <li key={item}>— {item}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 m-0">
                    {personal.watch_out_for}
                  </p>
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 border-t border-border bg-card px-6 py-4 z-40"
        style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.06)' }}
      >
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-muted-foreground m-0 hidden sm:block">
            {canSubmit ? 'Ready to submit' : `${remaining}% still to assign`}
          </p>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => void handleSubmit()}
            className="avanti-btn avanti-btn-primary w-full sm:w-auto sm:min-w-[280px] disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Round 2 Votes'}
          </button>
        </div>
      </div>
    </div>
  )
}
