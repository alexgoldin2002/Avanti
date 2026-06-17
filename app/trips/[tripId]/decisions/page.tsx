'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import SubpageShell from '../../../components/SubpageShell'

export default function DecisionsPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [votes, setVotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current')

  useEffect(() => {
    const load = async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) setTrip(tripData)
      const { data: voteData } = await supabase.from('group_votes').select('*').eq('trip_id', tripId).order('created_at', { ascending: false })
      if (voteData) setVotes(voteData)
      setLoading(false)
    }
    load()
  }, [tripId])

  const getVoteStatus = (vote: any) => {
    if (vote.status === 'closed') return 'closed'
    const now = new Date()
    if (!vote.submission_deadline) return 'pending_setup'
    if (new Date(vote.submission_deadline) > now) return 'submission_open'
    if (!vote.voting_deadline || new Date(vote.voting_deadline) > now) return 'voting_open'
    return 'closed'
  }

  const getTimeLeft = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now()
    if (diff <= 0) return null
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h left`
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) return `${hours}h ${mins}m left`
    return `${mins}m left`
  }

  const statusConfig: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    pending_setup: { label: 'Not started', bg: 'var(--forest-mist)', color: 'var(--muted-foreground)', dot: 'var(--border)' },
    submission_open: { label: 'Accepting options', bg: 'oklch(0.94 0.04 85)', color: 'oklch(0.45 0.08 85)', dot: 'oklch(0.65 0.12 85)' },
    voting_open: { label: 'Voting open', bg: 'var(--forest-pale)', color: 'var(--forest)', dot: 'var(--forest-deep)' },
    closed: { label: 'Decided', bg: 'var(--forest-mist)', color: 'var(--muted-foreground)', dot: 'var(--muted-foreground)' },
  }

  const currentVotes = votes.filter(v => getVoteStatus(v) !== 'closed')
  const pastVotes = votes.filter(v => getVoteStatus(v) === 'closed')
  const displayVotes = activeTab === 'current' ? currentVotes : pastVotes

  if (loading) return <SuitcaseLoader message="Loading decisions" />
  if (!trip) return null

  return (
    <SubpageShell backHref={`/trips/${tripId}`} title="Decisions" subtitle={trip.name}>
      <div className="flex border-b border-border mb-6">
        {[{ key: 'current', label: `Current (${currentVotes.length})` }, { key: 'past', label: `Past (${pastVotes.length})` }].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as 'current' | 'past')}
            className={`avanti-tab ${activeTab === tab.key ? 'avanti-tab-active' : 'avanti-tab-inactive'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {displayVotes.length === 0 ? (
        <div className="avanti-box rounded-none border border-border bg-forest-mist px-6 py-12 text-center">
          <p className="font-serif text-lg text-foreground mb-2">
            {activeTab === 'current' ? 'No active votes' : 'No past votes yet'}
          </p>
          <p className="text-sm text-muted-foreground m-0">
            {activeTab === 'current' ? 'Votes will appear here when options are sent to the group.' : 'Completed votes will show up here.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayVotes.map(vote => {
            const status = getVoteStatus(vote)
            const config = statusConfig[status]
            const relevantDeadline = status === 'submission_open' ? vote.submission_deadline : status === 'voting_open' ? vote.voting_deadline : null
            const timeLeft = relevantDeadline ? getTimeLeft(relevantDeadline) : null

            return (
              <button
                key={vote.id}
                type="button"
                onClick={() => router.push(`/trips/${tripId}/vote/${vote.id}`)}
                className="avanti-box group flex w-full items-center justify-between rounded-none border border-border bg-card px-5 py-4 text-left transition-all duration-200 hover:-translate-y-px hover:border-forest-deep/30 hover:[box-shadow:var(--shadow-box-hover)]"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: config.dot }} />
                  <div>
                    <p className="font-serif text-base text-foreground m-0 mb-0.5 transition-colors group-hover:text-forest-deep">{vote.vote_type}</p>
                    {timeLeft && <p className="text-[11px] m-0" style={{ color: config.color }}>{timeLeft}</p>}
                    {status === 'closed' && vote.winner && (
                      <p className="text-[11px] text-muted-foreground m-0">→ {vote.winner.title}</p>
                    )}
                  </div>
                </div>
                <span className="text-[11px] tracking-wide shrink-0 ml-3 px-2.5 py-1 rounded-none" style={{ color: config.color, background: config.bg }}>
                  {config.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </SubpageShell>
  )
}
