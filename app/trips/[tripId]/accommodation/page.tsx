'use client'

import { useEffect, useState } from 'react'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import BookSearchLink from '../../../components/BookSearchLink'
import { TIER_LABELS } from '@/lib/trip-display'
import {
  bookingComUrl,
  expediaHotelsUrl,
  googleHotelsUrl,
  vrboUrl,
  hotelDestinationFromTrip,
  isRentalStyleStay,
} from '@/lib/booking/search-links'
import { fetchLiveStays, type LiveStaysResponse } from '@/lib/stays/client-api'
import { fetchRentalSearch, type RentalSearchResponse } from '@/lib/rentals/client-api'
import { usePlanningPage, LockedGate } from '../planning-shared'

export default function AccommodationPage() {
  const p = usePlanningPage('accommodation')
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveStays, setLiveStays] = useState<LiveStaysResponse | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [rentalBusy, setRentalBusy] = useState(false)
  const [rentals, setRentals] = useState<RentalSearchResponse | null>(null)

  if (p.loading) return <SuitcaseLoader message="Loading accommodation" />
  if (!p.locked) return <LockedGate tripId={p.tripId} router={p.router} />
  if (!p.flightsLocked) return <LockedGate tripId={p.tripId} router={p.router} requireFlights={true} flightsLocked={p.flightsLocked} />

  const checkIn = p.trip?.locked_date_start || p.trip?.start_date || ''
  const checkOut = p.trip?.locked_date_end || p.trip?.end_date || ''
  const hotelDest = hotelDestinationFromTrip(String(p.trip?.destination || ''))
  const guestCount = p.trip?.traveler_count || 2

  const hotelParams = { destination: hotelDest, checkIn, checkOut, adults: guestCount, pubref: p.tripId, label: 'accommodation' }

  const loadLiveStays = async () => {
    setLiveBusy(true)
    setLiveError(null)
    try {
      const result = await fetchLiveStays(p.tripId)
      setLiveStays(result)
      if (result.error) setLiveError(result.error)
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Failed to search')
    } finally {
      setLiveBusy(false)
    }
  }

  useEffect(() => {
    if (!checkIn || !checkOut || !p.locked) return
    let cancelled = false
    ;(async () => {
      setRentalBusy(true)
      try {
        const result = await fetchRentalSearch(p.tripId)
        if (!cancelled) setRentals(result)
      } catch { /* non-blocking */ }
      finally {
        if (!cancelled) setRentalBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [p.tripId, checkIn, checkOut, p.locked])

  const vrboSearchHref =
    rentals?.searchLinks.vrbo ||
    (checkIn && checkOut ? vrboUrl(hotelParams) : null)

  const rentalSection = checkIn && checkOut && (
    <div className="avanti-box border border-border bg-card p-5 mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-muted-foreground mb-1">Vacation rentals (VRBO)</p>
          <p className="text-sm text-muted-foreground m-0">
            Villas and whole-home stays for your group — search on VRBO, then add the confirmation to your vault.
          </p>
        </div>
        <BookSearchLink
          href={vrboSearchHref || '#'}
          label={rentalBusy ? 'Loading…' : 'Search VRBO →'}
          variant="primary"
          className={!vrboSearchHref ? 'pointer-events-none opacity-50' : ''}
        />
      </div>

      {!rentals && rentalBusy && (
        <p className="text-xs text-muted-foreground mt-4 mb-0">Loading tracked VRBO link…</p>
      )}

      {rentals && (
        <p className="text-xs text-muted-foreground mt-4 mb-0">
          {rentals.affiliateConfigured
            ? 'VRBO affiliate tracking is on.'
            : 'Add affiliate env vars in Vercel (see docs/booking-partners-spec.md).'}
          {rentals.liveInventory ? ' Expedia Rapid VRBO is configured for future in-app checkout.' : ''}
        </p>
      )}
    </div>
  )

  const bookLinksFooter = checkIn && checkOut && (
    <div className="mt-8 avanti-box border border-border bg-forest-mist/40 p-5 text-center">
      <p className="font-serif text-lg mb-2">Book a stay</p>
      <p className="text-sm text-muted-foreground mb-4">
        Hotels via live search or Booking.com — whole-home stays via VRBO ({checkIn} → {checkOut}).
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <BookSearchLink href={bookingComUrl(hotelParams)} label="Booking.com →" variant="primary" />
        <BookSearchLink href={expediaHotelsUrl(hotelParams)} label="Expedia →" />
        {vrboSearchHref && <BookSearchLink href={vrboSearchHref} label="VRBO →" />}
        <BookSearchLink href={googleHotelsUrl(hotelParams)} label="Google Hotels" />
        <button type="button" onClick={() => p.router.push(`/trips/${p.tripId}/bookings`)} className="avanti-btn avanti-btn-ghost">
          Add confirmation →
        </button>
      </div>
    </div>
  )

  return (
    <SubpageShell
      backHref={`/trips/${p.tripId}/itinerary`}
      backLabel="Itinerary"
      eyebrow={p.trip?.name}
      title="Accommodation"
      subtitle={`${p.trip.destination}${p.trip.locked_tier ? ` · ${TIER_LABELS[p.trip.locked_tier]}` : ''}`}
      maxWidth="max-w-3xl"
    >
      {checkIn && checkOut && (
        <div className="avanti-box border border-border bg-card p-5 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-muted-foreground mb-1">Live hotel rates</p>
              <p className="text-sm text-muted-foreground m-0">
                Real prices from our hotel partner when configured — VRBO for vacation rentals.
              </p>
            </div>
            <button
              type="button"
              disabled={liveBusy}
              onClick={loadLiveStays}
              className="avanti-btn avanti-btn-primary shrink-0"
            >
              {liveBusy ? 'Searching…' : 'Search live rates →'}
            </button>
          </div>

          {liveError && (
            <p className="text-sm text-red-700 mt-4 mb-0">{liveError}</p>
          )}

          {liveStays && !liveStays.configured && (
            <p className="text-sm text-muted-foreground mt-4 mb-0">
              Add <code className="text-xs">LITEAPI_API_KEY</code> in Vercel to enable live hotel search (like Duffel for flights).
            </p>
          )}

          {liveStays && liveStays.configured && liveStays.offers.length === 0 && !liveError && (
            <p className="text-sm text-muted-foreground mt-4 mb-0">No live rates found for these dates — try the search links below.</p>
          )}

          {liveStays && liveStays.offers.length > 0 && (
            <div className="space-y-3 mt-5 border-t border-border pt-5">
              {liveStays.offers.map(offer => (
                <div key={offer.hotelId} className="flex flex-wrap justify-between gap-3 border border-border/60 px-4 py-3">
                  <div>
                    <p className="font-serif text-base m-0">{offer.name}</p>
                    <p className="text-xs text-muted-foreground m-0 mt-1">
                      {[offer.stars != null && `${offer.stars}★`, offer.rating != null && `${offer.rating}/10`, offer.roomName].filter(Boolean).join(' · ')}
                    </p>
                    {offer.address && <p className="text-xs text-muted-foreground m-0 mt-1">{offer.address}</p>}
                  </div>
                  <div className="text-right">
                    {offer.minPerNightUsd != null && (
                      <p className="font-serif text-lg text-forest-deep m-0">${offer.minPerNightUsd}/night</p>
                    )}
                    {offer.minTotalUsd != null && (
                      <p className="text-[10px] text-muted-foreground m-0">${Math.round(offer.minTotalUsd)} total</p>
                    )}
                    <BookSearchLink
                      href={bookingComUrl({ ...hotelParams, query: offer.name })}
                      label="Book →"
                      className="mt-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rentalSection}

      {!p.data ? (
        <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
          <p className="font-serif text-xl mb-2">Find stays for your group</p>
          <p className="text-sm text-muted-foreground mb-6">Avanti picks options matched to your locked tier and destination.</p>
          <button type="button" disabled={p.generating} onClick={p.generate} className="avanti-btn avanti-btn-primary">
            {p.generating ? 'Searching…' : 'Suggest places to stay →'}
          </button>
          {bookLinksFooter}
        </div>
      ) : (
        <>
          {p.data.intro && <p className="text-sm italic text-muted-foreground mb-6">{p.data.intro}</p>}
          <div className="space-y-3">
            {(p.data.options || []).map((opt, i) => {
              const name = String(opt.name || '')
              const type = String(opt.type || '')
              const query = [name, opt.area].filter(Boolean).join(' ')
              const links =
                checkIn && checkOut
                  ? {
                      google: googleHotelsUrl({ ...hotelParams, query }),
                      booking: bookingComUrl({ ...hotelParams, query }),
                      expedia: expediaHotelsUrl({ ...hotelParams, query }),
                      vrbo: vrboUrl({ ...hotelParams, query: name }),
                    }
                  : null
              const preferRental = isRentalStyleStay(type)
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
                  {links && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
                      {preferRental ? (
                        <>
                          <BookSearchLink href={links.vrbo} label="Search VRBO →" variant="primary" />
                          <BookSearchLink href={links.booking} label="Hotels →" />
                        </>
                      ) : (
                        <>
                          <BookSearchLink href={links.booking} label="Booking.com →" variant="primary" />
                          <BookSearchLink href={links.expedia} label="Expedia →" />
                          <BookSearchLink href={links.vrbo} label="VRBO →" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button type="button" disabled={p.generating} onClick={p.generate} className="mt-6 w-full avanti-btn avanti-btn-ghost">
            {p.generating ? 'Refreshing…' : '↻ Refresh suggestions'}
          </button>
          {bookLinksFooter}
        </>
      )}
    </SubpageShell>
  )
}
