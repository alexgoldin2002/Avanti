'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader, { SuitcaseSpinner } from '../../../components/SuitcaseLoader'
import { TIER_LABELS } from '@/lib/trip-display'
import {
  fetchFlightSession,
  setCoordination,
  runFlightAnalysis,
  lockFlights,
  unlockFlights,
  formatCost,
  fetchUpgradeAdvice,
  type FlightSessionResponse,
  type AgentBrief,
} from '@/lib/flights/client-api'
import type {
  CoordinationMode,
  FlightScenario,
  FlightAnalysis,
  FlightOption,
  MemberFlightPlan,
} from '@/lib/flights/types'
import {
  COORDINATION_LABELS,
  GROUP_AIRLINE_CALL_THRESHOLD,
} from '@/lib/flights/types'
import FlightResultsBoard, { fmtFlightDate } from './FlightResults'
import BookSearchLink from '../../../components/BookSearchLink'
import { flightSearchUrl, googleFlightsUrl, extractIata } from '@/lib/booking/search-links'

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
  const [showBrief, setShowBrief] = useState(false)
  // Options added live via the AI chat, merged with the analysis list.
  const [extraOptions, setExtraOptions] = useState<FlightOption[]>([])
  const [upgradeBusy, setUpgradeBusy] = useState(false)
  const [upgradeAdvice, setUpgradeAdvice] = useState<{
    verdict: string
    confidence: string
    strategies: string[]
    watch_outs: string[]
    prefill_checklist: string[]
  } | null>(null)

  const load = useCallback(async () => {
    try {
      const json = (await fetchFlightSession(tripId)) as FlightSessionResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  // The analysis runs server-side for 1–2 min. If the page is reloaded mid-run
  // (or the request outlives the browser), poll until results are ready so the
  // "Searching…" screen advances on its own instead of looking stuck.
  const isAnalyzing = data?.session?.status === 'analyzing'
  useEffect(() => {
    if (!isAnalyzing) return
    const t = setInterval(() => { load() }, 5000)
    return () => clearInterval(t)
  }, [isAnalyzing, load])

  if (loading) return <SuitcaseLoader message="Loading flights" />
  if (!data?.trip) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} backLabel="Trip" title="Flights">
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">{error ? 'Couldn’t load flights' : 'Flights aren’t ready yet'}</p>
          <p className="text-sm text-muted-foreground mb-6">
            {error || 'Finish choosing your destination first, then come back here to coordinate flights.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={() => { setError(null); setLoading(true); load() }} className="avanti-btn avanti-btn-ghost">
              Try again
            </button>
            <button type="button" onClick={() => router.push(`/trips/${tripId}`)} className="avanti-btn avanti-btn-primary">
              Back to trip →
            </button>
          </div>
        </div>
      </SubpageShell>
    )
  }

  const trip = data.trip
  const brief = data.agentBrief
  const session = data.session
  const status = session?.status || 'setup'
  const analysis = session?.analysis as FlightAnalysis | null | undefined
  const travelerCount = data.travelers.length
  const isOrganizer = data.isOrganizer
  const coordinationMode = session?.coordination_mode

  if (!trip.destination || trip.destination === 'TBD') {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Flights">
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">Destination not set yet</p>
          <p className="text-sm text-muted-foreground m-0">Set your trip destination before coordinating flights.</p>
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

  const handleAnalyze = async () => {
    setBusy(true)
    setError(null)
    setExtraOptions([])
    try {
      await runFlightAnalysis(tripId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  const handleLockOption = async (optionId: string) => {
    if (!confirm('Lock this flight and its dates? Hotel search will use these fixed dates.')) return
    setBusy(true)
    setError(null)
    try {
      await lockFlights(tripId, { optionId })
      router.push(`/trips/${tripId}/accommodation`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lock failed')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    if (!confirm('Reopen flight selection? This unlocks the current pick so the group can choose again.')) return
    setBusy(true)
    setError(null)
    try {
      await unlockFlights(tripId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reopen selection')
    } finally {
      setBusy(false)
    }
  }

  const handleLockScenario = async (scenarioId: string) => {
    if (!confirm('Lock these flights and dates? Hotel search will use these fixed dates.')) return
    setBusy(true)
    setError(null)
    try {
      await lockFlights(tripId, { scenarioId })
      router.push(`/trips/${tripId}/accommodation`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lock failed')
    } finally {
      setBusy(false)
    }
  }

  const handleUpgradeAdvice = async () => {
    setUpgradeBusy(true)
    setError(null)
    try {
      const { advice } = await fetchUpgradeAdvice(tripId)
      setUpgradeAdvice(advice)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upgrade advice failed')
    } finally {
      setUpgradeBusy(false)
    }
  }

  const flightOptions: FlightOption[] = [
    ...((analysis?.flight_options as FlightOption[] | undefined) || []),
    ...extraOptions,
  ]

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

      {travelerCount > GROUP_AIRLINE_CALL_THRESHOLD && (
        <div className="mb-6 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your group has {travelerCount} travelers. Airlines often require calling for group fares ({'>'}9 passengers) — members will need to handle that directly with the airline.
        </div>
      )}

      {status !== 'locked' && brief && (
        <AgentBriefPanel brief={brief} open={showBrief} onToggle={() => setShowBrief(v => !v)} />
      )}

      {/* LOCKED */}
      {status === 'locked' && session?.locked_summary && (
        <div className="space-y-6">
          <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
            <p className="eyebrow text-muted-foreground mb-1">Flights locked</p>
            <p className="font-serif text-2xl text-forest-deep mb-2">
              {fmtFlightDate((session.locked_summary as FlightScenario).departure_date)} → {fmtFlightDate((session.locked_summary as FlightScenario).return_date)}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {(session.locked_summary as FlightScenario).label} · {formatCost((session.locked_summary as FlightScenario).avg_per_person_usd)} avg/person
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" onClick={() => router.push(`/trips/${tripId}/accommodation`)} className="avanti-btn avanti-btn-primary">
                Continue to hotels →
              </button>
              <button type="button" onClick={() => router.push(`/trips/${tripId}/bookings`)} className="avanti-btn avanti-btn-ghost">
                Add confirmation →
              </button>
            </div>
            {isOrganizer && (
              <button type="button" disabled={busy} onClick={handleUnlock} className="mt-4 bg-transparent border-0 p-0 cursor-pointer text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-forest-deep transition-colors">
                {busy ? 'Reopening…' : '← Change flight selection'}
              </button>
            )}
          </div>

          {(session.locked_summary as FlightScenario).member_plans?.length > 0 && (
            <div className="avanti-box border border-border bg-card p-6">
              <p className="font-serif text-xl mb-1">Book your flights</p>
              <p className="text-sm text-muted-foreground mb-4">
                Search with your dates pre-filled — then forward the confirmation email to your trip vault.
              </p>
              <div className="space-y-3">
                {(session.locked_summary as FlightScenario).member_plans.map(plan => {
                  const locked = session.locked_summary as FlightScenario
                  const dest =
                    extractIata(analysis?.destination_airport || '') ||
                    plan.segments?.[plan.segments.length - 1]?.to ||
                    String(trip.destination)
                  const origin = plan.segments?.[0]?.from || plan.departure_city
                  const href = flightSearchUrl({
                    origin,
                    destination: dest,
                    departDate: locked.departure_date,
                    returnDate: locked.return_date,
                    pubref: tripId,
                    label: 'flights',
                  })
                  const googleHref = googleFlightsUrl({
                    origin,
                    destination: dest,
                    departDate: locked.departure_date,
                    returnDate: locked.return_date,
                  })
                  return (
                    <div key={plan.traveler_id} className="flex flex-wrap items-center justify-between gap-3 border border-border/60 px-4 py-3">
                      <div>
                        <p className="font-serif text-base m-0">{plan.traveler_name}</p>
                        <p className="text-xs text-muted-foreground m-0">{origin} → {dest}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <BookSearchLink href={href} label="Search flights →" variant="primary" />
                        <BookSearchLink href={googleHref} label="Google Flights" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
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

      {/* SEARCH — mode is set, but no results yet. Filters replace the old questionnaire. */}
      {status !== 'locked' && coordinationMode && status !== 'analyzing' && flightOptions.length === 0 && (!analysis?.scenarios?.length) && (
        <div className="space-y-5">
          <div className="avanti-box border border-border bg-card p-5">
            <p className="eyebrow text-muted-foreground mb-1">Group mode</p>
            <p className="font-serif text-lg m-0">{COORDINATION_LABELS[coordinationMode]}</p>
            <p className="text-xs text-muted-foreground mt-2 m-0">
              We&apos;ll build the results from everyone&apos;s saved profile (home airport, loyalty, seat &amp; cabin rules) and this trip&apos;s dates. Refine with Google-Flights-style filters and the AI chat once results load.
            </p>
          </div>

          {isOrganizer ? (
            <button type="button" disabled={busy} onClick={handleAnalyze} className="avanti-btn avanti-btn-primary w-full">
              {busy ? 'Searching flights…' : 'Search flights →'}
            </button>
          ) : (
            <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
              <p className="font-serif text-lg mb-2">Waiting on organizer</p>
              <p className="text-sm text-muted-foreground m-0">They&apos;ll run the flight search for the group.</p>
            </div>
          )}
        </div>
      )}

      {/* ANALYZING */}
      {status === 'analyzing' && (
        <AnalyzingCard isOrganizer={isOrganizer} busy={busy} onRestart={handleAnalyze} />
      )}

      {/* RESULTS — Google-Flights-style list */}
      {status === 'review' && flightOptions.length > 0 && (
        <div className="space-y-5">
          {analysis?.price_drift_warning && (
            <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {analysis.price_drift_warning}
            </div>
          )}

          <FlightResultsBoard
            tripId={tripId}
            options={flightOptions}
            recommendedDates={analysis?.recommended_dates ?? null}
            isOrganizer={isOrganizer}
            busy={busy}
            onLock={handleLockOption}
            onNewOptions={opts => setExtraOptions(prev => [...prev, ...opts])}
          />

          {analysis?.booking_reminder && (
            <div className="border border-forest-deep/20 bg-forest-pale px-4 py-3 text-sm text-forest-deep">
              <span className="font-medium">Before you book: </span>{analysis.booking_reminder}
            </div>
          )}

          <div className="avanti-box border border-border bg-card p-5">
            <p className="font-serif text-lg mb-1">Upgrade advisor</p>
            <p className="text-sm text-muted-foreground mb-4">
              Uses your saved loyalty, cabin preferences, and flight pick to suggest upgrade strategies — like a travel-agent second opinion.
            </p>
            {!upgradeAdvice ? (
              <button type="button" disabled={upgradeBusy} onClick={handleUpgradeAdvice} className="avanti-btn avanti-btn-ghost">
                {upgradeBusy ? 'Analyzing…' : 'Get upgrade advice →'}
              </button>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="m-0">{upgradeAdvice.verdict}</p>
                {upgradeAdvice.strategies.length > 0 && (
                  <ul className="m-0 pl-4">
                    {upgradeAdvice.strategies.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
                {upgradeAdvice.prefill_checklist.length > 0 && (
                  <p className="text-xs text-muted-foreground m-0">
                    Add to your profile for sharper advice: {upgradeAdvice.prefill_checklist.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {isOrganizer && (
            <button type="button" disabled={busy} onClick={handleAnalyze} className="avanti-btn avanti-btn-ghost w-full text-sm">
              {busy ? 'Refreshing…' : 'Re-run the search from scratch'}
            </button>
          )}

          <p className="text-[11px] text-muted-foreground text-center pt-1">
            {analysis?.data_disclaimer ||
              (analysis?.fare_source === 'mixed'
                ? 'Prices combine live airline and Google Flights search results. Confirm the total fare on the airline site before booking.'
                : analysis?.fare_source === 'live'
                  ? 'Prices are live search results and can change quickly. Confirm the total fare on the airline site before booking.'
                  : 'Prices are AI estimates for planning. Confirm the live fare, dates, and total on the airline or search site before booking.')}
          </p>
        </div>
      )}

      {/* Fallback: older analyses that only produced grouped scenarios */}
      {status === 'review' && flightOptions.length === 0 && analysis?.scenarios && analysis.scenarios.length > 0 && (
        <div className="space-y-6">
          {analysis.summary && <p className="text-sm italic text-muted-foreground">{analysis.summary}</p>}
          {analysis.scenarios.map(scenario => (
            <ScenarioCard
              key={scenario.id}
              tripId={tripId}
              scenario={scenario}
              voteEstimate={data.voteEstimate}
              coordinationMode={coordinationMode}
              destinationLabel={String(trip.destination)}
              destinationAirport={analysis.destination_airport}
              expanded={expandedScenario === scenario.id}
              onToggle={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
              expandedMember={expandedMember}
              onToggleMember={id => setExpandedMember(expandedMember === id ? null : id)}
              isOrganizer={isOrganizer}
              busy={busy}
              onLock={() => handleLockScenario(scenario.id)}
            />
          ))}
        </div>
      )}

      {status === 'review' && flightOptions.length === 0 && analysis?.scenarios?.length === 0 && (
        <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
          <p className="font-serif text-lg mb-4">The search didn&apos;t return options</p>
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

function AnalyzingCard({
  isOrganizer,
  busy,
  onRestart,
}: {
  isOrganizer: boolean
  busy: boolean
  onRestart: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const mm = Math.floor(elapsed / 60)
  const ss = String(elapsed % 60).padStart(2, '0')
  // Fill toward ~110s but never quite complete, so it always feels alive.
  const pct = Math.min(95, Math.round((elapsed / 110) * 100))
  const overdue = elapsed > 150

  return (
    <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
      <div className="flex justify-center mb-6">
        <SuitcaseSpinner size={72} />
      </div>
      <p className="font-serif text-xl mb-2">Searching fares, routes, and timing</p>
      <p className="text-sm text-muted-foreground mb-1">The agent is pricing ~8 options against your best dates.</p>
      <p className="text-xs text-muted-foreground mb-5">
        {mm}:{ss} elapsed · usually 1–2 minutes · results appear here automatically
      </p>

      <div className="mx-auto mb-6 h-1 w-full max-w-sm overflow-hidden rounded-full bg-border/60">
        <div className="h-full bg-forest-deep transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>

      {overdue && (
        <p className="text-xs text-amber-700 mb-4">This is taking longer than usual — you can restart the search.</p>
      )}

      {isOrganizer && (
        <button type="button" disabled={busy} onClick={onRestart} className="avanti-btn avanti-btn-ghost text-sm">
          Restart the search
        </button>
      )}
    </div>
  )
}

function ScenarioCard({
  tripId,
  scenario,
  voteEstimate,
  coordinationMode,
  destinationLabel,
  destinationAirport,
  expanded,
  onToggle,
  expandedMember,
  onToggleMember,
  isOrganizer,
  busy,
  onLock,
}: {
  tripId: string
  scenario: FlightScenario
  voteEstimate: number | null
  coordinationMode: CoordinationMode | null | undefined
  destinationLabel: string
  destinationAirport?: string
  expanded: boolean
  onToggle: () => void
  expandedMember: string | null
  onToggleMember: (id: string) => void
  isOrganizer: boolean
  busy: boolean
  onLock: () => void
}) {
  const destCode =
    extractIata(destinationAirport || '') ||
    destinationLabel

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

      {/* Pros / cons */}
      {((scenario.pros && scenario.pros.length > 0) || (scenario.cons && scenario.cons.length > 0)) && (
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          {scenario.pros && scenario.pros.length > 0 && (
            <div className="border border-emerald-100 bg-emerald-50/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-emerald-800 mb-1">Pros</p>
              <ul className="list-none pl-0 m-0 space-y-0.5">
                {scenario.pros.map((p, i) => <li key={i} className="text-xs text-emerald-900">+ {p}</li>)}
              </ul>
            </div>
          )}
          {scenario.cons && scenario.cons.length > 0 && (
            <div className="border border-rose-100 bg-rose-50/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-rose-800 mb-1">Cons</p>
              <ul className="list-none pl-0 m-0 space-y-0.5">
                {scenario.cons.map((c, i) => <li key={i} className="text-xs text-rose-900">− {c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {scenario.best_time_to_book && (
        <p className="text-xs text-muted-foreground mb-3">
          <span className="font-medium text-forest-deep">Best time to book: </span>{scenario.best_time_to_book}
        </p>
      )}

      {scenario.airport_options && scenario.airport_options.length > 0 && (
        <div className="border border-border/60 px-4 py-3 mb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Airport options</p>
          {scenario.airport_options.map((a, i) => (
            <p key={i} className="text-xs text-muted-foreground m-0">
              {a.airport}{a.est_total_usd != null ? ` · ~${formatCost(a.est_total_usd)}` : ''} · {a.drive_or_transit}{a.note ? ` — ${a.note}` : ''}
            </p>
          ))}
        </div>
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
              tripId={tripId}
              plan={plan}
              destination={destCode}
              departDate={scenario.departure_date}
              returnDate={scenario.return_date}
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
  tripId,
  plan,
  destination,
  departDate,
  returnDate,
  expanded,
  onToggle,
}: {
  tripId: string
  plan: MemberFlightPlan
  destination: string
  departDate: string
  returnDate: string
  expanded: boolean
  onToggle: () => void
}) {
  const flightTypeLabel =
    plan.flight_type === 'nonstop' ? 'Nonstop' : plan.flight_type === 'one_stop' ? '1 stop' : 'Multi-stop'

  const origin = plan.segments?.[0]?.from || plan.departure_city
  const dest = plan.segments?.[plan.segments.length - 1]?.to || destination
  const affiliateCtx = { pubref: tripId, label: 'flights' }
  const bookHref = flightSearchUrl({
    origin,
    destination: dest,
    departDate,
    returnDate,
    ...affiliateCtx,
  })
  const googleHref = googleFlightsUrl({
    origin,
    destination: dest,
    departDate,
    returnDate,
  })

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
          {plan.seat_match && (
            <p className="text-xs text-muted-foreground m-0"><strong>Seat:</strong> {plan.seat_match}</p>
          )}
          {(plan.status_perks_used?.length > 0 || plan.card_perks_used?.length > 0) && (
            <p className="text-xs text-muted-foreground m-0">
              Perks: {[...(plan.status_perks_used || []), ...(plan.card_perks_used || [])].join(' · ')}
            </p>
          )}

          {plan.loyalty_earning && (
            <p className="text-xs m-0">
              <strong>Earns:</strong> ~{plan.loyalty_earning.miles_or_points.toLocaleString()} {plan.loyalty_earning.program}
              {plan.loyalty_earning.note ? ` — ${plan.loyalty_earning.note}` : ''}
            </p>
          )}

          {plan.hidden_fees && (
            <div className="border border-amber-100 bg-amber-50/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-amber-800 mb-1">Real cost breakdown</p>
              <div className="text-xs text-amber-900 space-y-0.5">
                <p className="m-0 flex justify-between"><span>Advertised fare</span><span>{formatCost(plan.hidden_fees.advertised_usd)}</span></p>
                {plan.hidden_fees.bags_usd > 0 && <p className="m-0 flex justify-between"><span>Bags</span><span>+{formatCost(plan.hidden_fees.bags_usd)}</span></p>}
                {plan.hidden_fees.seat_selection_usd > 0 && <p className="m-0 flex justify-between"><span>Seat selection</span><span>+{formatCost(plan.hidden_fees.seat_selection_usd)}</span></p>}
                {plan.hidden_fees.other_usd > 0 && <p className="m-0 flex justify-between"><span>Other add-ons</span><span>+{formatCost(plan.hidden_fees.other_usd)}</span></p>}
                <p className="m-0 flex justify-between border-t border-amber-200 pt-0.5 font-medium"><span>Real total</span><span>{formatCost(plan.hidden_fees.real_total_usd)}</span></p>
              </div>
              {plan.hidden_fees.note && <p className="text-[11px] text-amber-800 m-0 mt-1">{plan.hidden_fees.note}</p>}
            </div>
          )}

          {plan.rule_flags && plan.rule_flags.length > 0 && (
            <div className="border border-rose-100 bg-rose-50/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-rose-800 mb-1">Heads up — breaks your rules</p>
              {plan.rule_flags.map((r, i) => <p key={i} className="text-xs text-rose-900 m-0">• {r}</p>)}
            </div>
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

          <div className="flex flex-wrap gap-2 mt-2">
            <BookSearchLink href={bookHref} label="Search & book this route →" variant="primary" />
            <BookSearchLink href={googleHref} label="Google Flights" />
          </div>
        </div>
      )}
      {!expanded && (
        <div className="mt-2 flex flex-wrap gap-2">
          <BookSearchLink href={bookHref} label="Search flights →" variant="primary" />
          <BookSearchLink href={googleHref} label="Google" />
        </div>
      )}
    </div>
  )
}

function AgentBriefPanel({ brief, open, onToggle }: { brief: AgentBrief; open: boolean; onToggle: () => void }) {
  return (
    <div className="avanti-box border border-border bg-card px-4 py-2.5 mb-6">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <span className="font-serif text-sm text-forest-deep m-0">What Avanti knows</span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Review'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="border border-border/60 bg-forest-mist/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">This trip</p>
            {brief.trip_summary.map((line, i) => (
              <p key={i} className="text-xs m-0 text-forest-deep">{line}</p>
            ))}
          </div>

          {brief.travelers.map((tv, i) => (
            <div key={i} className="border border-border/60 px-4 py-3">
              <p className="font-serif text-base m-0 mb-1">{tv.name}</p>
              {tv.known.map((k, j) => (
                <p key={j} className="text-xs text-muted-foreground m-0">✓ {k}</p>
              ))}
              {tv.missing.length > 0 && (
                <p className="text-xs text-amber-800 m-0 mt-1">Add: {tv.missing.join(', ')}</p>
              )}
            </div>
          ))}

          {brief.global_gaps.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 px-4 py-3">
              {brief.global_gaps.map((g, i) => (
                <p key={i} className="text-xs text-amber-900 m-0">{g}</p>
              ))}
            </div>
          )}
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
