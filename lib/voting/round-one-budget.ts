import { formatUsd } from '@/lib/group-budget'

export type ParsedCostRange = {
  min: number
  max: number
  /** True when the source text used "$X,000+" style open ceiling. */
  openEnded?: boolean
}

/** Parse the COST field from a brainstorm / voting card snapshot. */
export function parseDestinationCostRange(cost: string | undefined | null): ParsedCostRange | null {
  if (!cost?.trim()) return null

  const firstLine = cost.split('\n')[0]?.trim() || cost.trim()

  const rangeMatch = firstLine.match(/~\s*\$?\s*([\d,]+)\s*[–-]\s*\$?\s*([\d,]+)/i)
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1].replace(/,/g, ''), 10)
    const max = parseInt(rangeMatch[2].replace(/,/g, ''), 10)
    if (!Number.isNaN(min) && !Number.isNaN(max) && max >= min) {
      return { min, max }
    }
  }

  const plusMatch = firstLine.match(/\$?\s*([\d,]+)\s*\+/)
  if (plusMatch) {
    const min = parseInt(plusMatch[1].replace(/,/g, ''), 10)
    if (!Number.isNaN(min)) {
      return { min, max: min, openEnded: true }
    }
  }

  const singleMatch = firstLine.match(/\$?\s*([\d,]+)/)
  if (singleMatch) {
    const value = parseInt(singleMatch[1].replace(/,/g, ''), 10)
    if (!Number.isNaN(value)) {
      return { min: value, max: value }
    }
  }

  return null
}

export function formatCostRangeLine(range: ParsedCostRange): string {
  if (range.openEnded) {
    return `${formatUsd(range.min)}+ / person est.`
  }
  if (range.min === range.max) {
    return `${formatUsd(range.min)} / person est.`
  }
  return `${formatUsd(range.min)} — ${formatUsd(range.max)} / person est.`
}

