/** Pre-filled external search URLs — bridge from Avanti planning to checkout sites. */

export type FlightSearchParams = {
  origin: string
  destination: string
  departDate: string
  returnDate: string
}

export type HotelSearchParams = {
  destination: string
  checkIn: string
  checkOut: string
  /** Property or neighborhood name for tighter results */
  query?: string
  adults?: number
}

/** Pull a 3-letter IATA code from strings like "JFK · New York" or "LIS". */
export function extractIata(codeOrLabel: string): string | null {
  if (!codeOrLabel?.trim()) return null
  const upper = codeOrLabel.toUpperCase()
  const match = upper.match(/\b([A-Z]{3})\b/)
  return match?.[1] ?? null
}

export function googleFlightsUrl(params: FlightSearchParams): string {
  const q = `Flights from ${params.origin} to ${params.destination} on ${params.departDate} through ${params.returnDate}`
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`
}

export function googleHotelsUrl(params: HotelSearchParams): string {
  const dest = params.destination.trim()
  const q = params.query?.trim() || `Hotels in ${dest}`
  const dates = `${params.checkIn},${params.checkOut}`
  return `https://www.google.com/travel/hotels/${encodeURIComponent(dest)}?q=${encodeURIComponent(q)}&dates=${dates}`
}

export function bookingComUrl(params: HotelSearchParams): string {
  const ss = params.query?.trim() || params.destination.trim()
  const url = new URL('https://www.booking.com/searchresults.html')
  url.searchParams.set('ss', ss)
  url.searchParams.set('checkin', params.checkIn)
  url.searchParams.set('checkout', params.checkOut)
  if (params.adults && params.adults > 1) {
    url.searchParams.set('group_adults', String(params.adults))
  }
  return url.toString()
}

export function kayakFlightsUrl(params: FlightSearchParams): string {
  const url = new URL('https://www.kayak.com/flights')
  url.pathname = `/${encodeURIComponent(params.origin)}-${encodeURIComponent(params.destination)}/${params.departDate}/${params.returnDate}`
  return url.toString()
}

/** Best destination label for hotel search from trip + optional airport string. */
export function hotelDestinationFromTrip(destination: string, destinationAirport?: string | null): string {
  if (destination?.trim()) return destination.trim()
  if (destinationAirport?.trim()) {
    return destinationAirport.replace(/^[A-Z]{3}\s*[·\-–—]?\s*/i, '').trim() || destinationAirport
  }
  return 'destination'
}
