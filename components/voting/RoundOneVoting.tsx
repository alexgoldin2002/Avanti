'use client'

import { useCallback, useMemo, useState } from 'react'
import type { DestinationAnalysisRow } from '@/lib/voting/types'
import RoundOneCard from '@/components/voting/RoundOneCard'

type RoundOneVotingProps = {
  tripId: string
  destinations: DestinationAnalysisRow[]
  initialRanks?: Record<string, number>
  onSubmit: (votes: Array<{ destinationAnalysisId: string; rank: number }>) => Promise<void>
  submitting?: boolean
  readOnly?: boolean
}

function sortByInitialRanks(
  destinations: DestinationAnalysisRow[],
  initialRanks: Record<string, number>
): DestinationAnalysisRow[] {
  if (!Object.keys(initialRanks).length) return destinations
  return [...destinations].sort((a, b) => {
    const ra = initialRanks[a.id] ?? 999
    const rb = initialRanks[b.id] ?? 999
    return ra - rb
  })
}

function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return list
  const next = [...list]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export default function RoundOneVoting({
  tripId,
  destinations,
  initialRanks = {},
  onSubmit,
  submitting = false,
  readOnly = false,
}: RoundOneVotingProps) {
  const [ordered, setOrdered] = useState<DestinationAnalysisRow[]>(() =>
    sortByInitialRanks(destinations, initialRanks)
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const rankById = useMemo(() => {
    const map: Record<string, number> = {}
    ordered.forEach((d, i) => {
      map[d.id] = i + 1
    })
    return map
  }, [ordered])

  const handleDragStart = useCallback((id: string) => (e: React.DragEvent) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const handleDragOver = useCallback((id: string) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }, [])

  const handleDrop = useCallback(
    (targetId: string) => (e: React.DragEvent) => {
      e.preventDefault()
      const sourceId = e.dataTransfer.getData('text/plain') || draggingId
      if (!sourceId || sourceId === targetId) {
        setDraggingId(null)
        setDragOverId(null)
        return
      }
      const fromIndex = ordered.findIndex(d => d.id === sourceId)
      const toIndex = ordered.findIndex(d => d.id === targetId)
      if (fromIndex === -1 || toIndex === -1) return
      setOrdered(reorderList(ordered, fromIndex, toIndex))
      setDraggingId(null)
      setDragOverId(null)
    },
    [draggingId, ordered]
  )

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setDragOverId(null)
  }, [])

  const handleSubmit = async () => {
    const payload = ordered.map((d, index) => ({
      destinationAnalysisId: d.id,
      rank: index + 1,
    }))
    await onSubmit(payload)
  }

  return (
    <div className="pb-28">
      <div className="avanti-box border border-forest-deep/20 bg-forest-pale px-5 py-4 mb-8">
        <p className="font-serif text-lg text-forest-deep m-0 mb-1">Round 1 — Rank your choices</p>
        <p className="text-sm text-muted-foreground m-0">
          Drag destinations to reorder. <strong>1</strong> is your top choice.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ordered.map(d => (
          <div
            key={d.id}
            className="h-full min-h-0"
            onDragOver={readOnly ? undefined : handleDragOver(d.id)}
            onDrop={readOnly ? undefined : handleDrop(d.id)}
            onDragLeave={readOnly ? undefined : () => setDragOverId(null)}
            style={{
              opacity: draggingId === d.id ? 0.5 : 1,
              outline: dragOverId === d.id && draggingId !== d.id ? '2px solid var(--forest-deep)' : 'none',
              outlineOffset: '2px',
              borderRadius: '2px',
              transition: 'opacity 0.15s',
            }}
          >
            <RoundOneCard
              destination={d}
              rank={rankById[d.id]}
              tripId={tripId}
              dragProps={
                readOnly
                  ? undefined
                  : {
                      draggable: true,
                      onDragStart: handleDragStart(d.id),
                      onDragEnd: handleDragEnd,
                    }
              }
            />
          </div>
        ))}
      </div>

      {!readOnly && (
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-border bg-card px-6 py-4 z-40"
        style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.06)' }}
      >
        <div className="mx-auto max-w-6xl">
          <button
            type="button"
            disabled={ordered.length === 0 || submitting}
            onClick={() => void handleSubmit()}
            className="avanti-btn avanti-btn-primary w-full disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Round 1 Rankings'}
          </button>
        </div>
      </div>
      )}
    </div>
  )
}
