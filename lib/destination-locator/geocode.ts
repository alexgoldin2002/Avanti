import { unstable_cache } from 'next/cache'
import { parseDestinationPlace } from './parse-place'
import {
  bboxToSvgRect,
  continentForCountry,
  projectToSvg,
  regionalViewAroundPoint,
  type ContinentView,
} from './continents'

export type GeocodeResult = {
  lat: number
  lng: number
  displayName: string
  country: string | null
  countryBbox: [number, number, number, number] | null
}

type NominatimRow = {
  lat: string
  lon: string
  display_name?: string
  boundingbox?: [string, string, string, string]
  address?: { country?: string }
}

async function nominatimSearch(query: string): Promise<NominatimRow | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'AvantiTravelApp/1.0',
      Accept: 'application/json',
    },
    next: { revalidate: 60 * 60 * 24 * 30 },
  })

  if (!res.ok) return null
  const rows = (await res.json()) as NominatimRow[]
  return rows[0] ?? null
}

function parseBbox(row: NominatimRow | null): [number, number, number, number] | null {
  if (!row?.boundingbox || row.boundingbox.length !== 4) return null
  const [south, north, west, east] = row.boundingbox.map(Number)
  if ([south, north, west, east].some(n => Number.isNaN(n))) return null
  return [south, north, west, east]
}

async function geocodePlaceUncached(name: string): Promise<GeocodeResult | null> {
  const parsed = parseDestinationPlace(name)
  const query = parsed.country ? `${parsed.city}, ${parsed.country}` : parsed.query

  const row = await nominatimSearch(query)
  if (!row) return null

  const lat = parseFloat(row.lat)
  const lng = parseFloat(row.lon)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  const country =
    parsed.country ||
    row.address?.country ||
    null

  let countryBbox = parseBbox(row)
  if (country && (!countryBbox || countryBbox[1] - countryBbox[0] < 0.5)) {
    const countryRow = await nominatimSearch(country)
    countryBbox = parseBbox(countryRow) ?? countryBbox
  }

  return {
    lat,
    lng,
    displayName: row.display_name || query,
    country,
    countryBbox,
  }
}

function googleMapsKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY ||
    null
  )
}

async function geocodeDestination(name: string): Promise<GeocodeResult | null> {
  return unstable_cache(
    async () => geocodePlaceUncached(name),
    ['destination-geocode', name.toLowerCase().trim()],
    { revalidate: 60 * 60 * 24 * 14 }
  )()
}

function buildGoogleStaticMapUrl(
  viewBbox: [number, number, number, number],
  lat: number,
  lng: number,
  countryBbox: [number, number, number, number] | null
): string | null {
  const key = googleMapsKey()
  if (!key) return null

  const [south, north, west, east] = viewBbox
  const params = new URLSearchParams({
    size: '256x256',
    scale: '2',
    maptype: 'terrain',
    key,
  })

  params.set('visible', `${south},${west}|${north},${east}`)

  if (countryBbox) {
    const [cSouth, cNorth, cWest, cEast] = countryBbox
    params.append(
      'path',
      `fillcolor:0x2d6a4f33|color:0x2d6a4f99|weight:1|${cNorth},${cWest}|${cNorth},${cEast}|${cSouth},${cEast}|${cSouth},${cWest}|${cNorth},${cWest}`
    )
  }

  params.append('markers', `size:small|color:0x1a1a1a|${lat},${lng}`)

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

export type LocatorPayload = {
  city: string
  country: string | null
  continent: string
  lat: number
  lng: number
  mapUrl: string | null
  svg: {
    viewBbox: [number, number, number, number]
    continentBbox: [number, number, number, number]
    countryBbox: [number, number, number, number] | null
    marker: { x: number; y: number }
    countryRect: { x: number; y: number; width: number; height: number } | null
    continentMarker: { x: number; y: number }
  }
}

export async function buildLocatorPayload(destinationName: string): Promise<LocatorPayload | null> {
  const parsed = parseDestinationPlace(destinationName)
  const geocoded = await geocodeDestination(destinationName)
  if (!geocoded) return null

  const continent: ContinentView = continentForCountry(
    geocoded.country,
    geocoded.lat,
    geocoded.lng
  )
  const viewBbox = regionalViewAroundPoint(
    geocoded.lat,
    geocoded.lng,
    continent,
    geocoded.countryBbox
  )

  const marker = projectToSvg(geocoded.lat, geocoded.lng, viewBbox)
  const countryRect = geocoded.countryBbox
    ? bboxToSvgRect(geocoded.countryBbox, viewBbox)
    : null
  const continentMarker = projectToSvg(
    geocoded.lat,
    geocoded.lng,
    continent.bbox,
    100,
    100
  )

  return {
    city: parsed.city,
    country: geocoded.country,
    continent: continent.label,
    lat: geocoded.lat,
    lng: geocoded.lng,
    mapUrl: buildGoogleStaticMapUrl(viewBbox, geocoded.lat, geocoded.lng, geocoded.countryBbox),
    svg: {
      viewBbox,
      continentBbox: continent.bbox,
      countryBbox: geocoded.countryBbox,
      marker,
      countryRect,
      continentMarker,
    },
  }
}
