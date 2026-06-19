import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'
import { tickDestinationDecision } from '@/lib/destination-decision/tick-decision'
import { personalCostFromScenarios } from '@/lib/destination-decision/scenario-utils'
import type { FlightToggle, DateToggle } from '@/lib/destination-decision/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = adminOrAnon(request)

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle()

    if (!decision) {
      return NextResponse.json({ decision: null })
    }

    await tickDestinationDecision(supabase, decision.id)

    const { data: refreshed } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('id', decision.id)
      .single()

    const { data: options } = await supabase
      .from('destination_options')
      .select('*')
      .eq('decision_id', decision.id)
      .order('sort_order')

    const optionIds = (options || []).map(o => o.id)

    const { data: analysis } = optionIds.length
      ? await supabase.from('destination_option_analysis').select('*').in('option_id', optionIds)
      : { data: [] }

    const { data: votes } = optionIds.length
      ? await supabase.from('destination_option_votes').select('*').in('option_id', optionIds)
      : { data: [] }

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)

    const priority = (refreshed?.group_priority_mode || 'balance') as 'budget' | 'experience' | 'balance'
    const memberCount = travelers?.length || 1
    const rankedOptions = (options || [])
      .map(o => {
        const optionVotes = (votes || []).filter(v => v.option_id === o.id)
        return {
          id: o.id,
          name: o.name,
          tier: o.tier,
          group_summary: (o.group_summary || {}) as Record<string, unknown>,
          desire_scores: optionVotes.map(v => v.desire_score).filter((s): s is number => s != null),
          approve_count: optionVotes.filter(v => v.approved).length,
          voter_count: optionVotes.length,
          feasibility_yes: Number((o.group_summary as Record<string, unknown>)?.group_fit_yes) || 0,
          member_count: memberCount,
        }
      })
      .map(o => ({
        ...o,
        score:
          priority === 'budget'
            ? (1 - (Number(o.group_summary.avg_cost) || 5000) / 8000) * 0.6
            : priority === 'experience'
              ? (o.desire_scores.length ? o.desire_scores.reduce((a, b) => a + b, 0) / o.desire_scores.length / 5 : 0) * 0.6
              : 0.5,
      }))
      .sort((a, b) => b.score - a.score)
      .map((o, i) => ({ ...o, rank: i + 1 }))

    const { data: metaVotes } = await supabase
      .from('destination_meta_votes')
      .select('*')
      .eq('decision_id', decision.id)

    const { data: confirmations } = await supabase
      .from('destination_confirmations')
      .select('*')
      .eq('decision_id', decision.id)

    const { data: { user } } = await supabase.auth.getUser()

    let myTravelerId: string | null = null
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('user_id', user.id)
        .maybeSingle()
      const traveler = travelers?.find(
        t => t.email?.toLowerCase() === profile?.email?.toLowerCase()
      )
      myTravelerId = traveler?.id ?? null
    }

    const enrichedOptions = (options || []).map(o => {
      const myAnalysis = analysis?.find(
        a => a.option_id === o.id && a.traveler_id === myTravelerId
      )
      const myVote = votes?.find(v => v.option_id === o.id && v.user_id === user?.id)
      const toggles = (myVote?.toggles || {}) as { flight?: FlightToggle; dates?: DateToggle }
      const personal = myAnalysis?.scenarios
        ? personalCostFromScenarios(myAnalysis.scenarios, toggles)
        : null

      return {
        ...o,
        myAnalysis: myAnalysis || null,
        myVote: myVote || null,
        personalCost: personal?.cost ?? null,
        worksForYou: personal?.works ?? null,
      }
    })

    const winnerOption = refreshed?.winner_option_id
      ? options?.find(o => o.id === refreshed.winner_option_id)
      : null

    const lockedOption = refreshed?.locked_option_id
      ? options?.find(o => o.id === refreshed.locked_option_id)
      : null

    const analysisTotal = optionIds.length * (travelers?.length || 1)
    const analysisDone = analysis?.length || 0

    return NextResponse.json({
      decision: refreshed,
      options: enrichedOptions,
      metaVotes: metaVotes || [],
      confirmations: confirmations || [],
      trip,
      travelers: travelers || [],
      winnerOption,
      lockedOption,
      myMetaVote: metaVotes?.find(m => m.user_id === user?.id) || null,
      myConfirmation: confirmations?.find(c => c.user_id === user?.id) || null,
      isOrganizer: user?.id === trip?.organizer_id,
      userId: user?.id ?? null,
      myTravelerId,
      analysisProgress: { done: analysisDone, total: analysisTotal },
      rankedOptions,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
