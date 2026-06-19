import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireUser } from '@/lib/destination-decision/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { decisionId, confirmed, statedMaxCost } = await request.json()
    if (!decisionId || confirmed === undefined) {
      return NextResponse.json({ error: 'decisionId and confirmed required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)
    const user = await requireUser(supabase)

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('status')
      .eq('id', decisionId)
      .single()

    if (!['results', 'confirming'].includes(decision?.status || '')) {
      return NextResponse.json({ error: 'Confirmation is not open' }, { status: 400 })
    }

    await supabase.from('destination_confirmations').upsert(
      {
        decision_id: decisionId,
        user_id: user.id,
        confirmed: !!confirmed,
        stated_max_cost: statedMaxCost ?? null,
      },
      { onConflict: 'decision_id,user_id' }
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
