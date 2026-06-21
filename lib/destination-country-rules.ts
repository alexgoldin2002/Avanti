const US_COUNTRY_KEYS = new Set([
  'united states',
  'united states of america',
  'usa',
  'u.s.a.',
  'u.s.',
  'us',
  'america',
])

const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'united kingdom',
  'u.k.': 'united kingdom',
  uae: 'united arab emirates',
  'u.a.e.': 'united arab emirates',
}

/** Normalize a country label for comparison. */
export function normalizeCountryKey(country: string): string {
  const key = country.toLowerCase().trim().replace(/\.$/, '')
  return COUNTRY_ALIASES[key] || key
}

export function isUnitedStatesCountry(countryKey: string): boolean {
  return US_COUNTRY_KEYS.has(normalizeCountryKey(countryKey))
}

/**
 * Extract country from a destination NAME field, e.g.
 * "Riviera Maya, Mexico" → "mexico"
 * "San José del Cabo / Los Cabos, Mexico" → "mexico"
 */
export function extractCountryFromDestinationName(name: string): string | null {
  let trimmed = name.trim()
  if (!trimmed) return null

  // Model sometimes adds meta text after the place name
  trimmed = trimmed
    .replace(/\.\.\.+.*$/s, '')
    .replace(/\*[^*]*\*/g, '')
    .replace(/\s*[—–-]\s*(wait|note|already|duplicate|skipped|excluded).*$/i, '')
    .trim()

  if (trimmed.includes(',')) {
    const afterComma = trimmed.split(',').pop()?.trim()
    if (afterComma) return normalizeCountryKey(afterComma.replace(/\.$/, ''))
  }

  // "City / Region Country" without comma — last token if it looks like a country
  const slashParts = trimmed.split('/').map(p => p.trim())
  const tail = slashParts[slashParts.length - 1]
  const tailWords = tail.split(/\s+/)
  if (tailWords.length >= 2) {
    const maybeCountry = tailWords.slice(-2).join(' ')
    const single = tailWords[tailWords.length - 1]
    if (maybeCountry.length > 3) return normalizeCountryKey(maybeCountry)
    if (single.length > 3) return normalizeCountryKey(single)
  }

  return normalizeCountryKey(trimmed)
}

export type CountryDuplicateViolation = {
  country: string
  names: string[]
}

/** Non-US countries that appear on more than one card. */
export function getCountryDuplicateViolations(
  cards: { name: string }[],
): CountryDuplicateViolation[] {
  const byCountry = new Map<string, string[]>()

  for (const card of cards) {
    const country = extractCountryFromDestinationName(card.name)
    if (!country) continue
    if (isUnitedStatesCountry(country)) continue

    const names = byCountry.get(country) || []
    names.push(card.name)
    byCountry.set(country, names)
  }

  return [...byCountry.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([country, names]) => ({ country, names }))
}

export function formatCountryViolations(violations: CountryDuplicateViolation[]): string {
  return violations
    .map(v => `${v.country} (${v.names.join(' + ')})`)
    .join('; ')
}
