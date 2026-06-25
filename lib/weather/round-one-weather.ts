/** Shown when group overlap dates are not computed yet. */
export const WEATHER_PENDING_OVERLAP =
  'Typical weather appears once the group overlap dates are set in Step 2.'

/** Shown when overlap exists but Open-Meteo could not produce a summary. */
export const WEATHER_UNAVAILABLE =
  'Typical weather unavailable for this destination.'

export const MIN_CLIMATE_SAMPLE_YEARS = 1

/** One-line Open-Meteo summary only — never narrative AI copy. */
export function resolveRoundOneWeather(input: {
  climateLine?: string | null
  hasTravelWindow: boolean
}): string {
  if (input.climateLine?.trim()) return input.climateLine.trim()
  if (!input.hasTravelWindow) return WEATHER_PENDING_OVERLAP
  return WEATHER_UNAVAILABLE
}

/** Block legacy brainstorm / AI weather paragraphs from Round 1 cards. */
export function isNarrativeWeatherText(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  const t = text.trim()
  if (t.length > 110) return true
  if ((t.match(/[.!?]/g) || []).length >= 2) return true
  if (/\b(note:|golden week|book accommodation|typically|layers essential|cherry blossom)\b/i.test(t)) {
    return true
  }
  if (t.startsWith('Typical weather for ') && t.includes('°F')) return false
  if (t === WEATHER_PENDING_OVERLAP || t === WEATHER_UNAVAILABLE) return false
  return false
}

/** Reject AI paragraphs and pre-validation Open-Meteo lines cached in the DB. */
export function isInvalidStoredWeather(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  if (isNarrativeWeatherText(text)) return true
  const t = text.trim()
  if (t.startsWith('Typical weather for ') && t.includes('°F') && !t.includes('around ')) {
    return true
  }
  return false
}
