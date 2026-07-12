import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import type { DestinationMatrixRow } from '@/lib/parse-destination-matrix'
import type { TripGroupOverlapFields } from '@/lib/group-date-overlap/sync-trip-overlap'
import { getTypicalWeatherLine } from './climate-summary'
import { resolveTripTravelWindow } from './travel-window'

/** Replace AI weather on destination cards with Open-Meteo climate for the group overlap window. */
export async function enrichDestinationCardsWithClimate(
  cards: ParsedDestinationCard[],
  trip: TripGroupOverlapFields | null | undefined
): Promise<ParsedDestinationCard[]> {
  const window = resolveTripTravelWindow({ trip })
  if (!window) return cards

  return Promise.all(
    cards.map(async card => {
      const line = await getTypicalWeatherLine(card.name, window)
      if (!line) return card
      return { ...card, weather: line }
    })
  )
}

/** Replace AI weather on matrix rows with Open-Meteo when coordinates resolve. */
export async function enrichMatrixRowsWithClimate(
  rows: DestinationMatrixRow[],
  trip: TripGroupOverlapFields | Record<string, unknown> | null | undefined,
): Promise<DestinationMatrixRow[]> {
  const window = resolveTripTravelWindow({
    trip: trip as TripGroupOverlapFields | null | undefined,
  })
  if (!window) return rows

  return Promise.all(
    rows.map(async row => {
      const line = await getTypicalWeatherLine(row.name, window)
      if (!line) return row
      return { ...row, weather: line }
    }),
  )
}
