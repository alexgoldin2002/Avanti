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
  const [whoGoing, setWhoGoing] = useState('')
  const [occasion, setOccasion] = useState('')
  const [vibe, setVibe] = useState('')
  const [domesticOrIntl, setDomesticOrIntl] = useState('')
  const [nights, setNights] = useState('')
  const [stops, setStops] = useState('')
  const [budget, setBudget] = useState('')
  const [stay, setStay] = useState('')
  const [intakeComplete, setIntakeComplete] = useState(false)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', ...s }

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
    const tripInfo = trip ? `Trip name: ${trip.name}. Destination hint: ${trip.destination || 'open'}. Dates: ${trip.start_date || 'flexible'} to ${trip.end_date || 'flexible'}.` : ''
    return `${tripInfo}

WHO IS GOING: ${whoGoing}
OCCASION: ${occasion || 'No specific occasion'}
VIBE: ${vibe || 'Not specified'}
DOMESTIC OR INTERNATIONAL: ${domesticOrIntl || 'Open to either'}
NIGHTS: ${nights}
STOPS: ${stops}
BUDGET PER PERSON (total): ${budget}
ACCOMMODATION: ${stay}

Please generate destination cards now.`
  }

  const saveNewMessages = async (allMessages: Message[]) => {
    if (!userId) return
    const newMessagesToSave = allMessages.slice(-2)
    for (const msg of newMessagesToSave) {
      await supabase.from('trip_conversations').insert({
        trip_id: tripId,
        user_id: userId,
        role: msg.role,
        content: msg.content,
        created_at: new Date().toISOString(),
      })
    }
  }

  const generateCards = async () => {
    if (!stops || !budget || !stay || !whoGoing) return
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
      await saveNewMessages(allMessages)
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
      await saveNewMessages(allMessages)
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
    setWhoGoing('')
    setOccasion('')
    setVibe('')
    setDomesticOrIntl('')
    setNights('')
    setStops('')
    setBudget('')
    setStay('')
    setError('')
  }

  if (loading) return <SuitcaseLoader message="Loading your trip" />

  return (
    <main style={{ minHeight: '100vh', background: 'var(--cream)', ...s }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 24px 100px' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {hasGenerated && (
              <button onClick={clearConversation} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', ...s }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                Restart
              </button>
            )}
            <button onClick={() => router.push(`/trips/${tripId}`)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', ...s }}>
              ← Back
            </button>
          </div>
        </div>

        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Step 4</p>
        <h1 style={{ fontSize: '36px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 32px' }}>{trip?.name}</h1>

        {/* INTAKE FORM */}
        {!intakeComplete && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* Who is going */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Who is going</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>e.g. 8 college friends, ages 22–25 · 4 couples in their 50s · multi-gen family with kids ages 6–14</p>
              <input
                style={inputStyle}
                value={whoGoing}
                onChange={e => setWhoGoing(e.target.value)}
                placeholder="8 college friends, ages 22–25"
              />
            </div>

            {/* Purpose / occasion */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Purpose or occasion</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>e.g. grad trip · bachelorette · milestone birthday · annual friend trip · no occasion, just going</p>
              <input
                style={inputStyle}
                value={occasion}
                onChange={e => setOccasion(e.target.value)}
                placeholder="Grad trip, no specific occasion, bachelorette..."
              />
            </div>

            {/* Vibe */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Vibe</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>What does the ideal trip feel like? What are you doing? What are you not doing?</p>
              <textarea
                value={vibe}
                onChange={e => setVibe(e.target.value)}
                placeholder="Beach days, boat trips, great food, energetic nights but not clubbing. Tan and relax but also explore."
                rows={3}
                style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', resize: 'none', lineHeight: 1.6, ...s }}
              />
            </div>

            {/* Domestic or international */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 10px' }}>Domestic or international?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['Domestic only', 'International', 'Open to either'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setDomesticOrIntl(opt)}
                    style={{
                      padding: '10px 18px', fontSize: '13px',
                      border: `1px solid ${domesticOrIntl === opt ? 'var(--forest-deep)' : 'var(--border)'}`,
                      background: domesticOrIntl === opt ? 'var(--accent-light)' : '#fff',
                      color: domesticOrIntl === opt ? 'var(--forest-deep)' : 'var(--muted-foreground)',
                      cursor: 'pointer', borderRadius: '24px', transition: 'all 0.15s',
                      ...s,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Number of nights */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Number of nights</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>Nights on the ground, not counting travel days</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['3–4 nights', '5–7 nights', '8–10 nights', '11–14 nights', '14+ nights'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setNights(opt)}
                    style={{
                      padding: '10px 18px', fontSize: '13px',
                      border: `1px solid ${nights === opt ? 'var(--forest-deep)' : 'var(--border)'}`,
                      background: nights === opt ? 'var(--accent-light)' : '#fff',
                      color: nights === opt ? 'var(--forest-deep)' : 'var(--muted-foreground)',
                      cursor: 'pointer', borderRadius: '24px', transition: 'all 0.15s',
                      ...s,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* How many stops */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>How many stops?</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>One base = stay in one place the whole trip · Multiple stops = move between 2 or 3 destinations</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['One base', '2 stops', '3 stops'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setStops(opt)}
                    style={{
                      padding: '10px 18px', fontSize: '13px',
                      border: `1px solid ${stops === opt ? 'var(--forest-deep)' : 'var(--border)'}`,
                      background: stops === opt ? 'var(--accent-light)' : '#fff',
                      color: stops === opt ? 'var(--forest-deep)' : 'var(--muted-foreground)',
                      cursor: 'pointer', borderRadius: '24px', transition: 'all 0.15s',
                      ...s,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Total budget per person</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>Everything included — flights, accommodation, food, activities. Be honest — this is just for the AI.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['Under $1,500', '$1,500–3,000', '$3,000–5,000', '$5,000+'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setBudget(opt)}
                    style={{
                      padding: '10px 18px', fontSize: '13px',
                      border: `1px solid ${budget === opt ? 'var(--forest-deep)' : 'var(--border)'}`,
                      background: budget === opt ? 'var(--accent-light)' : '#fff',
                      color: budget === opt ? 'var(--forest-deep)' : 'var(--muted-foreground)',
                      cursor: 'pointer', borderRadius: '24px', transition: 'all 0.15s',
                      ...s,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Villa or hotel */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Villa or hotel?</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>Villa = private home, shared pool, cook together · Hotel = individual rooms, concierge, pool scene</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['Villa', 'Hotel', 'Either'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setStay(opt)}
                    style={{
                      padding: '10px 18px', fontSize: '13px',
                      border: `1px solid ${stay === opt ? 'var(--forest-deep)' : 'var(--border)'}`,
                      background: stay === opt ? 'var(--accent-light)' : '#fff',
                      color: stay === opt ? 'var(--forest-deep)' : 'var(--muted-foreground)',
                      cursor: 'pointer', borderRadius: '24px', transition: 'all 0.15s',
                      ...s,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p style={{ fontSize: '12px', color: '#ff6b6b', margin: 0 }}>
                {error}{' '}
                <button onClick={generateCards} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', textDecoration: 'underline', ...s }}>Try again</button>
              </p>
            )}

            <button
              onClick={generateCards}
              disabled={!stops || !budget || !stay || !whoGoing || generating}
              style={{
                width: '100%', border: '1px solid var(--forest-deep)', padding: '16px',
                fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
                color: 'var(--cream)', background: 'var(--forest-deep)',
                cursor: stops && budget && stay && whoGoing ? 'pointer' : 'default',
                opacity: stops && budget && stay && whoGoing ? 1 : 0.4,
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
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.5" strokeLinecap="round">
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: 'center' }} />
            </svg>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--forest)' }}>Finding your perfect destinations...</p>
          </div>
        )}

        {/* DESTINATION CARDS */}
        {hasGenerated && cards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            {cards.map((card, i) => (
              <div
                key={i}
                style={{
                  background: card.isWildcard ? 'var(--forest-deep)' : '#fff',
                  border: card.isWildcard ? 'none' : '0.5px solid var(--border)',
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
                    <h3 style={{ fontSize: '22px', fontWeight: 300, color: card.isWildcard ? '#fff' : 'var(--foreground)', margin: 0, ...s }}>{card.destination}</h3>
                  </div>
                  <p style={{ fontSize: '13px', color: card.isWildcard ? 'rgba(255,255,255,0.7)' : 'var(--muted-foreground)', margin: '0 0 16px', lineHeight: 1.5 }}>{card.tagline}</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Getting there', value: card.gettingThere },
                      { label: 'Est. total per person', value: card.cost },
                      { label: 'Weather', value: card.weather },
                      { label: 'Activities', value: card.activities },
                      { label: 'Flexibility', value: card.flexibility },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: card.isWildcard ? 'rgba(255,255,255,0.4)' : 'var(--muted-foreground)', minWidth: '110px', paddingTop: '2px', flexShrink: 0 }}>{row.label}</span>
                        <span style={{ fontSize: '13px', color: card.isWildcard ? 'rgba(255,255,255,0.85)' : 'var(--foreground)', lineHeight: 1.5 }}>{row.value}</span>
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

                  <button style={{ marginTop: '16px', width: '100%', padding: '12px', border: `1px solid ${card.isWildcard ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`, background: 'transparent', color: card.isWildcard ? 'rgba(255,255,255,0.7)' : 'var(--muted-foreground)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', ...s }}>
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
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: 0 }}>Refine your results</p>

            {/* Only show non-initial messages */}
            {messages.slice(2).map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && !msg.content.includes('DESTINATION:') && (
                  <div style={{ maxWidth: '80%', padding: '12px 16px', background: '#fff', border: '0.5px solid var(--border)', borderRadius: '12px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>{msg.content}</p>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div style={{ maxWidth: '80%', padding: '12px 16px', background: 'var(--forest-deep)', borderRadius: '12px' }}>
                    <p style={{ fontSize: '13px', color: '#fff', margin: 0, lineHeight: 1.6 }}>{msg.content}</p>
                  </div>
                )}
              </div>
            ))}

            {generating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--forest)', animation: 'pulse 1s infinite' }} />
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0 }}>Thinking...</p>
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
                style={{ flex: 1, borderBottom: '1px solid var(--border)', background: 'transparent', padding: '10px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', border: 'none', borderBottom: '1px solid var(--border)', ...s }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || generating} style={{ padding: '10px 20px', background: 'var(--forest-deep)', border: 'none', color: '#fff', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', opacity: input.trim() ? 1 : 0.4, ...s }}>
                Send
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
