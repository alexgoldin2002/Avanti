function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*/g, '').trim()
}

const PRICE_RANGE_RE = /~?\$[\d,]+(?:[–\-]\$?[\d,]+)?/
const PER_PERSON_SUFFIX_RE = /^\s*(per person(?:\s+total)?|\/person(?:\s+total)?)/i

function firstBudgetLine(budgetFit: string): string {
  return budgetFit.split('\n')[0]?.trim() || budgetFit.trim()
}

/** Dollar range + optional "per person" — stops before em-dash verdict or breakdown parens. */
export function costHeadlineFromBudget(budgetFit: string): string {
  const first = firstBudgetLine(budgetFit)
  if (!first) return ''

  const rangeMatch = first.match(PRICE_RANGE_RE)
  if (!rangeMatch || rangeMatch.index == null) return first.slice(0, 60)

  let headline = rangeMatch[0].replace(/^~/, '')
  const afterRange = first.slice(rangeMatch.index + rangeMatch[0].length)
  const perPersonMatch = afterRange.match(PER_PERSON_SUFFIX_RE)
  if (perPersonMatch) {
    headline += perPersonMatch[0]
  } else if (!/per person|\/person/i.test(headline)) {
    headline = `${headline} per person`
  }

  return headline.trim()
}

/** Verdict text glued to line 1 after the price (e.g. after an em-dash), plain text. */
export function budgetVerdictFromHeadline(budgetFit: string): string {
  const first = firstBudgetLine(budgetFit)
  if (!first) return ''

  const headline = costHeadlineFromBudget(budgetFit)
  if (!headline) return ''

  const headIdx = first.toLowerCase().indexOf(headline.toLowerCase())
  let rest =
    headIdx >= 0
      ? first.slice(headIdx + headline.length).trim()
      : first.replace(PRICE_RANGE_RE, '').replace(PER_PERSON_SUFFIX_RE, '').trim()

  rest = rest.replace(/^[:\s—–-]+/, '').trim()
  if (!rest || rest.startsWith('(')) return ''

  return stripInlineMarkdown(rest)
}

export function budgetVerdictFromBreakdown(budgetFit: string): string {
  const body = budgetBreakdownBody(budgetFit)
  if (!body) return ''

  const match = body.match(/(?:—|–|-)\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?\s*$/)
  if (!match?.[1]) return ''

  return stripInlineMarkdown(match[1])
}

/** Breakdown body without the trailing em-dash verdict (verdict moves to synopsis). */
export function budgetBreakdownDetailBody(budgetFit: string): string {
  const body = budgetBreakdownBody(budgetFit)
  if (!body) return ''

  return body.replace(/\s*(?:—|–|-)\s*(?:\*\*)?[^*\n]+(?:\*\*)?\s*$/, '').trim()
}

export function combineSynopsisWithBudgetVerdict(synopsis: string, budgetFit: string): string {
  const verdicts = [budgetVerdictFromHeadline(budgetFit), budgetVerdictFromBreakdown(budgetFit)].filter(
    Boolean,
  )
  if (verdicts.length === 0) return synopsis

  let base = synopsis.trim()
  for (const verdict of verdicts) {
    if (base.toLowerCase().includes(verdict.toLowerCase())) continue
    base = base ? `${base} ${verdict}` : verdict
  }
  return base
}

/** Detail lines after the per-person headline — flights, nightly rates, verdict. */
export function budgetBreakdownBody(budgetFit: string): string {
  const raw = budgetFit.trim()
  if (!raw) return ''

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length > 1) {
    return lines.slice(1).join('\n').trim()
  }

  const first = lines[0] || raw
  const headline = costHeadlineFromBudget(raw)
  if (!headline) return ''

  let rest = first
  const headIdx = first.toLowerCase().indexOf(headline.toLowerCase())
  if (headIdx >= 0) {
    rest = first.slice(headIdx + headline.length).trim()
  } else {
    rest = first.replace(/^~?\$[\d,]+(?:[–\-]\$?[\d,]+)?[^(\n]*/i, '').trim()
  }

  rest = rest.replace(/^[:\s—–-]+/, '').trim()

  // Line-1 verdict only — shown in synopsis, not breakdown.
  if (rest && !rest.startsWith('(') && !/^[-•*]/.test(rest)) {
    return ''
  }

  return rest
}

export function parseCostBullets(budgetFit: string): string[] {
  const body = budgetBreakdownDetailBody(budgetFit)
  if (!body) return []
  return body
    .split('\n')
    .map(line => line.replace(/^[-•*]\s*/, '').trim())
    .filter(line => line.length > 2)
}

// Re-export chip display helper for matrix UI
export { matrixChipLabel } from './matrix-chip-fields'
