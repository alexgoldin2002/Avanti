'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import Footer from '../../../components/Footer'

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

  const statusConfig: Record<string, { label: string, bg: string, color: string, dot: string }> = {
    pending_setup: { label: 'Not started', bg: '#f5f5f0', color: 'var(--muted-foreground)', dot: 'var(--border)' },
    submission_open: { label: 'Accepting options', bg: '#faeeda', color: '#854f0b', dot: '#ef9f27' },
    voting_open: { label: 'Voting open', bg: 'var(--accent-light)', color: 'var(--forest)', dot: 'var(--forest)' },
    closed: { label: 'Decided', bg: '#f5f5f0', color: 'var(--muted-foreground)', dot: 'var(--muted-foreground)' },
  }

  const currentVotes = votes.filter(v => getVoteStatus(v) !== 'closed')
  const pastVotes = votes.filter(v => getVoteStatus(v) === 'closed')
  const displayVotes = activeTab === 'current' ? currentVotes : pastVotes

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  if (loading) return <SuitcaseLoader message="Loading decisions" />
  if (!trip) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', ...s }}>
      <div style={{ flex: 1, maxWidth: '560px', margin: '0 auto', padding: '40px 24px', width: '100%' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.push(`/trips/${tripId}`)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← Back to trip</button>
        </div>

        <h1 style={{ fontSize: '36px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 6px', ...s }}>Decisions</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 24px' }}>{trip.name}</p>

        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e0', marginBottom: '24px' }}>
          {[{ key: 'current', label: `Current (${currentVotes.length})` }, { key: 'past', label: `Past (${pastVotes.length})` }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              style={{ flex: 1, padding: '10px 0', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: activeTab === tab.key ? 'var(--foreground)' : 'var(--muted-foreground)', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? 'var(--forest)' : 'transparent'}`, cursor: 'pointer', ...s }}>
              {tab.label}
            </button>
          ))}
        </div>

        {displayVotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '18px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 8px', ...s }}>
              {activeTab === 'current' ? 'No active votes' : 'No past votes yet'}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
              {activeTab === 'current' ? 'Votes will appear here when options are sent to the group.' : 'Completed votes will show up here.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayVotes.map(vote => {
              const status = getVoteStatus(vote)
              const config = statusConfig[status]
              const relevantDeadline = status === 'submission_open' ? vote.submission_deadline : status === 'voting_open' ? vote.voting_deadline : null
              const timeLeft = relevantDeadline ? getTimeLeft(relevantDeadline) : null

              return (
                <button key={vote.id}
                  onClick={() => router.push(`/trips/${tripId}/vote/${vote.id}`)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#fff', border: '0.5px solid var(--border)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s', width: '100%', ...s }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.dot, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '16px', color: 'var(--foreground)', margin: '0 0 3px', ...s }}>{vote.vote_type}</p>
                      {timeLeft && (
                        <p style={{ fontSize: '11px', color: config.color, margin: 0 }}>{timeLeft}</p>
                      )}
                      {status === 'closed' && vote.winner && (
                        <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>→ {vote.winner.title}</p>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: config.color, background: config.bg, padding: '4px 10px', borderRadius: '20px', letterSpacing: '0.05em', flexShrink: 0, marginLeft: '12px' }}>
                    {config.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}

      </div>
      <Footer />
    </div>
  )
}
