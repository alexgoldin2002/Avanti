export type ContinentId =
  | 'north_america'
  | 'central_america'
  | 'south_america'
  | 'europe'
  | 'africa'
  | 'middle_east'
  | 'central_asia'
  | 'south_asia'
  | 'east_asia'
  | 'southeast_asia'
  | 'oceania'

export type ContinentView = {
  id: ContinentId
  label: string
  /** [south, north, west, east] */
  bbox: [number, number, number, number]
  defaultZoom: number
}

/** Regional map window — enlarged slice of the continent for the locator inset. */
export const CONTINENT_VIEWS: Record<ContinentId, ContinentView> = {
  north_america: {
    id: 'north_america',
    label: 'North America',
    bbox: [15, 72, -170, -50],
    defaultZoom: 3,
  },
  central_america: {
    id: 'central_america',
    label: 'Central America & Caribbean',
    bbox: [7, 32, -118, -58],
    defaultZoom: 4,
  },
  south_america: {
    id: 'south_america',
    label: 'South America',
    bbox: [-56, 13, -82, -34],
    defaultZoom: 3,
  },
  europe: {
    id: 'europe',
    label: 'Europe',
    bbox: [34, 72, -25, 45],
    defaultZoom: 4,
  },
  africa: {
    id: 'africa',
    label: 'Africa',
    bbox: [-35, 38, -20, 52],
    defaultZoom: 3,
  },
  middle_east: {
    id: 'middle_east',
    label: 'Middle East',
    bbox: [12, 42, 25, 65],
    defaultZoom: 4,
  },
  central_asia: {
    id: 'central_asia',
    label: 'Central Asia',
    bbox: [25, 55, 45, 90],
    defaultZoom: 4,
  },
  south_asia: {
    id: 'south_asia',
    label: 'South Asia',
    bbox: [5, 38, 60, 95],
    defaultZoom: 4,
  },
  east_asia: {
    id: 'east_asia',
    label: 'East Asia',
    bbox: [18, 55, 95, 150],
    defaultZoom: 4,
  },
  southeast_asia: {
    id: 'southeast_asia',
    label: 'Southeast Asia',
    bbox: [-10, 28, 92, 140],
    defaultZoom: 4,
  },
  oceania: {
    id: 'oceania',
    label: 'Oceania',
    bbox: [-48, 5, 110, 180],
    defaultZoom: 3,
  },
}

const COUNTRY_CONTINENT: Record<string, ContinentId> = {
  'united states': 'north_america',
  usa: 'north_america',
  canada: 'north_america',
  mexico: 'central_america',
  cuba: 'central_america',
  jamaica: 'central_america',
  'costa rica': 'central_america',
  panama: 'central_america',
  'dominican republic': 'central_america',
  bahamas: 'central_america',
  brazil: 'south_america',
  argentina: 'south_america',
  chile: 'south_america',
  colombia: 'south_america',
  peru: 'south_america',
  ecuador: 'south_america',
  uruguay: 'south_america',
  bolivia: 'south_america',
  paraguay: 'south_america',
  'united kingdom': 'europe',
  uk: 'europe',
  france: 'europe',
  spain: 'europe',
  portugal: 'europe',
  italy: 'europe',
  germany: 'europe',
  greece: 'europe',
  netherlands: 'europe',
  belgium: 'europe',
  switzerland: 'europe',
  austria: 'europe',
  ireland: 'europe',
  iceland: 'europe',
  norway: 'europe',
  sweden: 'europe',
  denmark: 'europe',
  poland: 'europe',
  croatia: 'europe',
  hungary: 'europe',
  czechia: 'europe',
  'czech republic': 'europe',
  morocco: 'africa',
  egypt: 'africa',
  'south africa': 'africa',
  kenya: 'africa',
  tanzania: 'africa',
  nigeria: 'africa',
  ghana: 'africa',
  ethiopia: 'africa',
  tunisia: 'africa',
  'united arab emirates': 'middle_east',
  uae: 'middle_east',
  israel: 'middle_east',
  jordan: 'middle_east',
  turkey: 'middle_east',
  qatar: 'middle_east',
  'saudi arabia': 'middle_east',
  oman: 'middle_east',
  lebanon: 'middle_east',
  japan: 'east_asia',
  china: 'east_asia',
  'south korea': 'east_asia',
  korea: 'east_asia',
  taiwan: 'east_asia',
  'hong kong': 'east_asia',
  thailand: 'southeast_asia',
  vietnam: 'southeast_asia',
  indonesia: 'southeast_asia',
  bali: 'southeast_asia',
  philippines: 'southeast_asia',
  singapore: 'southeast_asia',
  malaysia: 'southeast_asia',
  cambodia: 'southeast_asia',
  'sri lanka': 'south_asia',
  india: 'south_asia',
  nepal: 'south_asia',
  maldives: 'south_asia',
  australia: 'oceania',
  'new zealand': 'oceania',
  fiji: 'oceania',
  tahiti: 'oceania',
  'french polynesia': 'oceania',
}

export function continentForCountry(country: string | null, lat?: number, lng?: number): ContinentView {
  if (country) {
    const key = country.toLowerCase().trim()
    const id = COUNTRY_CONTINENT[key]
    if (id) return CONTINENT_VIEWS[id]
  }

  if (lat != null && lng != null) {
    if (lat >= 15 && lng <= -50) return CONTINENT_VIEWS.north_america
    if (lat < 15 && lat > -60 && lng < -30) return CONTINENT_VIEWS.south_america
    if (lat > 34 && lng > -25 && lng < 45) return CONTINENT_VIEWS.europe
    if (lat > -35 && lat < 38 && lng > -20 && lng < 55) return CONTINENT_VIEWS.africa
    if (lng > 25 && lng < 65 && lat > 10 && lat < 45) return CONTINENT_VIEWS.middle_east
    if (lng > 95 && lng < 150 && lat > 18) return CONTINENT_VIEWS.east_asia
    if (lng > 92 && lat > -12 && lat < 28) return CONTINENT_VIEWS.southeast_asia
    if (lng > 110 || lat < -10) return CONTINENT_VIEWS.oceania
  }

  return CONTINENT_VIEWS.europe
}

/** Tighter bbox around a point for the regional “zoom” feel. */
export function regionalViewAroundPoint(
  lat: number,
  lng: number,
  continent: ContinentView,
  countryBbox?: [number, number, number, number] | null
): [number, number, number, number] {
  const spanLat = countryBbox
    ? Math.max(4, (countryBbox[1] - countryBbox[0]) * 1.8)
    : 12
  const spanLng = countryBbox
    ? Math.max(4, (countryBbox[3] - countryBbox[2]) * 1.8)
    : 14

  let south = lat - spanLat / 2
  let north = lat + spanLat / 2
  let west = lng - spanLng / 2
  let east = lng + spanLng / 2

  const [cSouth, cNorth, cWest, cEast] = continent.bbox
  south = Math.max(south, cSouth)
  north = Math.min(north, cNorth)
  west = Math.max(west, cWest)
  east = Math.min(east, cEast)

  return [south, north, west, east]
}

export function projectToSvg(
  lat: number,
  lng: number,
  viewBbox: [number, number, number, number],
  width = 100,
  height = 100
): { x: number; y: number } {
  const [south, north, west, east] = viewBbox
  const x = ((lng - west) / (east - west)) * width
  const y = ((north - lat) / (north - south)) * height
  return {
    x: Math.max(4, Math.min(width - 4, x)),
    y: Math.max(4, Math.min(height - 4, y)),
  }
}

export function bboxToSvgRect(
  bbox: [number, number, number, number],
  viewBbox: [number, number, number, number],
  width = 100,
  height = 100
) {
  const [south, north, west, east] = bbox
  const tl = projectToSvg(north, west, viewBbox, width, height)
  const br = projectToSvg(south, east, viewBbox, width, height)
  return {
    x: Math.min(tl.x, br.x),
    y: Math.min(tl.y, br.y),
    width: Math.max(8, Math.abs(br.x - tl.x)),
    height: Math.max(8, Math.abs(br.y - tl.y)),
  }
}
