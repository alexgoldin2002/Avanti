'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader, { SuitcaseSpinner } from '../../../components/SuitcaseLoader'
import BookSearchLink from '../../../components/BookSearchLink'
import { TIER_LABELS } from '@/lib/trip-display'
import {
  fetchAccommodationSession,
  setStayCoordination,
  runStayAnalysis,
  lockStay,
  unlockStay,
  formatCost,
  type AccommodationSessionResponse,
} from '@/lib/accommodation/client-api'
import type { StayAnalysis, StayCoordinationMode, StayOption } from '@/lib/accommodation/types'
import { STAY_COORDINATION_LABELS } from '@/lib/accommodation/types'
import StayResultsBoard, { fmtStayDate } from './StayResults'

export default function AccommodationPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AccommodationSessionResponse | null>(null)
  const [showSources, setShowSources] = useState(false)

  const load = useCallback(async () => {
    try {
      const json = (await fetchAccommodationSession(tripId)) as AccommodationSessionResponse
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

  const isAnalyzing = data?.session?.status === 'analyzing'
  useEffect(() => {
    if (!isAnalyzing) return
    const t = setInterval(() => { load() }, 5000)
    return () => clearInterval(t)
  }, [isAnalyzing, load])

  if (loading) return <SuitcaseLoader message="Loading accommodation" />

  if (!data?.trip) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} backLabel="Trip" title="Accommodation">
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">{error ? 'Couldn’t load accommodation' : 'Accommodation isn’t ready yet'}</p>
          <p className="text-sm text-muted-foreground mb-6">
            {error || 'Finish flights first, then come back here to find stays.'}
          </p>
          <button type="button" onClick={() => router.push(`/trips/${tripId}`)} className="avanti-btn avanti-btn-primary">
            Back to trip →
          </button>
        </div>
      </SubpageShell>
    )
  }

  const trip = data.trip
  const session = data.session
  const status = session?.status || 'setup'
  const analysis = session?.analysis as StayAnalysis | null | undefined
  const isOrganizer = data.isOrganizer
  const coordinationMode = session?.coordination_mode
  const stayOptions: StayOption[] = analysis?.stay_options || []

  if (!trip.flights_locked) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Accommodation">
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">Lock flights first</p>
          <p className="text-sm text-muted-foreground mb-6 m-0">
            Hotel search uses your locked flight dates. Finish Step 3 before searching for stays.
          </p>
          <button type="button" onClick={() => router.push(`/trips/${tripId}/flights`)} className="avanti-btn avanti-btn-primary">
            Go to flights →
          </button>
        </div>
      </SubpageShell>
    )
  }

  const handleCoordination = async (mode: StayCoordinationMode) => {
    setBusy(true)
    setError(null)
    try {
      await setStayCoordination(tripId, mode)
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
      await runStayAnalysis(tripId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  const handleLock = async (optionId: string) => {
    if (!confirm('Lock this stay for the group? Everyone will book from the links provided.')) return
    setBusy(true)
    setError(null)
    try {
      await lockStay(tripId, optionId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lock failed')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    if (!confirm('Reopen stay selection?')) return
    setBusy(true)
    try {
      await unlockStay(tripId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const checkIn = String(trip.locked_date_start || trip.start_date || '')
  const checkOut = String(trip.locked_date_end || trip.end_date || '')

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={String(trip.name)}
      title="Accommodation"
      subtitle={`${trip.destination}${trip.locked_tier ? ` · ${TIER_LABELS[String(trip.locked_tier)] || trip.locked_tier}` : ''}${checkIn && checkOut ? ` · ${fmtStayDate(checkIn)} → ${fmtStayDate(checkOut)}` : ''}`}
      maxWidth="max-w-3xl"
    >
      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {/* Connected sources */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowSources(v => !v)}
          className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-forest-deep"
        >
          {showSources ? 'Hide' : 'Show'} connected sources ({data.connectedSources.length})
        </button>
        {showSources && (
          <ul className="mt-2 text-xs text-muted-foreground space-y-1 pl-4">
            {data.connectedSources.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        )}
      </div>

      {/* LOCKED */}
      {status === 'locked' && session?.locked_summary && (
        <div className="space-y-6">
          <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
            <p className="eyebrow text-muted-foreground mb-1">Stay locked</p>
            <p className="font-serif text-2xl text-forest-deep mb-2">
              {(session.locked_summary as StayOption).name}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {formatCost((session.locked_summary as StayOption).price_per_night_usd)}/night · {formatCost((session.locked_summary as StayOption).total_usd)} total
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" onClick={() => router.push(`/trips/${tripId}/activities`)} className="avanti-btn avanti-btn-primary">
                Continue to activities →
              </button>
              <button type="button" onClick={() => router.push(`/trips/${tripId}/bookings`)} className="avanti-btn avanti-btn-ghost">
                Add confirmation →
              </button>
            </div>
            {isOrganizer && (
              <button type="button" disabled={busy} onClick={handleUnlock} className="mt-4 bg-transparent border-0 p-0 cursor-pointer text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-forest-deep">
                {busy ? 'Reopening…' : '← Change stay selection'}
              </button>
            )}
          </div>

          <div className="avanti-box border border-border bg-card p-6">
            <p className="font-serif text-xl mb-1">Book your stay</p>
            <p className="text-sm text-muted-foreground mb-4">
              Use the tracked links below, then add your confirmation to the trip vault.
            </p>
            <div className="flex flex-wrap gap-2">
              {(session.locked_summary as StayOption).book_links.booking && (
                <BookSearchLink href={(session.locked_summary as StayOption).book_links.booking!} label="Booking.com →" variant="primary" />
              )}
              {(session.locked_summary as StayOption).book_links.expedia && (
                <BookSearchLink href={(session.locked_summary as StayOption).book_links.expedia!} label="Expedia →" />
              )}
              {(session.locked_summary as StayOption).book_links.vrbo && (
                <BookSearchLink href={(session.locked_summary as StayOption).book_links.vrbo!} label="VRBO →" />
              )}
              {(session.locked_summary as StayOption).book_links.google && (
                <BookSearchLink href={(session.locked_summary as StayOption).book_links.google!} label="Google Hotels" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* SETUP — coordination */}
      {status !== 'locked' && (!coordinationMode || status === 'setup') && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            How should the group stay? The organizer sets this before we search hotels and rentals.
          </p>
          {isOrganizer ? (
            <div className="grid gap-3">
              {(['together', 'split', 'mix'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  disabled={busy}
                  onClick={() => handleCoordination(mode)}
                  className="avanti-box group border border-border bg-card p-5 text-left transition-all hover:-translate-y-px hover:border-forest-deep/30"
                >
                  <p className="font-serif text-lg mb-1 group-hover:text-forest-deep">{STAY_COORDINATION_LABELS[mode]}</p>
                  <p className="text-xs text-muted-foreground m-0">
                    {mode === 'together' && 'One villa, large rental, or suite block — best for groups who want shared space.'}
                    {mode === 'split' && 'Multiple hotel rooms or units in the same area — privacy with easy meetups.'}
                    {mode === 'mix' && 'Some share a rental, others take hotel rooms — flexible for different budgets.'}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
              <p className="font-serif text-lg mb-2">Waiting on organizer</p>
              <p className="text-sm text-muted-foreground m-0">They&apos;ll choose how the group stays together.</p>
            </div>
          )}
        </div>
      )}

      {/* SEARCH */}
      {status !== 'locked' && coordinationMode && status !== 'analyzing' && stayOptions.length === 0 && (
        <div className="space-y-5">
          <div className="avanti-box border border-border bg-card p-5">
            <p className="eyebrow text-muted-foreground mb-1">Group mode</p>
            <p className="font-serif text-lg m-0">{STAY_COORDINATION_LABELS[coordinationMode]}</p>
            <p className="text-xs text-muted-foreground mt-2 m-0">
              We search LiteAPI for live hotel rates, then compare across Booking.com, Expedia, VRBO, Google Hotels, and Airbnb. AI ranks options for your tier and group size.
            </p>
          </div>

          {isOrganizer ? (
            <button type="button" disabled={busy} onClick={handleAnalyze} className="avanti-btn avanti-btn-primary w-full">
              {busy ? 'Searching stays…' : 'Search stays →'}
            </button>
          ) : (
            <div className="avanti-box border border-border bg-card px-6 py-8 text-center">
              <p className="font-serif text-lg mb-2">Waiting on organizer</p>
              <p className="text-sm text-muted-foreground m-0">They&apos;ll run the stay search for the group.</p>
            </div>
          )}
        </div>
      )}

      {/* ANALYZING */}
      {status === 'analyzing' && (
        <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
          <SuitcaseSpinner />
          <p className="font-serif text-xl mt-4 mb-2">Searching stays</p>
          <p className="text-sm text-muted-foreground m-0">
            Pulling live rates and ranking options for {data.guestCount} guests…
          </p>
          {isOrganizer && (
            <button type="button" disabled={busy} onClick={handleAnalyze} className="mt-6 avanti-btn avanti-btn-ghost">
              {busy ? 'Still running…' : 'Taking too long? Run again'}
            </button>
          )}
        </div>
      )}

      {/* RESULTS */}
      {status === 'review' && stayOptions.length > 0 && (
        <div className="space-y-5">
          {analysis?.price_drift_warning && (
            <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {analysis.price_drift_warning}
            </div>
          )}

          {analysis?.summary && (
            <p className="text-sm text-muted-foreground italic m-0">{analysis.summary}</p>
          )}

          <StayResultsBoard
            options={stayOptions}
            isOrganizer={isOrganizer}
            busy={busy}
            onLock={handleLock}
            onRefresh={isOrganizer ? handleAnalyze : undefined}
          />

          {analysis?.data_disclaimer && (
            <p className="text-[11px] text-muted-foreground m-0">{analysis.data_disclaimer}</p>
          )}

          {analysis?.stay_tips && analysis.stay_tips.length > 0 && (
            <div className="avanti-box border border-border bg-forest-mist/40 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tips</p>
              <ul className="text-sm m-0 pl-4 space-y-1">
                {analysis.stay_tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </SubpageShell>
  )
}
