'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import { TIER_LABELS } from '@/lib/destination-decision/client-api'
import {
  fetchFlightSession,
  setCoordination,
  saveFlightPreferences,
  runFlightAnalysis,
  lockFlights,
  formatCost,
  type FlightSessionResponse,
  type PrefsFormState,
} from '@/lib/flights/client-api'
import type {
  CoordinationMode,
  FlightScenario,
  MemberFlightPlan,
} from '@/lib/flights/types'
import {
  COORDINATION_LABELS,
  DIRECT_PREF_LABELS,
  COST_VS_TIME_LABELS,
  GROUP_AIRLINE_CALL_THRESHOLD,
} from '@/lib/flights/types'

const DAY_IMPACT_LABELS: Record<string, string> = {
  full_day: 'Full day on arrival',
  afternoon_ok: 'Afternoon — check-in OK',
  late_night: 'Late night — may lose evening',
  lose_day: 'Lose most of the day',
  early_departure: 'Early departure — short last day',
}

export default function FlightsPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FlightSessionResponse | null>(null)
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)

  const [prefsForm, setPrefsForm] = useState<PrefsFormState>({
    direct_preference: 'one_stop_ok',
    preferred_airlines: [],
    avoid_airlines: '',
    cost_vs_time: 'balance',
    wants_group_routing: null,
    notes: '',
  })

  const load = useCallback(async () => {
    try {
      const json = await fetchFlightSession(tripId)
      setData(json)

      if (json.myPrefs) {
        setPrefsForm({
          direct_preference: json.myPrefs.direct_preference,
          preferred_airlines: json.myPrefs.preferred_airlines || [],
          avoid_airlines: (json.myPrefs.avoid_airlines || []).join(', '),
          cost_vs_time: json.myPrefs.cost_vs_time,
          wants_group_routing: json.myPrefs.wants_group_routing ?? null,
          notes: json.myPrefs.notes || '',
        })
      } else if (json.travelerContexts?.length && json.myTravelerId) {
        const ctx = json.travelerContexts.find(c => c.id === json.myTravelerId)
        if (ctx) {
          setPrefsForm(f => ({
            ...f,
            preferred_airlines: ctx.airlines.map(a => a.airline),
          }))
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <SuitcaseLoader message="Loading flights" />
  if (!data?.trip) return null

  const trip = data.trip
  const session = data.session
  const status = session?.status || 'setup'
  const analysis = session?.analysis
  const travelerCount = data.travelers.length
  const isOrganizer = data.isOrganizer
  const coordinationMode = session?.coordination_mode

  if (!trip.destination || trip.destination === 'TBD') {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Flights">
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">Destination not locked yet</p>
          <button type="button" onClick={() => router.push(`/trips/${tripId}/choose`)} className="avanti-btn avanti-btn-primary">
            Go to Choose destination →
          </button>
        </div>
      </SubpageShell>
    )
  }

  const handleCoordination = async (mode: CoordinationMode) => {
    setBusy(true)
    setError(null)
    try {
      await setCoordination(tripId, mode)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const handleSavePrefs = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveFlightPreferences(tripId, {
        direct_preference: prefsForm.direct_preference,
        preferred_airlines: prefsForm.preferred_airlines,
        avoid_airlines: prefsForm.avoid_airlines
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        cost_vs_time: prefsForm.cost_vs_time,
        wants_group_routing: prefsForm.wants_group_routing,
        notes: prefsForm.notes || null,
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const handleAnalyze = async () => {
    setBusy(true)
    setError(null)
    try {
      await runFlightAnalysis(tripId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setBusy(false)
    }
  }

  const handleLock = async (scenarioId: string) => {
    if (!confirm('Lock these flights and dates? Hotel search will use these fixed dates.')) return
    setBusy(true)
    setError(null)
    try {
      await lockFlights(tripId, scenarioId)
      router.push(`/trips/${tripId}/accommodation`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lock failed')
    } finally {
      setBusy(false)
    }
  }

  const toggleAirline = (airline: string) => {
    setPrefsForm(f => ({
      ...f,
      preferred_airlines: f.preferred_airlines.includes(airline)
        ? f.preferred_airlines.filter(a => a !== airline)
        : [...f.preferred_airlines, airline],
    }))
  }

  const myCtx = data.travelerContexts.find(c => c.id === data.myTravelerId)
  const prefsCount = data.prefs.length
  const allPrefsIn = prefsCount >= travelerCount && travelerCount > 0

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={String(trip.name)}
      title="Flights"
      subtitle={`${trip.destination}${trip.locked_tier ? ` · ${TIER_LABELS[String(trip.locked_tier)] || trip.locked_tier}` : ''}`}
      maxWidth="max-w-3xl"
    >
      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {/* Summary bar */}
      <div className="avanti-box border border-forest-deep/20 bg-forest-pale px-5 py-4 mb-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="eyebrow text-forest mb-1">Locked from Step 3</p>
            <p className="font-serif text-xl text-forest-deep m-0">{String(trip.destination)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Est. at vote</p>
            <p className="font-serif text-lg text-forest-deep m-0">{formatCost(data.voteEstimate)}</p>
            <p className="text-[10px] text-muted-foreground m-0">per person · flights may differ</p>
          </div>
        </div>
      </div>

      {travelerCount > GROUP_AIRLINE_CALL_THRESHOLD && (
        <div className="mb-6 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your group has {travelerCount} travelers. Airlines often require calling for group fares ({'>'}9 passengers) — members will need to handle that directly with the airline.
        </div>
      )}

      {/* LOCKED */}
      {status === 'locked' && session?.locked_summary && (
        <div className="space-y-6">
          <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
            <p className="eyebrow text-muted-foreground mb-1">Flights locked</p>
            <p className="font-serif text-2xl text-forest-deep mb-2">
              {(session.locked_summary as FlightScenario).departure_date} → {(session.locked_summary as FlightScenario).return_date}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {(session.locked_summary as FlightScenario).label} · {formatCost((session.locked_summary as FlightScenario).avg_per_person_usd)} avg/person
            </p>
            <button type="button" onClick={() => router.push(`/trips/${tripId}/accommodation`)} className="avanti-btn avanti-btn-primary">
              Continue to hotels →
            </button>
          </div>
        </div>
      )}

      {/* SETUP — coordination */}
      {status !== 'locked' && (!coordinationMode || status === 'setup') && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Before flight search, the organizer sets how the group travels.
          </p>
          {isOrganizer ? (
            <div className="grid gap-3">
              {(['together', 'independent', 'mix'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  disabled={busy}
                  onClick={() => handleCoordination(mode)}
                  className="avanti-box group border border-border bg-card p-5 text-left transition-all hover:-translate-y-px hover:border-forest-deep/30"
                >
                  <p className="font-serif text-lg mb-1 group-hover:text-forest-deep">{COORDINATION_LABELS[mode]}</p>
                  <p className="text-xs text-muted-foreground m-0">
                    {mode === 'together' && 'AI finds shared routing — may connect through a hub. Shows cost vs booking solo.'}
                    {mode === 'independent' && 'Everyone books their own path. Compare arrival times and optional meetups.'}
                    {mode === 'mix' && 'Each member chooses coordinated routing or solo.'}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
              <p className="font-serif text-lg mb-2">Waiting on organizer</p>
              <p className="text-sm text-muted-foreground m-0">They&apos;ll choose how the group flies together.</p>
            </div>
          )}
        </div>
      )}

      {/* PREFERENCES */}
      {status !== 'locked' && coordinationMode && ['preferences', 'review', 'analyzing'].includes(status) && (
        <div className="space-y-8">
          <div className="avanti-box border border-border bg-card p-5">
            <p className="eyebrow text-muted-foreground mb-1">Group mode</p>
            <p className="font-serif text-lg m-0">{COORDINATION_LABELS[coordinationMode]}</p>
            <p className="text-xs text-muted-foreground mt-2 m-0">
              {prefsCount}/{travelerCount} members submitted preferences
            </p>
          </div>

          {data.myTravelerId && (
            <div className="avanti-box border border-border bg-card p-6 space-y-5">
              <div>
                <p className="font-serif text-xl mb-1">Your flight preferences</p>
                {myCtx && (
                  <p className="text-sm text-muted-foreground m-0">
                    Departing {myCtx.departure_city}
                    {myCtx.airlines.length > 0 && ` · ${myCtx.airlines.map(a => `${a.airline} ${a.tier}`).join(', ')}`}
                  </p>
                )}
              </div>

              {myCtx && (myCtx.card_perks_summary.length > 0 || myCtx.status_perks_summary.length > 0) && (
                <div className="border border-border/60 bg-forest-mist/50 px-4 py-3 text-xs text-muted-foreground space-y-1">
                  {myCtx.status_perks_summary.map((s, i) => <p key={`s-${i}`} className="m-0">{s}</p>)}
                  {myCtx.card_perks_summary.map((s, i) => <p key={`c-${i}`} className="m-0">{s}</p>)}
                </div>
              )}

              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">Direct vs stops</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DIRECT_PREF_LABELS) as Array<keyof typeof DIRECT_PREF_LABELS>).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPrefsForm(f => ({ ...f, direct_preference: k }))}
                      className={`px-3 py-2 text-xs border transition-colors ${
                        prefsForm.direct_preference === k
                          ? 'border-forest-deep bg-forest-deep text-white'
                          : 'border-border bg-card text-muted-foreground hover:border-forest-deep/40'
                      }`}
                    >
                      {DIRECT_PREF_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">Cost vs time</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(COST_VS_TIME_LABELS) as Array<keyof typeof COST_VS_TIME_LABELS>).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPrefsForm(f => ({ ...f, cost_vs_time: k }))}
                      className={`px-3 py-2 text-xs border transition-colors ${
                        prefsForm.cost_vs_time === k
                          ? 'border-forest-deep bg-forest-deep text-white'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      {COST_VS_TIME_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>

              {coordinationMode === 'mix' && (
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={prefsForm.wants_group_routing === true}
                      onChange={() => setPrefsForm(f => ({ ...f, wants_group_routing: true }))}
                    />
                    Coordinate with group
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={prefsForm.wants_group_routing === false}
                      onChange={() => setPrefsForm(f => ({ ...f, wants_group_routing: false }))}
                    />
                    Fly solo
                  </label>
                </div>
              )}

              {myCtx && myCtx.airlines.length > 0 && (
                <div>
                  <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">Preferred airlines</p>
                  <div className="flex flex-wrap gap-2">
                    {myCtx.airlines.map(a => (
                      <button
                        key={a.airline}
                        type="button"
                        onClick={() => toggleAirline(a.airline)}
                        className={`px-3 py-1.5 text-xs border ${
                          prefsForm.preferred_airlines.includes(a.airline)
                            ? 'border-forest-deep bg-forest-pale'
                            : 'border-border'
                        }`}
                      >
                        {a.airline}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground block mb-2">Airlines to avoid</label>
                <input
                  className="avanti-input w-full"
                  placeholder="e.g. Spirit, Frontier"
                  value={prefsForm.avoid_airlines}
                  onChange={e => setPrefsForm(f => ({ ...f, avoid_airlines: e.target.value }))}
                />
              </div>

              <button type="button" disabled={busy} onClick={handleSavePrefs} className="avanti-btn avanti-btn-primary w-full">
                Save my preferences
              </button>
            </div>
          )}

          {isOrganizer && allPrefsIn && status !== 'analyzing' && !analysis?.scenarios?.length && (
            <button type="button" disabled={busy} onClick={handleAnalyze} className="avanti-btn avanti-btn-primary w-full">
              {busy ? 'Analyzing routes…' : 'Run flight analysis →'}
            </button>
          )}

          {isOrganizer && !allPrefsIn && status === 'preferences' && (
            <p className="text-sm text-center text-muted-foreground">
              Waiting for all members to submit preferences before analysis.
            </p>
          )}

          {isOrganizer && status === 'preferences' && prefsCount > 0 && !allPrefsIn && (
            <button type="button" disabled={busy} onClick={handleAnalyze} className="avanti-btn avanti-btn-ghost w-full text-sm">
              Run analysis anyway (not everyone submitted)
            </button>
          )}
        </div>
      )}

      {/* ANALYZING */}
      {status === 'analyzing' && (
        <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
          <p className="font-serif text-xl mb-2">Comparing routes, timing, and ground transport</p>
          <p className="text-sm text-muted-foreground">This may take a minute for large groups.</p>
        </div>
      )}

      {/* REVIEW scenarios */}
      {status === 'review' && analysis?.scenarios && analysis.scenarios.length > 0 && (
        <div className="space-y-6">
          {analysis.price_drift_warning && (
            <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {analysis.price_drift_warning}
              {isOrganizer && (
                <button
                  type="button"
                  className="block mt-2 text-[10px] uppercase tracking-wider text-amber-950 underline"
                  onClick={() => router.push(`/trips/${tripId}/choose`)}
                >
                  Reopen destination decision
                </button>
              )}
            </div>
          )}

          {analysis.summary && (
            <p className="text-sm italic text-muted-foreground">{analysis.summary}</p>
          )}

          {analysis.scenarios.map(scenario => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              voteEstimate={data.voteEstimate}
              coordinationMode={coordinationMode}
              expanded={expandedScenario === scenario.id}
              onToggle={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
              expandedMember={expandedMember}
              onToggleMember={id => setExpandedMember(expandedMember === id ? null : id)}
              isOrganizer={isOrganizer}
              busy={busy}
              onLock={() => handleLock(scenario.id)}
            />
          ))}
        </div>
      )}

      {status === 'review' && analysis?.scenarios?.length === 0 && (
        <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
          <p className="font-serif text-lg mb-4">Analysis didn&apos;t return scenarios</p>
          {isOrganizer && (
            <button type="button" disabled={busy} onClick={handleAnalyze} className="avanti-btn avanti-btn-primary">
              Try again
            </button>
          )}
        </div>
      )}
    </SubpageShell>
  )
}

function ScenarioCard({
  scenario,
  voteEstimate,
  coordinationMode,
  expanded,
  onToggle,
  expandedMember,
  onToggleMember,
  isOrganizer,
  busy,
  onLock,
}: {
  scenario: FlightScenario
  voteEstimate: number | null
  coordinationMode: CoordinationMode | null | undefined
  expanded: boolean
  onToggle: () => void
  expandedMember: string | null
  onToggleMember: (id: string) => void
  isOrganizer: boolean
  busy: boolean
  onLock: () => void
}) {
  return (
    <div className={`avanti-box border bg-card p-5 ${scenario.recommended ? 'border-forest-deep' : 'border-border'}`}>
      <div className="flex flex-wrap justify-between gap-3 mb-3">
        <div>
          {scenario.recommended && (
            <span className="text-[10px] uppercase tracking-wider text-forest-deep mb-1 block">Recommended</span>
          )}
          <p className="font-serif text-xl m-0">{scenario.label}</p>
          <p className="text-xs text-muted-foreground mt-1 m-0">
            {scenario.departure_date} → {scenario.return_date} · {scenario.cost_vs_time_label}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl text-forest-deep m-0">{formatCost(scenario.avg_per_person_usd)}</p>
          <p className="text-[10px] text-muted-foreground m-0">avg / person</p>
        </div>
      </div>

      {scenario.group_size_note && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 px-3 py-2 mb-3">{scenario.group_size_note}</p>
      )}

      {coordinationMode === 'together' && scenario.solo_vs_group_delta_usd != null && (
        <p className="text-sm text-muted-foreground mb-3">
          vs booking solo: {scenario.solo_vs_group_delta_usd >= 0 ? '+' : ''}
          {formatCost(scenario.solo_vs_group_delta_usd)} per person to fly together
        </p>
      )}

      {scenario.cheapest_date_window && (
        <p className="text-xs text-muted-foreground mb-3">
          Cheapest window: {scenario.cheapest_date_window.leave} – {scenario.cheapest_date_window.return}
          {scenario.cheapest_date_window.savings_vs_peak_usd > 0 &&
            ` · save ~${formatCost(scenario.cheapest_date_window.savings_vs_peak_usd)} vs peak`}
          {scenario.cheapest_date_window.note && ` · ${scenario.cheapest_date_window.note}`}
        </p>
      )}

      {scenario.routing_order_note && (
        <p className="text-xs italic text-muted-foreground mb-3">{scenario.routing_order_note}</p>
      )}

      {/* Group sync */}
      {scenario.group_sync && (
        <div className="border border-border/60 px-4 py-3 mb-3 text-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Group arrivals</p>
          <p className="m-0">
            First: {scenario.group_sync.first_arrival} · Last: {scenario.group_sync.last_arrival}
            {scenario.group_sync.spread_hours > 0 && ` · ${scenario.group_sync.spread_hours}h spread`}
          </p>
          {scenario.group_sync.meetup_options?.length > 0 && (
            <ul className="mt-2 mb-0 pl-4 text-xs text-muted-foreground">
              {scenario.group_sync.meetup_options.map((m, i) => (
                <li key={i}>{m.city} ({m.where}): {m.note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button type="button" onClick={onToggle} className="text-[10px] uppercase tracking-wider text-forest-deep hover:underline mb-3">
        {expanded ? 'Hide details' : 'Show per-person routing & timing'}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border pt-3">
          {scenario.member_plans?.map(plan => (
            <MemberPlanCard
              key={plan.traveler_id}
              plan={plan}
              expanded={expandedMember === plan.traveler_id}
              onToggle={() => onToggleMember(plan.traveler_id)}
            />
          ))}
        </div>
      )}

      {isOrganizer && (
        <button
          type="button"
          disabled={busy}
          onClick={onLock}
          className="mt-4 avanti-btn avanti-btn-primary w-full"
        >
          Lock these flights & dates →
        </button>
      )}
    </div>
  )
}

function MemberPlanCard({
  plan,
  expanded,
  onToggle,
}: {
  plan: MemberFlightPlan
  expanded: boolean
  onToggle: () => void
}) {
  const flightTypeLabel =
    plan.flight_type === 'nonstop' ? 'Nonstop' : plan.flight_type === 'one_stop' ? '1 stop' : 'Multi-stop'

  return (
    <div className="border border-border/60 px-4 py-3">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex justify-between gap-2">
          <div>
            <p className="font-serif text-base m-0">{plan.traveler_name}</p>
            <p className="text-xs text-muted-foreground m-0">
              {plan.departure_city} · {plan.airline} · {flightTypeLabel} · {plan.duration_hours}h · {formatCost(plan.price_usd)}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 text-sm space-y-3 border-t border-border/40 pt-3">
          {plan.segments?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Segments</p>
              {plan.segments.map((s, i) => (
                <p key={i} className="text-xs text-muted-foreground m-0">
                  {s.from} → {s.to} · {s.airline} · {s.duration_hours}h
                </p>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <TimingBlock label="Outbound" timing={plan.outbound} />
            <TimingBlock label="Return" timing={plan.return_leg} />
          </div>

          {plan.bags_included && (
            <p className="text-xs m-0"><strong>Bags:</strong> {plan.bags_included}</p>
          )}
          {(plan.status_perks_used?.length > 0 || plan.card_perks_used?.length > 0) && (
            <p className="text-xs text-muted-foreground m-0">
              Perks: {[...(plan.status_perks_used || []), ...(plan.card_perks_used || [])].join(' · ')}
            </p>
          )}

          {plan.ground_transport?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Airport → city</p>
              {plan.ground_transport.map((g, i) => (
                <p key={i} className="text-xs text-muted-foreground m-0">
                  {g.mode}: ~{g.duration_min} min · {formatCost(g.cost_usd)} — {g.notes}
                </p>
              ))}
            </div>
          )}

          <p className="text-xs m-0 capitalize">Group meet: {plan.meets_group?.replace(/_/g, ' ')}</p>
        </div>
      )}
    </div>
  )
}

function TimingBlock({ label, timing }: { label: string; timing: MemberFlightPlan['outbound'] }) {
  if (!timing) return null
  return (
    <div className="border border-border/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-xs m-0">{timing.depart_local} → {timing.arrive_local}</p>
      <p className="text-xs text-muted-foreground m-0 mt-1">
        {DAY_IMPACT_LABELS[timing.arrival_vs_checkin] || timing.arrival_vs_checkin}
      </p>
      {timing.day_impact && <p className="text-xs italic text-muted-foreground m-0">{timing.day_impact}</p>}
    </div>
  )
}
