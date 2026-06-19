import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { decisionId, optionId } = await request.json()
    if (!decisionId || !optionId) {
      return NextResponse.json({ error: 'decisionId and optionId required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('id', decisionId)
      .single()

    if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await requireOrganizer(supabase, decision.trip_id)

    const { data: option } = await supabase
      .from('destination_options')
      .select('*')
      .eq('id', optionId)
      .eq('decision_id', decisionId)
      .single()

    if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 })

    const summary = option.group_summary as Record<string, unknown>
    const recommendedDates = summary.recommended_dates as string | undefined

    const { data: trip } = await supabase.from('trips').select('*').eq('id', decision.trip_id).single()

    await supabase.from('destination_decisions').update({
      status: 'locked',
      locked_option_id: optionId,
      winner_option_id: decision.winner_option_id || optionId,
      updated_at: new Date().toISOString(),
    }).eq('id', decisionId)

    await supabase.from('trips').update({
      destination: option.name,
      locked_tier: option.tier,
      destination_type: 'set',
      locked_date_start: trip?.start_date || trip?.date_range_start || null,
      locked_date_end: trip?.end_date || trip?.date_range_end || null,
    }).eq('id', decision.trip_id)

    return NextResponse.json({
      ok: true,
      destination: option.name,
      tier: option.tier,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
