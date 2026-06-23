import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireUser } from '@/lib/destination-decision/supabase-server'
import { aggregateGroupPriority } from '@/lib/destination-decision/ranking'
import { tickDestinationDecision } from '@/lib/destination-decision/tick-decision'
import { getMyTripTraveler, travelerCanVote } from '@/lib/account-companions'
import {
  normalizeWeights,
  priorityFromWeights,
  weightsTotal,
  type InterestWeights,
} from '@/lib/destination-decision/voting-display'
import type { GroupPriority } from '@/lib/destination-decision/types'

export async function POST(request: NextRequest) {
  try {
    const { decisionId, priority, weights } = await request.json()
    if (!decisionId) {
      return NextResponse.json({ error: 'decisionId required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)
    const user = await requireUser(supabase)

    let resolvedPriority = priority as GroupPriority | undefined
    let resolvedWeights: InterestWeights | null = null

    if (weights && typeof weights === 'object') {
      resolvedWeights = normalizeWeights(weights as Partial<InterestWeights>)
      if (weightsTotal(resolvedWeights) !== 100) {
        return NextResponse.json({ error: 'Weights must total 100%' }, { status: 400 })
      }
      resolvedPriority = priorityFromWeights(resolvedWeights)
    }

    const valid: GroupPriority[] = ['budget', 'experience', 'balance']
    if (!resolvedPriority || !valid.includes(resolvedPriority)) {
      return NextResponse.json({ error: 'priority or weights required' }, { status: 400 })
    }

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('id', decisionId)
      .single()

    if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const traveler = await getMyTripTraveler(supabase, decision.trip_id, user.id)
    if (traveler && !travelerCanVote(traveler)) {
      return NextResponse.json(
        { error: 'Your account is set to view-only — someone else manages your votes on this trip.' },
        { status: 403 }
      )
    }

    const upsertPayload: Record<string, unknown> = {
      decision_id: decisionId,
      user_id: user.id,
      priority: resolvedPriority,
    }
    if (resolvedWeights) upsertPayload.weights = resolvedWeights

    let { error: upsertError } = await supabase
      .from('destination_meta_votes')
      .upsert(upsertPayload, { onConflict: 'decision_id,user_id' })

    if (
      upsertError &&
      resolvedWeights &&
      (upsertError.message.includes('weights') || upsertError.message.includes('column'))
    ) {
      const fallback = await supabase.from('destination_meta_votes').upsert(
        {
          decision_id: decisionId,
          user_id: user.id,
          priority: resolvedPriority,
        },
        { onConflict: 'decision_id,user_id' }
      )
      upsertError = fallback.error
    }

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

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
