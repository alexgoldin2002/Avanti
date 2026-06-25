import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
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
