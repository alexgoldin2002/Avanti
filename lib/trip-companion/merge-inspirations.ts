import type { ItineraryData, ItineraryDay, ItineraryItem } from '@/lib/bookings/types'

export type TripInspirationRow = {
  id: string
  place_name: string
  place_category: string | null
  place_address: string | null
  place_city: string | null
  place_description: string | null
  suggested_day_date: string | null
  suggested_time: string | null
  suggestion_reason: string | null
  source_platform: string | null
  status: string
}

function categoryToType(category: string | null): string {
  if (category === 'restaurant' || category === 'cafe' || category === 'bar') return 'food'
  if (category === 'store' || category === 'market') return 'shopping'
  return category || 'activity'
}

export function inspirationToItem(insp: TripInspirationRow): ItineraryItem {
  const location = [insp.place_address, insp.place_city].filter(Boolean).join(', ')
  const platform = insp.source_platform ? ` · from ${insp.source_platform}` : ''
  return {
    time: insp.suggested_time || '—',
    name: insp.place_name,
    detail: insp.suggestion_reason || insp.place_description || location || `Saved place${platform}`,
    type: categoryToType(insp.place_category),
    inspiration_id: insp.id,
  }
}

/** Re-merge saved places marked added_to_itinerary (survives itinerary regeneration). */
export function mergeInspirationsIntoItinerary(
  itinerary: ItineraryData,
  inspirations: TripInspirationRow[]
): ItineraryData {
  const active = inspirations.filter(i => i.status === 'added_to_itinerary')
  if (active.length === 0) return itinerary

  const byDate = new Map<string, TripInspirationRow[]>()
  for (const insp of active) {
    const date = insp.suggested_day_date
    if (!date) continue
    const list = byDate.get(date) || []
    list.push(insp)
    byDate.set(date, list)
  }

  const days: ItineraryDay[] = itinerary.days.map(day => {
    const dayInspirations = byDate.get(day.date) || []
    const existingIds = new Set(
      day.items.filter(i => i.inspiration_id).map(i => i.inspiration_id)
    )
    const newItems = dayInspirations
      .filter(i => !existingIds.has(i.id))
      .map(inspirationToItem)

    const merged = [...day.items, ...newItems]
    merged.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    return { ...day, items: merged }
  })

  for (const [date, dayInspirations] of byDate) {
    if (days.some(d => d.date === date)) continue
    days.push({
      date,
      title: 'Saved places',
      items: dayInspirations.map(inspirationToItem),
    })
  }

  days.sort((a, b) => a.date.localeCompare(b.date))
  return { ...itinerary, days }
}

export function insertInspirationIntoItinerary(
  itinerary: ItineraryData,
  insp: TripInspirationRow,
  fallbackDate: string
): ItineraryData {
  const date = insp.suggested_day_date || fallbackDate
  const item = inspirationToItem(insp)
  const days = [...itinerary.days]
  const dayIndex = days.findIndex(d => d.date === date)

  if (dayIndex >= 0) {
    const day = days[dayIndex]
    const withoutDup = day.items.filter(i => i.inspiration_id !== insp.id)
    const merged = [...withoutDup, item].sort((a, b) =>
      (a.time || '99:99').localeCompare(b.time || '99:99')
    )
    days[dayIndex] = { ...day, items: merged }
  } else {
    days.push({ date, title: 'Saved places', items: [item] })
    days.sort((a, b) => a.date.localeCompare(b.date))
  }

  return { ...itinerary, days }
}
