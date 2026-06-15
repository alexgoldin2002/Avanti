'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import SuitcaseLoader from '../../../components/SuitcaseLoader'

interface Message { role: 'user' | 'assistant'; content: string }
interface PlanCard {
  destination: string
  tagline: string
  gettingThere: string
  cost: string
  weather: string
  activities: string
  flexibility: string
  structure?: string
  footnotes?: string
  tradeoff?: string
  isWildcard?: boolean
}

function DestinationCard({ card }: { card: any }) {
  const [openSection, setOpenSection] = useState<string | null>(null)
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const toggle = (section: string) => setOpenSection(prev => prev === section ? null : section)

  const isWildcard = card.priceNote === 'Another angle' || card.isWildcard

  const name = card.destination || card.title || ''
  const tagline = card.tagline || ''
  const costPill = card.priceRange ? `$${card.priceRange}` : card.cost?.match(/\$[\d,]+[–-]\$?[\d,]+/)?.[0] || ''
  const structurePill = card.structure || ''
  const flexPill = card.flexibility?.match(/^(High|Medium|Low)/i)?.[0] || ''

  const sections = [
    card.details?.getting_there || card.gettingThere ? { key: 'getting_there', label: 'Getting there', content: card.details?.getting_there || card.gettingThere } : null,
    card.priceRange || card.cost ? { key: 'cost', label: 'Cost breakdown', content: card.cost || `~$${card.priceRange} per person` } : null,
    card.details?.weather || card.weather ? { key: 'weather', label: 'Weather', content: card.details?.weather || card.weather } : null,
    card.details?.avanti_take || card.activities ? { key: 'activities', label: 'Activities & hikes', content: card.details?.avanti_take || card.activities } : null,
    card.flexibility ? { key: 'flexibility', label: 'Logistics & flexibility', content: card.flexibility } : null,
    card.details?.cons?.length ? { key: 'tradeoff', label: 'Honest tradeoff', content: card.details.cons.join(' ') } : null,
    card.bullets?.filter((b: any) => b.type === 'warning').length ? { key: 'footnotes', label: 'Things to know', content: card.bullets.filter((b: any) => b.type === 'warning').map((b: any) => b.text).join(' ') } : null,
  ].filter(Boolean) as { key: string; label: string; content: string }[]

  const parseBullets = (text: string): string[] => {
    if (!text) return []
    const lines = text
      .split(/\n|(?<=\.)\s+(?=[A-Z])|·/)
      .map(l => l.replace(/^[-•·]\s*/, '').trim())
      .filter(l => l.length > 4)
    return lines.length > 1 ? lines : [text]
  }

  return (
    <div style={{ border: '1.5px solid #1a1a1a', borderRadius: '16px', overflow: 'hidden', background: isWildcard ? '#1a3a2a' : '#fff' }}>
      {isWildcard && (
        <div style={{ padding: '12px 24px 0' }}>
          <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: '10px' }}>
            Another angle
          </span>
        </div>
      )}
      <div style={{ padding: isWildcard ? '14px 24px 20px' : '24px 24px 20px' }}>
        <h3 style={{ fontSize: '28px', fontWeight: 400, color: isWildcard ? '#fff' : '#1a1a1a', margin: '0 0 8px', letterSpacing: '-0.3px', lineHeight: 1.2, ...s }}>
          {name}
        </h3>
        <p style={{ fontSize: '13px', color: isWildcard ? 'rgba(255,255,255,0.6)' : '#6a6a6a', margin: '0 0 18px', lineHeight: 1.6 }}>
          {tagline}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {costPill && (
            <span style={{ fontSize: '12px', padding: '5px 13px', borderRadius: '20px', background: isWildcard ? 'rgba(255,255,255,0.1)' : '#f5f5f0', color: isWildcard ? 'rgba(255,255,255,0.85)' : '#1a1a1a', ...s }}>
              {costPill} / person
            </span>
          )}
          {structurePill && (
            <span style={{ fontSize: '12px', padding: '5px 13px', borderRadius: '20px', background: isWildcard ? 'rgba(255,255,255,0.1)' : '#f5f5f0', color: isWildcard ? 'rgba(255,255,255,0.85)' : '#1a1a1a', ...s }}>
              {structurePill}
            </span>
          )}
          {flexPill && (
            <span style={{ fontSize: '12px', padding: '5px 13px', borderRadius: '20px', background: isWildcard ? 'rgba(255,255,255,0.1)' : '#f5f5f0', color: isWildcard ? 'rgba(255,255,255,0.85)' : '#1a1a1a', ...s }}>
              {flexPill} flexibility
            </span>
          )}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${isWildcard ? 'rgba(255,255,255,0.1)' : '#f0f0e8'}` }} />

      {sections.map((section, si) => (
        <div key={section.key}>
          <button onClick={() => toggle(section.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: isWildcard ? 'rgba(255,255,255,0.45)' : '#9a9a8a' }}>{section.label}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isWildcard ? 'rgba(255,255,255,0.3)' : '#c4c4b8'} strokeWidth="2" style={{ transform: openSection === section.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {openSection === section.key && (
            <div style={{ padding: '0 24px 16px' }}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {parseBullets(section.content).map((bullet, bi) => (
                  <li key={bi} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: isWildcard ? 'rgba(255,255,255,0.25)' : '#c4c4b8', flexShrink: 0, marginTop: '3px' }}>—</span>
                    <span style={{ fontSize: '13px', color: isWildcard ? 'rgba(255,255,255,0.75)' : '#3a3a3a', lineHeight: 1.6 }}>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {si < sections.length - 1 && (
            <div style={{ borderTop: `0.5px solid ${isWildcard ? 'rgba(255,255,255,0.07)' : '#f5f5f0'}`, margin: '0 24px' }} />
          )}
        </div>
      ))}

      <div style={{ padding: '14px 24px', borderTop: `1px solid ${isWildcard ? 'rgba(255,255,255,0.1)' : '#f0f0e8'}` }}>
        <button style={{ width: '100%', padding: '12px', border: `1px solid ${isWildcard ? 'rgba(255,255,255,0.2)' : '#1a1a1a'}`, background: 'transparent', color: isWildcard ? 'rgba(255,255,255,0.65)' : '#1a1a1a', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', ...s }}>
          Add to group vote
        </button>
      </div>
    </div>
  )
}

export default function PlanPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [cards, setCards] = useState<PlanCard[]>([])
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
  const [submitted, setSubmitted] = useState(false)

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
          const parsed = parseCardsFromText(lastAssistant.content)
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

  const parseCardsFromText = (text: string): PlanCard[] => {
    if (!text.includes('CARDS:') && !text.includes('DESTINATION:')) return []
    const cards: PlanCard[] = []
    const sections = text.split('---').filter(s => s.trim())
    for (const section of sections) {
      if (!section.includes('DESTINATION:')) continue
      const get = (field: string) => {
        const lines = section.split('\n')
        let value = ''
        let capturing = false
        for (const line of lines) {
          if (line.startsWith(field + ':')) {
            value = line.slice(field.length + 1).trim()
            capturing = true
          } else if (capturing && line.match(/^[A-Z\s]+:/) && !line.startsWith(' ')) {
            capturing = false
          } else if (capturing && line.trim()) {
            value += ' ' + line.trim()
          }
        }
        return value.trim()
      }
      cards.push({
        destination: get('DESTINATION'),
        tagline: get('TAGLINE'),
        structure: get('STRUCTURE'),
        gettingThere: get('GETTING THERE'),
        cost: get('EST. TOTAL PER PERSON'),
        weather: get('WEATHER'),
        activities: get('ACTIVITIES'),
        flexibility: get('FLEXIBILITY'),
        footnotes: get('FOOTNOTES') || undefined,
        tradeoff: get('TRADEOFF') || undefined,
        isWildcard: section.includes('WILDCARD:'),
      })
    }
    return cards.filter(c => c.destination)
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
    setSubmitted(true)
    if (!stops || !budget || !stay || !whoGoing) return
    setGenerating(true)
    setError('')
    const userMsg = buildInitialPrompt()
    console.log('sending prompt:', userMsg)
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
      console.log('API response:', JSON.stringify(data).slice(0, 500))

      if (data.error) {
        setError('Something went wrong. Try again.')
        setGenerating(false)
        setIntakeComplete(false)
        return
      }

      const assistantMsg: Message = { role: 'assistant', content: data.message || '' }
      const allMessages = [...newMessages, assistantMsg]
      setMessages(allMessages)

      const parsed = parseCardsFromText(data.message || '')
      console.log('parsed cards frontend:', parsed.length, parsed[0]?.destination)
      if (parsed.length > 0) {
        setCards(parsed)
        setHasGenerated(true)
      } else {
        console.log('still no cards, raw response:', data.message?.slice(0, 300))
        setError('No destinations found. Try again.')
        setIntakeComplete(false)
      }

      await saveNewMessages(allMessages)
    } catch (e: any) {
      console.error('generateCards error:', e)
      setError('Something went wrong: ' + e.message)
      setIntakeComplete(false)
    } finally {
      setGenerating(false)
    }
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
      const parsed = parseCardsFromText(data.message || '')
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
    setSubmitted(false)
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* WHO IS GOING */}
            <div data-required="true" data-empty={!whoGoing ? 'true' : 'false'}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: submitted && !whoGoing ? '#e8453c' : '#9a9a8a', margin: '0 0 6px', transition: 'color 0.2s' }}>
                Who is going{submitted && !whoGoing ? ' — required' : ''}
              </p>
              <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>e.g. 8 college friends, ages 22–25 · 4 couples in their 50s · multi-gen family with kids ages 6–14</p>
              <input
                style={{ ...inputStyle, borderBottom: submitted && !whoGoing ? '1px solid #e8453c' : '1px solid #d4d4c8' }}
                value={whoGoing}
                onChange={e => setWhoGoing(e.target.value)}
                placeholder=""
              />
            </div>

            <div style={{ borderTop: '0.5px solid #e4e4d8', margin: '8px 0' }} />

            {/* OCCASION */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>Purpose or occasion</p>
              <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>e.g. grad trip · bachelorette · milestone birthday · annual friend trip · no occasion, just going</p>
              <input
                style={inputStyle}
                value={occasion}
                onChange={e => setOccasion(e.target.value)}
                placeholder=""
              />
            </div>

            <div style={{ borderTop: '0.5px solid #e4e4d8', margin: '8px 0' }} />

            {/* VIBE */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>Vibe</p>
              <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>e.g. beach days, boat trips, great food, energetic nights but not clubbing · adventurous but also time to unwind</p>
              <textarea
                value={vibe}
                onChange={e => setVibe(e.target.value)}
                placeholder=""
                rows={3}
                style={{ width: '100%', border: 'none', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', resize: 'none', lineHeight: 1.6, ...s }}
              />
            </div>

            <div style={{ borderTop: '0.5px solid #e4e4d8', margin: '8px 0' }} />

            {/* DOMESTIC OR INTERNATIONAL */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>Domestic or international?</p>
              <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>e.g. domestic only · international · open to either</p>
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

            <div style={{ borderTop: '0.5px solid #e4e4d8', margin: '8px 0' }} />

            {/* NUMBER OF NIGHTS */}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>Number of nights</p>
              <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>Nights on the ground, not counting travel days</p>
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

            <div style={{ borderTop: '0.5px solid #e4e4d8', margin: '8px 0' }} />

            {/* HOW MANY STOPS */}
            <div data-required="true" data-empty={!stops ? 'true' : 'false'}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: submitted && !stops ? '#e8453c' : '#9a9a8a', margin: '0 0 6px', transition: 'color 0.2s' }}>
                How many stops?{submitted && !stops ? ' — required' : ''}
              </p>
              <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>One base = stay in one place the whole trip · Multiple stops = move between 2 or 3 destinations</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['One base', '2 stops', '3 stops'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setStops(opt)}
                    style={{
                      padding: '10px 18px', fontSize: '13px',
                      border: `1px solid ${stops === opt ? 'var(--forest-deep)' : submitted && !stops ? '#e8453c' : 'var(--border)'}`,
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

            <div style={{ borderTop: '0.5px solid #e4e4d8', margin: '8px 0' }} />

            {/* BUDGET */}
            <div data-required="true" data-empty={!budget ? 'true' : 'false'}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: submitted && !budget ? '#e8453c' : '#9a9a8a', margin: '0 0 6px', transition: 'color 0.2s' }}>
                Total budget per person{submitted && !budget ? ' — required' : ''}
              </p>
              <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>Everything included — flights, accommodation, food, activities. Be honest — this is just for the AI.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['Under $1,500', '$1,500–3,000', '$3,000–5,000', '$5,000+'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setBudget(opt)}
                    style={{
                      padding: '10px 18px', fontSize: '13px',
                      border: `1px solid ${budget === opt ? 'var(--forest-deep)' : submitted && !budget ? '#e8453c' : 'var(--border)'}`,
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

            <div style={{ borderTop: '0.5px solid #e4e4d8', margin: '8px 0' }} />

            {/* VILLA OR HOTEL */}
            <div data-required="true" data-empty={!stay ? 'true' : 'false'}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: submitted && !stay ? '#e8453c' : '#9a9a8a', margin: '0 0 6px', transition: 'color 0.2s' }}>
                Villa or hotel?{submitted && !stay ? ' — required' : ''}
              </p>
              <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>Villa = private home, shared pool, cook together · Hotel = individual rooms, concierge, pool scene</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['Villa', 'Hotel', 'Either'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setStay(opt)}
                    style={{
                      padding: '10px 18px', fontSize: '13px',
                      border: `1px solid ${stay === opt ? 'var(--forest-deep)' : submitted && !stay ? '#e8453c' : 'var(--border)'}`,
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

            <div style={{ borderTop: '0.5px solid #e4e4d8', margin: '24px 0 16px' }} />

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
            {cards.map((card, i) => (
              <DestinationCard key={i} card={card} />
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
