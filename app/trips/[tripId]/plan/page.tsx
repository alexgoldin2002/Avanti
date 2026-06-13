'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import SuitcaseLoader from '../../../components/SuitcaseLoader'

interface Message { role: 'user' | 'assistant'; content: string }
interface DestinationCard {
  destination: string
  tagline: string
  gettingThere: string
  cost: string
  weather: string
  activities: string
  flexibility: string
  footnotes?: string
  tradeoff?: string
  isWildcard?: boolean
}

export default function PlanPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [cards, setCards] = useState<DestinationCard[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  // Intake form state
  const [stops, setStops] = useState('')
  const [budget, setBudget] = useState('')
  const [stay, setStay] = useState('')
  const [intakeComplete, setIntakeComplete] = useState(false)
  const [tripDescription, setTripDescription] = useState('')

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) setTrip(tripData)

      // Load saved conversation
      let convoQuery = supabase
        .from('trip_conversations')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })

      if (user) {
        convoQuery = convoQuery.eq('user_id', user.id)
      }

      const { data: convoData } = await convoQuery

      if (convoData && convoData.length > 0) {
        const msgs = convoData.map((c: any) => ({ role: c.role, content: c.content }))
        setMessages(msgs)
        // Try to parse cards from last assistant message
        const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')
        if (lastAssistant) {
          const parsed = parseCards(lastAssistant.content)
          if (parsed.length > 0) {
            setCards(parsed)
            setHasGenerated(true)
            setIntakeComplete(true)
          }
        }
      }
      setLoading(false)
    }
    load()
  }, [tripId])

  const parseCards = (text: string): DestinationCard[] => {
    const cards: DestinationCard[] = []
    if (!text.includes('DESTINATION:')) return cards
    const sections = text.split('---').filter(s => s.trim())
    for (const section of sections) {
      if (!section.includes('DESTINATION:')) continue
      const get = (field: string) => {
        const regex = new RegExp(`${field}:\\s*([^\\n]+(?:\\n(?![A-Z]+:)[^\\n]+)*)`)
        const match = section.match(regex)
        return match ? match[1].trim() : ''
      }
      const isWildcard = section.includes('WILDCARD:')
      cards.push({
        destination: get('DESTINATION'),
        tagline: get('TAGLINE'),
        gettingThere: get('GETTING THERE'),
        cost: get('COST'),
        weather: get('WEATHER'),
        activities: get('ACTIVITIES'),
        flexibility: get('FLEXIBILITY'),
        footnotes: get('FOOTNOTES') || undefined,
        tradeoff: get('TRADEOFF') || undefined,
        isWildcard,
      })
    }
    return cards
  }

  const buildInitialPrompt = () => {
    const tripInfo = trip ? `Trip: ${trip.name}. Destination hint: ${trip.destination || 'open'}. Dates: ${trip.start_date || 'flexible'} to ${trip.end_date || 'flexible'}.` : ''
    return `${tripDescription ? `Group description: ${tripDescription}` : ''}
${tripInfo}
Stops preference: ${stops}
Budget per person total: ${budget}
Accommodation: ${stay}
Please generate destination cards now.`
  }

  const saveConversation = async (allMessages: Message[]) => {
    if (!userId) return
    await supabase.from('trip_conversations').delete().eq('trip_id', tripId).eq('user_id', userId)
    for (const msg of allMessages) {
      await supabase.from('trip_conversations').insert({
        trip_id: tripId,
        user_id: userId,
        role: msg.role,
        content: msg.content,
      })
    }
  }

  const generateCards = async () => {
    if (!stops || !budget || !stay) return
    setGenerating(true)
    setError('')
    const userMsg = buildInitialPrompt()
    const newMessages: Message[] = [{ role: 'user', content: userMsg }]
    setMessages(newMessages)
    setIntakeComplete(true)
    try {
      const res = await fetch('/api/plan-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, messages: newMessages }),
      })
      const data = await res.json()
      if (data.error) { setError('Something went wrong. Try again.'); setGenerating(false); return }
      const assistantMsg: Message = { role: 'assistant', content: data.message }
      const allMessages = [...newMessages, assistantMsg]
      setMessages(allMessages)
      const parsed = parseCards(data.message)
      if (parsed.length > 0) {
        setCards(parsed)
        setHasGenerated(true)
      }
      await saveConversation(allMessages)
    } catch (e) {
      setError('Something went wrong. Try again.')
    }
    setGenerating(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || generating) return
    const userMsg: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/plan-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, messages: newMessages }),
      })
      const data = await res.json()
      if (data.error) { setError('Something went wrong. Try again.'); setGenerating(false); return }
      const assistantMsg: Message = { role: 'assistant', content: data.message }
      const allMessages = [...newMessages, assistantMsg]
      setMessages(allMessages)
      const parsed = parseCards(data.message)
      if (parsed.length > 0) {
        setCards(parsed)
        setHasGenerated(true)
      }
      await saveConversation(allMessages)
    } catch (e) {
      setError('Something went wrong. Try again.')
    }
    setGenerating(false)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const clearConversation = async () => {
    if (userId) {
      await supabase.from('trip_conversations').delete().eq('trip_id', tripId).eq('user_id', userId)
    }
    setMessages([])
    setCards([])
    setHasGenerated(false)
    setIntakeComplete(false)
    setStops('')
    setBudget('')
    setStay('')
    setTripDescription('')
    setError('')
  }

  if (loading) return <SuitcaseLoader message="Loading your trip" />

  const optionBtn = (value: string, selected: string, setter: (v: string) => void, label: string) => (
    <button
      onClick={() => setter(value)}
      style={{
        padding: '10px 18px',
        fontSize: '13px',
        border: `1px solid ${selected === value ? '#1a3a2a' : '#d4d4c8'}`,
        background: selected === value ? '#e8f5ee' : '#fff',
        color: selected === value ? '#1a3a2a' : '#6a6a6a',
        cursor: 'pointer',
        borderRadius: '24px',
        transition: 'all 0.15s',
        ...s,
      }}
    >
      {label}
    </button>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 24px 100px' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {hasGenerated && (
              <button onClick={clearConversation} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9a9a8a" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                Restart
              </button>
            )}
            <button onClick={() => router.push(`/trips/${tripId}`)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}>
              ← Back
            </button>
          </div>
        </div>

        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>Step 4</p>
        <h1 style={{ fontSize: '36px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 32px' }}>{trip?.name}</h1>

        {/* INTAKE FORM — shown before cards are generated */}
        {!intakeComplete && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* Trip description */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 10px' }}>Tell us about this trip</p>
              <textarea
                value={tripDescription}
                onChange={e => setTripDescription(e.target.value)}
                placeholder="What kind of trip is this? Who's going? What's the vibe?"
                rows={3}
                style={{ width: '100%', border: 'none', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '14px', color: '#1a1a1a', outline: 'none', resize: 'none', lineHeight: 1.6, ...s }}
              />
            </div>

            {/* Stops */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 10px' }}>How many stops?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {optionBtn('One base', stops, setStops, 'One place')}
                {optionBtn('2 stops', stops, setStops, '2 stops')}
                {optionBtn('3 stops', stops, setStops, '3 stops')}
              </div>
            </div>

            {/* Budget */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 10px' }}>Total budget per person?</p>
              <p style={{ fontSize: '11px', color: '#b4b4a8', margin: '0 0 10px', fontStyle: 'italic' }}>Everything included — flights, hotel, food, activities</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {optionBtn('Under $1,500', budget, setBudget, 'Under $1,500')}
                {optionBtn('$1,500–3,000', budget, setBudget, '$1,500–3,000')}
                {optionBtn('$3,000–5,000', budget, setBudget, '$3,000–5,000')}
                {optionBtn('$5,000+', budget, setBudget, '$5,000+')}
              </div>
            </div>

            {/* Stay */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 10px' }}>Villa or hotel?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {optionBtn('Villa', stay, setStay, 'Villa')}
                {optionBtn('Hotel', stay, setStay, 'Hotel')}
                {optionBtn('Either', stay, setStay, 'Either')}
              </div>
            </div>

            {error && <p style={{ fontSize: '12px', color: '#ff6b6b', margin: 0 }}>{error} <button onClick={generateCards} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', textDecoration: 'underline', ...s }}>Try again</button></p>}

            <button
              onClick={generateCards}
              disabled={!stops || !budget || !stay || generating}
              style={{
                width: '100%',
                border: '1px solid #1a3a2a',
                padding: '16px',
                fontSize: '10px',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#fafaf8',
                background: '#1a3a2a',
                cursor: stops && budget && stay ? 'pointer' : 'default',
                opacity: stops && budget && stay ? 1 : 0.4,
                transition: 'opacity 0.2s',
                ...s,
              }}
            >
              {generating ? 'Finding your destinations...' : 'Find my trip →'}
            </button>
          </div>
        )}

        {/* GENERATING STATE */}
        {generating && !hasGenerated && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round">
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: 'center' }} />
            </svg>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d6a4f' }}>Finding your perfect destinations...</p>
          </div>
        )}

        {/* DESTINATION CARDS */}
        {hasGenerated && cards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            {cards.map((card, i) => (
              <div
                key={i}
                style={{
                  background: card.isWildcard ? '#1a3a2a' : '#fff',
                  border: card.isWildcard ? 'none' : '0.5px solid #e4e4d8',
                  borderRadius: '16px',
                  overflow: 'hidden',
                }}
              >
                {card.isWildcard && (
                  <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: '10px' }}>Another angle</span>
                  </div>
                )}
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '22px', fontWeight: 300, color: card.isWildcard ? '#fff' : '#1a1a1a', margin: 0, ...s }}>{card.destination}</h3>
                  </div>
                  <p style={{ fontSize: '13px', color: card.isWildcard ? 'rgba(255,255,255,0.7)' : '#9a9a8a', margin: '0 0 16px', lineHeight: 1.5 }}>{card.tagline}</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Getting there', value: card.gettingThere },
                      { label: 'Est. total per person', value: card.cost },
                      { label: 'Weather', value: card.weather },
                      { label: 'Activities', value: card.activities },
                      { label: 'Flexibility', value: card.flexibility },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: card.isWildcard ? 'rgba(255,255,255,0.4)' : '#b4b4a8', minWidth: '110px', paddingTop: '2px', flexShrink: 0 }}>{row.label}</span>
                        <span style={{ fontSize: '13px', color: card.isWildcard ? 'rgba(255,255,255,0.85)' : '#1a1a1a', lineHeight: 1.5 }}>{row.value}</span>
                      </div>
                    ))}

                    {card.tradeoff && (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', minWidth: '110px', paddingTop: '2px', flexShrink: 0 }}>Tradeoff</span>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, fontStyle: 'italic' }}>{card.tradeoff}</span>
                      </div>
                    )}
                  </div>

                  {card.footnotes && card.footnotes.trim() && (
                    <div style={{ marginTop: '14px', padding: '12px 14px', background: card.isWildcard ? 'rgba(255,255,255,0.08)' : '#fef9ec', borderRadius: '8px', borderLeft: `3px solid ${card.isWildcard ? 'rgba(255,255,255,0.2)' : '#f0c040'}` }}>
                      <p style={{ fontSize: '11px', color: card.isWildcard ? 'rgba(255,255,255,0.6)' : '#8a6a10', margin: 0, lineHeight: 1.6 }}>{card.footnotes}</p>
                    </div>
                  )}

                  <button style={{ marginTop: '16px', width: '100%', padding: '12px', border: `1px solid ${card.isWildcard ? 'rgba(255,255,255,0.2)' : '#e4e4d8'}`, background: 'transparent', color: card.isWildcard ? 'rgba(255,255,255,0.7)' : '#6a6a6a', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', ...s }}>
                    Add to group vote
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CHAT — shown after cards are generated */}
        {hasGenerated && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: 0 }}>Refine your results</p>

            {/* Only show non-initial messages */}
            {messages.slice(2).map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && !msg.content.includes('DESTINATION:') && (
                  <div style={{ maxWidth: '80%', padding: '12px 16px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '12px' }}>
                    <p style={{ fontSize: '13px', color: '#1a1a1a', margin: 0, lineHeight: 1.6 }}>{msg.content}</p>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div style={{ maxWidth: '80%', padding: '12px 16px', background: '#1a3a2a', borderRadius: '12px' }}>
                    <p style={{ fontSize: '13px', color: '#fff', margin: 0, lineHeight: 1.6 }}>{msg.content}</p>
                  </div>
                )}
              </div>
            ))}

            {generating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2d6a4f', animation: 'pulse 1s infinite' }} />
                <p style={{ fontSize: '12px', color: '#9a9a8a', margin: 0 }}>Thinking...</p>
              </div>
            )}

            {error && (
              <p style={{ fontSize: '12px', color: '#ff6b6b', margin: 0 }}>
                {error}{' '}
                <button onClick={() => sendMessage()} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', textDecoration: 'underline', ...s }}>Try again</button>
              </p>
            )}

            <div ref={messagesEndRef} />

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Too far, different vibe, swap one out..."
                style={{ flex: 1, borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '14px', color: '#1a1a1a', outline: 'none', border: 'none', borderBottom: '1px solid #d4d4c8', ...s }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || generating} style={{ padding: '10px 20px', background: '#1a3a2a', border: 'none', color: '#fff', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', opacity: input.trim() ? 1 : 0.4, ...s }}>
                Send
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
