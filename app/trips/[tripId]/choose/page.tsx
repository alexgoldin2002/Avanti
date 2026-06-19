'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import {
  fetchDecision,
  suggestDestination,
  closeSubmissions,
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

  const decision = data?.decision
  const status = decision?.status || 'draft'
  const options = data?.options || []
  const isOrganizer = data?.isOrganizer

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

  const updateVote = async (
    optionId: string,
    patch: { desireScore?: number; approved?: boolean; toggles?: { flight?: string; dates?: string }; privateMax?: boolean }
  ) => {
    setBusy(true)
    try {
      const opt = options.find(o => o.id === optionId)
      await submitOptionVote({
        optionId,
        desireScore: patch.desireScore ?? opt?.myVote?.desire_score ?? undefined,
        approved: patch.approved ?? opt?.myVote?.approved ?? undefined,
        toggles: patch.toggles ?? opt?.myVote?.toggles ?? {},
        privateMax: patch.privateMax ?? opt?.myVote?.private_max ?? false,
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async (confirmed: boolean) => {
    if (!decision?.id) return
    setBusy(true)
    try {
      await submitConfirmation(decision.id, confirmed)
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
      router.push(`/trips/${tripId}/itinerary`)
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

  const showMeta = status === 'meta_vote' && !data.myMetaVote
  const showVote = status === 'voting' || (status === 'meta_vote' && !!data.myMetaVote)
  const winnerId = decision?.winner_option_id || ranked[0]?.id

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

      {status === 'draft' && (
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl text-foreground mb-2">Not started yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            Complete Brainstorm, then the organizer starts the group decision.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/trips/${tripId}/step2`)}
            className="avanti-btn avanti-btn-primary"
          >
            Go to Brainstorm →
          </button>
        </div>
      )}

      {status === 'suggestions_open' && (
        <div className="space-y-8">
          <div className="avanti-box border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Add one destination idea for the group. Avanti will price it at Budget, Mid, and Luxury tiers alongside your AI cards.
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
          </div>

          <div>
            <p className="eyebrow text-muted-foreground mb-3">{options.length} options in the pool</p>
            <div className="grid gap-2">
              {[...new Set(options.map(o => o.name))].map(name => (
                <div key={name} className="avanti-box border border-border bg-card px-4 py-3 text-sm">
                  {name}
                </div>
              ))}
            </div>
          </div>

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
              className="avanti-btn avanti-btn-ghost w-full"
            >
              Close suggestions early →
            </button>
          )}
        </div>
      )}

      {status === 'analyzing' && (
        <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto mb-6 h-2 max-w-md overflow-hidden bg-forest-mist">
            <div
              className="h-full bg-forest-deep transition-all duration-500"
              style={{
                width: `${data.analysisProgress.total ? (100 * data.analysisProgress.done) / data.analysisProgress.total : 10}%`,
              }}
            />
          </div>
          <p className="font-serif text-xl mb-2">Pricing flights, hotels, and dates for everyone</p>
          <p className="text-sm text-muted-foreground">
            {data.analysisProgress.done} of {data.analysisProgress.total} personal estimates ready.
            Voting opens automatically when analysis completes.
          </p>
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
            const toggles = (option.myVote?.toggles || {
              flight: 'one_stop',
              dates: 'best',
            }) as { flight: 'direct' | 'one_stop' | 'cheapest'; dates: 'best' | 'fri' | 'mon' }
            const gs = option.group_summary || {}

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
                    <p className="font-serif text-lg text-forest-deep">{formatCost(option.personalCost)}</p>
                    {option.worksForYou && (
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Works for you: {WORKS_LABELS[option.worksForYou] || option.worksForYou}
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
                          className={`text-lg ${(option.myVote?.desire_score || 0) >= n ? 'text-forest-deep' : 'text-border'}`}
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
                      checked={!!option.myVote?.approved}
                      onChange={e => updateVote(option.id, { approved: e.target.checked })}
                    />
                    I&apos;d go if the group picks this
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!option.myVote?.private_max}
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
            <div className="grid sm:grid-cols-2 gap-3">
              <button type="button" disabled={busy} onClick={() => handleConfirm(true)} className="avanti-btn avanti-btn-primary">
                I&apos;m in at this price
              </button>
              <button type="button" disabled={busy} onClick={() => handleConfirm(false)} className="avanti-btn avanti-btn-ghost">
                Can&apos;t do this
              </button>
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
            onClick={() => router.push(`/trips/${tripId}/itinerary`)}
            className="avanti-btn avanti-btn-primary"
          >
            Plan flights →
          </button>
        </div>
      )}
    </SubpageShell>
  )
}
