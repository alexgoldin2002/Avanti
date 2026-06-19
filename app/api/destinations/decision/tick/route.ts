import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'
import { tickDestinationDecision } from '@/lib/destination-decision/tick-decision'

export async function POST(request: NextRequest) {
  try {
    const { decisionId, tripId } = await request.json()
    const supabase = adminOrAnon(request)

    let id = decisionId
    if (!id && tripId) {
      const { data } = await supabase
        .from('destination_decisions')
        .select('id')
        .eq('trip_id', tripId)
        .maybeSingle()
      id = data?.id
    }

    if (!id) return NextResponse.json({ error: 'decisionId required' }, { status: 400 })

    const status = await tickDestinationDecision(supabase, id)
    return NextResponse.json({ ok: true, status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
