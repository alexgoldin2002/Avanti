'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import { BackLink } from '../../../components/SubpageShell'
import { parseDestinationCards } from '@/lib/parse-destination-cards'
import { dedupeCardsByCountry } from '@/lib/generate-destinations-core'

interface DestCard {
  name: string
  synopsis: string
  logistics: string
  cost: string
  weather: string
  activities: string
  groupFit: string
  vibeCheck: string
  footnotes?: string
  tradeoff?: string
  isWildcard: boolean
}

export default function Destinations() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [cards, setCards] = useState<DestCard[]>([])
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [answers, setAnswers] = useState<any>(null)
  const [trip, setTrip] = useState<any>(null)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [closingLine, setClosingLine] = useState('')
  const [votes, setVotes] = useState<Record<string, boolean>>({})
  const [maxVotes, setMaxVotes] = useState(2)

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
      const { data: traveler } = await supabase.from('travelers').select('step2').eq('trip_id', tripId).eq('email', profile?.email || '').single()
      if (traveler?.step2) {
        setAnswers(traveler.step2)
      }

      const { data: savedCards } = await supabase
        .from('trip_destinations')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (savedCards?.cards) {
        setCards(savedCards.cards)
        if (savedCards.messages) setMessages(savedCards.messages)
        if (savedCards.closing_line) setClosingLine(savedCards.closing_line)
        setLoading(false)
        return
      }

      setLoading(false)
    }
    load()
  }, [tripId, router])

  useEffect(() => {
    if (!loading && answers && cards.length === 0) {
      generateCards([])
    }
  }, [loading, answers])

  const generateCards = async (existingMessages: typeof messages) => {
    if (!answers) return
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, answers, messages: existingMessages, stream: false }),
      })
      const data = await res.json()
      if (data.error) { setGenerating(false); return }

      const rawParsed = data.cards?.length ? data.cards : parseDestinationCards(data.message).cards
      const parsed = dedupeCardsByCountry(rawParsed)
      const closing = data.closing ?? parseDestinationCards(data.message).closing
      setCards(parsed)
      setClosingLine(closing)
      const newMessages = [...existingMessages, { role: 'assistant' as const, content: data.message }]
      setMessages(newMessages)

      await supabase.from('trip_destinations').upsert({
        trip_id: tripId,
        cards: parsed,
        messages: newMessages,
        closing_line: closing,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id' })
    } catch (e) {
      console.error('generateCards error:', e)
    }
    setGenerating(false)
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: 'user' as const, content: chatInput }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    await generateCards(newMessages)
    setChatLoading(false)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const toggleVote = (name: string) => {
    const currentVotes = Object.values(votes).filter(Boolean).length
    const isVoted = votes[name]
    if (!isVoted && currentVotes >= maxVotes) return
    setVotes(v => ({ ...v, [name]: !v[name] }))
  }

  if (loading) return <SuitcaseLoader message="Loading your trip ideas" />

  return (
    <main style={{ minHeight: '100vh', background: 'transparent', paddingBottom: '140px', ...s }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 0' }}>
        <BackLink href={`/trips/${tripId}`} wrapperClassName="mb-8 flex justify-end" />

        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>{trip?.name}</p>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '40px', fontWeight: 300, color: 'var(--foreground)', margin: 0 }}>Destination ideas</h1>
          <button
            onClick={() => router.push(`/trips/${tripId}/step2`)}
            style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: '8px', ...s }}
          >
            Edit answers →
          </button>
        </div>
        {closingLine && <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', margin: '0 0 32px', lineHeight: 1.6 }}>{closingLine}</p>}

        {cards.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0 }}>
              {Object.values(votes).filter(Boolean).length} of {maxVotes} votes used
            </p>
            {Object.values(votes).filter(Boolean).length > 0 && (
              <button
                onClick={async () => {
                  await supabase.from('trip_destinations').update({ votes }).eq('trip_id', tripId)
                  alert('Votes submitted!')
                }}
                style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2d6a4f', background: 'none', border: '1px solid #2d6a4f', padding: '8px 16px', cursor: 'pointer', ...s }}
              >
                Submit votes →
              </button>
            )}
          </div>
        )}

        {generating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '20px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round">
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: 'center' }} />
            </svg>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d6a4f' }}>
              {messages.length > 1 ? 'Updating your suggestions...' : 'Avanti is thinking...'}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', maxWidth: '300px', lineHeight: 1.6 }}>
              Weighing destinations against your group&apos;s vibe, budget, and deal breakers
            </p>
          </div>
        )}

        {!generating && cards.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
            {cards.map((card, i) => (
              <DestCardComponent
                key={i}
                card={card}
                voted={!!votes[card.name]}
                canVote={Object.values(votes).filter(Boolean).length < maxVotes}
                onVote={() => toggleVote(card.name)}
              />
            ))}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--card)', borderTop: '0.5px solid #e4e4d8',
        padding: '12px 24px 20px', zIndex: 50,
      }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          {messages.filter(m => m.role === 'user').length > 0 && (
            <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {messages.filter(m => m.role === 'user').map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ maxWidth: '80%', padding: '7px 12px', borderRadius: '0', fontSize: '13px', background: 'var(--forest-deep)', color: '#fff', lineHeight: 1.5 }}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Too far, wrong vibe, swap one out, make it cheaper..."
              style={{ flex: 1, border: 'none', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', ...s }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading || generating}
              style={{ padding: '8px 18px', background: 'var(--forest-deep)', border: 'none', color: '#fff', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', opacity: chatInput.trim() ? 1 : 0.4, borderRadius: '6px', ...s }}
            >
              {chatLoading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function DestCardComponent({ card, voted, canVote, onVote }: { card: DestCard; voted: boolean; canVote: boolean; onVote: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const toggle = (key: string) => setOpen(prev => prev === key ? null : key)

  const parseBullets = (text: string): string[] => {
    if (!text) return []
    return text.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(l => l.length > 2)
  }

  const sections = [
    { key: 'logistics', label: 'Getting there', content: card.logistics },
    { key: 'cost', label: 'Cost breakdown', content: card.cost },
    { key: 'weather', label: 'Weather', content: card.weather },
    { key: 'activities', label: 'Activities', content: card.activities },
    { key: 'groupFit', label: 'Group fit', content: card.groupFit },
    { key: 'vibeCheck', label: 'Vibe check', content: card.vibeCheck },
    ...(card.tradeoff ? [{ key: 'tradeoff', label: 'Honest tradeoff', content: card.tradeoff }] : []),
    ...(card.footnotes ? [{ key: 'footnotes', label: 'Things to know', content: card.footnotes }] : []),
  ].filter(sec => sec.content?.trim())

  return (
    <div style={{
      border: '1.5px solid #1a1a1a',
      borderRadius: '0',
      overflow: 'hidden',
      background: card.isWildcard ? 'var(--forest-deep)' : '#fff',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {card.isWildcard && (
        <div style={{ padding: '12px 20px 0' }}>
          <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: '0' }}>
            Wildcard
          </span>
        </div>
      )}

      <div style={{ padding: card.isWildcard ? '14px 20px 18px' : '22px 20px 18px', flex: 1 }}>
        <h3 style={{ fontSize: '24px', fontWeight: 400, color: card.isWildcard ? '#fff' : '#1a1a1a', margin: '0 0 10px', lineHeight: 1.2, ...s }}>
          {card.name}
        </h3>
        <p style={{ fontSize: '13px', color: card.isWildcard ? 'rgba(255,255,255,0.65)' : '#6a6a6a', margin: 0, lineHeight: 1.6 }}>
          {card.synopsis}
        </p>
      </div>

      <div style={{ borderTop: `1px solid ${card.isWildcard ? 'rgba(255,255,255,0.1)' : '#f0f0e8'}` }} />

      {sections.map((section, si) => (
        <div key={section.key}>
          <button
            onClick={() => toggle(section.key)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: card.isWildcard ? 'rgba(255,255,255,0.4)' : '#9a9a8a' }}>
              {section.label}
            </span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={card.isWildcard ? 'rgba(255,255,255,0.3)' : '#c4c4b8'} strokeWidth="2"
              style={{ transform: open === section.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {open === section.key && (
            <div style={{ padding: '0 20px 14px' }}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {parseBullets(section.content).map((bullet, bi) => (
                  <li key={bi} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: card.isWildcard ? 'rgba(255,255,255,0.25)' : '#c4c4b8', flexShrink: 0, marginTop: '3px' }}>—</span>
                    <span style={{ fontSize: '12px', color: card.isWildcard ? 'rgba(255,255,255,0.75)' : '#3a3a3a', lineHeight: 1.6 }}>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {si < sections.length - 1 && (
            <div style={{ borderTop: `0.5px solid ${card.isWildcard ? 'rgba(255,255,255,0.07)' : '#f5f5f0'}`, margin: '0 20px' }} />
          )}
        </div>
      ))}

      <div style={{ padding: '14px 20px', borderTop: `1px solid ${card.isWildcard ? 'rgba(255,255,255,0.1)' : '#f0f0e8'}`, marginTop: 'auto' }}>
        <button
          onClick={onVote}
          disabled={!voted && !canVote}
          style={{
            width: '100%', padding: '11px',
            border: `1px solid ${voted ? '#2d6a4f' : card.isWildcard ? 'rgba(255,255,255,0.2)' : '#1a1a1a'}`,
            background: voted ? '#e8f5ee' : 'transparent',
            color: voted ? 'var(--forest-deep)' : card.isWildcard ? 'rgba(255,255,255,0.65)' : '#1a1a1a',
            fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
            cursor: voted || canVote ? 'pointer' : 'default',
            opacity: !voted && !canVote ? 0.4 : 1,
            borderRadius: '0', transition: 'all 0.15s', ...s,
          }}
        >
          {voted ? '✓ Voted' : 'Add to vote'}
        </button>
      </div>
    </div>
  )
}
