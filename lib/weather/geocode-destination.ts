import { parseDestinationPlace } from '@/lib/destination-locator/parse-place'

const OPEN_METEO_GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'

export type Coordinates = { latitude: number; longitude: number }

type OpenMeteoGeocodeResponse = {
  results?: Array<{ latitude: number; longitude: number }>
}

type NominatimRow = {
  lat: string
  lon: string
}

const geocodeCache = new Map<string, { expires: number; value: Coordinates | null }>()
const GEOCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

function titleCaseCountry(country: string): string {
  return country
    .split(' ')
    .map(word => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
}

async function openMeteoGeocode(query: string): Promise<Coordinates | null> {
  const url = new URL(OPEN_METEO_GEOCODE)
  url.searchParams.set('name', query)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const res = await fetch(url.toString(), {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'User-Agent': 'AvantiTravelApp/1.0' },
  })
  if (!res.ok) return null

  const data = (await res.json()) as OpenMeteoGeocodeResponse
  const hit = data.results?.[0]
  if (!hit) return null
  return { latitude: hit.latitude, longitude: hit.longitude }
}

async function nominatimGeocode(query: string): Promise<Coordinates | null> {
  const url = new URL(NOMINATIM_SEARCH)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '0')

  const res = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AvantiTravelApp/1.0 (weather@avanti.travel)',
    },
  })
  if (!res.ok) return null

  const rows = (await res.json()) as NominatimRow[]
  const hit = rows[0]
  if (!hit) return null

  const latitude = parseFloat(hit.lat)
  const longitude = parseFloat(hit.lon)
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null
  return { latitude, longitude }
}

/** Resolve lat/lng for a destination card name (Open-Meteo → Nominatim). */
export async function geocodeDestination(
  destinationName: string,
  countryHint?: string | null
): Promise<Coordinates | null> {
  const cacheKey = `${destinationName.trim().toLowerCase()}|${(countryHint || '').trim().toLowerCase()}`
  const cached = geocodeCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.value

  const parsed = parseDestinationPlace(destinationName)
  const country =
    countryHint?.trim() ||
    (parsed.country ? titleCaseCountry(parsed.country) : null)
  const cityBase = parsed.city.split('+')[0]?.trim()
  const citySlash = parsed.city.split('/')[0]?.trim()

  const queries = [
    country && cityBase ? `${cityBase}, ${country}` : null,
    country && citySlash && citySlash !== cityBase ? `${citySlash}, ${country}` : null,
    country ? `${parsed.city}, ${country}` : null,
    country && cityBase ? `${cityBase}, ${country}` : null,
    parsed.query,
    cityBase,
    citySlash,
    destinationName.split(',')[0]?.trim(),
    destinationName.split('+')[0]?.trim(),
    country,
  ].filter((q): q is string => !!q?.trim())

  const seen = new Set<string>()
  let coords: Coordinates | null = null

  for (const query of queries) {
    const key = query.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    coords = await openMeteoGeocode(query)
    if (coords) break
  }

  if (!coords) {
    for (const query of queries.slice(0, 6)) {
      const key = `n:${query.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      coords = await nominatimGeocode(query)
      if (coords) break
    }
  }

  if (coords) {
    geocodeCache.set(cacheKey, {
      expires: Date.now() + GEOCODE_CACHE_TTL_MS,
      value: coords,
    })
  }

  return coords
}
