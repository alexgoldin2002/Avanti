import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { decisionId } = await request.json()
    const supabase = adminOrAnon(request)

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('id', decisionId)
      .single()

    if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await requireOrganizer(supabase, decision.trip_id)

    const now = new Date()
    const votingEnd = decision.voting_deadline
      ? decision.voting_deadline
      : new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString()

    await supabase.from('destination_decisions').update({
      status: 'voting',
      voting_deadline: votingEnd,
      updated_at: now.toISOString(),
    }).eq('id', decisionId)

    return NextResponse.json({ ok: true, status: 'voting' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
