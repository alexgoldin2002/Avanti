'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import MemberConstraintsModal from './MemberConstraintsModal'
import { personalCostFromScenarios } from '@/lib/destination-decision/scenario-utils'
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
  formatCost,
  TIER_LABELS,
  WORKS_LABELS,
  STATUS_HEADINGS,
} from '@/lib/destination-decision/client-api'
import SubmissionCountdown from '../../../components/SubmissionCountdown'

type DecisionPayload = Awaited<ReturnType<typeof fetchDecision>>

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="mt-3">
      <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 text-xs border transition-colors ${
              value === o.id
                ? 'border-forest-deep bg-forest-pale text-forest-deep'
                : 'border-border text-muted-foreground hover:border-forest-deep/40'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChooseDestinationPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DecisionPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [suggestName, setSuggestName] = useState('')
  const [suggestNote, setSuggestNote] = useState('')
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)
  const [localVotes, setLocalVotes] = useState<Record<string, {
    toggles: { flight: FlightToggle; dates: DateToggle }
    desire_score?: number
    approved?: boolean
    private_max?: boolean
  }>>({})
  const [constraintsDone, setConstraintsDone] = useState(false)
  const [confirmMaxCost, setConfirmMaxCost] = useState('')
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const load = useCallback(async () => {
    try {
      const payload = await fetchDecision(tripId)
      setData(payload)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!data?.analysisProgress) return
    const { done, total } = data.analysisProgress
    if (data.decision?.status !== 'analyzing' || total === 0 || done < total) return
    load()
    const fast = setInterval(load, 3000)
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

  const decision = data?.decision
  const status = decision?.status || 'draft'
  const options = data?.options || []
  const isOrganizer = data?.isOrganizer
  const submissionDeadline = decision?.submission_deadline ?? null
  const votingOpen = ['meta_vote', 'voting', 'results', 'confirming', 'locked'].includes(status)
  const waitingForVoting = !votingOpen
  const submissionWindowOpen =
    !!submissionDeadline && new Date(submissionDeadline) > new Date()
  const analysisComplete =
    status === 'analyzing' &&
    !!data?.analysisProgress &&
    data.analysisProgress.total > 0 &&
    data.analysisProgress.done >= data.analysisProgress.total

  const ranked = data?.rankedOptions || []

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

  const handleMeta = async (priority: 'budget' | 'experience' | 'balance') => {
    if (!decision?.id) return
    setBusy(true)
    try {
      await submitMetaVote(decision.id, priority)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const persistVote = useCallback((
    optionId: string,
    patch: Partial<{ desireScore: number; approved: boolean; toggles: { flight?: string; dates?: string }; privateMax: boolean }>,
    reload = false
  ) => {
    const opt = options.find(o => o.id === optionId)
    const local = localVotes[optionId]
    const payload = {
      optionId,
      desireScore: patch.desireScore ?? local?.desire_score ?? opt?.myVote?.desire_score ?? undefined,
      approved: patch.approved ?? local?.approved ?? opt?.myVote?.approved ?? undefined,
      toggles: patch.toggles ?? local?.toggles ?? opt?.myVote?.toggles ?? {},
      privateMax: patch.privateMax ?? local?.private_max ?? opt?.myVote?.private_max ?? false,
    }

    if (saveTimers.current[optionId]) clearTimeout(saveTimers.current[optionId])
    saveTimers.current[optionId] = setTimeout(async () => {
      try {
        await submitOptionVote(payload)
        if (reload) await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save vote')
      }
    }, patch.toggles ? 400 : 0)
  }, [options, localVotes, load])

  const updateVote = (
    optionId: string,
    patch: { desireScore?: number; approved?: boolean; toggles?: { flight?: FlightToggle; dates?: DateToggle }; privateMax?: boolean }
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
          ...(patch.privateMax !== undefined ? { private_max: patch.privateMax } : {}),
          ...(patch.toggles ? { toggles: { ...cur.toggles, ...patch.toggles } } : {}),
        },
      }
    })
    persistVote(optionId, patch, patch.desireScore !== undefined || patch.approved !== undefined)
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
  if (!data?.trip) return null

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
  const showMeta = canVote && status === 'meta_vote' && !data.myMetaVote
  const showVote = canVote && (status === 'voting' || (status === 'meta_vote' && !!data.myMetaVote))
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
            ? `${data.analysisProgress.done} / ${data.analysisProgress.total} estimates ready`
            : undefined
      }
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
                {data!.analysisProgress!.done} / {data!.analysisProgress!.total} estimates ready
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Next up: everyone picks whether to optimize for budget, experience, or balance — then you vote on destinations.
              </p>
              <p className="text-xs text-muted-foreground animate-pulse mb-0">
                Opening the next step… refresh if this doesn&apos;t update in a few seconds.
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
            </div>
          )}
          <button type="button" onClick={() => router.push(`/trips/${tripId}`)} className="avanti-btn avanti-btn-ghost mt-6">
            Back to trip dashboard
          </button>
        </div>
      )}

      {showMeta && (
        <div className="grid gap-4 sm:grid-cols-3">
          {([
            ['budget', 'Budget first', 'Optimize for the lowest workable cost for the group.'],
            ['experience', 'Experience first', 'Optimize for excitement and group desire.'],
            ['balance', 'Balance', 'Blend cost and experience fairly.'],
          ] as const).map(([id, title, desc]) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => handleMeta(id)}
              className="avanti-box group border border-border bg-card p-6 text-left transition-all hover:-translate-y-px hover:border-forest-deep/30 hover:[box-shadow:var(--shadow-box-hover)]"
            >
              <p className="font-serif text-lg mb-2 group-hover:text-forest-deep">{title}</p>
              <p className="text-xs text-muted-foreground m-0">{desc}</p>
            </button>
          ))}
        </div>
      )}

      {status === 'meta_vote' && isOrganizer && !showVote && (
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
          className="mt-4 avanti-btn avanti-btn-ghost w-full"
        >
          Open voting now (organizer)
        </button>
      )}

      {showVote && (
        <div className="space-y-4">
          {options.map(option => {
            const local = localVotes[option.id]
            const toggles = local?.toggles || {
              flight: 'one_stop' as FlightToggle,
              dates: 'best' as DateToggle,
            }
            const gs = option.group_summary || {}
            const personal = option.myAnalysis?.scenarios
              ? personalCostFromScenarios(option.myAnalysis.scenarios, toggles)
              : null
            const displayCost = personal?.cost ?? option.personalCost
            const worksForYou = personal?.works ?? option.worksForYou

            return (
              <div key={option.id} className="avanti-box border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-serif text-xl text-foreground">{option.name}</p>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
                      {TIER_LABELS[option.tier] || option.tier}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Your est.</p>
                    <p className="font-serif text-lg text-forest-deep">{formatCost(displayCost)}</p>
                    {worksForYou && (
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Works for you: {WORKS_LABELS[worksForYou] || worksForYou}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-1">
                  Group avg {formatCost(Number(gs.avg_cost))} ·{' '}
                  {Number(gs.group_fit_yes) || 0}/{Number(gs.group_fit_total) || data.travelers.length} members — Yes
                </p>
                {gs.tradeoff && <p className="text-xs italic text-muted-foreground mb-3">{String(gs.tradeoff)}</p>}

                <ToggleGroup
                  label="Flights"
                  value={toggles.flight || 'one_stop'}
                  options={[
                    { id: 'direct' as const, label: 'Direct' },
                    { id: 'one_stop' as const, label: '1-stop OK' },
                    { id: 'cheapest' as const, label: 'Cheapest' },
                  ]}
                  onChange={f => updateVote(option.id, { toggles: { ...toggles, flight: f } })}
                />
                <ToggleGroup
                  label="Dates"
                  value={toggles.dates || 'best'}
                  options={[
                    { id: 'best' as const, label: 'Group best' },
                    { id: 'fri' as const, label: 'Leave Fri' },
                    { id: 'mon' as const, label: 'Leave Mon' },
                  ]}
                  onChange={d => updateVote(option.id, { toggles: { ...toggles, dates: d } })}
                />

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-1">Desire</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => updateVote(option.id, { desireScore: n })}
                          className={`text-lg ${(local?.desire_score ?? option.myVote?.desire_score ?? 0) >= n ? 'text-forest-deep' : 'text-border'}`}
                          aria-label={`${n} stars`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(local?.approved ?? option.myVote?.approved)}
                      onChange={e => updateVote(option.id, { approved: e.target.checked })}
                    />
                    I&apos;d go if the group picks this
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(local?.private_max ?? option.myVote?.private_max)}
                      onChange={e => updateVote(option.id, { privateMax: e.target.checked })}
                    />
                    This is my max (organizer only)
                  </label>
                </div>

                <button
                  type="button"
                  className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-forest-deep"
                  onClick={() => setCompareIds(prev =>
                    prev?.[0] === option.id ? null : prev ? [prev[0], option.id] : [option.id, option.id]
                  )}
                >
                  Compare
                </button>
              </div>
            )
          })}
        </div>
      )}

      {compareIds && compareIds[0] !== compareIds[1] && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="avanti-box max-w-2xl w-full bg-card border border-border p-6 max-h-[80vh] overflow-y-auto">
            <p className="font-serif text-xl mb-4">Compare</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {compareIds.map(id => {
                const o = options.find(x => x.id === id)
                if (!o) return null
                return (
                  <div key={id} className="border border-border p-4">
                    <p className="font-serif text-lg">{o.name}</p>
                    <p className="text-xs uppercase text-muted-foreground">{TIER_LABELS[o.tier]}</p>
                    <p className="mt-2 text-forest-deep font-serif text-xl">{formatCost(o.personalCost)}</p>
                    <p className="text-sm text-muted-foreground">Works: {o.worksForYou || '—'}</p>
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={() => setCompareIds(null)} className="mt-4 avanti-btn avanti-btn-ghost w-full">
              Close
            </button>
          </div>
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
