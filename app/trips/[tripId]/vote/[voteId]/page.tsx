'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../../components/AvantiLogo'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const voteId = params.voteId as string
  const [vote, setVote] = useState<any>(null)
  const [trip, setTrip] = useState<any>(null)
  const [responses, setResponses] = useState<any[]>([])
  const [myVote, setMyVote] = useState<number | null>(null)
  const [myComment, setMyComment] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [expandedCard, setExpandedCard] = useState<number | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data: voteData } = await supabase.from('group_votes').select('*').eq('id', voteId).single()
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      const { data: responseData } = await supabase.from('group_vote_responses').select('*').eq('vote_id', voteId)
      if (voteData) setVote(voteData)
      if (tripData) {
        setTrip(tripData)
        if (user) setIsOrganizer(tripData.organizer_id === user.id)
      }
      if (responseData) {
        setResponses(responseData)
        if (user) {
          const mine = responseData.find((r: any) => r.user_id === user.id)
          if (mine) { setMyVote(mine.option_index); setMyComment(mine.comment || ''); setSubmitted(true) }
        }
      }
      setLoading(false)
    }
    load()
  }, [tripId, voteId])

  const handleVote = async (optionIndex: number) => {
    setMyVote(optionIndex)
  }

  const handleSubmit = async () => {
    if (myVote === null) return
    setSubmitting(true)
    await supabase.from('group_vote_responses').upsert({ vote_id: voteId, user_id: userId, option_index: myVote, comment: myComment, traveler_nickname: '' })
    const { data: responseData } = await supabase.from('group_vote_responses').select('*').eq('vote_id', voteId)
    if (responseData) setResponses(responseData)
    setSubmitted(true)
    setSubmitting(false)
  }

  const handleLock = async () => {
    if (myVote === null) return
    const winner = vote.options[myVote]
    await supabase.from('group_votes').update({ status: 'closed', winner }).eq('id', voteId)
    await supabase.from('trips').update({ destination: winner.title, options_generated: true, phase: 'planning' }).eq('id', tripId)
    router.push(`/trips/${tripId}`)
  }

  const getVotesForOption = (i: number) => responses.filter(r => r.option_index === i).length

  const getDaysLeft = () => {
    if (!vote?.deadline) return null
    const diff = new Date(vote.deadline).getTime() - Date.now()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days <= 0) return 'Voting closes today'
    if (days === 1) return '1 day left to vote'
    return `${days} days left to vote`
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  if (loading) return <SuitcaseLoader message="Loading vote" />
  if (!vote || !trip) return null

  const options = vote.options || []
  const totalVotes = responses.length

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.push(`/trips/${tripId}`)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← Back to trip</button>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>Group vote · {trip.name}</p>
          <h1 style={{ fontSize: '32px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px', ...s }}>{vote.vote_type}</h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {getDaysLeft() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2d5a18', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: '12px', color: '#2d5a18' }}>{getDaysLeft()}</span>
              </div>
            )}
            <span style={{ fontSize: '12px', color: '#9a9a8a' }}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''} so far</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {options.map((option: any, i: number) => {
            const voteCount = getVotesForOption(i)
            const isSelected = myVote === i
            const isExpanded = expandedCard === i
            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0

            return (
              <div key={i} style={{ border: isSelected ? '2px solid #2d5a18' : '0.5px solid #e4e4d8', borderRadius: '12px', background: '#fff', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div>
                      <p style={{ fontSize: '16px', color: '#1a1a1a', margin: '0 0 2px', ...s }}>{option.title}</p>
                      <p style={{ fontSize: '12px', color: '#6a6a6a', margin: 0, lineHeight: 1.4 }}>{option.tagline}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <p style={{ fontSize: '15px', color: '#2d5a18', fontWeight: 500, margin: '0 0 1px', ...s }}>~${option.price?.toLocaleString()}</p>
                      <p style={{ fontSize: '10px', color: '#9a9a8a', margin: 0 }}>${option.priceRange}</p>
                    </div>
                  </div>

                  {option.bullets && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', margin: '10px 0' }}>
                      {option.bullets.slice(0, 3).map((b: any, j: number) => (
                        <div key={j} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: b.type === 'warning' ? '#854f0b' : '#2d5a18', flexShrink: 0, marginTop: '6px' }} />
                          <p style={{ fontSize: '12px', color: b.type === 'warning' ? '#854f0b' : '#3a3a3a', margin: 0, lineHeight: 1.5 }}>{b.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {totalVotes > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#9a9a8a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{voteCount} vote{voteCount !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: '10px', color: '#2d5a18', fontWeight: 500 }}>{pct}%</span>
                      </div>
                      <div style={{ height: '3px', background: '#e8e8e0', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#2d5a18', width: `${pct}%`, transition: 'width 0.5s ease', borderRadius: '2px' }} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setExpandedCard(isExpanded ? null : i)}
                      style={{ padding: '8px 14px', border: '1px solid #d4d4c8', background: '#fff', color: '#6a6a6a', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '20px', ...s }}>
                      {isExpanded ? 'Hide ↑' : 'Details'}
                    </button>
                    {!submitted ? (
                      <button onClick={() => handleVote(i)}
                        style={{ flex: 1, padding: '8px 14px', border: `2px solid ${isSelected ? '#182D09' : '#182D09'}`, background: isSelected ? '#182D09' : '#fff', color: isSelected ? '#fff' : '#182D09', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '20px', fontWeight: 500, ...s }}>
                        {isSelected ? '✓ Selected' : 'Select this option'}
                      </button>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 14px', background: isSelected ? '#e8f0e4' : 'transparent', borderRadius: '20px' }}>
                        {isSelected && <span style={{ fontSize: '11px', color: '#2d5a18', letterSpacing: '0.08em', textTransform: 'uppercase' }}>✓ Your vote</span>}
                      </div>
                    )}
                    {isOrganizer && submitted && (
                      <button onClick={() => handleLock()} style={{ padding: '8px 14px', border: '1px solid #182D09', background: '#182D09', color: '#fff', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '20px', ...s }}>
                        Lock in →
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && option.details && (
                  <div style={{ borderTop: '0.5px solid #f0f0e8', padding: '14px 16px', background: '#fafaf8' }}>
                    {option.details.map((d: any, j: number) => (
                      <div key={j} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', flexShrink: 0 }}>{d.icon}</span>
                        <p style={{ fontSize: '12px', color: '#3a3a3a', margin: 0, lineHeight: 1.5 }}>{d.text}</p>
                      </div>
                    ))}
                    {option.bottomLine && (
                      <div style={{ marginTop: '10px', padding: '10px 12px', background: '#e8f0e4', borderRadius: '6px' }}>
                        <p style={{ fontSize: '12px', color: '#0a2a06', margin: 0, lineHeight: 1.6 }}>{option.bottomLine}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!submitted && myVote !== null && (
          <div style={{ marginBottom: '16px' }}>
            <textarea value={myComment} onChange={e => setMyComment(e.target.value)} placeholder="Add a comment or condition (optional)..." rows={2}
              style={{ width: '100%', border: '0.5px solid #d4d4c8', background: '#fff', padding: '10px 14px', fontSize: '13px', color: '#1a1a1a', outline: 'none', resize: 'none', borderRadius: '8px', marginBottom: '10px', ...s }} />
            <button onClick={handleSubmit} disabled={submitting}
              style={{ width: '100%', border: '1px solid #182D09', background: '#182D09', color: '#fff', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', opacity: submitting ? 0.6 : 1, ...s }}>
              {submitting ? 'Submitting...' : 'Submit vote →'}
            </button>
          </div>
        )}

        {submitted && (
          <div style={{ padding: '16px', background: '#e8f0e4', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#2d5a18', margin: 0, ...s }}>✓ Your vote is in. Results update in real time.</p>
            {isOrganizer && <p style={{ fontSize: '11px', color: '#2d5a18', margin: '6px 0 0', opacity: 0.8 }}>As organizer you can lock in any option at any time.</p>}
          </div>
        )}

      </div>
    </main>
  )
}
