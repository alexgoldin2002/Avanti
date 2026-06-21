import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ANALYSIS_BUFFER_MINUTES,
  DEFAULT_CONFIRM_HOURS,
  type DestinationDecisionStatus,
} from './types'
import { nextStatusFromClock } from './status'
import { pickWinner, aggregateGroupPriority } from './ranking'
import type { RankableOption } from './ranking'
import { notifyDecisionEventAsync } from './notify-trip'

export async function tickDestinationDecision(
  supabase: SupabaseClient,
  decisionId: string
): Promise<DestinationDecisionStatus | null> {
  const { data: decision } = await supabase
    .from('destination_decisions')
    .select('*')
    .eq('id', decisionId)
    .single()

  if (!decision || decision.status === 'locked' || decision.status === 'cancelled') {
    return decision?.status ?? null
  }

  const { data: options } = await supabase
    .from('destination_options')
    .select('id')
    .eq('decision_id', decisionId)

  const optionIds = (options || []).map(o => o.id)
  let allAnalyzed = optionIds.length === 0

  if (optionIds.length > 0) {
    const { count } = await supabase
      .from('destination_option_analysis')
      .select('option_id', { count: 'exact', head: true })
      .in('option_id', optionIds)
    const { data: travelers } = await supabase
      .from('travelers')
      .select('id')
      .eq('trip_id', decision.trip_id)
    const expected = optionIds.length * (travelers?.length || 1)
    allAnalyzed = (count || 0) >= expected
  }

  const now = new Date()
  let next = nextStatusFromClock({
    status: decision.status,
    now,
    submissionDeadline: decision.submission_deadline ? new Date(decision.submission_deadline) : null,
    analysisCompletedAt: decision.analysis_completed_at ? new Date(decision.analysis_completed_at) : null,
    analysisStartedAt: decision.analysis_started_at ? new Date(decision.analysis_started_at) : null,
    votingDeadline: decision.voting_deadline ? new Date(decision.voting_deadline) : null,
    confirmDeadline: decision.confirm_deadline ? new Date(decision.confirm_deadline) : null,
    analysisBufferMinutes: ANALYSIS_BUFFER_MINUTES,
    allOptionsAnalyzed: allAnalyzed,
  })

  const updates: Record<string, unknown> = { updated_at: now.toISOString() }

  if (decision.status === 'suggestions_open' && next === 'analyzing') {
    updates.status = 'analyzing'
    updates.analysis_started_at = now.toISOString()
    next = 'analyzing'
  }

  if (decision.status === 'analyzing' && allAnalyzed) {
    updates.status = 'meta_vote'
    updates.analysis_completed_at = decision.analysis_completed_at || now.toISOString()
    if (!decision.voting_deadline) {
      const votingEnd = new Date(now.getTime() + 72 * 60 * 60 * 1000)
      updates.voting_deadline = votingEnd.toISOString()
    }
    next = 'meta_vote'
  }

  // All meta votes in → voting
  if (decision.status === 'meta_vote') {
    const { data: metaVotes } = await supabase
      .from('destination_meta_votes')
      .select('user_id')
      .eq('decision_id', decisionId)
    const { data: travelers } = await supabase
      .from('travelers')
      .select('email')
      .eq('trip_id', decision.trip_id)
    const { data: profiles } = await supabase.from('user_profiles').select('user_id, email')
    const memberUserIds = new Set<string>()
    for (const t of travelers || []) {
      const p = profiles?.find(pr => pr.email?.toLowerCase() === t.email?.toLowerCase())
      if (p?.user_id) memberUserIds.add(p.user_id)
    }
    const metaUserIds = new Set((metaVotes || []).map(m => m.user_id))
    const allMeta = [...memberUserIds].every(id => metaUserIds.has(id))
    if (allMeta && memberUserIds.size > 0) {
      updates.status = 'voting'
      next = 'voting'
    }
  }

  if (decision.status === 'voting' && decision.voting_deadline && now >= new Date(decision.voting_deadline)) {
    updates.status = 'results'
    const confirmEnd = new Date(now.getTime() + DEFAULT_CONFIRM_HOURS * 60 * 60 * 1000)
    updates.confirm_deadline = confirmEnd.toISOString()
    next = 'results'

    // Compute winner
    await computeAndStoreWinner(supabase, decisionId, decision.trip_id)
  }

  if (decision.status === 'results') {
    updates.status = 'confirming'
    if (!decision.confirm_deadline) {
      updates.confirm_deadline = new Date(now.getTime() + DEFAULT_CONFIRM_HOURS * 60 * 60 * 1000).toISOString()
    }
    next = 'confirming'
  }

  if (Object.keys(updates).length > 1) {
    await supabase.from('destination_decisions').update(updates).eq('id', decisionId)

    const newStatus = updates.status as DestinationDecisionStatus
    const { data: tripRow } = await supabase.from('trips').select('name').eq('id', decision.trip_id).single()
    const tripName = tripRow?.name || 'Your trip'

    if (newStatus === 'meta_vote' || newStatus === 'voting') {
      notifyDecisionEventAsync(supabase, {
        tripId: decision.trip_id,
        decisionId,
        event: 'voting_open',
        tripName,
      })
    }
    if (newStatus === 'confirming') {
      notifyDecisionEventAsync(supabase, {
        tripId: decision.trip_id,
        decisionId,
        event: 'confirm_open',
        tripName,
      })
    }
  }

  return (updates.status as DestinationDecisionStatus) || decision.status
}

async function computeAndStoreWinner(
  supabase: SupabaseClient,
  decisionId: string,
  tripId: string
) {
  const { data: decision } = await supabase
    .from('destination_decisions')
    .select('group_priority_mode')
    .eq('id', decisionId)
    .single()

  const { data: metaVotes } = await supabase
    .from('destination_meta_votes')
    .select('priority')
    .eq('decision_id', decisionId)

  const priority = decision?.group_priority_mode || aggregateGroupPriority(metaVotes || [])

  const { data: options } = await supabase
    .from('destination_options')
    .select('id, name, tier, group_summary')
    .eq('decision_id', decisionId)

  const { data: votes } = await supabase
    .from('destination_option_votes')
    .select('option_id, desire_score, approved, user_id')
    .in('option_id', (options || []).map(o => o.id))

  const { data: travelers } = await supabase.from('travelers').select('id').eq('trip_id', tripId)
  const memberCount = travelers?.length || 1

  const rankable: RankableOption[] = (options || []).map(o => {
    const optionVotes = (votes || []).filter(v => v.option_id === o.id)
    return {
      id: o.id,
      name: o.name,
      tier: o.tier,
      group_summary: o.group_summary as Record<string, unknown>,
      desire_scores: optionVotes.map(v => v.desire_score).filter((s): s is number => s != null),
      approve_count: optionVotes.filter(v => v.approved).length,
      voter_count: optionVotes.length,
      feasibility_yes: Number(o.group_summary?.group_fit_yes) || 0,
      member_count: memberCount,
    }
  })

  const winner = pickWinner(rankable, priority as 'budget' | 'experience' | 'balance')
  if (winner) {
    await supabase
      .from('destination_decisions')
      .update({ winner_option_id: winner.id, group_priority_mode: priority })
      .eq('id', decisionId)
  }
}
