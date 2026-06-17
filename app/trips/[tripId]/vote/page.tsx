'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'

export default function VotePage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<any[]>([])
  const [trip, setTrip] = useState<any>(null)
  const [maxVotes, setMaxVotes] = useState(2)
  const [votes, setVotes] = useState<Record<string, boolean>>({})
  const [myId, setMyId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        setMaxVotes(tripData.max_votes || 2)
      }

      const { data: profile } = await supabase.from('user_profiles').select('email').eq('user_id', user.id).single()
      const { data: traveler } = await supabase.from('travelers').select('id, votes').eq('trip_id', tripId).eq('email', profile?.email || '').single()
      if (traveler) {
        setMyId(traveler.id)
        if (traveler.votes) {
          setVotes(traveler.votes)
          const hasVoted = Object.values(traveler.votes).some(Boolean)
          if (hasVoted) setSubmitted(true)
        }
      }

      const { data: destData } = await supabase.from('trip_destinations').select('cards').eq('trip_id', tripId).single()
      if (destData?.cards) setCards(destData.cards)

      setLoading(false)
    }
    load()
  }, [tripId, router])

  const toggleVote = (name: string) => {
    if (submitted) return
    const currentCount = Object.values(votes).filter(Boolean).length
    const isVoted = votes[name]
    if (!isVoted && currentCount >= maxVotes) return
    setVotes(v => ({ ...v, [name]: !v[name] }))
  }

  const submitVotes = async () => {
    if (saving) return
    setSaving(true)
    await supabase.from('travelers').update({ votes }).eq('id', myId)
    setSubmitted(true)
    setSaving(false)
  }

  const voteCount = Object.values(votes).filter(Boolean).length

  if (loading) return <SuitcaseLoader message="Loading" />

  return (
    <SubpageShell backHref={`/trips/${tripId}/destinations`} eyebrow={trip?.name} title="Vote" maxWidth="max-w-xl">
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed font-serif italic">
          {submitted
            ? 'Your votes are in. The host will see results when everyone has voted.'
            : `Pick up to ${maxVotes} destination${maxVotes > 1 ? 's' : ''} you'd be happy with.`}
        </p>

        {!submitted && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '12px', color: voteCount >= maxVotes ? '#2d6a4f' : '#9a9a8a', margin: 0 }}>
              {voteCount} of {maxVotes} votes used
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          {cards.map((card, i) => {
            const isVoted = !!votes[card.name]
            const canVote = voteCount < maxVotes
            return (
              <button
                key={i}
                onClick={() => toggleVote(card.name)}
                disabled={submitted || (!isVoted && !canVote)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '18px 20px',
                  border: `1.5px solid ${isVoted ? 'var(--forest-deep)' : '#e4e4d8'}`,
                  borderRadius: '0',
                  background: isVoted ? '#e8f5ee' : '#fff',
                  cursor: submitted ? 'default' : (!isVoted && !canVote) ? 'default' : 'pointer',
                  opacity: (!isVoted && !canVote && !submitted) ? 0.4 : 1,
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.2s ease',
                  boxShadow: isVoted ? 'var(--shadow-box-hover)' : 'var(--shadow-box)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '18px', fontWeight: 400, color: isVoted ? 'var(--forest-deep)' : '#1a1a1a', margin: '0 0 4px', ...s }}>{card.name}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {card.highlight && (
                      <span style={{ fontSize: '10px', color: '#2d6a4f', background: '#e8f5ee', padding: '2px 8px', borderRadius: '0', border: '0.5px solid #a8d4b8' }}>
                        {card.highlight}
                      </span>
                    )}
                    {card.consider && (
                      <span style={{ fontSize: '10px', color: '#8a6a10', background: '#fef9ec', padding: '2px 8px', borderRadius: '0', border: '0.5px solid #f0c040' }}>
                        {card.consider}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${isVoted ? 'var(--forest-deep)' : '#d4d4c8'}`, background: isVoted ? 'var(--forest-deep)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '16px' }}>
                  {isVoted && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {!submitted ? (
          <button
            onClick={submitVotes}
            disabled={voteCount === 0 || saving}
            style={{
              width: '100%', padding: '16px',
              border: '1px solid var(--forest-deep)',
              background: voteCount > 0 ? 'var(--forest-deep)' : 'transparent',
              color: voteCount > 0 ? '#fafaf8' : '#d4d4c8',
              fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
              cursor: voteCount > 0 ? 'pointer' : 'default',
              opacity: saving ? 0.6 : 1, ...s,
            }}
          >
            {saving ? 'Submitting...' : 'Submit votes →'}
          </button>
        ) : (
          <div style={{ background: '#e8f5ee', border: '0.5px solid #a8d4b8', borderRadius: '0', padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '16px', color: 'var(--forest-deep)', margin: '0 0 4px', ...s }}>Votes submitted ✓</p>
            <p style={{ fontSize: '13px', color: '#2d6a4f', margin: 0 }}>The host will see results once everyone has voted.</p>
          </div>
        )}

    </SubpageShell>
  )
}
