/**
 * Central affiliate tracking for outbound booking links.
 *
 * Revenue model:
 * - Affiliate links (Booking.com, VRBO/Expedia Partnerize, Kayak, GetYourGuide) → commission on completed bookings
 * - Live APIs (Duffel, LiteAPI, GYG Partner API) → partner margin when in-app checkout ships
 * - Google Flights/Hotels → no affiliate program; use Kayak/Booking.com when monetizing outbound clicks
 */

export type AffiliateContext = {
  /** Sub-id for attribution — typically tripId */
  pubref?: string
  /** Extra tracking label (e.g. step name) */
  label?: string
}

export type AffiliateProgram =
  | 'vrbo'
  | 'expedia'
  | 'booking_com'
  | 'kayak'
  | 'getyourguide'

export type AffiliateStatus = Record<AffiliateProgram, boolean> & {
  /** Programs with no public affiliate option */
  google_flights: false
  google_hotels: false
}

function env(key: string): string | null {
  const v = process.env[key]?.trim()
  return v || null
}

function camref(...keys: string[]): string | null {
  for (const key of keys) {
    const v = env(key)
    if (v) return v
  }
  return null
}

function pubrefValue(ctx?: AffiliateContext): string | null {
  return ctx?.pubref?.trim() || env('AFFILIATE_DEFAULT_PUBREF') || null
}

/**
 * Partnerize deeplink — used by Expedia Group brands (VRBO, Expedia.com, Hotels.com).
 * Do not add UTMs to the destination URL.
 */
export function partnerizeUrl(
  camrefValue: string | null,
  destinationUrl: string,
  ctx?: AffiliateContext
): string {
  if (!camrefValue) return destinationUrl

  const parts = [`https://prf.hn/click/camref:${camrefValue}`]
  const pubref = pubrefValue(ctx)
  if (pubref) parts.push(`pubref:${encodeURIComponent(pubref)}`)
  if (ctx?.label?.trim()) parts.push(`adref:${encodeURIComponent(ctx.label.trim())}`)
  parts.push(`destination:${destinationUrl}`)
  return parts.join('/')
}

export function vrboCamref(): string | null {
  return camref('VRBO_PARTNERIZE_CAMREF', 'AFFILIATE_VRBO_CAMREF')
}

export function expediaCamref(): string | null {
  return camref('AFFILIATE_EXPEDIA_CAMREF', 'EXPEDIA_PARTNERIZE_CAMREF')
}

export function bookingAid(): string | null {
  return camref('AFFILIATE_BOOKING_AID', 'BOOKING_AFFILIATE_AID')
}

export function kayakPartnerId(): string | null {
  return camref('AFFILIATE_KAYAK_PARTNER_ID', 'KAYAK_AFFILIATE_PARTNER_ID')
}

export function getYourGuidePartnerId(): string | null {
  return camref('AFFILIATE_GETYOURGUIDE_PARTNER_ID', 'GETYOURGUIDE_PARTNER_ID')
}

export function isVrboAffiliateConfigured(): boolean {
  return Boolean(vrboCamref())
}

export function isBookingAffiliateConfigured(): boolean {
  return Boolean(bookingAid())
}

export function isKayakAffiliateConfigured(): boolean {
  return Boolean(kayakPartnerId())
}

export function isExpediaAffiliateConfigured(): boolean {
  return Boolean(expediaCamref())
}

export function isGetYourGuideAffiliateConfigured(): boolean {
  return Boolean(getYourGuidePartnerId())
}

export function getAffiliateStatus(): AffiliateStatus {
  return {
    vrbo: isVrboAffiliateConfigured(),
    expedia: isExpediaAffiliateConfigured(),
    booking_com: isBookingAffiliateConfigured(),
    kayak: isKayakAffiliateConfigured(),
    getyourguide: isGetYourGuideAffiliateConfigured(),
    google_flights: false,
    google_hotels: false,
  }
}

export function wrapVrboUrl(destinationUrl: string, ctx?: AffiliateContext): string {
  return partnerizeUrl(vrboCamref(), destinationUrl, ctx)
}

export function wrapExpediaUrl(destinationUrl: string, ctx?: AffiliateContext): string {
  return partnerizeUrl(expediaCamref(), destinationUrl, ctx)
}

/** Booking.com affiliate — aid + optional label for sub-tracking. */
export function wrapBookingComUrl(destinationUrl: string, ctx?: AffiliateContext): string {
  const aid = bookingAid()
  if (!aid) return destinationUrl

  const url = new URL(destinationUrl)
  url.searchParams.set('aid', aid)
  const label = ctx?.label?.trim() || (ctx?.pubref ? `avanti-${ctx.pubref}` : null)
  if (label) url.searchParams.set('label', label)
  return url.toString()
}

/** Kayak media partner redirect. */
export function wrapKayakUrl(destinationUrl: string, ctx?: AffiliateContext): string {
  const partnerId = kayakPartnerId()
  if (!partnerId) return destinationUrl

  const url = new URL('https://www.kayak.com/in')
  url.searchParams.set('a', partnerId)
  url.searchParams.set('url', destinationUrl)
  if (ctx?.pubref) url.searchParams.set('encoder', ctx.pubref)
  return url.toString()
}

/** GetYourGuide partner search / tour links. */
export function wrapGetYourGuideUrl(destinationUrl: string, ctx?: AffiliateContext): string {
  const partnerId = getYourGuidePartnerId()
  if (!partnerId) return destinationUrl

  const url = new URL(destinationUrl)
  if (!url.searchParams.has('partner_id')) {
    url.searchParams.set('partner_id', partnerId)
  }
  if (ctx?.pubref && !url.searchParams.has('cmp')) {
    url.searchParams.set('cmp', `avanti-${ctx.pubref}`)
  }
  return url.toString()
}
