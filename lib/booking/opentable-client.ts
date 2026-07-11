/**
 * OpenTable API client — SCAFFOLD.
 *
 * OpenTable's real-time availability + booking API is partner-gated (you apply
 * for access and receive an API key). Until that key exists, the rest of the app
 * keeps using the pre-filled search deep links in `search-links.ts`.
 *
 * This module is the seam so that the day a key arrives it's a one-line `.env`
 * change (OPENTABLE_API_KEY=...) — no rearchitecting. Server-only: never import
 * this into a client component, and never expose the key to the browser.
 *
 * Flow once live:
 *   1. `isOpenTableConfigured()` → gate live features behind the key.
 *   2. `searchOpenTableAvailability(...)` → real bookable time slots.
 *   3. `openTableBookingUrl(slot)` → deep link to confirm a specific slot.
 *
 * Server-only by construction: it reads OPENTABLE_API_KEY (no NEXT_PUBLIC_
 * prefix), which is never bundled into client code. Call it from API routes /
 * server components only.
 */

/** Base URL for OpenTable's partner API. Override per environment if needed. */
const OPENTABLE_API_BASE =
  process.env.OPENTABLE_API_BASE?.replace(/\/$/, '') ||
  'https://platform.opentable.com'

export type OpenTableSearchInput = {
  /** Restaurant name to match, when linking a specific suggestion. */
  name?: string
  /** City / destination for location context. */
  destination: string
  /** Reservation date, YYYY-MM-DD. */
  date: string
  /** 24h time HH:MM. */
  time: string
  partySize: number
}

/** A single bookable restaurant returned from a search. */
export type OpenTableRestaurant = {
  id: string
  name: string
  cuisine?: string
  priceBand?: number
  neighborhood?: string
  /** Bookable time slots near the requested time. */
  slots: OpenTableSlot[]
}

export type OpenTableSlot = {
  /** ISO 8601 datetime of the reservable slot. */
  dateTime: string
  /** Party size the slot is offered for. */
  partySize: number
  /** Opaque token used to confirm/book this exact slot, when the API provides one. */
  offerToken?: string
}

/** True when a partner API key is present, so live features can be enabled. */
export function isOpenTableConfigured(): boolean {
  return Boolean(process.env.OPENTABLE_API_KEY)
}

/**
 * Look up real-time availability. Returns [] when unconfigured so callers can
 * transparently fall back to the search deep links. Throws only on a real API
 * error once configured.
 */
export async function searchOpenTableAvailability(
  input: OpenTableSearchInput,
): Promise<OpenTableRestaurant[]> {
  const apiKey = process.env.OPENTABLE_API_KEY
  if (!apiKey) return []

  const url = new URL(`${OPENTABLE_API_BASE}/v2/availability`)
  url.searchParams.set('query', [input.name, input.destination].filter(Boolean).join(' '))
  url.searchParams.set('date', input.date)
  url.searchParams.set('time', input.time)
  url.searchParams.set('partySize', String(input.partySize))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    // Availability is time-sensitive; don't let Next cache it.
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`OpenTable availability request failed (${res.status})`)
  }

  const json = (await res.json()) as unknown
  return normalizeAvailability(json)
}

/**
 * Map the raw partner-API payload into our shape. Kept isolated so the exact
 * field names can be adjusted to the real API contract without touching callers.
 */
function normalizeAvailability(payload: unknown): OpenTableRestaurant[] {
  if (!payload || typeof payload !== 'object') return []
  const raw = (payload as { restaurants?: unknown }).restaurants
  if (!Array.isArray(raw)) return []

  return raw.map((r): OpenTableRestaurant => {
    const item = (r ?? {}) as Record<string, unknown>
    const slots = Array.isArray(item.slots) ? item.slots : []
    return {
      id: String(item.id ?? ''),
      name: String(item.name ?? 'Restaurant'),
      cuisine: item.cuisine ? String(item.cuisine) : undefined,
      priceBand: typeof item.priceBand === 'number' ? item.priceBand : undefined,
      neighborhood: item.neighborhood ? String(item.neighborhood) : undefined,
      slots: slots.map((s): OpenTableSlot => {
        const slot = (s ?? {}) as Record<string, unknown>
        return {
          dateTime: String(slot.dateTime ?? ''),
          partySize: typeof slot.partySize === 'number' ? slot.partySize : 0,
          offerToken: slot.offerToken ? String(slot.offerToken) : undefined,
        }
      }),
    }
  })
}

/**
 * Build a booking URL for a specific slot. Uses the offer token when the API
 * provides one; otherwise falls back to a restaurant page deep link.
 */
export function openTableBookingUrl(
  restaurant: Pick<OpenTableRestaurant, 'id'>,
  slot: OpenTableSlot,
): string {
  const url = new URL('https://www.opentable.com/booking/restref/availability')
  url.searchParams.set('rid', restaurant.id)
  url.searchParams.set('datetime', slot.dateTime)
  url.searchParams.set('covers', String(slot.partySize))
  if (slot.offerToken) url.searchParams.set('offerToken', slot.offerToken)
  return url.toString()
}
