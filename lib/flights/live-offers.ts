import { resolveAirportIata } from '@/lib/pricing/resolve-airport'
import type { FlightAnalysisInput } from './traveler-context'
import {
  assignLiveBadges,
  searchDetailedDuffelOffers,
  type DetailedDuffelOffer,
} from './duffel-offers'
import { searchBrightDataGoogleFlights } from './brightdata/google-flights'
import { isBrightDataConfigured } from './brightdata/client'
import { isDuffelConfigured } from '@/lib/duffel/client'
import type { FlightOption } from './types'

const MAX_ORIGIN_SEARCHES = 3

export type LiveFareSources = {
  duffel: boolean
  google: boolean
}

export type LiveOffersFetchResult = {
  configured: boolean
  sources: LiveFareSources
  offers: DetailedDuffelOffer[]
  options: FlightOption[]
  destinationIata: string | null
  originsSearched: string[]
  error?: string
}

async function resolveTravelerOrigins(
  travelers: FlightAnalysisInput['travelers']
): Promise<string[]> {
  const labels = new Set<string>()
  for (const t of travelers) {
    if (t.home_airport) labels.add(t.home_airport)
    if (t.departure_city && t.departure_city !== 'Unknown') labels.add(t.departure_city)
    for (const backup of t.backup_airports.slice(0, 1)) labels.add(backup)
  }

  const iatas: string[] = []
  for (const label of labels) {
    const iata = await resolveAirportIata(label)
    if (iata && !iatas.includes(iata)) iatas.push(iata)
    if (iatas.length >= MAX_ORIGIN_SEARCHES) break
  }
  return iatas
}

function optionFingerprint(o: FlightOption): string {
  return [
    o.origin,
    o.destination,
    o.airlines.join('+'),
    o.depart_time,
    o.stops,
    Math.round(o.price_usd / 10),
  ].join('|')
}

function mergeFlightOptions(pools: FlightOption[]): FlightOption[] {
  const byKey = new Map<string, FlightOption>()
  for (const option of pools) {
    const key = optionFingerprint(option)
    const existing = byKey.get(key)
    if (!existing || option.price_usd < existing.price_usd) {
      byKey.set(key, option)
    }
  }
  return [...byKey.values()].sort((a, b) => a.price_usd - b.price_usd).slice(0, 8)
}

export async function fetchLiveOffersForAnalysis(
  input: FlightAnalysisInput
): Promise<LiveOffersFetchResult> {
  const dateStart =
    input.trip.locked_date_start ||
    input.trip.start_date ||
    input.trip.date_range_start ||
    ''
  const dateEnd =
    input.trip.locked_date_end ||
    input.trip.end_date ||
    input.trip.date_range_end ||
    ''

  const sources: LiveFareSources = {
    duffel: isDuffelConfigured(),
    google: isBrightDataConfigured(),
  }

  if (!dateStart || !dateEnd) {
    return {
      configured: false,
      sources,
      offers: [],
      options: [],
      destinationIata: null,
      originsSearched: [],
    }
  }

  const destinationIata = await resolveAirportIata(input.trip.destination)
  const origins = await resolveTravelerOrigins(input.travelers)

  if (!destinationIata || !origins.length) {
    return {
      configured: sources.duffel || sources.google,
      sources,
      offers: [],
      options: [],
      destinationIata,
      originsSearched: origins,
    }
  }

  const adults = Math.max(1, input.travelers.length)

  const perOrigin = await Promise.all(
    origins.map(async origin => {
      const [duffel, google] = await Promise.all([
        searchDetailedDuffelOffers({
          origin,
          destination: destinationIata,
          departDate: dateStart,
          returnDate: dateEnd,
          adults,
          maxOffers: 8,
        }),
        searchBrightDataGoogleFlights({
          origin,
          destination: destinationIata,
          departDate: dateStart,
          returnDate: dateEnd,
          adults,
          maxOffers: 12,
        }),
      ])
      return { duffel, google }
    })
  )

  const duffelOffers: DetailedDuffelOffer[] = []
  const optionPool: FlightOption[] = []
  const errors: string[] = []

  for (const { duffel, google } of perOrigin) {
    if (duffel.error) errors.push(duffel.error)
    if (google.error) errors.push(google.error)

    const byDuffelId = new Map<string, DetailedDuffelOffer>()
    for (const offer of duffel.offers) {
      const existing = byDuffelId.get(offer.duffelId)
      if (!existing || offer.totalAmount < existing.totalAmount) {
        byDuffelId.set(offer.duffelId, offer)
      }
    }
    duffelOffers.push(...byDuffelId.values())
    optionPool.push(...duffel.offers.map(o => ({ ...o.option })))
    optionPool.push(...google.options)
  }

  const merged = mergeFlightOptions(optionPool)
  const options = assignLiveBadges(merged)

  const configured =
    (sources.duffel && perOrigin.some(r => r.duffel.configured)) ||
    (sources.google && perOrigin.some(r => r.google.configured))

  const sortedDuffel = [...duffelOffers].sort((a, b) => a.totalAmount - b.totalAmount).slice(0, 8)

  return {
    configured,
    sources,
    offers: sortedDuffel,
    options,
    destinationIata,
    originsSearched: origins,
    error: errors[0],
  }
}
