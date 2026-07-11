'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ItineraryData, ItineraryDay, TripBooking } from '@/lib/bookings/types'
import { CATEGORY_LABELS } from '@/lib/bookings/client-api'

type Props = {
  tripId: string
  tripName: string
  destination?: string | null
  dateLabel?: string | null
  itinerary: ItineraryData | null
  bookings: TripBooking[]
}

function CornerLogo({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none select-none text-forest-deep/70 ${className}`}
      style={{
        fontFamily: 'var(--font-cormorant), Georgia, serif',
        fontSize: '12px',
        letterSpacing: '0.4em',
        lineHeight: 1,
      }}
    >
      AVANTI
    </span>
  )
}

function bookingDateKey(b: TripBooking) {
  return b.starts_at ? b.starts_at.slice(0, 10) : null
}

function bookingsForDay(day: ItineraryDay, bookings: TripBooking[]) {
  const referencedIds = new Set(
    (day.items || []).map(i => i.booking_id).filter(Boolean) as string[]
  )
  const seen = new Set<string>()
  const result: TripBooking[] = []
  for (const b of bookings) {
    const matchesDate = bookingDateKey(b) === day.date
    const matchesItem = referencedIds.has(b.id)
    if ((matchesDate || matchesItem) && !seen.has(b.id)) {
      seen.add(b.id)
      result.push(b)
    }
  }
  return result
}

function formatBookingTime(b: TripBooking) {
  if (!b.starts_at) return null
  return new Date(b.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function dayLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function BookingRow({ tripId, b }: { tripId: string; b: TripBooking }) {
  const time = formatBookingTime(b)
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-0">
        <p className="m-0 text-sm font-medium text-foreground truncate">
          {b.display_title || b.vendor_name || CATEGORY_LABELS[b.category] || 'Booking'}
        </p>
        <p className="m-0 mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {CATEGORY_LABELS[b.category] || b.category}
          {time ? ` · ${time}` : ''}
        </p>
        {b.location && <p className="m-0 mt-1 text-xs text-muted-foreground truncate">{b.location}</p>}
        {b.confirmation_number && (
          <p className="m-0 mt-0.5 font-mono text-[11px] text-muted-foreground">Conf {b.confirmation_number}</p>
        )}
      </div>
      <Link
        href={`/trips/${tripId}/bookings/${b.id}`}
        className="shrink-0 text-[10px] uppercase tracking-wider text-forest-deep hover:underline"
      >
        View →
      </Link>
    </div>
  )
}

function CollapsibleTop({
  eyebrow,
  title,
  count,
  icon,
  children,
}: {
  eyebrow: string
  title: string
  count: number
  icon: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="avanti-box border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          <i className={`ti ${icon} text-xl text-forest-deep`} aria-hidden />
          <span>
            <span className="eyebrow block text-muted-foreground">{eyebrow}</span>
            <span className="font-serif text-lg text-foreground">{title}</span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {count} {count === 1 ? 'booking' : 'bookings'}
          </span>
          <i
            className={`ti ti-chevron-down text-lg text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
      </button>
      {open && <div className="border-t border-border px-5 py-2">{children}</div>}
    </div>
  )
}

export default function ItineraryTemplate({
  tripId,
  tripName,
  destination,
  dateLabel,
  itinerary,
  bookings,
}: Props) {
  const [openDay, setOpenDay] = useState<number | null>(0)
  const [folderDay, setFolderDay] = useState<number | null>(null)

  const flights = useMemo(() => bookings.filter(b => b.category === 'flight'), [bookings])
  const hotels = useMemo(() => bookings.filter(b => b.category === 'hotel'), [bookings])

  const days = itinerary?.days || []
  const folderBookings = folderDay != null && days[folderDay] ? bookingsForDay(days[folderDay], bookings) : []

  return (
    <div className="relative">
      {/* Framed itinerary document with the Avanti wordmark in each corner */}
      <div className="relative avanti-box border border-forest-deep/20 bg-card px-6 py-10 sm:px-10">
        <CornerLogo className="absolute left-5 top-4" />
        <CornerLogo className="absolute right-5 top-4" />
        <CornerLogo className="absolute bottom-4 left-5" />
        <CornerLogo className="absolute bottom-4 right-5" />

        {/* Header — trip name is the title */}
        <header className="mb-10 text-center">
          <p className="eyebrow text-muted-foreground mb-3">Your Itinerary</p>
          <h1 className="font-serif text-4xl font-light text-foreground sm:text-5xl">{tripName}</h1>
          {(destination || dateLabel) && (
            <p className="mt-3 font-serif italic text-muted-foreground">
              {[destination, dateLabel].filter(Boolean).join('  ·  ')}
            </p>
          )}
          <div className="mx-auto mt-6 h-px w-16 bg-forest-deep/30" />
        </header>

        {/* Flights + Hotels dropdowns */}
        <div className="mb-10 space-y-3">
          <CollapsibleTop eyebrow="Getting there" title="Flights" count={flights.length} icon="ti-plane">
            {flights.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No flights added yet.</p>
            ) : (
              flights.map(f => <BookingRow key={f.id} tripId={tripId} b={f} />)
            )}
          </CollapsibleTop>

          <CollapsibleTop eyebrow="Where you stay" title="Hotels" count={hotels.length} icon="ti-bed">
            {hotels.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No hotels added yet.</p>
            ) : (
              hotels.map(h => <BookingRow key={h.id} tripId={tripId} b={h} />)
            )}
          </CollapsibleTop>
        </div>

        {/* Day-by-day breakdown */}
        <section>
          <h2 className="mb-4 font-serif text-2xl text-foreground">Day by day</h2>

          {itinerary?.summary && (
            <div className="avanti-box mb-4 border border-border bg-forest-mist px-5 py-4">
              <p className="m-0 text-sm italic text-muted-foreground">{itinerary.summary}</p>
            </div>
          )}

          {days.length === 0 ? (
            <div className="avanti-box border border-border bg-card px-6 py-10 text-center">
              <p className="mb-1 font-serif text-lg text-foreground">No days planned yet</p>
              <p className="m-0 text-sm text-muted-foreground">
                Your day-by-day breakdown will appear here once the itinerary is built.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {days.map((day, i) => {
                const isOpen = openDay === i
                const dayBookings = bookingsForDay(day, bookings)
                return (
                  <div key={day.date || i} className="avanti-box border border-border bg-card">
                    <div className="flex items-stretch">
                      {/* Expand/collapse the day */}
                      <button
                        type="button"
                        onClick={() => setOpenDay(isOpen ? null : i)}
                        className="flex flex-1 items-center gap-3 px-5 py-4 text-left"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-pale text-xs text-forest-deep">
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-serif text-lg text-foreground">{day.title}</span>
                          {day.date && (
                            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                              {dayLabel(day.date)}
                            </span>
                          )}
                        </span>
                        <i
                          className={`ti ti-chevron-down ml-auto text-lg text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          aria-hidden
                        />
                      </button>

                      {/* Folder icon — this day's bookings live here */}
                      <button
                        type="button"
                        onClick={() => setFolderDay(i)}
                        title="Bookings for this day"
                        aria-label={`Bookings for ${day.title}`}
                        className="relative flex w-14 shrink-0 items-center justify-center border-l border-border text-forest-deep transition-colors hover:bg-forest-pale"
                      >
                        <i className="ti ti-folder text-xl" aria-hidden />
                        {dayBookings.length > 0 && (
                          <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-forest-deep px-1 text-[9px] font-medium text-cream">
                            {dayBookings.length}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Expanded per-day plan with time breakdown */}
                    {isOpen && (
                      <div className="border-t border-border">
                        {day.morning_briefing && (
                          <div className="border-b border-border bg-forest-mist px-5 py-3 text-xs text-muted-foreground">
                            <span className="mb-1 block text-[10px] uppercase tracking-wider">Morning</span>
                            {day.morning_briefing}
                          </div>
                        )}
                        {day.items?.length ? (
                          <div className="divide-y divide-border/60">
                            {day.items.map((item, j) => (
                              <div key={j} className="flex gap-4 px-5 py-4">
                                <span className="min-w-[56px] pt-0.5 text-xs text-muted-foreground">{item.time}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="m-0 text-sm font-medium text-foreground">{item.name}</p>
                                  {item.detail && (
                                    <p className="m-0 mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                                  )}
                                  {item.booking_id && (
                                    <Link
                                      href={`/trips/${tripId}/bookings/${item.booking_id}`}
                                      className="mt-1 inline-block text-[10px] uppercase tracking-wider text-forest-deep hover:underline"
                                    >
                                      Confirmation →
                                    </Link>
                                  )}
                                </div>
                                {item.type && (
                                  <span className="h-fit text-[10px] uppercase tracking-wider text-muted-foreground">
                                    {item.type}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="px-5 py-4 text-sm text-muted-foreground">Nothing scheduled for this day yet.</p>
                        )}
                        {day.evening_note && (
                          <div className="border-t border-border bg-forest-mist px-5 py-3 text-xs text-muted-foreground">
                            <span className="mb-1 block text-[10px] uppercase tracking-wider">Tonight</span>
                            {day.evening_note}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Legal / privacy notice */}
        <footer className="mt-12 border-t border-border pt-6 text-center">
          <p className="m-0 text-[10px] leading-relaxed tracking-wide text-muted-foreground">
            © {new Date().getFullYear()} Avanti. All rights reserved. This itinerary and its contents are
            confidential and proprietary to Avanti and are provided solely for the personal use of the named
            traveler(s). No part of this document may be copied, reproduced, distributed, or republished without
            the prior written consent of Avanti.
          </p>
        </footer>
      </div>

      {/* Per-day bookings folder popup */}
      {folderDay != null && days[folderDay] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-forest-deep/40 px-4"
          onClick={() => setFolderDay(null)}
        >
          <div
            className="avanti-box relative w-full max-w-md border border-border bg-card"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <i className="ti ti-folder-open text-xl text-forest-deep" aria-hidden />
                <div>
                  <p className="eyebrow m-0 text-muted-foreground">Bookings</p>
                  <p className="m-0 font-serif text-lg text-foreground">{days[folderDay].title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFolderDay(null)}
                aria-label="Close"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <i className="ti ti-x text-lg" aria-hidden />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-5 py-2">
              {folderBookings.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No bookings tied to this day yet.
                </p>
              ) : (
                folderBookings.map(b => <BookingRow key={b.id} tripId={tripId} b={b} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
