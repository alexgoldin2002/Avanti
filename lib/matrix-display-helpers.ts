/** One-line trip takeaway for the matrix UI — no markdown, capped length. */
export function compactMatrixBlurb(recommendedShape?: string, summary?: string): string {
  const shape = stripMarkdown(recommendedShape || '').trim()
  const body = stripMarkdown(summary || '').trim()

  const pick = shape || body
  return truncateBlurb(pick)
}

export function truncateBlurb(text: string, max = 140): string {
  const oneLine = stripMarkdown(text).replace(/\s+/g, ' ').trim()
  if (!oneLine) return ''
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1).trim()}…`
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\*/g, '').trim()
}
