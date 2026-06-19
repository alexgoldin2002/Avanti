import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireUser } from '@/lib/destination-decision/supabase-server'
import { aggregateGroupPriority } from '@/lib/destination-decision/ranking'
import { tickDestinationDecision } from '@/lib/destination-decision/tick-decision'
import type { GroupPriority } from '@/lib/destination-decision/types'

export async function POST(request: NextRequest) {
  try {
    const { decisionId, priority } = await request.json()
    if (!decisionId || !priority) {
      return NextResponse.json({ error: 'decisionId and priority required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)
    const user = await requireUser(supabase)

    const valid: GroupPriority[] = ['budget', 'experience', 'balance']
    if (!valid.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('id', decisionId)
      .single()

    if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await supabase.from('destination_meta_votes').upsert(
      { decision_id: decisionId, user_id: user.id, priority },
      { onConflict: 'decision_id,user_id' }
    )

    const { data: allMeta } = await supabase
      .from('destination_meta_votes')
      .select('priority')
      .eq('decision_id', decisionId)

    const groupMode = aggregateGroupPriority(allMeta || [])

    await supabase.from('destination_decisions').update({
      group_priority_mode: groupMode,
      updated_at: new Date().toISOString(),
    }).eq('id', decisionId)

    await tickDestinationDecision(supabase, decisionId)

    return NextResponse.json({ ok: true, groupPriorityMode: groupMode })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
