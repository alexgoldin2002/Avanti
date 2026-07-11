import type { Offer, OfferSliceSegment } from '@duffel/api/types'
import { extractIata } from '@/lib/booking/search-links'
import { getDuffelClient } from '@/lib/duffel/client'
import type { FlightOption } from './types'

export type DetailedDuffelOffer = {
  duffelId: string
  origin: string
  destination: string
  departureDate: string
  returnDate: string
  totalAmount: number
  totalCurrency: string
  co2Kg: number | null
  cabin: string | null
  bagsSummary: string | null
  option: FlightOption
}

export type DetailedDuffelSearchResult = {
  configured: boolean
  offers: DetailedDuffelOffer[]
  error?: string
}

function parseIsoDuration(iso: string | null | undefined): { hours: number; label: string } {
  if (!iso) return { hours: 0, label: '—' }
  const h = iso.match(/(\d+)H/)
  const m = iso.match(/(\d+)M/)
  const hours = (h ? Number(h[1]) : 0) + (m ? Number(m[1]) / 60 : 0)
  const parts: string[] = []
  if (h) parts.push(`${h[1]} hr`)
  if (m) parts.push(`${m[1]} min`)
  return { hours: Math.round(hours * 10) / 10, label: parts.join(' ') || '—' }
}

function formatLocalTime(iso: string, timeZone?: string | null): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timeZone || undefined,
  })
}

function isoDate(iso: string): string {
  return iso.slice(0, 10)
}

function dayOffset(departIso: string, arriveIso: string): number {
  const depart = new Date(departIso)
  const arrive = new Date(arriveIso)
  const departDay = Date.UTC(depart.getUTCFullYear(), depart.getUTCMonth(), depart.getUTCDate())
  const arriveDay = Date.UTC(arrive.getUTCFullYear(), arrive.getUTCMonth(), arrive.getUTCDate())
  return Math.max(0, Math.round((arriveDay - departDay) / 86_400_000))
}

function layoverDetail(segments: OfferSliceSegment[]): string | null {
  if (segments.length < 2) return null
  const parts: string[] = []
  for (let i = 0; i < segments.length - 1; i++) {
    const arrive = new Date(segments[i].arriving_at).getTime()
    const depart = new Date(segments[i + 1].departing_at).getTime()
    const mins = Math.max(0, Math.round((depart - arrive) / 60_000))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    const airport = segments[i].destination?.iata_code || ''
    parts.push(h > 0 ? `${h}h ${m}m ${airport}` : `${m}m ${airport}`)
  }
  return parts.join(' · ')
}

function stopsLabel(stops: number): string {
  if (stops === 0) return 'Nonstop'
  if (stops === 1) return '1 stop'
  return `${stops} stops`
}

function uniqueAirlines(segments: OfferSliceSegment[]): string[] {
  const names = segments.map(s => s.marketing_carrier?.name).filter(Boolean) as string[]
  return [...new Set(names)]
}

function operatedByLabel(segments: OfferSliceSegment[]): string | null {
  const pairs = segments
    .filter(s => s.operating_carrier?.name && s.marketing_carrier?.name !== s.operating_carrier?.name)
    .map(s => s.operating_carrier.name)
  const unique = [...new Set(pairs)]
  return unique.length ? `Operated by ${unique.join(', ')}` : null
}

function bagsSummaryFromOffer(offer: Pick<Offer, 'slices'>): string | null {
  const seg = offer.slices[0]?.segments[0]
  const pax = seg?.passengers?.[0]
  const bags = pax?.baggages || []
  if (!bags.length) return null
  const checked = bags.filter(b => b.type === 'checked')
  const carry = bags.filter(b => b.type === 'carry_on')
  const parts: string[] = []
  if (carry.length) {
    const qty = carry.reduce((s, b) => s + (b.quantity || 0), 0)
    if (qty) parts.push(`${qty} carry-on included`)
  }
  if (checked.length) {
    const qty = checked.reduce((s, b) => s + (b.quantity || 0), 0)
    parts.push(qty ? `${qty} checked bag included` : 'Checked bag extra')
  }
  return parts.length ? parts.join(' · ') : null
}

function offerToFlightOption(offer: Pick<Offer, 'id' | 'slices' | 'total_amount' | 'total_currency' | 'total_emissions_kg'>, index: number): DetailedDuffelOffer | null {
  const outbound = offer.slices[0]
  const inbound = offer.slices[1]
  if (!outbound?.segments?.length) return null

  const segments = outbound.segments
  const first = segments[0]
  const last = segments[segments.length - 1]
  const origin = first.origin?.iata_code || ''
  const destination = last.destination?.iata_code || ''
  if (!origin || !destination) return null

  const duration = parseIsoDuration(outbound.duration)
  const stops = Math.max(0, segments.length - 1)
  const price = Number.parseFloat(offer.total_amount)
  if (!Number.isFinite(price)) return null

  const cabin =
    segments[0]?.passengers?.[0]?.cabin_class_marketing_name ||
    segments[0]?.passengers?.[0]?.cabin_class ||
    null

  const option: FlightOption = {
    id: `live-${offer.id.slice(0, 8)}-${index}`,
    airlines: uniqueAirlines(segments),
    operated_by: operatedByLabel(segments),
    origin,
    destination,
    departure_date: isoDate(first.departing_at),
    return_date: inbound?.segments?.[0] ? isoDate(inbound.segments[0].departing_at) : isoDate(first.departing_at),
    depart_time: formatLocalTime(first.departing_at, first.origin?.time_zone),
    arrive_time: formatLocalTime(last.arriving_at, last.destination?.time_zone),
    arrive_plus_days: dayOffset(first.departing_at, last.arriving_at),
    duration_hours: duration.hours,
    duration_label: duration.label,
    stops,
    stops_label: stopsLabel(stops),
    layover_detail: layoverDetail(segments),
    self_transfer: false,
    price_usd: Math.round(price),
    price_label: 'round trip',
    co2_kg: offer.total_emissions_kg ? Math.round(Number(offer.total_emissions_kg)) : null,
    co2_delta_pct: null,
    cabin,
    bags_summary: bagsSummaryFromOffer(offer),
    seat_summary: null,
    badges: [],
    recommended: false,
    pros: [],
    cons: [],
  }

  return {
    duffelId: offer.id,
    origin,
    destination,
    departureDate: option.departure_date,
    returnDate: option.return_date,
    totalAmount: price,
    totalCurrency: offer.total_currency,
    co2Kg: option.co2_kg ?? null,
    cabin,
    bagsSummary: option.bags_summary ?? null,
    option,
  }
}

export async function searchDetailedDuffelOffers(input: {
  origin: string
  destination: string
  departDate: string
  returnDate: string
  adults?: number
  maxOffers?: number
}): Promise<DetailedDuffelSearchResult> {
  const duffel = getDuffelClient()
  if (!duffel) return { configured: false, offers: [] }

  const origin = extractIata(input.origin) || input.origin.slice(0, 3).toUpperCase()
  const destination = extractIata(input.destination) || input.destination.slice(0, 3).toUpperCase()
  const adults = input.adults ?? 1
  const maxOffers = input.maxOffers ?? 12

  try {
    const response = await duffel.offerRequests.create({
      slices: [
        { origin, destination, departure_date: input.departDate },
        { origin: destination, destination: origin, departure_date: input.returnDate },
      ] as Parameters<typeof duffel.offerRequests.create>[0]['slices'],
      passengers: Array.from({ length: adults }, () => ({ type: 'adult' as const })),
      cabin_class: 'economy',
      return_offers: true,
    })

    const sorted = [...(response.data.offers || [])].sort(
      (a, b) => Number.parseFloat(a.total_amount) - Number.parseFloat(b.total_amount)
    )

    const offers: DetailedDuffelOffer[] = []
    for (let i = 0; i < sorted.length && offers.length < maxOffers; i++) {
      const mapped = offerToFlightOption(sorted[i], i)
      if (mapped) offers.push(mapped)
    }

    return { configured: true, offers }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Duffel search failed'
    return { configured: true, offers: [], error: msg }
  }
}

/** Assign cheapest / fastest / best badges from live options (before AI enrichment). */
export function assignLiveBadges(options: FlightOption[]): FlightOption[] {
  if (!options.length) return options

  const priced = [...options]
  const cheapest = priced.reduce((a, b) => (a.price_usd <= b.price_usd ? a : b))
  const fastest = priced.reduce((a, b) => (a.duration_hours <= b.duration_hours ? a : b))

  const score = (o: FlightOption) => {
    const priceNorm = o.price_usd / Math.max(cheapest.price_usd, 1)
    const durNorm = o.duration_hours / Math.max(fastest.duration_hours || 1, 1)
    return priceNorm * 0.55 + durNorm * 0.45
  }
  const best = priced.reduce((a, b) => (score(a) <= score(b) ? a : b))

  return options.map(o => {
    const badges: FlightOption['badges'] = []
    if (o.id === cheapest.id) badges.push('cheapest')
    if (o.id === fastest.id && fastest.duration_hours > 0) badges.push('fastest')
    if (o.id === best.id) badges.push('best')
    return {
      ...o,
      badges: [...new Set(badges)],
      recommended: o.id === best.id,
    }
  })
}
