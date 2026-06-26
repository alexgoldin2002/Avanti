'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DestinationAnalysisRow, RoundTwoPersonalContent } from '@/lib/voting/types'
import { buildFallbackRoundTwoPersonalContent } from '@/lib/voting/step2-preferences'
import { GroupDestinationCard } from '@/components/voting/DestinationCard'
import { fetchPersonalizedPanel } from '@/lib/voting/client-api'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'

type RoundTwoVotingProps = {
  tripId: string
  destinations: DestinationAnalysisRow[]
  personalizedByDest?: Record<string, RoundTwoPersonalContent>
  initialAllocations?: Record<string, number>
  onSubmit: (allocations: Array<{ destinationAnalysisId: string; percentage: number }>) => Promise<void>
  submitting?: boolean
  readOnly?: boolean
}

function shortDestinationName(name: string): string {
  const parts = name.split(',').map(s => s.trim())
  return parts[0] || name
}

/** Compact labels for the split-% row — numbered when routes share a first city or span multiple stops. */
function splitVoteLabels(names: string[]): string[] {
  if (names.length <= 1) return names.map(shortDestinationName)

  const shortNames = names.map(shortDestinationName)
  const shortNamesCollide = new Set(shortNames).size !== shortNames.length
  const hasMultiStop = names.some(name => name.includes(' · '))

  if (!shortNamesCollide && !hasMultiStop) return shortNames

  return names.map((_, index) => `Option ${index + 1}`)
}

export default function RoundTwoVoting({
  tripId,
  destinations,
  personalizedByDest = {},
  initialAllocations = {},
  onSubmit,
  submitting = false,
  readOnly = false,
}: RoundTwoVotingProps) {
  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const d of destinations) {
      init[d.id] = initialAllocations[d.id] ?? 0
    }
    return init
  })
  const [personalPanels, setPersonalPanels] = useState<Record<string, RoundTwoPersonalContent>>(
    () => ({ ...personalizedByDest })
  )

  useEffect(() => {
    setPersonalPanels({ ...personalizedByDest })
  }, [personalizedByDest])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      for (const d of destinations) {
        try {
          const content = await fetchPersonalizedPanel(tripId, d.id)
          if (!cancelled) {
            setPersonalPanels(prev => ({ ...prev, [d.id]: content }))
          }
        } catch {
          /* keep instant fallback from GET */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tripId, destinations])

  const total = useMemo(
    () => Object.values(allocations).reduce((sum, n) => sum + n, 0),
    [allocations]
  )
  const splitLabels = useMemo(
    () => splitVoteLabels(destinations.map(d => d.destination_name)),
    [destinations]
  )
  const useNumberedOptions = splitLabels.some(label => label.startsWith('Option '))
  const remaining = 100 - total
  const canSubmit = total === 100 && destinations.length > 0

  const setAllocation = (id: string, raw: string) => {
    if (raw === '') {
      setAllocations(prev => ({ ...prev, [id]: 0 }))
      return
    }
    const n = Number(raw)
    if (Number.isNaN(n)) return
    setAllocations(prev => ({ ...prev, [id]: Math.max(0, Math.min(100, Math.round(n))) }))
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
      <div className="avanti-box border border-forest-deep/25 bg-card mb-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 border-b border-border bg-forest-pale/50">
          <p className="font-serif text-base text-forest-deep m-0">Round 2 — split 100%</p>
          <p
            className="text-sm tabular-nums m-0 font-serif"
            style={{ color: remaining === 0 ? 'var(--forest-deep)' : remaining < 0 ? '#a32d2d' : '#6a6a6a' }}
          >
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2">Left</span>
            {remaining}%
          </p>
        </div>

        <div className="px-4 py-4 flex flex-wrap gap-3">
          {destinations.map((d, index) => (
            <label
              key={d.id}
              className="flex flex-col gap-1 min-w-[88px] max-w-[140px] flex-1"
              style={{ flexBasis: '88px' }}
            >
              <span className="text-[11px] text-muted-foreground truncate leading-tight" title={d.destination_name}>
                {splitLabels[index]}
              </span>
              <div className="flex items-center border border-border bg-white focus-within:border-forest-deep">
                <input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={allocations[d.id] || 0}
                  onChange={e => setAllocation(d.id, e.target.value)}
                  disabled={readOnly}
                  className="w-full min-w-0 border-0 bg-transparent px-2 py-1.5 text-sm text-center tabular-nums outline-none font-serif disabled:opacity-70"
                  aria-label={`Percent for ${splitLabels[index]}: ${d.destination_name}`}
                />
                <span className="text-[10px] text-muted-foreground pr-2 shrink-0">%</span>
              </div>
            </label>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground px-4 pb-3 m-0">
          {total}% assigned · must total 100% to submit
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {destinations.map((d, index) => {
          const personal = personalPanels[d.id] || buildFallbackRoundTwoPersonalContent(
            d.destination_name,
            null,
            d.card_snapshot as Record<string, unknown> | null
          )
          const card = (d.card_snapshot || {}) as ParsedDestinationCard
          return (
            <section key={d.id} className="avanti-box border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-forest-mist/30">
                <p className="font-serif text-lg text-forest-deep m-0 truncate">
                  {useNumberedOptions && (
                    <span className="inline-flex items-center justify-center min-w-[1.35rem] h-[1.35rem] mr-2 px-1 text-[11px] font-sans font-semibold tracking-wide text-forest-deep bg-forest-pale border border-forest-deep/20 align-middle">
                      {index + 1}
                    </span>
                  )}
                  {d.destination_name}
                </p>
              </div>
              <GroupDestinationCard card={{ ...card, name: d.destination_name }} tripId={tripId} />
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

      {!readOnly && (
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
            {submitting ? 'Submitting…' : 'Submit votes'}
          </button>
        </div>
      </div>
      )}
    </div>
  )
}
