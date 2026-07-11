import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 60

import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { mergeCompanionOptions } from '@/lib/trip-companion/client-api'
import { generateEntryRequirements } from '@/lib/trip-companion/generate-entry-requirements'
import type { EntryRequirementsMed } from '@/lib/trip-companion/types'

type ProfileRow = {
  user_id: string
  full_name: string | null
  country_of_residence: string | null
  benefits_profile: Record<string, unknown> | null
}

function readMeds(source: unknown): Array<{ name: string; dosage?: string; unit?: string }> {
  if (!Array.isArray(source)) return []
  return source
    .map(m => {
      const med = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>
      return {
        name: typeof med.name === 'string' ? med.name : '',
        dosage: typeof med.dosage === 'string' ? med.dosage : undefined,
        unit: typeof med.unit === 'string' ? med.unit : undefined,
      }
    })
    .filter(m => m.name.trim() !== '')
}

async function loadInputs(supabase: ReturnType<typeof supabaseFromRequest>, tripId: string) {
  const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
  if (!trip) return null

  const { data: travelers } = await supabase
    .from('travelers')
    .select('user_id, account_companion_id, managed_by_user_id, full_name, nickname')
    .eq('trip_id', tripId)

  const travelerRows = travelers || []
  const userIds = [
    ...new Set(
      travelerRows.flatMap(t => [t.user_id, t.managed_by_user_id]).filter(Boolean) as string[]
    ),
  ]

  const profilesById = new Map<string, ProfileRow>()
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, country_of_residence, benefits_profile')
      .in('user_id', userIds)
    for (const p of (profiles || []) as ProfileRow[]) profilesById.set(p.user_id, p)
  }

  const nationalities = [
    ...new Set(
      Array.from(profilesById.values())
        .map(p => p.country_of_residence)
        .filter(Boolean) as string[]
    ),
  ]

  const medications: EntryRequirementsMed[] = []
  for (const t of travelerRows) {
    if (t.user_id && profilesById.has(t.user_id)) {
      const p = profilesById.get(t.user_id)!
      const extras = (p.benefits_profile?.profile_extras || {}) as Record<string, unknown>
      for (const m of readMeds(extras.medications)) {
        medications.push({ ...m, who: p.full_name || t.full_name || undefined })
      }
    } else if (t.account_companion_id && t.managed_by_user_id) {
      const mgr = profilesById.get(t.managed_by_user_id)
      const cp = (mgr?.benefits_profile?.companion_profiles || {}) as Record<string, unknown>
      const rec = (cp[t.account_companion_id] || {}) as { details?: { medications?: unknown } }
      for (const m of readMeds(rec.details?.medications)) {
        medications.push({ ...m, who: t.full_name || t.nickname || undefined })
      }
    }
  }

  return {
    trip,
    input: {
      trip: {
        name: String(trip.name || 'Trip'),
        destination: String(trip.destination || 'TBD'),
        start_date: String(trip.locked_date_start || trip.start_date || ''),
        end_date: String(trip.locked_date_end || trip.end_date || ''),
      },
      nationalities: nationalities.length ? nationalities : ['United States'],
      medications,
    },
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const { data: trip } = await supabase.from('trips').select('options').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const companion = (trip.options as { companion?: Record<string, unknown> })?.companion || {}
    return NextResponse.json({ entry_requirements: companion.entry_requirements || null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const loaded = await loadInputs(supabase, tripId)
    if (!loaded) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const entry_requirements = await generateEntryRequirements(loaded.input)
    const mergedOptions = mergeCompanionOptions(loaded.trip.options as Record<string, unknown>, { entry_requirements })
    await supabase.from('trips').update({ options: mergedOptions }).eq('id', tripId)

    return NextResponse.json({ entry_requirements })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
