/**
 * Resy API client — SCAFFOLD.
 *
 * Resy's booking API is partner-only (you apply, get an API key). Until that key
 * exists, dining keeps using the pre-filled Resy search link in `search-links.ts`.
 *
 * This mirrors `opentable-client.ts` so both providers share the same shape and
 * the dining route/UI can treat them uniformly. Server-only by construction: it
 * reads RESY_API_KEY (no NEXT_PUBLIC_ prefix), which is never bundled into client
 * code. Call it from API routes / server components only.
 *
 * Flow once live:
 *   1. `isResyConfigured()` → gate live features behind the key.
 *   2. `searchResyAvailability(...)` → real bookable time slots.
 *   3. `resyBookingUrl(slot)` → deep link to confirm a specific slot.
 */

/** Base URL for Resy's partner API. Override per environment if needed. */
const RESY_API_BASE =
  process.env.RESY_API_BASE?.replace(/\/$/, '') || 'https://api.resy.com'

export type ResySearchInput = {
  /** Restaurant name to match. */
  name?: string
  /** City / destination for location context. */
  destination: string
  /** Reservation date, YYYY-MM-DD. */
  date: string
  /** 24h time HH:MM. */
  time: string
  partySize: number
}

export type ResyRestaurant = {
  id: string
  name: string
  cuisine?: string
  neighborhood?: string
  slots: ResySlot[]
}

export type ResySlot = {
  /** ISO 8601 datetime of the reservable slot. */
  dateTime: string
  partySize: number
  /** Opaque token used to confirm/book this exact slot, when the API provides one. */
  configToken?: string
}

/** True when a partner API key is present, so live features can be enabled. */
export function isResyConfigured(): boolean {
  return Boolean(process.env.RESY_API_KEY)
}

/**
 * Look up real-time availability. Returns [] when unconfigured so callers can
 * transparently fall back to the search deep links. Throws only on a real API
 * error once configured.
 */
export async function searchResyAvailability(
  input: ResySearchInput,
): Promise<ResyRestaurant[]> {
  const apiKey = process.env.RESY_API_KEY
  if (!apiKey) return []

  const url = new URL(`${RESY_API_BASE}/3/venuesearch/search`)
  url.searchParams.set('query', [input.name, input.destination].filter(Boolean).join(' '))
  url.searchParams.set('day', input.date)
  url.searchParams.set('party_size', String(input.partySize))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `ResyAPI api_key="${apiKey}"`,
      Accept: 'application/json',
    },
    // Availability is time-sensitive; don't let Next cache it.
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Resy availability request failed (${res.status})`)
  }

  const json = (await res.json()) as unknown
  return normalizeAvailability(json)
}

/**
 * Map the raw partner-API payload into our shape. Kept isolated so the exact
 * field names can be adjusted to the real API contract without touching callers.
 */
function normalizeAvailability(payload: unknown): ResyRestaurant[] {
  if (!payload || typeof payload !== 'object') return []
  const raw = (payload as { venues?: unknown }).venues
  if (!Array.isArray(raw)) return []

  return raw.map((v): ResyRestaurant => {
    const item = (v ?? {}) as Record<string, unknown>
    const slots = Array.isArray(item.slots) ? item.slots : []
    return {
      id: String(item.id ?? ''),
      name: String(item.name ?? 'Restaurant'),
      cuisine: item.cuisine ? String(item.cuisine) : undefined,
      neighborhood: item.neighborhood ? String(item.neighborhood) : undefined,
      slots: slots.map((s): ResySlot => {
        const slot = (s ?? {}) as Record<string, unknown>
        return {
          dateTime: String(slot.dateTime ?? ''),
          partySize: typeof slot.partySize === 'number' ? slot.partySize : 0,
          configToken: slot.configToken ? String(slot.configToken) : undefined,
        }
      }),
    }
  })
}

/**
 * Build a booking URL for a specific slot. Uses the config token when the API
 * provides one; otherwise falls back to the restaurant page.
 */
export function resyBookingUrl(
  restaurant: Pick<ResyRestaurant, 'id'>,
  slot: ResySlot,
): string {
  const url = new URL('https://resy.com/cities/reservation')
  url.searchParams.set('venueId', restaurant.id)
  url.searchParams.set('date', slot.dateTime)
  url.searchParams.set('seats', String(slot.partySize))
  if (slot.configToken) url.searchParams.set('configToken', slot.configToken)
  return url.toString()
}
