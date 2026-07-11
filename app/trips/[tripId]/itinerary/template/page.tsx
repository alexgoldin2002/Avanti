'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SubpageShell from '../../../../components/SubpageShell'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import ItineraryTemplate from '../../../../components/ItineraryTemplate'
import { mergeFullItinerary } from '@/lib/trip-companion/merge-full-itinerary'
import { fetchTripBookings } from '@/lib/bookings/client-api'
import { fetchInspirations } from '@/lib/trip-companion/client-api'
import type { ItineraryData, TripBooking } from '@/lib/bookings/types'
import type { TripInspirationRow } from '@/lib/trip-companion/merge-inspirations'

export default function ItineraryTemplatePage() {
  const { tripId } = useParams() as { tripId: string }
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null)
  const [bookings, setBookings] = useState<TripBooking[]>([])

  const load = useCallback(async () => {
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!tripData) {
      setLoading(false)
      return
    }
    setTrip(tripData)

    let bookingList: TripBooking[] = []
    try {
      const res = await fetchTripBookings(tripId)
      bookingList = res.bookings as TripBooking[]
      setBookings(bookingList)
    } catch {
      /* no bookings yet */
    }

    const base: ItineraryData = tripData.options?.itinerary || { summary: '', days: [] }
    try {
      let inspirations: TripInspirationRow[] = []
      try {
        inspirations = (await fetchInspirations(tripId)) as TripInspirationRow[]
      } catch {
        /* none */
      }
      setItinerary(mergeFullItinerary(base, bookingList, inspirations))
    } catch {
      setItinerary(base)
    }

    setLoading(false)
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <SuitcaseLoader message="Loading itinerary" />

  if (!trip) {
    return (
      <SubpageShell backHref={`/trips/${tripId}`} backLabel="Trip" title="Itinerary">
        <div className="avanti-box border border-border bg-forest-mist px-6 py-10 text-center">
          <p className="m-0 font-serif text-xl">Trip not found</p>
        </div>
      </SubpageShell>
    )
  }

  const dateLabel =
    trip.locked_date_start && trip.locked_date_end
      ? `${trip.locked_date_start} → ${trip.locked_date_end}`
      : trip.start_date && trip.end_date
        ? `${trip.start_date} → ${trip.end_date}`
        : null

  return (
    <SubpageShell backHref={`/trips/${tripId}/itinerary`} backLabel="Itinerary" maxWidth="max-w-3xl">
      <ItineraryTemplate
        tripId={tripId}
        tripName={trip.name || 'Your Trip'}
        destination={trip.destination && trip.destination !== 'TBD' ? trip.destination : null}
        dateLabel={dateLabel}
        itinerary={itinerary}
        bookings={bookings}
      />
    </SubpageShell>
  )
}
