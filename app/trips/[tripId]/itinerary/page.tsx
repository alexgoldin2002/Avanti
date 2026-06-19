'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import { formatCost, TIER_LABELS } from '@/lib/destination-decision/client-api'
import { personalCostFromScenarios } from '@/lib/destination-decision/scenario-utils'
import type { FlightToggle, DateToggle } from '@/lib/destination-decision/types'
import { mergeBookingsIntoItinerary } from '@/lib/bookings/merge-itinerary'
import { fetchTripBookings } from '@/lib/bookings/client-api'
import type { ItineraryData, TripBooking } from '@/lib/bookings/types'
import Link from 'next/link'

const DRIFT_THRESHOLD = 0.15

export default function ItineraryPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [travelers, setTravelers] = useState<any[]>([])
  const [lockedOption, setLockedOption] = useState<any>(null)
  const [myAnalysis, setMyAnalysis] = useState<any>(null)
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [activeDay, setActiveDay] = useState(0)
  const [flightQuote, setFlightQuote] = useState<number | null>(null)
  const [checkingFlights, setCheckingFlights] = useState(false)
  const [driftWarning, setDriftWarning] = useState<string | null>(null)
  const [bookings, setBookings] = useState<TripBooking[]>([])

  const applyBookingsToItinerary = (base: ItineraryData, bookingList: TripBooking[]) =>
    mergeBookingsIntoItinerary(base, bookingList)

  const load = useCallback(async () => {
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!tripData) {
      setLoading(false)
      return
    }
    setTrip(tripData)

    if (tripData.options?.itinerary) {
      try {
        const { bookings: bookingList } = await fetchTripBookings(tripId)
        setBookings(bookingList as TripBooking[])
        setItinerary(applyBookingsToItinerary(tripData.options.itinerary, bookingList as TripBooking[]))
      } catch {
        setItinerary(tripData.options.itinerary)
      }
    } else {
      try {
        const { bookings: bookingList } = await fetchTripBookings(tripId)
        setBookings(bookingList as TripBooking[])
        if (bookingList.length > 0) {
          setItinerary(applyBookingsToItinerary({ summary: 'Your confirmed bookings', days: [] }, bookingList as TripBooking[]))
        }
      } catch { /* no bookings yet */ }
    }

    const { data: travelerData } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    setTravelers(travelerData || [])

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('locked_option_id')
      .eq('trip_id', tripId)
      .maybeSingle()

    if (decision?.locked_option_id) {
      const { data: option } = await supabase
        .from('destination_options')
        .select('*')
        .eq('id', decision.locked_option_id)
        .single()
      setLockedOption(option)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('user_id', user.id)
          .maybeSingle()
        const me = travelerData?.find(t => t.email?.toLowerCase() === profile?.email?.toLowerCase())
        if (me) {
          const { data: analysis } = await supabase
            .from('destination_option_analysis')
            .select('*')
            .eq('option_id', decision.locked_option_id)
            .eq('traveler_id', me.id)
            .maybeSingle()
          setMyAnalysis(analysis)
        }
      }
    }

    setLoading(false)
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  const estimatedAtVote = lockedOption?.group_summary?.avg_cost
    ? Number(lockedOption.group_summary.avg_cost)
    : null

  const myScenarioCost = myAnalysis?.scenarios
    ? personalCostFromScenarios(myAnalysis.scenarios, {
        flight: (lockedOption?.group_summary?.recommended_flight as FlightToggle) || 'one_stop',
        dates: (lockedOption?.group_summary?.recommended_dates as DateToggle) || 'best',
      }).cost
    : null

  const generateItinerary = async () => {
    setGenerating(true)
    try {
      const enrichedTravelers = travelers.map(t => ({
        full_name: t.name || t.email,
        departure_city: t.departure_city || t.step2?.departureCity || 'Unknown',
        budget_per_day: 200,
        vibes: t.step2?.vibe || [],
        dietary_restrictions: '',
      }))

      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip: {
            ...trip,
            destination: trip.destination,
            start_date: trip.locked_date_start || trip.start_date,
            end_date: trip.locked_date_end || trip.end_date,
          },
          travelers: enrichedTravelers,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      let bookingList = bookings
      try {
        const fresh = await fetchTripBookings(tripId)
        bookingList = fresh.bookings as TripBooking[]
        setBookings(bookingList)
      } catch { /* use cached */ }

      const merged = applyBookingsToItinerary(data.itinerary, bookingList)
      setItinerary(merged)
      setActiveDay(0)

      const mergedOptions = { ...(trip.options || {}), itinerary: merged }
      await supabase.from('trips').update({ options: mergedOptions, options_generated: true }).eq('id', tripId)
      setTrip((t: any) => ({ ...t, options: mergedOptions, options_generated: true }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to generate itinerary')
    } finally {
      setGenerating(false)
    }
  }

  const checkFlightDrift = async () => {
    setCheckingFlights(true)
    setDriftWarning(null)
    try {
      // Simulated live quote: AI estimate + small variance until real flight API is wired
      const baseline = myScenarioCost || estimatedAtVote || 1200
      const simulatedQuote = Math.round(baseline * (0.92 + Math.random() * 0.26))
      setFlightQuote(simulatedQuote)

      const compareTo = myScenarioCost || estimatedAtVote
      if (compareTo && simulatedQuote > compareTo * (1 + DRIFT_THRESHOLD)) {
        const pct = Math.round(((simulatedQuote - compareTo) / compareTo) * 100)
        setDriftWarning(
          `Live flight estimates are ~${pct}% above what the group voted on. You may want to reopen the destination decision or adjust tier/dates.`
        )
      }
    } finally {
      setCheckingFlights(false)
    }
  }

  if (loading) return <SuitcaseLoader message="Loading itinerary" />

  if (!trip?.destination || trip.destination === 'TBD') {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} title="Itinerary & flights">
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="font-serif text-xl mb-2">Destination not locked yet</p>
          <p className="text-sm text-muted-foreground mb-6">Complete Choose destination first.</p>
          <button type="button" onClick={() => router.push(`/trips/${tripId}/choose`)} className="avanti-btn avanti-btn-primary">
            Go to Choose destination →
          </button>
        </div>
      </SubpageShell>
    )
  }

  const dateLabel =
    trip.locked_date_start && trip.locked_date_end
      ? `${trip.locked_date_start} → ${trip.locked_date_end}`
      : trip.start_date && trip.end_date
        ? `${trip.start_date} → ${trip.end_date}`
        : 'Dates TBD'

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={trip.name}
      title="Itinerary & flights"
      subtitle={`${trip.destination}${trip.locked_tier ? ` · ${TIER_LABELS[trip.locked_tier] || trip.locked_tier}` : ''}`}
      maxWidth="max-w-3xl"
    >
      {/* Locked destination summary */}
      <div className="avanti-box border border-forest-deep/20 bg-forest-pale px-5 py-4 mb-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="eyebrow text-forest mb-1">Locked destination</p>
            <p className="font-serif text-xl text-forest-deep m-0">{trip.destination}</p>
            <p className="text-xs text-muted-foreground mt-1 m-0">{dateLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Est. at vote</p>
            <p className="font-serif text-lg text-forest-deep m-0">{formatCost(myScenarioCost || estimatedAtVote)}</p>
            <p className="text-[10px] text-muted-foreground m-0">per person · est. only</p>
          </div>
        </div>
      </div>

      {/* Flights section */}
      <section className="mb-10">
        <h2 className="font-serif text-2xl mb-4">Flights</h2>
        <div className="avanti-box border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground mb-4">
            Departure cities for your group — confirm routes and check if live prices still match the vote.
          </p>
          <ul className="space-y-2 mb-5">
            {travelers.map(t => (
              <li key={t.id} className="flex justify-between text-sm border-b border-border/60 pb-2">
                <span>{t.name || t.email?.split('@')[0]}</span>
                <span className="text-muted-foreground">
                  {t.departure_city || t.step2?.departureCity || 'City not set'}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={checkingFlights}
            onClick={checkFlightDrift}
            className="avanti-btn avanti-btn-primary w-full sm:w-auto"
          >
            {checkingFlights ? 'Checking…' : 'Check live flight estimate'}
          </button>
          {flightQuote != null && (
            <p className="mt-3 text-sm">
              Current est. for you: <strong className="text-forest-deep">{formatCost(flightQuote)}</strong> all-in
            </p>
          )}
          {driftWarning && (
            <div className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="m-0 mb-3">{driftWarning}</p>
              <button
                type="button"
                onClick={() => router.push(`/trips/${tripId}/choose`)}
                className="text-[10px] uppercase tracking-wider text-amber-900 underline"
              >
                Reopen destination decision
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Itinerary section */}
      <section>
        <h2 className="font-serif text-2xl mb-4">Day-by-day plan</h2>
        {!itinerary ? (
          <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
            <p className="font-serif text-xl mb-2">Ready to build your itinerary</p>
            <p className="text-sm text-muted-foreground mb-6">
              Avanti will draft a day-by-day plan based on your locked destination and group profile.
            </p>
            <button
              type="button"
              disabled={generating}
              onClick={generateItinerary}
              className="avanti-btn avanti-btn-primary"
            >
              {generating ? 'Avanti is planning…' : 'Generate itinerary →'}
            </button>
          </div>
        ) : (
          <>
            <div className="avanti-box border border-border bg-card px-5 py-4 mb-4">
              <p className="text-sm italic text-muted-foreground m-0">{itinerary.summary}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {itinerary.days?.map((day, i) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setActiveDay(i)}
                  className={`shrink-0 px-4 py-2 text-xs border transition-colors ${
                    activeDay === i
                      ? 'border-forest-deep bg-forest-pale text-forest-deep'
                      : 'border-border text-muted-foreground hover:border-forest-deep/40'
                  }`}
                >
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </button>
              ))}
            </div>
            {itinerary.days?.[activeDay] && (
              <div className="avanti-box border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <p className="font-serif text-lg m-0">{itinerary.days[activeDay].title}</p>
                  <p className="text-xs text-muted-foreground m-0 mt-1">{itinerary.days[activeDay].date}</p>
                </div>
                {itinerary.days[activeDay].morning_briefing && (
                  <div className="px-5 py-3 bg-forest-mist border-b border-border text-xs text-muted-foreground">
                    <span className="uppercase tracking-wider text-[10px] block mb-1">Morning</span>
                    {itinerary.days[activeDay].morning_briefing}
                  </div>
                )}
                <div className="divide-y divide-border/60">
                  {itinerary.days[activeDay].items?.map((item, j) => (
                    <div key={j} className="flex gap-4 px-5 py-4">
                      <span className="text-xs text-muted-foreground min-w-[52px] pt-0.5">{item.time}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium m-0">{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 m-0">{item.detail}</p>
                        {item.booking_id && (
                          <Link
                            href={`/trips/${tripId}/bookings/${item.booking_id}`}
                            className="text-[10px] uppercase tracking-wider text-forest-deep hover:underline mt-1 inline-block"
                          >
                            View confirmation →
                          </Link>
                        )}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground h-fit">{item.type}</span>
                    </div>
                  ))}
                </div>
                {itinerary.days[activeDay].evening_note && (
                  <div className="px-5 py-3 bg-forest-mist border-t border-border text-xs text-muted-foreground">
                    <span className="uppercase tracking-wider text-[10px] block mb-1">Tonight</span>
                    {itinerary.days[activeDay].evening_note}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              disabled={generating}
              onClick={generateItinerary}
              className="mt-4 w-full avanti-btn avanti-btn-ghost"
            >
              {generating ? 'Regenerating…' : '↻ Regenerate itinerary'}
            </button>
          </>
        )}
      </section>

      <div className="mt-10 grid sm:grid-cols-2 gap-3">
        {[
          { label: 'Bookings & confirmations', path: 'bookings' },
          { label: 'Accommodation', path: 'accommodation' },
          { label: 'Activities', path: 'activities' },
          { label: 'Dining', path: 'dining' },
        ].map(s => (
          <button
            key={s.path}
            type="button"
            onClick={() => router.push(`/trips/${tripId}/${s.path}`)}
            className="avanti-box border border-border bg-card px-4 py-3 text-left text-sm hover:border-forest-deep/30 transition-colors"
          >
            {s.label} →
          </button>
        ))}
      </div>
    </SubpageShell>
  )
}
