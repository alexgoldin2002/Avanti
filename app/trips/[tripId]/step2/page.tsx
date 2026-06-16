'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import SuitcaseLoader from '../../../components/SuitcaseLoader'

function StepTwoDestCard({ card, tripId, isVoted, onVote }: { card: any; tripId: string; isVoted: boolean; onVote: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const toggle = (key: string) => setOpen(prev => prev === key ? null : key)
  const isWildcard = card.isWildcard
  const parseBullets = (text: string): string[] => {
    if (!text) return []
    return text.split('\n').map((l: string) => l.replace(/^[-•*]\s*/, '').trim()).filter((l: string) => l.length > 2)
  }
  const costPill = card.cost?.split('\n')[0]?.trim() || ''
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
    <div style={{ border: '1.5px solid #1a1a1a', borderRadius: '16px', overflow: 'hidden', background: isWildcard ? '#1a3a2a' : '#fff', display: 'flex', flexDirection: 'column' }}>
      {isWildcard && (
        <div style={{ padding: '12px 20px 0' }}>
          <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: '10px' }}>Wildcard</span>
        </div>
      )}
      <div style={{ padding: isWildcard ? '14px 20px 18px' : '22px 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '22px', fontWeight: 400, color: isWildcard ? '#fff' : '#1a1a1a', margin: 0, lineHeight: 1.2, ...s }}>
            {card.name}
          </h3>
          {costPill && (
            <span style={{ fontSize: '12px', color: isWildcard ? 'rgba(255,255,255,0.55)' : '#9a9a8a', flexShrink: 0, ...s }}>
              {costPill.match(/\$[\d,]+[–\-]\$?[\d,]+/)?.[0] || costPill.slice(0, 25)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {card.highlight && (
            <span style={{
              fontSize: '10px', padding: '3px 10px', borderRadius: '20px',
              background: isWildcard ? 'rgba(255,255,255,0.12)' : '#e8f5ee',
              color: isWildcard ? 'rgba(255,255,255,0.8)' : '#1a3a2a',
              border: `0.5px solid ${isWildcard ? 'rgba(255,255,255,0.2)' : '#a8d4b8'}`,
              fontFamily: 'var(--font-cormorant), Georgia, serif',
              letterSpacing: '0.05em',
            }}>
              {card.highlight}
            </span>
          )}
          {card.consider && (
            <span style={{
              fontSize: '10px', padding: '3px 10px', borderRadius: '20px',
              background: isWildcard ? 'rgba(255,165,0,0.15)' : '#fef9ec',
              color: isWildcard ? 'rgba(255,200,100,0.9)' : '#8a6a10',
              border: `0.5px solid ${isWildcard ? 'rgba(255,165,0,0.3)' : '#f0c040'}`,
              fontFamily: 'var(--font-cormorant), Georgia, serif',
              letterSpacing: '0.05em',
            }}>
              {card.consider}
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: isWildcard ? 'rgba(255,255,255,0.65)' : '#6a6a6a', margin: 0, lineHeight: 1.6 }}>
          {card.synopsis}
        </p>
      </div>
      <div style={{ borderTop: `1px solid ${isWildcard ? 'rgba(255,255,255,0.1)' : '#f0f0e8'}` }} />
      {sections.map((section, si) => (
        <div key={section.key}>
          <button
            onClick={() => toggle(section.key)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: isWildcard ? 'rgba(255,255,255,0.4)' : '#9a9a8a' }}>{section.label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isWildcard ? 'rgba(255,255,255,0.3)' : '#c4c4b8'} strokeWidth="2" style={{ transform: open === section.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {open === section.key && (
            <div style={{ padding: '0 20px 14px' }}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {parseBullets(section.content).map((bullet: string, bi: number) => (
                  <li key={bi} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: isWildcard ? 'rgba(255,255,255,0.25)' : '#c4c4b8', flexShrink: 0, marginTop: '3px' }}>—</span>
                    <span style={{ fontSize: '12px', color: isWildcard ? 'rgba(255,255,255,0.75)' : '#3a3a3a', lineHeight: 1.6 }}>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {si < sections.length - 1 && (
            <div style={{ borderTop: `0.5px solid ${isWildcard ? 'rgba(255,255,255,0.07)' : '#f5f5f0'}`, margin: '0 20px' }} />
          )}
        </div>
      ))}
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${isWildcard ? 'rgba(255,255,255,0.1)' : '#f0f0e8'}`, marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={onVote}
          style={{
            width: '100%', padding: '11px',
            border: `1px solid ${isVoted ? '#2d6a4f' : isWildcard ? 'rgba(255,255,255,0.2)' : '#1a1a1a'}`,
            background: isVoted ? '#e8f5ee' : 'transparent',
            color: isVoted ? '#1a3a2a' : isWildcard ? 'rgba(255,255,255,0.65)' : '#1a1a1a',
            fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
            cursor: 'pointer', borderRadius: '8px', transition: 'all 0.15s',
            fontFamily: 'var(--font-cormorant), Georgia, serif',
          }}
        >
          {isVoted ? '✓ Selected' : 'Add to vote'}
        </button>
        <button
          onClick={() => window.location.href = `/trips/${tripId}/destinations/${encodeURIComponent(card.name)}`}
          style={{
            width: '100%', padding: '9px',
            border: 'none', background: 'transparent',
            color: isWildcard ? 'rgba(255,255,255,0.4)' : '#9a9a8a',
            fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
            cursor: 'pointer', textDecoration: 'underline',
            fontFamily: 'var(--font-cormorant), Georgia, serif',
          }}
        >
          Deep dive →
        </button>
      </div>
    </div>
  )
}

export default function Step2() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [stage, setStage] = useState<1 | 2 | 3 | 'generate' | 'done'>(1)
  // Q1
  const [q1, setQ1] = useState('')
  // Q2 answers
  const [departureCityInput, setDepartureCityInput] = useState('')
  const [departureCities, setDepartureCities] = useState<string[]>([])
  const [dates, setDates] = useState('')
  const [fixedDates, setFixedDates] = useState({ start: '', end: '' })
  const [flexLength, setFlexLength] = useState('')
  const [datesOther, setDatesOther] = useState('')
  const [domestic, setDomestic] = useState('')
  const [regions, setRegions] = useState<string[]>([])
  const [stops, setStops] = useState('')
  const [stopsOther, setStopsOther] = useState('')
  const [activities, setActivities] = useState<string[]>([])
  const [vibe, setVibe] = useState<string[]>([])
  const [vibeOther, setVibeOther] = useState('')
  const [accommodation, setAccommodation] = useState('')
  const [budget, setBudget] = useState('')
  const [budgetOther, setBudgetOther] = useState('')
  const [popularity, setPopularity] = useState('')
  // Q3
  const [q3, setQ3] = useState('')
  // AI chat
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [cards, setCards] = useState<any[]>([])
  const [whyNot, setWhyNot] = useState<{ name: string; reasons: string[] }[]>([])
  const [editMode, setEditMode] = useState(false)
  const [cachedAnswers, setCachedAnswers] = useState<any>(null)
  const [votes, setVotes] = useState<Record<string, boolean>>({})
  const [maxVotes, setMaxVotes] = useState(2)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '15px', color: '#1a1a1a', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#9a9a8a', display: 'block', marginBottom: '8px' }
  const sectionLabel = { fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#9a9a8a', marginBottom: '10px', display: 'block' }
  const chipStyle = (selected: boolean) => ({
    padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
    border: `1px solid ${selected ? '#1a3a2a' : '#d4d4c8'}`,
    background: selected ? '#e8f5ee' : '#fff',
    color: selected ? '#1a3a2a' : '#6a6a6a',
    borderRadius: '24px', transition: 'all 0.15s', ...s,
  })
  const nextBtn = (onClick: () => void, disabled: boolean, label = 'Next →') => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '14px 32px', border: '1px solid #1a3a2a',
        background: disabled ? 'transparent' : '#1a3a2a',
        color: disabled ? '#d4d4c8' : '#fafaf8',
        fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
        cursor: disabled ? 'default' : 'pointer', ...s,
      }}
    >
      {label}
    </button>
  )

  useEffect(() => {
    const load = async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        if (tripData.max_votes) setMaxVotes(tripData.max_votes)
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('user_profiles').select('email').eq('user_id', user.id).single()
        const { data: traveler } = await supabase.from('travelers').select('step2').eq('trip_id', tripId).eq('email', profile?.email || '').single()
        if (traveler?.step2) {
          const s2 = traveler.step2
          if (s2.q1) { setQ1(s2.q1) }
          if (s2.departureCity) setDepartureCities(s2.departureCity.split(',').map((c: string) => c.trim()).filter(Boolean))
          if (s2.dates) setDates(s2.dates)
          if (s2.domestic) setDomestic(s2.domestic)
          if (s2.regions) setRegions(s2.regions)
          if (s2.stops) setStops(s2.stops)
          if (s2.activities) setActivities(s2.activities)
          if (s2.vibe) setVibe(s2.vibe)
          if (s2.accommodation) setAccommodation(s2.accommodation)
          if (s2.budget) setBudget(s2.budget)
          if (s2.popularity) setPopularity(s2.popularity)
          if (s2.q3) setQ3(s2.q3)
          if (s2.stage) setStage(s2.stage)
        }
        const { data: savedDest } = await supabase
          .from('trip_destinations')
          .select('cards, why_not')
          .eq('trip_id', tripId)
          .single()

        if (savedDest?.cards && savedDest.cards.length > 0) {
          setCards(savedDest.cards)
          if (savedDest.why_not) setWhyNot(savedDest.why_not)
          setStage('done' as any)
        }
      }
      setLoading(false)
    }
    load()
  }, [tripId])

  const showQ2 = (typeof stage === 'number' && stage >= 2) || stage === 'generate' || stage === 'done' || editMode
  const showQ3 = (typeof stage === 'number' && stage >= 3) || stage === 'generate' || stage === 'done' || editMode

  useEffect(() => {
    if ((window as any).google?.maps?.places) return
    if (document.getElementById('google-maps-script')) return
    const script = document.createElement('script')
    script.id = 'google-maps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY}&libraries=places`
    script.async = true
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (stage < 2) return
    const tryInit = () => {
      const input = document.getElementById('departure-city-input') as HTMLInputElement
      if (!input) return
      if (!(window as any).google?.maps?.places) return
      const autocomplete = new (window as any).google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const name = place?.formatted_address || place?.name || ''
        if (name) {
          setDepartureCities(prev => [...prev, name])
          setDepartureCityInput('')
        }
      })
    }
    tryInit()
    const timer = setTimeout(tryInit, 1000)
    return () => clearTimeout(timer)
  }, [stage])

  const buildAnswersPayload = () => ({
    q1,
    departureCity: departureCities.join(', '),
    dates,
    fixedDates,
    flexLength,
    domestic,
    regions,
    stops,
    stopsOther,
    activities,
    vibe,
    vibeOther,
    accommodation,
    budget,
    budgetOther,
    popularity,
    q3,
  })

  const saveProgress = async (stageToSave: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('user_profiles').select('email').eq('user_id', user.id).single()
    await supabase.from('travelers').update({
      step2: {
        q1, departureCity: departureCities.join(', '),
        dates, fixedDates, flexLength,
        domestic, regions, stops: stops === 'Other' ? stopsOther : stops,
        activities, vibe: vibe.includes('Other') ? [...vibe.filter(v => v !== 'Other'), vibeOther] : vibe,
        accommodation, budget: budget === 'Other' ? budgetOther : budget,
        popularity, q3, stage: stageToSave,
      }
    }).eq('trip_id', tripId).eq('email', profile?.email || '')
  }

  const toggleMulti = (arr: string[], val: string, setter: (a: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const parseCardsFromText = (text: string) => {
    const result: any[] = []

    // Only parse up to AVANTI_CARDS_END or REASONING — whichever comes first
    let cardsBlock = text
    const endMarkers = ['AVANTI_CARDS_END', 'REASONING:', 'WHY_NOT:']
    for (const marker of endMarkers) {
      const idx = cardsBlock.indexOf(marker)
      if (idx !== -1) cardsBlock = cardsBlock.slice(0, idx)
    }

    if (!cardsBlock.includes('NAME:')) return result

    const sections = cardsBlock.split('---').map((s: string) => s.trim()).filter((s: string) => s)

    for (const section of sections) {
      if (!section.includes('NAME:')) continue
      // Skip header lines like DESTINATIONS:
      if (section.trim() === 'DESTINATIONS:') continue

      const isWildcard = section.includes('WILDCARD:')

      const get = (field: string): string => {
        const lines = section.split('\n')
        let value = ''
        let capturing = false
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith(field + ':')) {
            value = trimmed.slice(field.length + 1).trim()
            capturing = true
          } else if (capturing) {
            if (/^[A-Z][A-Z\s]+:/.test(trimmed) && !trimmed.startsWith('-')) {
              capturing = false
            } else {
              value += '\n' + line
            }
          }
        }
        return value.trim()
      }

      const name = get('NAME')
      if (!name || name.length < 2) continue

      result.push({
        name,
        highlight: get('HIGHLIGHT'),
        consider: get('CONSIDER'),
        synopsis: get('SYNOPSIS'),
        logistics: get('LOGISTICS'),
        cost: get('COST'),
        weather: get('WEATHER'),
        activities: get('ACTIVITIES'),
        groupFit: get('GROUP FIT'),
        vibeCheck: get('VIBE CHECK'),
        footnotes: get('FOOTNOTES') || undefined,
        tradeoff: get('TRADEOFF') || undefined,
        isWildcard,
      })
    }

    return result
  }

  const parseWhyNot = (text: string): { name: string; reasons: string[] }[] => {
    const result: { name: string; reasons: string[] }[] = []
    const reasoningStart = text.indexOf('REASONING:')
    const reasoningEnd = text.indexOf('REASONING_END')
    if (reasoningStart === -1) return result
    const block = text.slice(reasoningStart, reasoningEnd !== -1 ? reasoningEnd : undefined)
    const sections = block.split('---').map((s: string) => s.trim()).filter((s: string) => s && s.includes('NAME:'))
    for (const section of sections) {
      const nameMatch = section.match(/NAME:\s*(.+)/)
      const name = nameMatch?.[1]?.trim() || ''
      if (!name) continue
      const reasons = section.split('\n')
        .filter((l: string) => l.trim().startsWith('-'))
        .map((l: string) => l.replace(/^-\s*/, '').trim())
        .filter((l: string) => l.length > 0)
      result.push({ name, reasons })
    }
    return result
  }

  const generateDestinations = async () => {
    setGenerating(true)
    await saveProgress('done')
    try {
      const res = await fetch('/api/generate-destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          answers: buildAnswersPayload(),
          messages: [],
        }),
      })
      const data = await res.json()
      const parsed = parseCardsFromText(data.message || '')
      const parsedWhyNot = parseWhyNot(data.message || '')
      setCards(parsed)
      setWhyNot(parsedWhyNot)
      setStage('done')
      await supabase.from('trip_destinations').upsert({
        trip_id: tripId,
        cards: parsed,
        why_not: parsedWhyNot,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id' })
    } catch (e) {
      console.error(e)
    }
    setGenerating(false)
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: 'user' as const, content: chatInput }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/step2-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, tripId, context: { q1, departureCity: departureCities.join(', '), dates, domestic, activities, vibe, budget, q3 } }),
      })
      const data = await res.json()
      setChatMessages(m => [...m, { role: 'assistant', content: data.message }])
    } catch (e) {
      setChatMessages(m => [...m, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setChatLoading(false)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const q2Valid = departureCities.length > 0 && !!dates

  const avatarStyle = { width: '40px', height: '40px', borderRadius: '50%', background: '#1a3a2a', flexShrink: 0 } as const
  const questionTextStyle = { fontSize: '16px', color: '#1a1a1a', lineHeight: 1.7, margin: 0, ...s }
  const underlineInputStyle = { width: '100%', border: 'none', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '15px', color: '#1a1a1a', outline: 'none', resize: 'none' as const, lineHeight: 1.6, ...s }

  const AvantiQuestion = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '20px' }}>
      <div style={avatarStyle} />
      <p style={questionTextStyle}>{children}</p>
    </div>
  )

  const UserBubble = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
      <div style={{ maxWidth: '80%', background: '#1a3a2a', color: '#fff', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap', ...s }}>
        {children}
      </div>
    </div>
  )

  if (loading) return <SuitcaseLoader message="Loading" />

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', paddingBottom: '140px', ...s }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '40px' }}>
          <AvantiLogo size="sm" />
          <p style={{ fontSize: '18px', fontWeight: 400, color: '#1a1a1a', margin: 0, textAlign: 'center', padding: '0 12px', ...s }}>
            {trip?.name}
          </p>
          <button
            onClick={() => router.push(`/trips/${tripId}`)}
            style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', justifySelf: 'end', ...s }}
          >
            ← Back
          </button>
        </div>

        {(stage === 1 || editMode) && (
          <>
            <AvantiQuestion>
              Tell us about this trip. Who is going? What kind of trip are you looking for? Any idea where? What&apos;s the reason for the trip?
            </AvantiQuestion>

            <div style={{ paddingLeft: '56px', marginTop: '16px' }}>
              <textarea
                value={q1}
                onChange={e => setQ1(e.target.value)}
                placeholder="e.g. 8 college friends, graduation trip, beaches and nightlife somewhere in Europe"
                rows={4}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  padding: '0',
                  fontSize: '15px',
                  color: '#1a1a1a',
                  resize: 'none',
                  lineHeight: 1.7,
                  fontFamily: 'var(--font-cormorant), Georgia, serif',
                  display: 'block',
                  pointerEvents: 'auto',
                }}
              />
              {stage === 1 && !editMode && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    onClick={() => { setStage(2); saveProgress(2) }}
                    disabled={!q1.trim()}
                    style={{
                      padding: '12px 28px', border: '1px solid #1a3a2a',
                      background: q1.trim() ? '#1a3a2a' : 'transparent',
                      color: q1.trim() ? '#fafaf8' : '#d4d4c8',
                      fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
                      cursor: q1.trim() ? 'pointer' : 'default',
                      fontFamily: 'var(--font-cormorant), Georgia, serif',
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {((typeof stage === 'number' && stage >= 2) || stage === 'generate' || stage === 'done') && !editMode && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1a3a2a', flexShrink: 0 }} />
              <p style={{ fontSize: '16px', color: '#1a1a1a', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                Tell us about this trip. Who is going? What kind of trip are you looking for? Any idea where? What&apos;s the reason for the trip?
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ maxWidth: '80%', background: '#1a3a2a', color: '#fff', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                {q1}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={() => setStage(1)}
                style={{ fontSize: '11px', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              >
                Edit
              </button>
            </div>
          </div>
        )}

        {showQ2 && (
          <>
            <AvantiQuestion>
              A few more details — tap to answer each one.
            </AvantiQuestion>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: showQ3 ? '32px' : '0', paddingLeft: '54px' }}>
              <div>
                <span style={sectionLabel}>Where are you flying from? ★</span>

                {departureCities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {departureCities.map((city, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f', borderRadius: '20px' }}>
                        <span style={{ fontSize: '13px', color: '#1a3a2a', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{city}</span>
                        <button
                          onClick={() => setDepartureCities(departureCities.filter((_, idx) => idx !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', fontSize: '14px', lineHeight: 1, padding: '0 0 0 2px' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    id="departure-city-input"
                    type="text"
                    autoComplete="off"
                    style={{
                      width: '200px',
                      borderBottom: '1px solid #d4d4c8',
                      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                      background: 'transparent',
                      padding: '8px 0',
                      fontSize: '14px',
                      color: '#1a1a1a',
                      outline: 'none',
                      fontFamily: 'var(--font-cormorant), Georgia, serif',
                    }}
                    value={departureCityInput}
                    onChange={e => setDepartureCityInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && departureCityInput.trim()) {
                        setDepartureCities(prev => [...prev, departureCityInput.trim()])
                        setDepartureCityInput('')
                      }
                    }}
                    placeholder="Type a city..."
                  />
                  {departureCityInput.trim() && (
                    <button
                      onClick={() => {
                        setDepartureCities(prev => [...prev, departureCityInput.trim()])
                        setDepartureCityInput('')
                      }}
                      style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d6a4f', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>What are your dates? ★</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {['Fixed dates', 'Flexible — I have a range', 'Completely flexible'].map(opt => (
                    <button key={opt} onClick={() => setDates(opt)} style={chipStyle(dates === opt)}>{opt}</button>
                  ))}
                </div>
                {dates === 'Fixed dates' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Departure</label>
                      <input type="date" style={inputStyle} value={fixedDates.start} onChange={e => setFixedDates(d => ({ ...d, start: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Return</label>
                      <input type="date" style={inputStyle} value={fixedDates.end} onChange={e => setFixedDates(d => ({ ...d, end: e.target.value }))} />
                    </div>
                  </div>
                )}
                {dates === 'Flexible — I have a range' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={labelStyle}>Earliest departure</label>
                        <input type="date" style={inputStyle} value={fixedDates.start} onChange={e => setFixedDates(d => ({ ...d, start: e.target.value }))} />
                      </div>
                      <div>
                        <label style={labelStyle}>Latest return</label>
                        <input type="date" style={inputStyle} value={fixedDates.end} onChange={e => setFixedDates(d => ({ ...d, end: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Preferred trip length</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {['3–4 nights', '5–7 nights', '8–10 nights', '11–14 nights', '2+ weeks'].map(opt => (
                          <button key={opt} onClick={() => setFlexLength(opt)} style={chipStyle(flexLength === opt)}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>Domestic or international?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {['Domestic only', 'International', 'No preference'].map(opt => (
                    <button key={opt} onClick={() => setDomestic(opt)} style={chipStyle(domestic === opt)}>{opt}</button>
                  ))}
                </div>
                {domestic === 'International' && (
                  <div>
                    <label style={{ ...labelStyle, marginTop: '8px' }}>Regions you&apos;d consider</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {['Europe', 'Caribbean', 'Latin America', 'Southeast Asia', 'East Asia', 'Middle East', 'Africa', 'South Pacific', 'Anywhere'].map(r => (
                        <button key={r} onClick={() => toggleMulti(regions, r, setRegions)} style={chipStyle(regions.includes(r))}>{r}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>How many places?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Just one', '2 stops', '3 stops', 'Open to anything', 'Other'].map(opt => (
                    <button key={opt} onClick={() => setStops(opt)} style={chipStyle(stops === opt)}>{opt}</button>
                  ))}
                </div>
                {stops === 'Other' && (
                  <input style={{ ...inputStyle, marginTop: '8px' }} value={stopsOther} onChange={e => setStopsOther(e.target.value)} placeholder="Tell us more..." />
                )}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>What kind of activities?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Physical / outdoor', 'Cultural / historical', 'Entertainment & nightlife', 'Food & dining', 'Relaxation & wellness', 'Water activities', 'Shopping', 'Arts & music', 'Adventure sports'].map(opt => (
                    <button key={opt} onClick={() => toggleMulti(activities, opt, setActivities)} style={chipStyle(activities.includes(opt))}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>What&apos;s the vibe?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {['Luxury', 'Budget-conscious', 'Party', 'Romantic', 'Family-friendly', 'Cultural immersion', 'Off the beaten path', 'Touristy & easy', 'Relaxed & slow', 'Action-packed', 'Other'].map(opt => (
                    <button key={opt} onClick={() => toggleMulti(vibe, opt, setVibe)} style={chipStyle(vibe.includes(opt))}>{opt}</button>
                  ))}
                </div>
                {vibe.includes('Other') && (
                  <input style={{ ...inputStyle, marginTop: '8px' }} value={vibeOther} onChange={e => setVibeOther(e.target.value)} placeholder="Describe the vibe..." />
                )}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>Hotel or Airbnb?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Hotel', 'Airbnb / villa', 'Resort', 'Boutique / guesthouse', 'No preference'].map(opt => (
                    <button key={opt} onClick={() => setAccommodation(opt)} style={chipStyle(accommodation === opt)}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>Trip budget per person?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {['Under $1,000', '$1,000–2,000', '$2,000–4,000', '$4,000–7,000', '$7,000+', 'Other'].map(opt => (
                    <button key={opt} onClick={() => setBudget(opt)} style={chipStyle(budget === opt)}>{opt}</button>
                  ))}
                </div>
                {budget === 'Other' && (
                  <input style={{ ...inputStyle, marginTop: '8px' }} value={budgetOther} onChange={e => setBudgetOther(e.target.value)} placeholder="Describe your budget..." />
                )}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>How popular should the destination be?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Well known & easy', 'A mix of both', 'Off the beaten path', 'Surprise us'].map(opt => (
                    <button key={opt} onClick={() => setPopularity(opt)} style={chipStyle(popularity === opt)}>{opt}</button>
                  ))}
                </div>
              </div>

              {stage === 2 && !editMode && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                  {nextBtn(() => { setStage(3); saveProgress(3) }, !q2Valid)}
                </div>
              )}
            </div>
          </>
        )}

        {showQ3 && (
          <>
            <AvantiQuestion>
              What don&apos;t you want? Any deal breakers? Anything else Avanti should know?
            </AvantiQuestion>

            {(stage === 3 || editMode) ? (
              <div style={{ marginBottom: '32px', paddingLeft: '54px' }}>
                <textarea
                  value={q3}
                  onChange={e => setQ3(e.target.value)}
                  placeholder="No cold weather. Don't want anywhere too touristy. One person in the group has a shellfish allergy. We'd rather not go anywhere that requires a visa..."
                  rows={3}
                  style={underlineInputStyle}
                />
                {stage === 3 && !editMode && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    {nextBtn(() => { setStage('generate'); saveProgress('generate') }, false, 'Next →')}
                  </div>
                )}
              </div>
            ) : q3.trim() && !editMode ? (
              <>
                <UserBubble>{q3}</UserBubble>
                {(stage === 3 || stage === 'generate' || stage === 'done') && !editMode && !generating && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button
                      onClick={async () => {
                        setGenerating(true)
                        await saveProgress('done')
                        try {
                          const res = await fetch('/api/generate-destinations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              tripId,
                              answers: {
                                q1, departureCity: departureCities.join(', '), dates, fixedDates, flexLength,
                                domestic, regions, stops, stopsOther, activities,
                                vibe, vibeOther, accommodation, budget, budgetOther,
                                popularity, q3,
                              },
                              messages: [],
                            }),
                          })
                          const data = await res.json()
                          console.log('FULL MESSAGE LENGTH:', data.message?.length)
                          console.log('HAS REASONING:', data.message?.includes('REASONING:'))
                          console.log('HAS WHY_NOT:', data.message?.includes('WHY_NOT:'))
                          console.log('REASONING SECTION:', data.message?.slice(data.message?.indexOf('REASONING:'), data.message?.indexOf('REASONING:') + 500))
                          const parsed = parseCardsFromText(data.message || '')
                          const parsedWhyNot = parseWhyNot(data.message || '')
                          console.log('PARSED WHY NOT:', parsedWhyNot)
                          setCards(parsed)
                          setWhyNot(parsedWhyNot)
                          setStage('done')
                          await supabase.from('trip_destinations').upsert({
                            trip_id: tripId,
                            cards: parsed,
                            why_not: parsedWhyNot,
                            updated_at: new Date().toISOString(),
                          }, { onConflict: 'trip_id' })
                        } catch (e) {
                          console.error(e)
                        }
                        setGenerating(false)
                      }}
                      style={{
                        padding: '14px 32px',
                        border: '1px solid #1a3a2a',
                        background: '#1a3a2a',
                        color: '#fafaf8',
                        fontSize: '10px',
                        letterSpacing: '0.25em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-cormorant), Georgia, serif',
                      }}
                    >
                      Generate trip ideas →
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </>
        )}

        {editMode && (
          <button
            onClick={async () => {
              const answersChanged = JSON.stringify(buildAnswersPayload()) !== JSON.stringify(cachedAnswers)
              setEditMode(false)
              if (!answersChanged && cachedAnswers) {
                const { data } = await supabase
                  .from('trip_destinations')
                  .select('cards, why_not')
                  .eq('trip_id', tripId)
                  .single()
                if (data?.cards) setCards(data.cards)
                if (data?.why_not) setWhyNot(data.why_not)
                return
              }
              await generateDestinations()
            }}
            style={{
              width: '100%', padding: '18px',
              border: '1px solid #1a3a2a', background: '#1a3a2a',
              color: '#fafaf8', fontSize: '11px', letterSpacing: '0.25em',
              textTransform: 'uppercase', cursor: 'pointer',
              fontFamily: 'var(--font-cormorant), Georgia, serif',
              marginTop: '24px',
            }}
          >
            Regenerate trip ideas →
          </button>
        )}

        {generating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round">
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: 'center' }} />
            </svg>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d6a4f', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Avanti is thinking...</p>
            <p style={{ fontSize: '13px', color: '#9a9a8a', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Based on what you&apos;ve shared — weighing destinations against your vibe, budget, and deal breakers
            </p>
          </div>
        )}

        {!editMode && !generating && cards.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '32px', marginBottom: '32px' }}>
            {cards.map((card, i) => (
              <StepTwoDestCard
                key={i}
                card={card}
                tripId={tripId}
                isVoted={!!votes[card.name]}
                onVote={() => {
                  const currentCount = Object.values(votes).filter(Boolean).length
                  const isCurrentlyVoted = votes[card.name]
                  if (!isCurrentlyVoted && currentCount >= maxVotes) return
                  setVotes(v => ({ ...v, [card.name]: !v[card.name] }))
                }}
              />
            ))}
          </div>
        )}

        {!generating && cards.length > 0 && (
          <div style={{ marginTop: '24px', marginBottom: '32px' }}>
            <button
              onClick={() => router.push(`/trips/${tripId}/vote`)}
              style={{
                width: '100%', padding: '16px',
                border: 'none', background: '#1a3a2a', color: '#fafaf8',
                fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'var(--font-cormorant), Georgia, serif',
              }}
            >
              Go to voting →
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '0.5px solid #e4e4d8',
        padding: '12px 24px 20px', zIndex: 50,
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {chatMessages.length > 0 && (
            <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '8px 14px', borderRadius: '12px', fontSize: '13px', lineHeight: 1.5,
                    background: msg.role === 'user' ? '#1a3a2a' : '#f5f5f0',
                    color: msg.role === 'user' ? '#fff' : '#1a1a1a',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '4px', padding: '8px 14px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9a9a8a', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask Avanti anything about this trip..."
              style={{
                flex: 1, border: 'none', borderBottom: '1px solid #d4d4c8',
                background: 'transparent', padding: '8px 0', fontSize: '14px',
                color: '#1a1a1a', outline: 'none', ...s,
              }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading}
              style={{
                padding: '8px 18px', background: '#1a3a2a', border: 'none',
                color: '#fff', fontSize: '10px', letterSpacing: '0.15em',
                textTransform: 'uppercase', cursor: 'pointer',
                opacity: chatInput.trim() ? 1 : 0.4, borderRadius: '6px', ...s,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
