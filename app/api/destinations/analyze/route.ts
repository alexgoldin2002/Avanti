import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 300

import { analyzeDestinationOption } from '@/lib/destination-decision/analyze-core'
import { buildTravelerContexts } from '@/lib/destination-decision/traveler-context'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { decisionId, optionIds } = await request.json()
    if (!decisionId) {
      return NextResponse.json({ error: 'decisionId required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('id', decisionId)
      .single()

    if (!decision) return NextResponse.json({ error: 'Decision not found' }, { status: 404 })

    const { data: trip } = await supabase.from('trips').select('*').eq('id', decision.trip_id).single()
    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', decision.trip_id)
    const { data: profiles } = await supabase.from('user_profiles').select('user_id, email')

    const contexts = buildTravelerContexts(travelers || [], profiles || [])

    let query = supabase.from('destination_options').select('*').eq('decision_id', decisionId)
    if (optionIds?.length) query = query.in('id', optionIds)

    const { data: options } = await query

    const results: { optionId: string; ok: boolean }[] = []

    for (const option of options || []) {
      const output = await analyzeDestinationOption({
        trip: trip!,
        option: {
          name: option.name,
          country: option.country,
          tier: option.tier,
          card_snapshot: option.card_snapshot,
        },
        travelers: contexts.map(c => ({
          id: c.id,
          name: c.name,
          departure_city: c.departure_city,
          budget_ceiling: c.budget_ceiling,
        })),
      })

      await supabase
        .from('destination_options')
        .update({ group_summary: output.group_summary })
        .eq('id', option.id)

      for (const row of output.per_traveler) {
        await supabase.from('destination_option_analysis').upsert(
          {
            option_id: option.id,
            traveler_id: row.traveler_id,
            scenarios: row.scenarios,
            flags: row.flags,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'option_id,traveler_id' }
        )
      }

      results.push({ optionId: option.id, ok: true })
    }

    return NextResponse.json({ analyzed: results.length, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
