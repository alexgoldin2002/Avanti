'use client'

import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import BookSearchLink from '../../../components/BookSearchLink'
import { TIER_LABELS } from '@/lib/destination-decision/client-api'
import { googleHotelsUrl, bookingComUrl, hotelDestinationFromTrip } from '@/lib/booking/search-links'
import { usePlanningPage, LockedGate } from '../planning-shared'

export default function AccommodationPage() {
  const p = usePlanningPage('accommodation')
  if (p.loading) return <SuitcaseLoader message="Loading accommodation" />
  if (!p.locked) return <LockedGate tripId={p.tripId} router={p.router} />
  if (!p.flightsLocked) return <LockedGate tripId={p.tripId} router={p.router} requireFlights={true} flightsLocked={p.flightsLocked} />

  const checkIn = p.trip?.locked_date_start || p.trip?.start_date || ''
  const checkOut = p.trip?.locked_date_end || p.trip?.end_date || ''
  const hotelDest = hotelDestinationFromTrip(String(p.trip?.destination || ''))
  const guestCount = p.trip?.traveler_count || 2

  return (
    <SubpageShell
      backHref={`/trips/${p.tripId}/itinerary`}
      backLabel="Itinerary"
      eyebrow={p.trip?.name}
      title="Accommodation"
      subtitle={`${p.trip.destination}${p.trip.locked_tier ? ` · ${TIER_LABELS[p.trip.locked_tier]}` : ''}`}
      maxWidth="max-w-3xl"
    >
      {!p.data ? (
        <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
          <p className="font-serif text-xl mb-2">Find stays for your group</p>
          <p className="text-sm text-muted-foreground mb-6">Avanti picks options matched to your locked tier and destination.</p>
          <button type="button" disabled={p.generating} onClick={p.generate} className="avanti-btn avanti-btn-primary">
            {p.generating ? 'Searching…' : 'Suggest places to stay →'}
          </button>
        </div>
      ) : (
        <>
          {p.data.intro && <p className="text-sm italic text-muted-foreground mb-6">{p.data.intro}</p>}
          <div className="space-y-3">
            {(p.data.options || []).map((opt, i) => {
              const name = String(opt.name || '')
              const query = [name, opt.area].filter(Boolean).join(' ')
              const hotelLinks =
                checkIn && checkOut
                  ? {
                      google: googleHotelsUrl({ destination: hotelDest, checkIn, checkOut, query, adults: guestCount }),
                      booking: bookingComUrl({ destination: hotelDest, checkIn, checkOut, query, adults: guestCount }),
                    }
                  : null
              return (
              <div key={i} className="avanti-box border border-border bg-card p-5">
                <div className="flex justify-between gap-2 mb-1">
                  <p className="font-serif text-lg m-0">{name}</p>
                  {opt.price_per_night_usd != null && (
                    <p className="text-sm text-forest-deep shrink-0">${String(opt.price_per_night_usd)}/night</p>
                  )}
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  {[opt.type, opt.area].filter(Boolean).join(' · ')}
                </p>
                {opt.why && <p className="text-sm text-muted-foreground m-0 mb-1">{String(opt.why)}</p>}
                {opt.group_fit && <p className="text-xs text-muted-foreground m-0 mb-3">{String(opt.group_fit)}</p>}
                {hotelLinks && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
                    <BookSearchLink href={hotelLinks.google} label="Google Hotels →" />
                    <BookSearchLink href={hotelLinks.booking} label="Booking.com →" />
                  </div>
                )}
              </div>
            )})}
          </div>
          <button type="button" disabled={p.generating} onClick={p.generate} className="mt-6 w-full avanti-btn avanti-btn-ghost">
            {p.generating ? 'Refreshing…' : '↻ Refresh suggestions'}
          </button>
          {checkIn && checkOut && (
            <div className="mt-8 avanti-box border border-border bg-forest-mist/40 p-5 text-center">
              <p className="font-serif text-lg mb-2">Book a stay</p>
              <p className="text-sm text-muted-foreground mb-4">
                Search with your locked dates ({checkIn} → {checkOut}) — then add the confirmation to your trip vault.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <BookSearchLink
                  href={googleHotelsUrl({ destination: hotelDest, checkIn, checkOut, adults: guestCount })}
                  label="Search Google Hotels →"
                  variant="primary"
                />
                <BookSearchLink
                  href={bookingComUrl({ destination: hotelDest, checkIn, checkOut, adults: guestCount })}
                  label="Search Booking.com →"
                />
                <button type="button" onClick={() => p.router.push(`/trips/${p.tripId}/bookings`)} className="avanti-btn avanti-btn-ghost">
                  Add confirmation →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </SubpageShell>
  )
}
