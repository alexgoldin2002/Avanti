import type { ItineraryData, ItineraryDay, ItineraryItem, TripBooking } from './types'

function dateKey(iso: string | null): string | null {
  if (!iso) return null
  try {
    return iso.slice(0, 10)
  } catch {
    return null
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function bookingToItem(b: TripBooking): ItineraryItem {
  const time = formatTime(b.starts_at)
  const conf = b.confirmation_number ? `Conf. ${b.confirmation_number}` : 'Confirmation on file'
  return {
    time: time || '—',
    name: b.display_title,
    detail: `${conf} · Booked by ${b.booker?.name || 'group'}`,
    type: b.category === 'restaurant' ? 'food' : b.category === 'hotel' ? 'transport' : b.category,
    booking_id: b.id,
  }
}

/** Merge trip bookings into itinerary days by date; add booking_id links. */
export function mergeBookingsIntoItinerary(
  itinerary: ItineraryData,
  bookings: TripBooking[]
): ItineraryData {
  const byDate = new Map<string, TripBooking[]>()
  for (const b of bookings) {
    if (b.status === 'cancelled') continue
    const dk = dateKey(b.starts_at)
    if (!dk) continue
    const list = byDate.get(dk) || []
    list.push(b)
    byDate.set(dk, list)
  }

  const days: ItineraryDay[] = itinerary.days.map(day => {
    const dayBookings = byDate.get(day.date) || []
    const existingIds = new Set(
      day.items.filter(i => i.booking_id).map(i => i.booking_id)
    )
    const newItems: ItineraryItem[] = dayBookings
      .filter(b => !existingIds.has(b.id))
      .map(bookingToItem)

    const merged = [...day.items, ...newItems]
    merged.sort((a, b) => {
      const ta = a.time || '99:99'
      const tb = b.time || '99:99'
      return ta.localeCompare(tb)
    })

    return { ...day, items: merged }
  })

  // Days that only have bookings but no itinerary day yet
  for (const [date, dayBookings] of byDate) {
    if (days.some(d => d.date === date)) continue
    days.push({
      date,
      title: 'Bookings',
      items: dayBookings.map(bookingToItem),
    })
  }

  days.sort((a, b) => a.date.localeCompare(b.date))

  return { ...itinerary, days }
}
