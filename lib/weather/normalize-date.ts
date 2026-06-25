/** Normalize trip / overlap dates to YYYY-MM-DD for Open-Meteo. */
export function normalizeIsoDate(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }

  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const [, mm, dd, yyyy] = us
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}
