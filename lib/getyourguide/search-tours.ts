import { getYourGuideTourUrl } from '@/lib/booking/search-links'
import { gygFetch, isGetYourGuideConfigured } from './client'

export type ActivityOffer = {
  tourId: string
  title: string
  abstract: string | null
  rating: number | null
  reviewCount: number | null
  priceFromUsd: number | null
  durationLabel: string | null
  pictureUrl: string | null
  bookUrl: string | null
  bestseller: boolean
}

export type ActivitySearchResult = {
  configured: boolean
  offers: ActivityOffer[]
  error?: string
}

type GygTour = {
  tour_id?: number
  title?: string
  abstract?: string
  overall_rating?: number
  number_of_ratings?: number
  bestseller?: boolean
  url?: string
  price?: {
    values?: { amount?: number; currency?: string }[]
    description?: string
  }
  duration?: { value?: number; unit?: string }
  pictures?: { url?: string }[]
}

type GygToursResponse = {
  data?: { tours?: GygTour[] }
}

function priceFromTour(tour: GygTour): number | null {
  const values = tour.price?.values
  if (!values?.length) return null
  const usd = values.find(v => v.currency === 'USD')
  const pick = usd || values[0]
  return pick?.amount != null ? Number(pick.amount) : null
}

function durationLabel(tour: GygTour): string | null {
  if (tour.price?.description) return tour.price.description
  const d = tour.duration
  if (!d?.value) return null
  const unit = d.unit === 'hour' ? 'h' : d.unit === 'minute' ? 'min' : d.unit || ''
  return `${d.value}${unit ? ` ${unit}` : ''}`
}

function mapTour(tour: GygTour, pubref?: string): ActivityOffer | null {
  const tourId = tour.tour_id != null ? String(tour.tour_id) : ''
  if (!tourId || !tour.title) return null
  return {
    tourId,
    title: tour.title,
    abstract: tour.abstract || null,
    rating: tour.overall_rating != null ? Number(tour.overall_rating) : null,
    reviewCount: tour.number_of_ratings != null ? Number(tour.number_of_ratings) : null,
    priceFromUsd: priceFromTour(tour),
    durationLabel: durationLabel(tour),
    pictureUrl: tour.pictures?.[0]?.url || null,
    bookUrl: tour.url ? getYourGuideTourUrl(tour.url, { pubref, label: 'activities' }) : null,
    bestseller: Boolean(tour.bestseller),
  }
}

export async function searchActivities(input: {
  destination: string
  query?: string
  startDate?: string | null
  endDate?: string | null
  limit?: number
  pubref?: string
}): Promise<ActivitySearchResult> {
  if (!isGetYourGuideConfigured()) {
    return { configured: false, offers: [] }
  }

  const q = input.query?.trim() || input.destination.trim()
  const dates =
    input.startDate && input.endDate ? `${input.startDate},${input.endDate}` : undefined

  try {
    const json = await gygFetch<GygToursResponse>('/tours', {
      q,
      currency: 'USD',
      cnt_language: 'en',
      limit: input.limit ?? 12,
      dates,
      sortfield: 'popularity',
      sortdirection: 'DESC',
    })

    const offers = (json.data?.tours || [])
      .map(t => mapTour(t, input.pubref))
      .filter((o): o is ActivityOffer => o != null)
      .slice(0, input.limit ?? 12)

    return { configured: true, offers }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'GetYourGuide search failed'
    return { configured: true, offers: [], error: msg }
  }
}
