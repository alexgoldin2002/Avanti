import { NextRequest, NextResponse } from 'next/server'

// Autocomplete backed by the NLM RxNorm drug database. The full display-name
// list (~28k terms, ~750KB) is fetched once and cached in module memory so
// keystroke lookups stay fast and never hit the network per request.

const RXNAV_DISPLAY_NAMES = 'https://rxnav.nlm.nih.gov/REST/displaynames.json'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 1 day

let cache: { terms: string[]; loadedAt: number } | null = null
let inflight: Promise<string[]> | null = null

async function loadTerms(): Promise<string[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.terms
  if (inflight) return inflight
  inflight = (async () => {
    const res = await fetch(RXNAV_DISPLAY_NAMES, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`RxNav responded ${res.status}`)
    const json = (await res.json()) as { displayTermsList?: { term?: string[] } }
    const terms = Array.isArray(json.displayTermsList?.term) ? json.displayTermsList!.term! : []
    cache = { terms, loadedAt: Date.now() }
    return terms
  })()
  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  if (q.length < 2) return NextResponse.json({ results: [] })

  let terms: string[]
  try {
    terms = await loadTerms()
  } catch {
    return NextResponse.json({ results: [], error: 'lookup_unavailable' }, { status: 200 })
  }

  const prefix: string[] = []
  const contains: string[] = []
  for (const term of terms) {
    const lower = term.toLowerCase()
    if (lower.startsWith(q)) prefix.push(term)
    else if (contains.length < 40 && lower.includes(q)) contains.push(term)
    if (prefix.length >= 12) break
  }

  const merged = [...prefix, ...contains].slice(0, 12)
  // Title-case the leading letter for nicer display; RxNorm terms are lowercase.
  const results = merged.map(t => t.charAt(0).toUpperCase() + t.slice(1))
  return NextResponse.json({ results })
}
