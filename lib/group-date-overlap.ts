export type Step2DateInput = {
  dates?: string | null
  fixedDates?: { start?: string; end?: string } | null
  flexLength?: string | null
}

export type TravelerDateProfile = {
  id: string
  displayName: string
  step2?: Step2DateInput | Record<string, unknown> | null
  /** Dependents / non-voters may skip */
  fillsOwnPreferences?: boolean | null
}

export type DateOverlapFix = {
  travelerId: string
  displayName: string
  reasons: string[]
}

export type GroupDateOverlapResult = {
  status: 'ok' | 'waiting' | 'no_overlap' | 'too_short'
  /** Travelers with a usable date window for overlap math */
  participants: number
  /** Still need to complete Brainstorm dates */
  pendingNames: string[]
  overlapStart: string | null
  overlapEnd: string | null
  overlapNights: number
  /** Shortest preferred trip length across the group (nights) */
  minRequiredNights: number | null
  minRequiredBy: { travelerId: string; displayName: string; label: string } | null
  fixes: DateOverlapFix[]
  summary: string
}

function asStep2(raw: TravelerDateProfile['step2']): Step2DateInput {
  if (!raw || typeof raw !== 'object') return {}
  return raw as Step2DateInput
}

function displayLabel(traveler: TravelerDateProfile): string {
  return traveler.displayName.trim() || 'A traveler'
}

/** Inclusive calendar span → nights away (departure to return). */
export function nightsBetween(start: string, end: string): number {
  if (!start || !end || end < start) return 0
  const a = new Date(`${start.slice(0, 10)}T12:00:00`)
  const b = new Date(`${end.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  return Math.max(0, days)
}

export function parseFlexLengthMinNights(flexLength?: string | null): number | null {
  if (!flexLength?.trim()) return null
  if (/2\+?\s*weeks/i.test(flexLength)) return 14
  const range = flexLength.match(/(\d+)\s*[–-]\s*(\d+)/)
  if (range) return parseInt(range[1], 10)
  const single = flexLength.match(/(\d+)/)
  if (single) return parseInt(single[1], 10)
  return null
}

export function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  return `${fmt(start)} – ${fmt(end)}`
}

type ParsedWindow = {
  travelerId: string
  displayName: string
  start: string
  end: string
  minPreferredNights: number | null
  preferredLabel: string
  datesMode: string
}

function parseTravelerWindow(traveler: TravelerDateProfile): ParsedWindow | null {
  const s2 = asStep2(traveler.step2)
  const mode = s2.dates?.trim() || ''
  const start = s2.fixedDates?.start?.slice(0, 10) || ''
  const end = s2.fixedDates?.end?.slice(0, 10) || ''

  if (mode === 'Completely flexible') {
    const minN = parseFlexLengthMinNights(s2.flexLength)
    return minN != null
      ? {
          travelerId: traveler.id,
          displayName: displayLabel(traveler),
          start: '',
          end: '',
          minPreferredNights: minN,
          preferredLabel: s2.flexLength || `${minN} nights`,
          datesMode: mode,
        }
      : null
  }

  if (mode !== 'Fixed dates' && mode !== 'Flexible — I have a range') return null
  if (!start || !end || end < start) return null

  let minPreferred: number | null = null
  let preferredLabel = ''

  if (mode === 'Fixed dates') {
    minPreferred = nightsBetween(start, end)
    preferredLabel = `${minPreferred} night${minPreferred === 1 ? '' : 's'} (fixed)`
  } else {
    minPreferred = parseFlexLengthMinNights(s2.flexLength)
    preferredLabel = s2.flexLength?.trim() || (minPreferred ? `${minPreferred}+ nights` : 'flexible length')
  }

  return {
    travelerId: traveler.id,
    displayName: displayLabel(traveler),
    start,
    end,
    minPreferredNights: minPreferred,
    preferredLabel,
    datesMode: mode,
  }
}

function addFix(map: Map<string, DateOverlapFix>, id: string, name: string, reason: string) {
  const existing = map.get(id) || { travelerId: id, displayName: name, reasons: [] }
  if (!existing.reasons.includes(reason)) existing.reasons.push(reason)
  map.set(id, existing)
}

export function analyzeGroupDateOverlap(travelers: TravelerDateProfile[]): GroupDateOverlapResult {
  const eligible = travelers.filter(t => t.fillsOwnPreferences !== false)
  const fixes = new Map<string, DateOverlapFix>()
  const pendingNames: string[] = []

  for (const t of eligible) {
    const parsed = parseTravelerWindow(t)
    if (!parsed || (parsed.datesMode !== 'Completely flexible' && (!parsed.start || !parsed.end))) {
      pendingNames.push(displayLabel(t))
      addFix(
        fixes,
        t.id,
        displayLabel(t),
        'Complete your travel dates in Brainstorm so the group can find overlapping days.'
      )
    }
  }

  const withWindows = eligible
    .map(parseTravelerWindow)
    .filter((p): p is ParsedWindow => !!p && !!p.start && !!p.end)

  const withPrefOnly = eligible
    .map(parseTravelerWindow)
    .filter((p): p is ParsedWindow => !!p && p.datesMode === 'Completely flexible')

  const prefValues = [
    ...withWindows.map(p => p.minPreferredNights).filter((n): n is number => n != null && n > 0),
    ...withPrefOnly.map(p => p.minPreferredNights).filter((n): n is number => n != null && n > 0),
  ]

  const minRequiredNights = prefValues.length ? Math.min(...prefValues) : null
  const minTraveler = [...withWindows, ...withPrefOnly].find(
    p => p.minPreferredNights != null && p.minPreferredNights === minRequiredNights
  )

  if (withWindows.length === 0) {
    return {
      status: pendingNames.length ? 'waiting' : 'waiting',
      participants: 0,
      pendingNames,
      overlapStart: null,
      overlapEnd: null,
      overlapNights: 0,
      minRequiredNights,
      minRequiredBy: minTraveler
        ? { travelerId: minTraveler.travelerId, displayName: minTraveler.displayName, label: minTraveler.preferredLabel }
        : null,
      fixes: [...fixes.values()],
      summary:
        pendingNames.length > 0
          ? `Waiting on ${pendingNames.length} traveler${pendingNames.length === 1 ? '' : 's'} to enter dates.`
          : 'No date windows to compare yet.',
    }
  }

  if (pendingNames.length > 0 && withWindows.length < eligible.length) {
    return {
      status: 'waiting',
      participants: withWindows.length,
      pendingNames,
      overlapStart: null,
      overlapEnd: null,
      overlapNights: 0,
      minRequiredNights,
      minRequiredBy: minTraveler
        ? { travelerId: minTraveler.travelerId, displayName: minTraveler.displayName, label: minTraveler.preferredLabel }
        : null,
      fixes: [...fixes.values()],
      summary: `Waiting on ${pendingNames.join(', ')} to enter dates before the group can align.`,
    }
  }

  const overlapStart = withWindows.reduce((max, p) => (p.start > max ? p.start : max), withWindows[0].start)
  const overlapEnd = withWindows.reduce((min, p) => (p.end < min ? p.end : min), withWindows[0].end)
  const overlapNights = overlapStart <= overlapEnd ? nightsBetween(overlapStart, overlapEnd) : 0

  const latestStarters = withWindows.filter(p => p.start === overlapStart)
  const earliestLeavers = withWindows.filter(p => p.end === overlapEnd)

  if (overlapNights === 0) {
    for (const p of latestStarters) {
      addFix(
        fixes,
        p.travelerId,
        p.displayName,
        `Your available window (${formatDateRange(p.start, p.end)}) starts too late — try an earlier departure so dates overlap with the rest of the group.`
      )
    }
    for (const p of earliestLeavers) {
      addFix(
        fixes,
        p.travelerId,
        p.displayName,
        `Your available window (${formatDateRange(p.start, p.end)}) ends too early — try a later return so dates overlap with the rest of the group.`
      )
    }

    return {
      status: 'no_overlap',
      participants: withWindows.length,
      pendingNames,
      overlapStart: null,
      overlapEnd: null,
      overlapNights: 0,
      minRequiredNights,
      minRequiredBy: minTraveler
        ? { travelerId: minTraveler.travelerId, displayName: minTraveler.displayName, label: minTraveler.preferredLabel }
        : null,
      fixes: [...fixes.values()],
      summary: 'No dates overlap for the whole group yet.',
    }
  }

  const required = minRequiredNights ?? 1
  if (overlapNights < required) {
    for (const p of latestStarters) {
      addFix(
        fixes,
        p.travelerId,
        p.displayName,
        `You're the latest to depart (${formatDateRange(p.start, p.end)}) — an earlier start would give the group more shared days.`
      )
    }
    for (const p of earliestLeavers) {
      addFix(
        fixes,
        p.travelerId,
        p.displayName,
        `You're the earliest to return (${formatDateRange(p.start, p.end)}) — a later end date would give the group more shared days.`
      )
    }
    if (minTraveler) {
      addFix(
        fixes,
        minTraveler.travelerId,
        minTraveler.displayName,
        `You chose the shortest trip length (${minTraveler.preferredLabel}). The group only overlaps ${overlapNights} night${overlapNights === 1 ? '' : 's'} — consider a shorter length, or ask others to widen their date ranges.`
      )
    }

    return {
      status: 'too_short',
      participants: withWindows.length,
      pendingNames,
      overlapStart,
      overlapEnd,
      overlapNights,
      minRequiredNights: required,
      minRequiredBy: minTraveler
        ? { travelerId: minTraveler.travelerId, displayName: minTraveler.displayName, label: minTraveler.preferredLabel }
        : null,
      fixes: [...fixes.values()],
      summary: `Group overlap is ${overlapNights} night${overlapNights === 1 ? '' : 's'} (${formatDateRange(overlapStart, overlapEnd)}), but the group needs at least ${required} to match the shortest trip length chosen.`,
    }
  }

  return {
    status: 'ok',
    participants: withWindows.length,
    pendingNames,
    overlapStart,
    overlapEnd,
    overlapNights,
    minRequiredNights: required,
    minRequiredBy: minTraveler
      ? { travelerId: minTraveler.travelerId, displayName: minTraveler.displayName, label: minTraveler.preferredLabel }
      : null,
    fixes: [],
    summary: `Everyone overlaps ${overlapNights} night${overlapNights === 1 ? '' : 's'} (${formatDateRange(overlapStart, overlapEnd)}) — enough for the ${required}-night minimum.`,
  }
}

export function travelerProfilesFromRows(
  rows: Array<{
    id: string
    nickname?: string | null
    full_name?: string | null
    step2?: Record<string, unknown> | null
    fills_own_preferences?: boolean | null
  }>
): TravelerDateProfile[] {
  return rows.map(t => ({
    id: t.id,
    displayName: t.nickname || t.full_name?.split(' ')[0] || 'Traveler',
    step2: t.step2,
    fillsOwnPreferences: t.fills_own_preferences,
  }))
}
