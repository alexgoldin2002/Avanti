'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import MemberConstraintsModal from './MemberConstraintsModal'
import VotingComparisonGrid from './VotingComparisonGrid'
import InterestWeights from './InterestWeights'
import {
  columnsForVoting,
  DEFAULT_WEIGHTS,
  normalizeWeights,
  type InterestWeights as Weights,
} from '@/lib/destination-decision/voting-display'
import type { FlightToggle, DateToggle } from '@/lib/destination-decision/types'
import {
  fetchDecision,
  suggestDestination,
  closeSubmissions,
  retryAnalysis,
  submitMetaVote,
  submitOptionVote,
  submitConfirmation,
  lockDestination,
  openVotingNow,
  timeLeft,
  TIER_LABELS,
  STATUS_HEADINGS,
} from '@/lib/destination-decision/client-api'
import SubmissionCountdown from '../../../components/SubmissionCountdown'
import ExtendSubmissionWindow from '../../../components/ExtendSubmissionWindow'

type DecisionPayload = Awaited<ReturnType<typeof fetchDecision>>

export default function ChooseDestinationPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DecisionPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [suggestName, setSuggestName] = useState('')
  const [suggestNote, setSuggestNote] = useState('')
  const [localVotes, setLocalVotes] = useState<Record<string, {
    toggles: { flight: FlightToggle; dates: DateToggle }
    desire_score?: number
    approved?: boolean
    private_max?: boolean
  }>>({})
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS })
  const [weightsSaved, setWeightsSaved] = useState(false)
  const [constraintsDone, setConstraintsDone] = useState(false)
  const [confirmMaxCost, setConfirmMaxCost] = useState('')
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const loadAbortRef = useRef<AbortController | null>(null)
  const loadRequestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current
    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller

    try {
      let payload = await fetchDecision(tripId, { signal: controller.signal })
      if (requestId !== loadRequestIdRef.current) return

      if (!payload.trip) {
        const { data: tripRow } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .maybeSingle()
        if (tripRow) {
          payload = { ...payload, trip: tripRow }
        }
      }

      setData(payload)
      setError(null)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      if (requestId !== loadRequestIdRef.current) return
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false)
      }
    }
  }, [tripId])

  useEffect(() => {
    void load()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 30000)
    return () => {
      clearInterval(interval)
      loadAbortRef.current?.abort()
    }
  }, [load])

  useEffect(() => {
    if (!data?.analysisProgress) return
    const { done, total } = data.analysisProgress
    if (data.decision?.status !== 'analyzing' || total === 0 || done < total) return

    void load()
    const fast = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 5000)
    return () => clearInterval(fast)
  }, [data?.decision?.status, data?.analysisProgress?.done, data?.analysisProgress?.total, load])

  useEffect(() => {
    if (!data?.options?.length) return
    setLocalVotes(prev => {
      const next = { ...prev }
      for (const o of data.options) {
        if (!next[o.id]) {
          next[o.id] = {
            toggles: {
              flight: (o.myVote?.toggles?.flight as FlightToggle) || 'one_stop',
              dates: (o.myVote?.toggles?.dates as DateToggle) || 'best',
            },
            desire_score: o.myVote?.desire_score ?? undefined,
            approved: o.myVote?.approved ?? undefined,
            private_max: o.myVote?.private_max ?? undefined,
          }
        }
      }
      return next
    })
  }, [data?.options])

  useEffect(() => {
    const w = data?.myMetaVote?.weights as Partial<Weights> | undefined
    if (w) {
      setWeights(normalizeWeights(w))
      setWeightsSaved(true)
    }
  }, [data?.myMetaVote])

  const decision = data?.decision
  const status = decision?.status || 'draft'
  const options = data?.options || []
  const isOrganizer = data?.isOrganizer
  const submissionDeadline = decision?.submission_deadline ?? null
  const votingOpen = ['meta_vote', 'voting', 'results', 'confirming', 'locked'].includes(status)
  const waitingForVoting = !votingOpen
  const submissionWindowOpen =
    !!submissionDeadline && new Date(submissionDeadline) > new Date()
  const canExtendWindow =
    isOrganizer && ['draft', 'suggestions_open', 'analyzing'].includes(status)
  const analysisComplete =
    status === 'analyzing' &&
    !!data?.analysisProgress &&
    data.analysisProgress.total > 0 &&
    data.analysisProgress.done >= data.analysisProgress.total

  const ranked = data?.rankedOptions || []
  const votingColumns = columnsForVoting(options)

  const handleSuggest = async () => {
    if (!decision?.id || !suggestName.trim()) return
    setBusy(true)
    try {
      await suggestDestination(decision.id, suggestName.trim(), suggestNote.trim())
      setSuggestName('')
      setSuggestNote('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveWeights = async () => {
    if (!decision?.id) return
    setBusy(true)
    try {
      await submitMetaVote(decision.id, { weights })
      setWeightsSaved(true)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save weights')
    } finally {
      setBusy(false)
    }
  }

  const persistVote = useCallback((
    optionId: string,
    patch: Partial<{ desireScore: number; approved: boolean }>,
    reload = false
  ) => {
    const local = localVotes[optionId]
    const opt = options.find(o => o.id === optionId)
    const payload = {
      optionId,
      desireScore: patch.desireScore ?? local?.desire_score ?? opt?.myVote?.desire_score ?? undefined,
      approved: patch.approved ?? local?.approved ?? opt?.myVote?.approved ?? undefined,
      toggles: local?.toggles ?? opt?.myVote?.toggles ?? { flight: 'one_stop', dates: 'best' },
      privateMax: local?.private_max ?? opt?.myVote?.private_max ?? false,
    }

    if (saveTimers.current[optionId]) clearTimeout(saveTimers.current[optionId])
    saveTimers.current[optionId] = setTimeout(async () => {
      try {
        await submitOptionVote(payload)
        if (reload) await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save vote')
      }
    }, 300)
  }, [options, localVotes, load])

  const updateVote = (
    optionId: string,
    patch: { desireScore?: number; approved?: boolean }
  ) => {
    setLocalVotes(prev => {
      const cur = prev[optionId] || {
        toggles: { flight: 'one_stop' as FlightToggle, dates: 'best' as DateToggle },
      }
      return {
        ...prev,
        [optionId]: {
          ...cur,
          ...(patch.desireScore !== undefined ? { desire_score: patch.desireScore } : {}),
          ...(patch.approved !== undefined ? { approved: patch.approved } : {}),
        },
      }
    })
    persistVote(optionId, patch, false)
  }

  const handleConfirm = async (confirmed: boolean) => {
    if (!decision?.id) return
    setBusy(true)
    try {
      const max = confirmMaxCost.trim() ? parseFloat(confirmMaxCost.replace(/[^0-9.]/g, '')) : undefined
      await submitConfirmation(decision.id, confirmed, max)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const handleLock = async (optionId: string) => {
    if (!decision?.id) return
    setBusy(true)
    try {
      await lockDestination(decision.id, optionId)
      await load()
      router.push(`/trips/${tripId}/flights`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <SuitcaseLoader message="Loading destination decision" />

  if (!data?.trip) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} backLabel="Trip" title="Choose destination">
        {error ? (
          <div className="avanti-box border border-red-200 bg-red-50 px-4 py-6 text-center">
            <p className="text-sm text-red-800 mb-4">{error}</p>
            <button type="button" onClick={() => { setLoading(true); void load() }} className="avanti-btn avanti-btn-primary">
              Try again
            </button>
          </div>
        ) : (
          <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
            <p className="font-serif text-lg text-foreground mb-2">Couldn&apos;t load this trip</p>
            <p className="text-sm text-muted-foreground mb-4">
              You may not have access, or Step 2 hasn&apos;t been started yet.
            </p>
            <button type="button" onClick={() => router.push(`/trips/${tripId}`)} className="avanti-btn avanti-btn-primary">
              Back to trip dashboard →
            </button>
          </div>
        )}
      </SubpageShell>
    )
  }

  const analysisProgress = data.analysisProgress ?? { done: 0, total: 0 }

  const heading = STATUS_HEADINGS[status] || 'Choose destination'
  const deadline =
    status === 'suggestions_open'
      ? decision?.submission_deadline
      : ['meta_vote', 'voting'].includes(status)
        ? decision?.voting_deadline
        : status === 'confirming'
          ? decision?.confirm_deadline
          : null

  const canVote = data?.canVote !== false
  const showVotingMatrix = ['meta_vote', 'voting'].includes(status) && votingColumns.length > 0
  const winnerId = decision?.winner_option_id || ranked[0]?.id

  const myTraveler = data.myTravelerId
    ? data.travelers?.find((t: { id: string }) => t.id === data.myTravelerId)
    : null
  const needsConstraints =
    !constraintsDone &&
    myTraveler &&
    !myTraveler.departure_city &&
    !(myTraveler.step2 as { departureCity?: string } | undefined)?.departureCity &&
    ['meta_vote', 'voting'].includes(status)

  const gridVotes = Object.fromEntries(
    votingColumns.map(col => [
      col.id,
      {
        desire_score: localVotes[col.id]?.desire_score,
        approved: localVotes[col.id]?.approved,
      },
    ])
  )

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={data.trip.name}
      title={heading}
      subtitle={
        deadline
          ? timeLeft(deadline) || undefined
          : status === 'analyzing'
            ? `${analysisProgress.done} / ${analysisProgress.total} estimates ready`
            : undefined
      }
      maxWidth="max-w-5xl"
    >
      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {!canVote && ['meta_vote', 'voting'].includes(status) && (
        <div className="avanti-box border border-border bg-card p-5 mb-6">
          <p className="font-serif text-lg text-foreground mb-2">View-only on this trip</p>
          <p className="text-sm text-muted-foreground m-0 leading-relaxed">
            You asked someone else to handle planning on this trip. You can still follow along — you just won&apos;t cast votes yourself.
          </p>
        </div>
      )}

      {needsConstraints && myTraveler && (
        <MemberConstraintsModal
          tripId={tripId}
          travelerId={myTraveler.id}
          initialDeparture={myTraveler.departure_city || ''}
          initialBudget={(myTraveler.step2 as { budget?: string })?.budget || ''}
          onComplete={() => {
            setConstraintsDone(true)
            load()
          }}
        />
      )}

      {status === 'draft' && (
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl text-foreground mb-2">Waiting for trip cards</p>
          <p className="text-sm text-muted-foreground mb-4">
            Submit your Brainstorm picks to open the voting countdown.
          </p>
          {submissionDeadline && submissionWindowOpen && (
            <div className="mb-6">
              <SubmissionCountdown
                deadline={submissionDeadline}
                label="Submission window"
                variant="compact"
              />
            </div>
          )}
          {canExtendWindow && !submissionWindowOpen && (
            <div className="mb-6 text-left max-w-md mx-auto">
              <ExtendSubmissionWindow tripId={tripId} closed onExtended={() => load()} />
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={() => router.push(`/trips/${tripId}/step2`)} className="avanti-btn avanti-btn-primary">
              Go to Brainstorm →
            </button>
            <button type="button" onClick={() => router.push(`/trips/${tripId}`)} className="avanti-btn avanti-btn-ghost">
              Back to trip dashboard
            </button>
          </div>
        </div>
      )}

      {waitingForVoting && status !== 'draft' && (
        <div className="avanti-box border border-border bg-card px-6 py-10 text-center mb-8">
          {analysisComplete ? (
            <>
              <p className="font-serif text-xl text-foreground mb-2">Analysis complete</p>
              <p className="text-sm text-muted-foreground mb-2">
                {analysisProgress.done} / {analysisProgress.total} estimates ready
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Next up: compare destinations side by side and set what matters most to you.
              </p>
              <p className="text-xs text-muted-foreground animate-pulse mb-0">
                Opening the voting page… refresh if this doesn&apos;t update in a few seconds.
              </p>
            </>
          ) : (
            <>
              <SubmissionCountdown
                deadline={submissionDeadline}
                label={status === 'analyzing' ? 'Voting opens after analysis' : 'Until voting opens'}
                hint={
                  status === 'analyzing'
                    ? 'Avanti is pricing flights and stays for everyone.'
                    : 'Destination cards stay hidden until the submission window closes and analysis finishes.'
                }
              />
              {status === 'analyzing' && data?.analysisProgress && (
                <p className="text-xs text-muted-foreground mt-6 mb-0">
                  {data.analysisProgress.done} / {data.analysisProgress.total} estimates ready
                </p>
              )}
              {status === 'analyzing' && isOrganizer && data.analysisProgress && data.analysisProgress.done < data.analysisProgress.total && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await retryAnalysis(decision!.id)
                      await load()
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to start analysis')
                    } finally {
                      setBusy(false)
                    }
                  }}
                  className="avanti-btn avanti-btn-primary mt-4"
                >
                  {busy ? 'Starting…' : 'Start analysis →'}
                </button>
              )}
              {canExtendWindow && !submissionWindowOpen && (
                <div className="mt-8 text-left max-w-md mx-auto">
                  <ExtendSubmissionWindow tripId={tripId} closed onExtended={() => load()} />
                </div>
              )}
            </>
          )}
          {status === 'suggestions_open' && submissionWindowOpen && (
            <div className="mt-8 text-left max-w-md mx-auto border-t border-border pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Add one destination idea for the group (optional).
              </p>
              <input
                className="avanti-input w-full mb-3"
                placeholder="e.g. Lisbon, Portugal"
                value={suggestName}
                onChange={e => setSuggestName(e.target.value)}
              />
              <input
                className="avanti-input w-full mb-4"
                placeholder="Why this place? (optional)"
                value={suggestNote}
                onChange={e => setSuggestNote(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !suggestName.trim()}
                onClick={handleSuggest}
                className="avanti-btn avanti-btn-primary w-full"
              >
                Add suggestion
              </button>
              {isOrganizer && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await closeSubmissions(decision!.id)
                      await load()
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                  className="mt-3 avanti-btn avanti-btn-ghost w-full text-sm"
                >
                  Close submission window early →
                </button>
              )}
              {canExtendWindow && submissionWindowOpen && (
                <div className="mt-6">
                  <ExtendSubmissionWindow tripId={tripId} closed={false} onExtended={() => load()} />
                </div>
              )}
            </div>
          )}
          <button type="button" onClick={() => router.push(`/trips/${tripId}`)} className="avanti-btn avanti-btn-ghost mt-6">
            Back to trip dashboard
          </button>
        </div>
      )}

      {showVotingMatrix && (
        <div className="avanti-box border border-border bg-card p-4 sm:p-6">
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Compare destinations at a glance. Cost shows an affordability band ($ – $$$$) plus dollar range.
            Weather shows average daytime temp and conditions. Group fit combines Avanti&apos;s feasibility read for
            everyone with your personal star rating.
          </p>

          <VotingComparisonGrid
            columns={votingColumns}
            weights={weights}
            votes={gridVotes}
            onDesireChange={(id, score) => updateVote(id, { desireScore: score })}
            onApprovedChange={(id, approved) => updateVote(id, { approved })}
            readOnly={!canVote}
          />

          <InterestWeights
            value={weights}
            onChange={w => {
              setWeights(w)
              setWeightsSaved(false)
            }}
            onSave={handleSaveWeights}
            saving={busy}
            saved={weightsSaved && !!data.myMetaVote}
            disabled={!canVote}
          />

          {status === 'meta_vote' && !data.myMetaVote && (
            <p className="text-xs text-muted-foreground text-center mt-4 mb-0">
              Save your weights so the group can move to final voting once everyone weighs in.
            </p>
          )}

          {status === 'meta_vote' && isOrganizer && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await openVotingNow(decision!.id)
                  await load()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed')
                } finally {
                  setBusy(false)
                }
              }}
              className="mt-6 avanti-btn avanti-btn-ghost w-full text-sm"
            >
              Open voting now (host)
            </button>
          )}
        </div>
      )}

      {(status === 'results' || status === 'confirming') && (
        <div className="space-y-6">
          <div className="avanti-box border border-border bg-forest-pale p-6">
            <p className="eyebrow text-muted-foreground mb-1">Recommended</p>
            <p className="font-serif text-2xl text-forest-deep">
              {data.winnerOption?.name || ranked[0]?.name || '—'}
              {data.winnerOption?.tier && ` · ${TIER_LABELS[data.winnerOption.tier]}`}
            </p>
          </div>

          <div className="space-y-2">
            {ranked.slice(0, 5).map(r => {
              const opt = options.find(o => o.id === r.id)
              return (
                <div key={r.id} className="avanti-box flex items-center justify-between border border-border bg-card px-4 py-3">
                  <div>
                    <span className="text-xs text-muted-foreground mr-2">#{r.rank}</span>
                    <span className="font-serif">{opt?.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{TIER_LABELS[opt?.tier || '']}</span>
                  </div>
                  {isOrganizer && status === 'confirming' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleLock(r.id)}
                      className="text-[10px] uppercase tracking-wider text-forest-deep hover:underline"
                    >
                      Lock this
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {!data.myConfirmation && status === 'confirming' && (
            <div className="space-y-3">
              <input
                className="avanti-input w-full"
                placeholder="My max budget (optional) e.g. $2800"
                value={confirmMaxCost}
                onChange={e => setConfirmMaxCost(e.target.value)}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => handleConfirm(true)} className="avanti-btn avanti-btn-primary">
                  I&apos;m in at this price
                </button>
                <button type="button" disabled={busy} onClick={() => handleConfirm(false)} className="avanti-btn avanti-btn-ghost">
                  Can&apos;t do this
                </button>
              </div>
            </div>
          )}

          {isOrganizer && status === 'confirming' && (data.confirmations?.length ?? 0) > 0 && (
            <div className="avanti-box border border-border bg-card p-4 mb-4">
              <p className="eyebrow text-muted-foreground mb-2">Group confirmations</p>
              <p className="text-sm text-muted-foreground m-0">
                {(data.confirmations || []).filter((c: { confirmed: boolean }) => c.confirmed).length} in ·{' '}
                {(data.confirmations || []).filter((c: { confirmed: boolean }) => !c.confirmed).length} can&apos;t do
              </p>
            </div>
          )}

          {isOrganizer && winnerId && status === 'confirming' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleLock(winnerId)}
              className="avanti-btn avanti-btn-primary w-full"
            >
              Lock destination & continue to flights →
            </button>
          )}
        </div>
      )}

      {status === 'locked' && (
        <div className="avanti-box border border-border bg-card px-6 py-10 text-center">
          <p className="font-serif text-2xl text-forest-deep mb-2">
            {data.lockedOption?.name || data.trip.destination}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {data.lockedOption?.tier && `${TIER_LABELS[data.lockedOption.tier]} tier · `}
            Locked and ready for booking.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/trips/${tripId}/flights`)}
            className="avanti-btn avanti-btn-primary"
          >
            Plan flights →
          </button>
        </div>
      )}
    </SubpageShell>
  )
}
