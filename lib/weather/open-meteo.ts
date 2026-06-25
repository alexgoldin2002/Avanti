import { geocodeDestination, type Coordinates } from './geocode-destination'

export type { Coordinates } from './geocode-destination'
export { geocodeDestination }

const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive'

const LOOKBACK_YEARS = 5
const ARCHIVE_FETCH_CONCURRENCY = 3
const ARCHIVE_FETCH_RETRIES = 2
const CLIMATE_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000
/** Daily precipitation above this (mm) counts as a “rainy” day in averages. */
const RAIN_MM = 1

type DailyArchive = {
  daily?: {
    time?: string[]
    temperature_2m_max?: (number | null)[]
    temperature_2m_min?: (number | null)[]
    precipitation_sum?: (number | null)[]
  }
  error?: boolean
}

type CacheEntry<T> = { expires: number; value: T }

const climateCache = new Map<string, CacheEntry<AggregatedClimate | null>>()

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Latest calendar date the Open-Meteo archive API accepts (roughly today minus a week). */
export function archiveCutoffDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

/** Map trip calendar days onto a past year (handles Feb 29). Same-year trips only. */
export function calendarWindowInYear(
  tripStart: string,
  tripEnd: string,
  year: number
): { start: string; end: string } | null {
  const [, startMonth, startDay] = tripStart.split('-').map(Number)
  const [, endMonth, endDay] = tripEnd.split('-').map(Number)
  if (!startMonth || !startDay || !endMonth || !endDay) return null

  if (tripEnd.slice(5) < tripStart.slice(5)) {
    return null
  }

  let sm = startMonth
  let sd = startDay
  let em = endMonth
  let ed = endDay

  if (sm === 2 && sd === 29 && !isLeapYear(year)) {
    sd = 28
  }
  if (em === 2 && ed === 29 && !isLeapYear(year)) {
    ed = 28
  }

  const start = `${year}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`
  const end = `${year}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`
  if (end < start) return null

  return { start, end }
}

/** Split cross-year trips (e.g. Dec 28 → Jan 5) into archive-friendly segments. */
export function calendarYearSegments(
  tripStart: string,
  tripEnd: string,
  year: number
): Array<{ start: string; end: string }> {
  const sameYear = calendarWindowInYear(tripStart, tripEnd, year)
  if (sameYear) return [sameYear]

  if (tripEnd.slice(5) >= tripStart.slice(5)) return []

  const [, sm, sd] = tripStart.split('-').map(Number)
  const [, em, ed] = tripEnd.split('-').map(Number)
  if (!sm || !sd || !em || !ed) return []

  let startDay = sd
  let endDay = ed
  if (sm === 2 && sd === 29 && !isLeapYear(year)) startDay = 28
  if (em === 2 && ed === 29 && !isLeapYear(year + 1)) endDay = 28

  const seg1Start = `${year}-${String(sm).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
  const seg1End = `${year}-12-31`
  const seg2Start = `${year + 1}-01-01`
  const seg2End = `${year + 1}-${String(em).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  const segments: Array<{ start: string; end: string }> = []
  if (seg1Start <= seg1End) segments.push({ start: seg1Start, end: seg1End })
  if (seg2Start <= seg2End) segments.push({ start: seg2Start, end: seg2End })
  return segments
}

function archiveWindowsForTrip(
  tripStart: string,
  tripEnd: string
): Array<{ start: string; end: string }> {
  const cutoff = archiveCutoffDate()
  const lastYear = parseInt(cutoff.slice(0, 4), 10)
  const firstYear = lastYear - LOOKBACK_YEARS + 1

  const windows: Array<{ start: string; end: string }> = []
  for (let year = firstYear; year <= lastYear; year++) {
    for (const segment of calendarYearSegments(tripStart, tripEnd, year)) {
      if (segment.start > cutoff) continue
      windows.push({
        start: segment.start,
        end: segment.end > cutoff ? cutoff : segment.end,
      })
    }
  }
  return windows
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchArchiveDailyOnce(
  coords: Coordinates,
  startDate: string,
  endDate: string
): Promise<DailyArchive['daily'] | null> {
  const url = new URL(ARCHIVE_BASE)
  url.searchParams.set('latitude', String(coords.latitude))
  url.searchParams.set('longitude', String(coords.longitude))
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('temperature_unit', 'fahrenheit')

  const res = await fetch(url.toString(), {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'User-Agent': 'AvantiTravelApp/1.0' },
  })
  if (!res.ok) return null

  const json = (await res.json()) as DailyArchive
  if (json.error || !json.daily?.time?.length) return null
  return json.daily
}

async function fetchArchiveDaily(
  coords: Coordinates,
  startDate: string,
  endDate: string
): Promise<DailyArchive['daily'] | null> {
  for (let attempt = 0; attempt <= ARCHIVE_FETCH_RETRIES; attempt++) {
    const daily = await fetchArchiveDailyOnce(coords, startDate, endDate)
    if (daily) return daily
    if (attempt < ARCHIVE_FETCH_RETRIES) {
      await sleep(250 * (attempt + 1))
    }
  }
  return null
}

async function fetchArchiveWindows(
  coords: Coordinates,
  windows: Array<{ start: string; end: string }>
): Promise<Array<DailyArchive['daily'] | null>> {
  const results: Array<DailyArchive['daily'] | null> = []
  for (let i = 0; i < windows.length; i += ARCHIVE_FETCH_CONCURRENCY) {
    const batch = windows.slice(i, i + ARCHIVE_FETCH_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(w => fetchArchiveDaily(coords, w.start, w.end))
    )
    results.push(...batchResults)
  }
  return results
}

export type AggregatedClimate = {
  avgHighF: number
  avgLowF: number
  rainyDayFraction: number
  sampleYears: number
  dayCount: number
}

/** Average daily highs/lows and rain frequency for the same calendar window across past years. */
export async function aggregateHistoricalClimateUncached(
  coords: Coordinates,
  tripStart: string,
  tripEnd: string
): Promise<AggregatedClimate | null> {
  const yearWindows = archiveWindowsForTrip(tripStart, tripEnd)
  if (!yearWindows.length) return null

  const dailyChunks = await fetchArchiveWindows(coords, yearWindows)

  const highs: number[] = []
  const lows: number[] = []
  let rainyDays = 0
  let precipDays = 0
  const yearsWithData = new Set<number>()

  for (let i = 0; i < dailyChunks.length; i++) {
    const daily = dailyChunks[i]
    if (!daily?.time?.length) continue

    const year = parseInt(yearWindows[i].start.slice(0, 4), 10)
    if (!Number.isNaN(year)) yearsWithData.add(year)

    for (let j = 0; j < daily.time.length; j++) {
      const max = daily.temperature_2m_max?.[j]
      const min = daily.temperature_2m_min?.[j]
      const precip = daily.precipitation_sum?.[j]

      if (max != null && min != null && max >= min && max > -50 && max < 130) {
        highs.push(max)
        lows.push(min)
      }
      if (precip != null) {
        precipDays++
        if (precip >= RAIN_MM) rainyDays++
      }
    }
  }

  if (!highs.length || !lows.length || yearsWithData.size === 0) return null

  const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length

  return {
    avgHighF: Math.round(avg(highs)),
    avgLowF: Math.round(avg(lows)),
    rainyDayFraction: precipDays > 0 ? rainyDays / precipDays : 0,
    sampleYears: yearsWithData.size,
    dayCount: highs.length,
  }
}

export async function aggregateHistoricalClimate(
  coords: Coordinates,
  tripStart: string,
  tripEnd: string
): Promise<AggregatedClimate | null> {
  const key = [
    coords.latitude.toFixed(2),
    coords.longitude.toFixed(2),
    tripStart,
    tripEnd,
  ].join('|')

  const cached = climateCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.value

  const value = await aggregateHistoricalClimateUncached(coords, tripStart, tripEnd)
  if (value) {
    climateCache.set(key, {
      expires: Date.now() + CLIMATE_CACHE_TTL_MS,
      value,
    })
  }
  return value
}
