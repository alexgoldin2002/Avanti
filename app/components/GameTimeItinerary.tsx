'use client'

import Link from 'next/link'
import type { ItineraryData, TripBooking } from '@/lib/bookings/types'

type Props = {
  tripId: string
  itinerary: ItineraryData | null
  bookings: TripBooking[]
  compact?: boolean
}

function bookingById(bookings: TripBooking[], id?: string) {
  return id ? bookings.find(b => b.id === id) : undefined
}

function formatBookingMeta(b: TripBooking) {
  const parts: string[] = []
  if (b.confirmation_number) parts.push(`Conf ${b.confirmation_number}`)
  if (b.location) parts.push(b.location)
  if (b.booker?.phone) parts.push(b.booker.phone)
  return parts
}

export default function GameTimeItinerary({ tripId, itinerary, bookings, compact }: Props) {
  const hotels = bookings.filter(b => b.category === 'hotel')
  const flights = bookings.filter(b => b.category === 'flight')

  if (!itinerary?.days?.length && bookings.length === 0) {
    return (
      <div className="avanti-box border border-border bg-card px-5 py-8 text-center">
        <p className="font-serif text-lg mb-2">No itinerary yet</p>
        <p className="text-xs text-muted-foreground mb-4">Generate your day-by-day plan or add bookings.</p>
        <Link href={`/trips/${tripId}/itinerary`} className="text-[10px] uppercase tracking-wider text-forest-deep hover:underline">
          Build itinerary →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {(flights.length > 0 || hotels.length > 0) && (
        <section>
          <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Confirmations</p>
          <div className="space-y-2">
            {flights.map(f => (
              <div key={f.id} className="avanti-box border border-forest-deep/20 bg-forest-pale px-4 py-3">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium m-0">{f.display_title || f.vendor_name || 'Flight'}</p>
                  <Link href={`/trips/${tripId}/bookings/${f.id}`} className="text-[10px] uppercase tracking-wider text-forest-deep shrink-0">
                    View →
                  </Link>
                </div>
                {f.confirmation_number && (
                  <p className="text-xs text-muted-foreground mt-1 m-0 font-mono">{f.confirmation_number}</p>
                )}
                {f.starts_at && (
                  <p className="text-xs text-muted-foreground m-0 mt-0.5">
                    {new Date(f.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                )}
              </div>
            ))}
            {hotels.map(h => (
              <div key={h.id} className="avanti-box border border-border bg-card px-4 py-3">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium m-0">{h.vendor_name || h.display_title || 'Hotel'}</p>
                  <Link href={`/trips/${tripId}/bookings/${h.id}`} className="text-[10px] uppercase tracking-wider text-forest-deep shrink-0">
                    View →
                  </Link>
                </div>
                {h.location && <p className="text-xs text-muted-foreground mt-1 m-0">{h.location}</p>}
                {h.booker?.phone && <p className="text-xs text-muted-foreground m-0">{h.booker.phone}</p>}
                {h.confirmation_number && (
                  <p className="text-xs font-mono text-muted-foreground m-0 mt-0.5">Conf {h.confirmation_number}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {itinerary?.days?.map(day => (
        <section key={day.date}>
          <div className="flex items-baseline justify-between mb-2">
            <p className="font-serif text-lg m-0">{day.title}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground m-0">
              {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
          {!compact && day.morning_briefing && (
            <p className="text-xs text-muted-foreground mb-2 italic m-0">{day.morning_briefing}</p>
          )}
          <div className="avanti-box border border-border bg-card divide-y divide-border/60">
            {day.items?.map((item, j) => {
              const linked = bookingById(bookings, item.booking_id)
              return (
                <div key={j} className="flex gap-3 px-4 py-3">
                  <span className="text-[10px] text-muted-foreground min-w-[48px] pt-0.5">{item.time}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm m-0">{item.name}</p>
                    {!compact && item.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5 m-0">{item.detail}</p>
                    )}
                    {linked && (
                      <p className="text-[10px] text-muted-foreground mt-1 m-0 font-mono">
                        {formatBookingMeta(linked).join(' · ')}
                      </p>
                    )}
                    {item.inspiration_id && (
                      <Link
                        href={`/trips/${tripId}/saves`}
                        className="text-[10px] uppercase tracking-wider text-forest-deep hover:underline mt-0.5 inline-block"
                      >
                        Saved place →
                      </Link>
                    )}
                    {item.booking_id && (
                      <Link
                        href={`/trips/${tripId}/bookings/${item.booking_id}`}
                        className="text-[10px] uppercase tracking-wider text-forest-deep hover:underline mt-0.5 inline-block"
                      >
                        Confirmation →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
