'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { VotingResultsPayload } from '@/lib/voting/types'
import { fetchVotingResults, overrideTripDestination } from '@/lib/voting/client-api'

type RevealPhase = 'calculating' | 'drumroll' | 'revealed'

type DestinationRevealProps = {
  tripId: string
  initialResults?: VotingResultsPayload | null
}

function shortName(name: string): string {
  return name.split(',')[0]?.trim() || name
}

export default function DestinationReveal({ tripId, initialResults = null }: DestinationRevealProps) {
  const router = useRouter()
  const [results, setResults] = useState<VotingResultsPayload | null>(initialResults)
  const [phase, setPhase] = useState<RevealPhase>(initialResults?.ready ? 'drumroll' : 'calculating')
  const [error, setError] = useState<string | null>(null)
  const [showOverride, setShowOverride] = useState(false)
  const [overrideMode, setOverrideMode] = useState<'runners-up' | 'cards' | 'manual'>('runners-up')
  const [manualName, setManualName] = useState('')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [overrideBusy, setOverrideBusy] = useState(false)

  const winnerName = useMemo(() => {
    if (!results) return ''
    return results.winner?.destination_name || results.trip.destination || 'Your destination'
  }, [results])

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const poll = async () => {
      try {
        const json = await fetchVotingResults(tripId)
        if (cancelled) return
        setResults(json)
        setError(null)
        if (json.ready) {
          setPhase(prev => (prev === 'calculating' ? 'drumroll' : prev))
          return
        }
        attempts += 1
        if (attempts < 30) {
          window.setTimeout(() => void poll(), 2000)
        } else {
          setError('Still waiting on the group. Check back in a moment.')
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load results')
        }
      }
    }

    if (!initialResults?.ready) void poll()
    return () => {
      cancelled = true
    }
  }, [tripId, initialResults?.ready])

  useEffect(() => {
    if (phase !== 'drumroll') return
    const timer = window.setTimeout(() => setPhase('revealed'), 2800)
    return () => window.clearTimeout(timer)
  }, [phase])

  const runnersUp = useMemo(() => {
    if (!results?.tally.length) return []
    const winnerId = results.trip.winning_destination_id
    return results.tally.filter(t => t.destinationAnalysisId !== winnerId).slice(0, 2)
  }, [results])

  const handleOverride = async (destinationAnalysisId?: string, destinationName?: string) => {
    setOverrideBusy(true)
    try {
      await overrideTripDestination(tripId, { destinationAnalysisId, destinationName })
      const json = await fetchVotingResults(tripId)
      setResults(json)
      setShowOverride(false)
      setPhase('revealed')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Override failed')
    } finally {
      setOverrideBusy(false)
    }
  }

  if (error && !results?.ready) {
    return (
      <div className="avanti-box border border-border bg-card px-6 py-10 text-center">
        <p className="font-serif text-xl mb-2">Almost there</p>
        <p className="text-sm text-muted-foreground mb-6">{error}</p>
        <button type="button" onClick={() => router.push(`/trips/${tripId}/vote`)} className="avanti-btn">
          Back to voting →
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <style jsx>{`
        @keyframes revealPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes revealPop {
          0% { opacity: 0; transform: translateY(12px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        .reveal-pop {
          animation: revealPop 0.9s ease-out forwards;
        }
        .reveal-pulse {
          animation: revealPulse 1.8s ease-in-out infinite;
        }
        .dot-1 { animation: dotBounce 1.2s infinite 0s; }
        .dot-2 { animation: dotBounce 1.2s infinite 0.15s; }
        .dot-3 { animation: dotBounce 1.2s infinite 0.3s; }
      `}</style>

      <div className="avanti-box border border-forest-deep/20 bg-gradient-to-b from-forest-pale/80 to-card overflow-hidden">
        <div className="px-6 sm:px-10 py-14 sm:py-20 text-center min-h-[320px] flex flex-col items-center justify-center">
          {phase === 'calculating' && (
            <>
              <p className="eyebrow text-forest mb-4">Round 2 complete</p>
              <p className="font-serif text-2xl sm:text-3xl text-forest-deep mb-6 reveal-pulse">
                Tallying the group&apos;s votes…
              </p>
              <div className="flex gap-2 mb-6" aria-hidden>
                <span className="w-2 h-2 rounded-full bg-forest-deep dot-1" />
                <span className="w-2 h-2 rounded-full bg-forest-deep dot-2" />
                <span className="w-2 h-2 rounded-full bg-forest-deep dot-3" />
              </div>
              {results?.roundTwoStatus && results.roundTwoStatus.submitted < results.roundTwoStatus.eligible && (
                <p className="text-sm text-muted-foreground max-w-md">
                  {results.roundTwoStatus.submitted} of {results.roundTwoStatus.eligible} travelers have submitted.
                  {results.roundTwoStatus.pendingNicknames?.length
                    ? ` Waiting on ${results.roundTwoStatus.pendingNicknames.join(', ')}.`
                    : ''}
                </p>
              )}
            </>
          )}

          {phase === 'drumroll' && (
            <>
              <p className="eyebrow text-forest mb-4">And the winner is</p>
              <p className="font-serif text-xl sm:text-2xl text-muted-foreground mb-3 italic">
                {results?.trip.name || 'Your trip'} is going to…
              </p>
              <p className="font-serif text-4xl sm:text-5xl text-forest-deep reveal-pulse">✦</p>
            </>
          )}

          {phase === 'revealed' && (
            <div className="reveal-pop w-full">
              <p className="eyebrow text-forest mb-3">Destination locked</p>
              <p className="font-serif text-xl sm:text-2xl text-muted-foreground mb-2 italic">
                {results?.trip.name || 'Your trip'} is going to
              </p>
              <p className="font-serif text-4xl sm:text-6xl text-forest-deep leading-tight mb-6">
                {shortName(winnerName)}
              </p>
              {results?.tally?.length ? (
                <div className="max-w-md mx-auto text-left space-y-3 mb-8">
                  {results.tally.slice(0, 3).map((entry, index) => (
                    <div key={entry.destinationAnalysisId}>
                      <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        <span>{index + 1}. {shortName(entry.destinationName)}</span>
                        <span>{entry.averagePercentage}% avg</span>
                      </div>
                      <div className="h-2 bg-forest-mist/60 overflow-hidden">
                        <div
                          className="h-full bg-forest-deep transition-all duration-700"
                          style={{ width: `${Math.min(100, entry.averagePercentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => router.push(`/trips/${tripId}/flights`)}
                className="avanti-btn avanti-btn-primary"
              >
                Plan flights →
              </button>
            </div>
          )}
        </div>
      </div>

      {phase === 'revealed' && results?.isOrganizer && (
        <div className="mt-8 text-center">
          {!showOverride ? (
            <button
              type="button"
              onClick={() => setShowOverride(true)}
              className="text-xs uppercase tracking-wider text-muted-foreground underline underline-offset-4 bg-transparent border-0 cursor-pointer"
            >
              Override the decision
            </button>
          ) : (
            <div className="avanti-box border border-border bg-card px-5 py-6 text-left max-w-lg mx-auto">
              <p className="eyebrow text-muted-foreground mb-2">Override destination</p>
              <p className="text-sm text-muted-foreground mb-4">
                Pick a runner-up, choose from earlier voting cards, or enter a place manually.
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {(['runners-up', 'cards', 'manual'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setOverrideMode(mode)}
                    className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border ${
                      overrideMode === mode
                        ? 'border-forest-deep bg-forest-pale text-forest-deep'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {mode === 'runners-up' ? '2nd & 3rd' : mode === 'cards' ? 'All cards' : 'Manual'}
                  </button>
                ))}
              </div>

              {overrideMode === 'runners-up' && (
                <div className="space-y-2 mb-4">
                  {runnersUp.length ? runnersUp.map(entry => (
                    <button
                      key={entry.destinationAnalysisId}
                      type="button"
                      disabled={overrideBusy}
                      onClick={() => void handleOverride(entry.destinationAnalysisId)}
                      className="w-full text-left border border-border px-3 py-2 hover:border-forest-deep transition text-sm"
                    >
                      {entry.destinationName}
                      <span className="text-muted-foreground ml-2">({entry.averagePercentage}% avg)</span>
                    </button>
                  )) : (
                    <p className="text-sm text-muted-foreground">No runner-up options yet.</p>
                  )}
                </div>
              )}

              {overrideMode === 'cards' && (
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {results.allVotingCards.map(card => (
                    <label key={card.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="override-card"
                        checked={selectedCardId === card.id}
                        onChange={() => setSelectedCardId(card.id)}
                      />
                      {card.destination_name}
                    </label>
                  ))}
                  <button
                    type="button"
                    disabled={!selectedCardId || overrideBusy}
                    onClick={() => selectedCardId && void handleOverride(selectedCardId)}
                    className="avanti-btn avanti-btn-primary w-full mt-2 disabled:opacity-50"
                  >
                    Use selected card
                  </button>
                </div>
              )}

              {overrideMode === 'manual' && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="e.g. Amalfi Coast, Italy"
                    className="w-full border-b border-border bg-transparent py-2 text-sm outline-none font-serif mb-3"
                  />
                  <button
                    type="button"
                    disabled={!manualName.trim() || overrideBusy}
                    onClick={() => void handleOverride(undefined, manualName.trim())}
                    className="avanti-btn avanti-btn-primary w-full disabled:opacity-50"
                  >
                    Set manual destination
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowOverride(false)}
                className="text-xs text-muted-foreground underline bg-transparent border-0 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'revealed' && results && !results.isOrganizer && (
        <p className="text-center text-xs text-muted-foreground mt-6">
          The organizer can override this decision if needed.
        </p>
      )}
    </div>
  )
}
