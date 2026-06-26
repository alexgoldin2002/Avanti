/** Rules injected into matrix generation prompts — matches 2C card chips. */
export const MATRIX_CHIP_RULES = `HIGHLIGHT and CONSIDER are tiny UI note labels (identical rules to Step 2 brainstorm cards):
- Exactly 2–4 words each — noun-phrase labels only, NEVER sentences or fragments
- HIGHLIGHT = top pro. CONSIDER = honest con. **CONSIDER is REQUIRED on every row** — never omit it.
- Each chip must read complete on its own (e.g. "Great nightlife", "Peak crowds", "20-min to beaches")
- **Every CONSIDER must be unique** across destinations — never repeat
- No verbs (is, are, require, wants, arriving). No "if/when/group". No filler.
- Good: "Great nightlife" / "20-min to beaches" / "Rich Gothic quarter" / "Direct flights"
- WRONG: "group is arriving in the right" / "real working Spanish city with Gothic" / "best beaches require a 20" / "beautiful" / "if the group wants world-famous Instagram"
- Put ALL sentences in SYNOPSIS and TRADEOFF only.`

export const MAX_CHIP_WORDS = 4
const MIN_CHIP_WORDS = 2

const VAGUE_CON_CHIPS = new Set([
  'some tradeoffs',
  'trickier logistics',
  'weather risk',
  'extra transit',
  'safety concerns',
  'tradeoffs exist',
  'some compromise',
  'group compromises',
  'logistics hassle',
  'budget stretch',
  'crowd risk',
])

const VAGUE_PRO_CHIPS = new Set([
  'beautiful',
  'stunning',
  'amazing',
  'incredible',
  'perfect',
  'great',
  'good',
  'nice',
  'ideal',
  'wonderful',
  'breathtaking',
  'unique',
  'special',
  'excellent',
])

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** True when text reads like prose / a cut-off sentence, not a chip label. */
export function chipHasSentenceStructure(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return true

  if (
    /\b(is|are|was|were|am|be|been|being|have|has|had|do|does|did|will|would|can|could|should|may|might|must|need|needs|require|requires|want|wants|arrive|arriving|arrives|get|gets|getting|mean|means|offer|offers|include|includes|feel|feels|work|working|make|makes|let|lets|go|goes|come|comes|stay|stays|take|takes)\b/.test(
      t,
    )
  ) {
    return true
  }

  if (/^(if|when|while|although|because|since|unless|group|for|with|like|unlike|the|this|that|it|you|your|they|their|our|we|as)\b/.test(t)) {
    return true
  }

  if (/\b(the group|this group|your group|group is|group wants|if the|world-famous|instagram)\b/.test(t)) {
    return true
  }

  if (/\bthe right\b|\brequire a\b|\brequire an\b|\bwith gothic\b|\bwith gothic$/i.test(t)) {
    return true
  }

  if (/\d+\s*$/.test(t) && !/\d+\s*[-–]?\s*(hour|min|mile|km|€|\$)/i.test(t)) {
    return true
  }

  return false
}

/** Sentence fragments and truncated prose — not valid chip labels. */
export function chipLooksLikeFragment(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return true
  if (/[,.;:…]/.test(t)) return true
  if (chipHasSentenceStructure(t)) return true

  const danglingEnds = [
    /\bmost$/,
    /\bsome$/,
    /\bmany$/,
    /\btheir$/,
    /\bthe$/,
    /\ba$/,
    /\ban$/,
    /\bfor$/,
    /\bwith$/,
    /\band$/,
    /\bor$/,
    /\bthat$/,
    /\bwhich$/,
    /\bright$/,
    /\ba \d+$/,
  ]
  if (danglingEnds.some(re => re.test(t))) return true

  return false
}

export function isVagueConChip(chip: string): boolean {
  const n = chip.trim().toLowerCase()
  if (!n) return true
  if (VAGUE_CON_CHIPS.has(n)) return true
  if (/^some\s+(tradeoff|compromise|logistic|hassle|inconvenience)/i.test(n)) return true
  if (/^(trickier|extra|general|minor|main)\s+/i.test(n)) return true
  return false
}

export function isVagueProChip(chip: string): boolean {
  const n = chip.trim().toLowerCase()
  if (!n) return true
  if (VAGUE_PRO_CHIPS.has(n)) return true
  return false
}

function isValidChipLabel(text: string, kind: 'pro' | 'con'): boolean {
  const n = wordCount(text)
  if (n < MIN_CHIP_WORDS || n > MAX_CHIP_WORDS) return false
  if (chipLooksLikeFragment(text)) return false
  if (kind === 'con' && isVagueConChip(text)) return false
  if (kind === 'pro' && isVagueProChip(text)) return false
  return true
}

function tailAfterDash(text: string, kind: 'pro' | 'con'): string {
  const parts = text.split(/\s*[—–]\s*/).map(s => s.trim()).filter(Boolean)
  if (parts.length < 2) return ''
  const tail = parts[parts.length - 1]
  if (!isValidChipLabel(tail, kind)) return ''
  return tail
}

/** Normalize AI chip output; reject sentences, fragments, and truncation. */
export function normalizeMatrixChip(raw: string, kind: 'pro' | 'con' = 'pro'): string {
  let text = raw.trim().split('\n')[0]?.replace(/[.!?]+$/, '').trim() ?? ''
  if (!text) return ''

  text = text
    .replace(/^(this|that|the)\s+(destination|pair|route|trip|combo)\s+(is|has|offers|needs)\s+/i, '')
    .replace(/^(honest\s+)?(downside|con|consider):\s*/i, '')
    .replace(/^highlight:\s*/i, '')
    .trim()

  const fromTail = tailAfterDash(text, kind)
  if (fromTail) return fromTail

  if (!isValidChipLabel(text, kind)) return ''
  return text
}

export function matrixChipIsValid(raw: string, kind: 'pro' | 'con' = 'pro'): boolean {
  return normalizeMatrixChip(raw, kind).length > 0
}

/** First line only, then normalize — use for all chip display. */
export function matrixChipLabel(raw: string, kind: 'pro' | 'con' = 'pro'): string {
  return normalizeMatrixChip(raw, kind)
}

export function resolveMatrixChip(
  primary: string,
  fallback?: string,
  kind: 'pro' | 'con' = 'pro',
): string {
  const main = normalizeMatrixChip(primary, kind)
  if (main) return main
  if (fallback) return normalizeMatrixChip(fallback, kind)
  return ''
}

export type ChipContext = {
  synopsis?: string
  logistics?: string
  tradeoff?: string
  groupFit?: string
  activities?: string
  vibe?: string
}

type ChipExtractor = (text: string) => string | null

function addCandidate(
  out: string[],
  seen: Set<string>,
  chip: string | null | undefined,
  kind: 'pro' | 'con',
) {
  const c = chip?.trim()
  if (!c || !isValidChipLabel(c, kind)) return
  const key = c.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  out.push(c)
}

const PRO_EXTRACTORS: ChipExtractor[] = [
  text => {
    if (/direct flight|nonstop|one-stop/i.test(text)) return 'Direct flights'
    if (/easiest travel|easy to reach|simple logistics/i.test(text)) return 'Easiest travel'
    return null
  },
  text => {
    if (/nightlife|club|party scene|late-night/i.test(text)) return 'Great nightlife'
    return null
  },
  text => {
    if (/food scene|culinary|dining|tapas|restaurant/i.test(text)) return 'Best food scene'
    return null
  },
  text => {
    if (/gothic|medieval|old town|historic quarter/i.test(text)) return 'Rich Gothic quarter'
    return null
  },
  text => {
    if (/authentic.*spanish|real.*spanish|working spanish city/i.test(text)) return 'Authentic Spanish city'
    return null
  },
  text => {
    if (/instagram|photo.?worthy|iconic view/i.test(text)) return 'Iconic photo spots'
    return null
  },
  text => {
    if (/beach|coastline|coastal|mediterranean swim/i.test(text)) return 'Great beaches'
    return null
  },
  text => {
    if (/culture|museum|architecture|historic/i.test(text)) return 'Rich culture'
    return null
  },
  text => {
    if (/shoulder season|right season|ideal season|perfect timing/i.test(text)) return 'Great timing'
    return null
  },
  text => {
    if (/value|affordable|budget-friendly|fits budget/i.test(text)) return 'Strong value'
    return null
  },
  text => {
    if (/relax|spa|unwind|slow pace/i.test(text)) return 'Relaxing pace'
    return null
  },
  text => {
    if (/adventure|hik(e|ing)|outdoor/i.test(text)) return 'Adventure ready'
    return null
  },
]

const CON_EXTRACTORS: ChipExtractor[] = [
  text => {
    const m = text.match(/beach(?:es)?\s+(?:require|need)s?\s+(?:a\s+)?(\d+)\s*[-–]?\s*min/i)
    if (m) return `${m[1]}-min to beaches`
    const m2 = text.match(/(\d+)\s*[-–]?\s*min(?:ute)?s?\s+(?:to|from)\s+(?:the\s+)?beach/i)
    if (m2) return `${m2[1]}-min to beaches`
    return null
  },
  text => {
    const place = text.match(/\b([A-Z][\w']+(?:\s+[A-Z][\w']+)?)\s+(?:accommodation|hotels?|lodging)/i)
    const months = text.match(/books?\s+out\s+(\d+\+?\s*months?)\s+ahead/i)
    if (place && months) return `${place[1]} books out ${months[1]}`
    if (place && /books?\s+out|sold\s+out/i.test(text)) return `${place[1]} books out`
    if (months) return `Books out ${months[1]} ahead`
    return null
  },
  text => {
    const hours = text.match(/(\d+)\s*[-–]?\s*hour\s+flights?/i)
    if (hours) return `${hours[1]}-hour flights`
    if (/multi-stop|two\s+separate\s+flights/i.test(text)) return 'Two separate flights'
    if (/long\s+(flight|haul)/i.test(text)) return 'Long flight haul'
    return null
  },
  text => {
    const via = text.match(/(?:layover|connection)\s+(?:in|at|through)\s+([A-Z][\w']+)/i)
    if (via) return `Layover in ${via[1]}`
    if (/layover|connection/i.test(text)) return 'Long layovers'
    return null
  },
  text => {
    if (/peak|overtourist|packed|crowd/i.test(text)) return 'Peak crowds'
    return null
  },
  text => {
    if (/stretch(es)?\s+budget|over\s+budget|price(s)?\s+rise|steep(ly)?/i.test(text)) return 'Runs over budget'
    return null
  },
  text => {
    if (/visa|entry\s+requirement/i.test(text)) return 'Visa required'
    return null
  },
  text => {
    if (/heat|humid|rain(y)?\s+season|monsoon/i.test(text)) return 'Rainy season risk'
    return null
  },
  text => {
    if (/similar\s+vibe|same\s+vibe|overlap/i.test(text)) return 'Similar vibes'
    return null
  },
  text => {
    if (/ferry|extra\s+transit|multiple\s+transfer/i.test(text)) return 'Extra ferry hops'
    return null
  },
  text => {
    if (/less\s+(time|days)\s+per/i.test(text)) return 'Less time per stop'
    return null
  },
  text => {
    if (/language\s+barrier/i.test(text)) return 'Language barrier'
    return null
  },
  text => {
    if (/instagram.*crowd|over-tourist|tourist trap/i.test(text)) return 'Touristy spots'
    return null
  },
]

function collectFromExtractors(text: string, extractors: ChipExtractor[], kind: 'pro' | 'con'): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const extract of extractors) {
    addCandidate(out, seen, extract(text), kind)
  }
  return out
}

function proCorpus(context: ChipContext): string[] {
  return [context.synopsis, context.logistics, context.groupFit, context.activities, context.vibe].filter(
    Boolean,
  ) as string[]
}

function conCorpus(context: ChipContext): string[] {
  return [context.tradeoff, context.synopsis, context.logistics].filter(Boolean) as string[]
}

/** Build a short pro chip from destination fields when HIGHLIGHT is missing or invalid. */
export function extractProChip(context: ChipContext, opts?: { exclude?: Set<string> }): string {
  const exclude = opts?.exclude ?? new Set<string>()
  for (const text of proCorpus(context)) {
    for (const candidate of collectFromExtractors(text, PRO_EXTRACTORS, 'pro')) {
      if (!exclude.has(candidate.toLowerCase())) return candidate
    }
  }
  return ''
}

/** Build a specific con chip from TRADEOFF and related fields. */
export function extractConChip(context: ChipContext, opts?: { exclude?: Set<string> }): string {
  const exclude = opts?.exclude ?? new Set<string>()
  for (const text of conCorpus(context)) {
    for (const candidate of collectFromExtractors(text, CON_EXTRACTORS, 'con')) {
      if (!exclude.has(candidate.toLowerCase())) return candidate
    }
  }
  return ''
}

/** @deprecated pass ChipContext */
export function deriveConChip(tradeoff: string): string {
  return extractConChip({ tradeoff })
}

/** @deprecated pass ChipContext */
export function deriveProChip(context: ChipContext): string {
  return extractProChip(context)
}

export function resolveHighlightChip(highlight: string, context: ChipContext): string {
  const fromHighlight = normalizeMatrixChip(highlight, 'pro')
  if (fromHighlight) return fromHighlight
  return extractProChip(context)
}

export function resolveConsiderChip(
  consider: string,
  tradeoff: string,
  exclude?: Set<string>,
  context?: Omit<ChipContext, 'tradeoff'>,
): string {
  const fullContext: ChipContext = { ...context, tradeoff }
  const fromConsider = normalizeMatrixChip(consider, 'con')
  if (fromConsider && !isVagueConChip(fromConsider) && !exclude?.has(fromConsider.toLowerCase())) {
    return fromConsider
  }
  return extractConChip(fullContext, { exclude })
}

/** Ensure every row has a unique, specific con chip. */
export function dedupeConsiderChips(
  rows: Array<{ consider?: string; tradeoff?: string; synopsis?: string; logistics?: string }>,
): void {
  const used = new Set<string>()
  for (const row of rows) {
    const chip = resolveConsiderChip(row.consider || '', row.tradeoff || '', used, row)
    row.consider = chip
    if (chip) used.add(chip.toLowerCase())
  }
}

/** Re-resolve highlight chips; dedupe when possible. */
export function dedupeHighlightChips(
  rows: Array<{
    highlight?: string
    synopsis?: string
    logistics?: string
    groupFit?: string
    activities?: string
    vibe?: string
  }>,
): void {
  const used = new Set<string>()
  for (const row of rows) {
    const fromRaw = normalizeMatrixChip(row.highlight || '', 'pro')
    let chip =
      fromRaw && !used.has(fromRaw.toLowerCase())
        ? fromRaw
        : extractProChip(row, { exclude: used })
    if (!chip && fromRaw) chip = fromRaw
    row.highlight = chip
    if (chip) used.add(chip.toLowerCase())
  }
}
