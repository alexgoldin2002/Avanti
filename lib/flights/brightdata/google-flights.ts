import {
  BRIGHT_DATA_FLIGHTS_DATASET_ID,
  brightDataScrape,
  isBrightDataConfigured,
} from './client'
import { googleFlightsUrl } from '@/lib/booking/search-links'
import type { FlightOption } from '../types'

type BrightDataFlightRow = {
  airline?: string
  departure_time?: string
  arrival_time?: string
  duration?: string
  stops?: string
  price?: string
  co2_emissions?: string
  emissions_variation?: string
}

type BrightDataFlightsPayload = {
  flights?: BrightDataFlightRow[]
  search_url?: string
}

function parsePriceUsd(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseStops(stops: string | undefined): { count: number; label: string; layover: string | null } {
  if (!stops) return { count: 0, label: 'Nonstop', layover: null }
  const lower = stops.toLowerCase()
  if (lower.includes('nonstop') || lower === '0') {
    return { count: 0, label: 'Nonstop', layover: null }
  }
  const match = lower.match(/(\d+)\s*stop/)
  const count = match ? Number.parseInt(match[1], 10) : 1
  const layover = stops.includes(' in ') ? stops.split(' in ').slice(1).join(' in ').trim() : null
  return {
    count: Number.isFinite(count) ? count : 1,
    label: count === 1 ? '1 stop' : `${count} stops`,
    layover,
  }
}

function parseDurationHours(label: string | undefined): { hours: number; label: string } {
  if (!label) return { hours: 0, label: '—' }
  const hr = label.match(/(\d+)\s*hr/)
  const min = label.match(/(\d+)\s*min/)
  const hours = (hr ? Number(hr[1]) : 0) + (min ? Number(min[1]) / 60 : 0)
  return { hours: Math.round(hours * 10) / 10, label }
}

function parseArrivalPlusDays(arrival: string): number {
  const match = arrival.match(/\+(\d+)\s*$/)
  return match ? Number.parseInt(match[1], 10) : 0
}

function cleanTime(raw: string | undefined): string {
  if (!raw) return '—'
  return raw.replace(/\+\d+\s*$/, '').trim()
}

function splitAirlines(airline: string | undefined): string[] {
  if (!airline?.trim()) return ['Airline']
  const parts = airline
    .split(/,(?![^()]*\))/)
    .map(s => s.trim())
    .filter(Boolean)
  return parts.length ? parts : [airline.trim()]
}

function operatedByFromAirline(airline: string | undefined): string | null {
  if (!airline) return null
  const idx = airline.toLowerCase().indexOf('operated by')
  if (idx === -1) return null
  return airline.slice(idx).trim()
}

function extractFlightsArray(data: unknown): BrightDataFlightRow[] {
  if (!data) return []
  if (Array.isArray(data)) {
    const rows: BrightDataFlightRow[] = []
    for (const item of data) {
      if (item && typeof item === 'object') {
        const obj = item as BrightDataFlightsPayload & BrightDataFlightRow
        if (Array.isArray(obj.flights)) rows.push(...obj.flights)
        else if (obj.airline || obj.price) rows.push(obj)
      }
    }
    return rows
  }
  if (typeof data === 'object') {
    const obj = data as BrightDataFlightsPayload
    if (Array.isArray(obj.flights)) return obj.flights
  }
  return []
}

function rowToFlightOption(
  row: BrightDataFlightRow,
  index: number,
  ctx: { origin: string; destination: string; departDate: string; returnDate: string }
): FlightOption | null {
  const price = parsePriceUsd(row.price)
  if (price == null) return null

  const stops = parseStops(row.stops)
  const duration = parseDurationHours(row.duration)
  const arrivePlus = parseArrivalPlusDays(row.arrival_time || '')
  const airlines = splitAirlines(row.airline)

  return {
    id: `google-${ctx.origin}-${ctx.destination}-${index}-${price}`,
    airlines,
    operated_by: operatedByFromAirline(row.airline),
    origin: ctx.origin,
    destination: ctx.destination,
    departure_date: ctx.departDate,
    return_date: ctx.returnDate,
    depart_time: cleanTime(row.departure_time),
    arrive_time: cleanTime(row.arrival_time),
    arrive_plus_days: arrivePlus,
    duration_hours: duration.hours,
    duration_label: duration.label,
    stops: stops.count,
    stops_label: stops.label,
    layover_detail: stops.layover,
    self_transfer: false,
    price_usd: price,
    price_label: 'round trip',
    co2_kg: row.co2_emissions ? Number.parseInt(row.co2_emissions.replace(/[^0-9]/g, ''), 10) || null : null,
    co2_delta_pct: null,
    cabin: 'Economy',
    bags_summary: null,
    seat_summary: null,
    badges: [],
    recommended: false,
    pros: [],
    cons: [],
  }
}

export type BrightDataFlightSearchResult = {
  configured: boolean
  options: FlightOption[]
  error?: string
}

export async function searchBrightDataGoogleFlights(input: {
  origin: string
  destination: string
  departDate: string
  returnDate: string
  adults?: number
  maxOffers?: number
}): Promise<BrightDataFlightSearchResult> {
  if (!isBrightDataConfigured()) {
    return { configured: false, options: [] }
  }

  const adults = input.adults ?? 1
  const maxOffers = input.maxOffers ?? 12

  // Bright Data validates enum labels — not snake_case from their docs examples.
  const filterBody = [
    {
      origin: input.origin,
      destination: input.destination,
      departure: input.departDate,
      return: input.returnDate,
      trip_type: 'Round trip',
      adults,
      children: 0,
      infants_in_seat: 0,
      infants_on_lap: 0,
      cabin: 'Economy',
    },
  ]

  let result = await brightDataScrape<unknown>(
    {
      dataset_id: BRIGHT_DATA_FLIGHTS_DATASET_ID,
      type: 'discover_new',
      discover_by: 'input_filters',
    },
    filterBody
  )

  // Fallback: collect by Google Flights URL (simple q= search — no tfs encoding).
  if (!result.ok) {
    const url = googleFlightsUrl({
      origin: input.origin,
      destination: input.destination,
      departDate: input.departDate,
      returnDate: input.returnDate,
    })
    result = await brightDataScrape<unknown>(
      { dataset_id: BRIGHT_DATA_FLIGHTS_DATASET_ID },
      [{ url }]
    )
  }

  if (!result.ok || !result.data) {
    return { configured: true, options: [], error: result.error }
  }

  const rows = extractFlightsArray(result.data)
  const ctx = {
    origin: input.origin,
    destination: input.destination,
    departDate: input.departDate,
    returnDate: input.returnDate,
  }

  const options: FlightOption[] = []
  const seen = new Set<string>()
  for (let i = 0; i < rows.length && options.length < maxOffers; i++) {
    const option = rowToFlightOption(rows[i], i, ctx)
    if (!option) continue
    const key = `${option.airlines.join('|')}|${option.depart_time}|${option.price_usd}|${option.stops}`
    if (seen.has(key)) continue
    seen.add(key)
    options.push(option)
  }

  return { configured: true, options }
}
