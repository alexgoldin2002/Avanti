/** One chip = one complete departure location (may contain commas, e.g. "New York, NY, USA"). */

export function parseDepartureCitiesFromStep2(s2: Record<string, unknown> | null | undefined): string[] {
  if (!s2) return []
  if (Array.isArray(s2.departureCities)) {
    return s2.departureCities.map(c => String(c).trim()).filter(Boolean)
  }
  if (typeof s2.departureCity === 'string' && s2.departureCity.trim()) {
    return [s2.departureCity.trim()]
  }
  return []
}

/** Legacy single-field storage — use semicolon between multiple cities, never comma. */
export function departureCitiesToStoredString(cities: string[]): string {
  return cities.join('; ')
}

export function formatDepartureCitiesForPrompt(cities: string[] | string | undefined | null): string {
  if (!cities) return 'Not specified'
  if (typeof cities === 'string') return cities.trim() || 'Not specified'
  const list = cities.map(c => c.trim()).filter(Boolean)
  if (list.length === 0) return 'Not specified'
  if (list.length === 1) return list[0]
  return list.join('; ')
}

export function departureCitiesFromAnswers(answers: Record<string, unknown>): string[] {
  if (Array.isArray(answers.departureCities)) {
    return (answers.departureCities as string[]).map(c => String(c).trim()).filter(Boolean)
  }
  if (typeof answers.departureCity === 'string' && answers.departureCity.trim()) {
    return [answers.departureCity.trim()]
  }
  return []
}
