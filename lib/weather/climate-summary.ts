import type { ClimateSummary, TravelWindow } from './types'
import { aggregateHistoricalClimate } from './open-meteo'
import { geocodeDestination } from './geocode-destination'
import { resolveTripTravelWindow } from './travel-window'
import { MIN_CLIMATE_SAMPLE_YEARS } from './round-one-weather'

function rainNote(fraction: number): string {
  if (fraction >= 0.55) return 'expect rain on many days'
  if (fraction >= 0.3) return 'some rainy days likely'
  if (fraction >= 0.12) return 'occasional rain'
  return 'mostly dry'
}

function isPlausibleClimateStats(stats: NonNullable<Awaited<ReturnType<typeof aggregateHistoricalClimate>>>): boolean {
  if (stats.sampleYears < MIN_CLIMATE_SAMPLE_YEARS) return false
  if (stats.dayCount < 7) return false
  if (stats.avgHighF < stats.avgLowF) return false
  if (stats.avgHighF < -25 || stats.avgHighF > 125) return false
  if (stats.avgLowF < -40 || stats.avgLowF > 110) return false
  return true
}

function formatClimateLine(
  window: TravelWindow,
  stats: NonNullable<Awaited<ReturnType<typeof aggregateHistoricalClimate>>>
): string {
  const rain = rainNote(stats.rainyDayFraction)
  return `Typical weather for ${window.label}: around ${stats.avgHighF}°F daytime, ${stats.avgLowF}°F at night, ${rain} (${stats.sampleYears}-yr average).`
}

export type WeatherLookupDebug = {
  destination: string
  countryHint?: string | null
  coords: { latitude: number; longitude: number } | null
  window: TravelWindow | null
  stats: Awaited<ReturnType<typeof aggregateHistoricalClimate>>
  line: string | null
  failReason?: string
}

/** Fetch Open-Meteo historical normals for a destination + travel window. */
export async function getTypicalWeatherSummary(
  destinationName: string,
  window: TravelWindow,
  countryHint?: string | null
): Promise<ClimateSummary | null> {
  const coords = await geocodeDestination(destinationName, countryHint)
  if (!coords) return null

  const stats = await aggregateHistoricalClimate(coords, window.start, window.end)
  if (!stats || !isPlausibleClimateStats(stats)) return null

  const line = formatClimateLine(window, stats)

  return {
    line,
    avgHighF: stats.avgHighF,
    avgLowF: stats.avgLowF,
    rainyDayFraction: stats.rainyDayFraction,
    sampleYears: stats.sampleYears,
    window,
  }
}

export async function getTypicalWeatherLine(
  destinationName: string,
  window: TravelWindow,
  countryHint?: string | null
): Promise<string | null> {
  const summary = await getTypicalWeatherSummary(destinationName, window, countryHint)
  return summary?.line ?? null
}

/** Dev helper: explains why a lookup succeeded or failed. */
export async function debugTypicalWeather(input: {
  destinationName: string
  window: TravelWindow | null
  countryHint?: string | null
}): Promise<WeatherLookupDebug> {
  const result: WeatherLookupDebug = {
    destination: input.destinationName,
    countryHint: input.countryHint,
    coords: null,
    window: input.window,
    stats: null,
    line: null,
  }

  if (!input.window) {
    result.failReason = 'no_travel_window'
    return result
  }

  const coords = await geocodeDestination(input.destinationName, input.countryHint)
  result.coords = coords
  if (!coords) {
    result.failReason = 'geocode_failed'
    return result
  }

  const stats = await aggregateHistoricalClimate(
    coords,
    input.window.start,
    input.window.end
  )
  result.stats = stats
  if (!stats) {
    result.failReason = 'archive_empty'
    return result
  }
  if (!isPlausibleClimateStats(stats)) {
    result.failReason = 'implausible_stats'
    return result
  }

  result.line = formatClimateLine(input.window, stats)
  return result
}

export { resolveTripTravelWindow }

export async function getTypicalWeatherForTrip(
  destinationName: string,
  trip: Parameters<typeof resolveTripTravelWindow>[0]['trip'],
  countryHint?: string | null
): Promise<string | null> {
  const window = resolveTripTravelWindow({ trip })
  if (!window) return null
  return getTypicalWeatherLine(destinationName, window, countryHint)
}
