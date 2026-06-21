import type { SupabaseClient } from '@supabase/supabase-js'
import { analyzeDestinationOption } from './analyze-core'
import { buildTravelerContexts } from './traveler-context'

export async function runDestinationAnalysis(
  supabase: SupabaseClient,
  decisionId: string,
  optionIds?: string[]
): Promise<{ analyzed: number; skipped: number; errors: string[] }> {
  const errors: string[] = []

  const { data: decision } = await supabase
    .from('destination_decisions')
    .select('*')
    .eq('id', decisionId)
    .single()

  if (!decision) {
    throw new Error('Decision not found')
  }

  const { data: trip } = await supabase.from('trips').select('*').eq('id', decision.trip_id).single()
  if (!trip) {
    throw new Error('Trip not found')
  }

  const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', decision.trip_id)
  const { data: profiles } = await supabase.from('user_profiles').select('user_id, email')
  const contexts = buildTravelerContexts(travelers || [], profiles || [])
  const travelerCount = contexts.length || 1

  let query = supabase.from('destination_options').select('*').eq('decision_id', decisionId)
  if (optionIds?.length) query = query.in('id', optionIds)

  const { data: options } = await query
  if (!options?.length) {
    return { analyzed: 0, skipped: 0, errors }
  }

  const { data: existingAnalysis } = await supabase
    .from('destination_option_analysis')
    .select('option_id')
    .in('option_id', options.map(o => o.id))

  const analysisCountByOption = new Map<string, number>()
  for (const row of existingAnalysis || []) {
    analysisCountByOption.set(row.option_id, (analysisCountByOption.get(row.option_id) || 0) + 1)
  }

  let analyzed = 0
  let skipped = 0

  for (const option of options) {
    if ((analysisCountByOption.get(option.id) || 0) >= travelerCount) {
      skipped++
      continue
    }

    try {
      const output = await analyzeDestinationOption({
        trip,
        option: {
          name: option.name,
          country: option.country,
          tier: option.tier,
          card_snapshot: option.card_snapshot as Record<string, unknown>,
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

      analyzed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${option.name} (${option.tier}): ${msg}`)
      console.error('runDestinationAnalysis option error:', option.id, err)
    }
  }

  return { analyzed, skipped, errors }
}
