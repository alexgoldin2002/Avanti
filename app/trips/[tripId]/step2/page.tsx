'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import DestinationCard from '../../../components/DestinationCard'
import { BackLink } from '../../../components/SubpageShell'
import { fetchFullDestinationCards } from '@/lib/fetch-destination-batches'
import { STOP_OPTIONS } from '@/lib/preview-trip-storage'
import { startDecision } from '@/lib/destination-decision/client-api'

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
  const [showRefreshChatConfirm, setShowRefreshChatConfirm] = useState(false)
  const [refreshingChat, setRefreshingChat] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateStatus, setGenerateStatus] = useState<string | null>(null)
  const [cards, setCards] = useState<any[]>([])
  const [whyNot, setWhyNot] = useState<{ name: string; reasons: string[] }[]>([])
  const [editMode, setEditMode] = useState(false)
  const [cachedAnswers, setCachedAnswers] = useState<any>(null)
  const [votes, setVotes] = useState<Record<string, boolean>>({})
  const [maxVotes, setMaxVotes] = useState(2)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [startingDecision, setStartingDecision] = useState(false)
  const [submissionHours, setSubmissionHours] = useState(48)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '8px' }
  const sectionLabel = { fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', marginBottom: '10px', display: 'block' }
  const chipStyle = (selected: boolean) => ({
    padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
    border: `1px solid ${selected ? 'var(--forest-deep)' : '#d4d4c8'}`,
    background: selected ? '#e8f5ee' : '#fff',
    color: selected ? 'var(--forest-deep)' : '#6a6a6a',
    borderRadius: '24px', transition: 'all 0.15s', ...s,
  })
  const nextBtn = (onClick: () => void, disabled: boolean, label = 'Next →') => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '14px 32px', border: '1px solid var(--forest-deep)',
        background: disabled ? 'transparent' : 'var(--forest-deep)',
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
      if (user && tripData) {
        setIsOrganizer(tripData.organizer_id === user.id)
      }
      if (user) {
        const { data: profile } = await supabase.from('user_profiles').select('email').eq('user_id', user.id).single()
        const { data: traveler } = await supabase.from('travelers').select('step2').eq('trip_id', tripId).eq('email', profile?.email || '').single()
        if (traveler?.step2) {
          const s2 = traveler.step2
          if (s2.q1) { setQ1(s2.q1) }
          if (s2.departureCity) setDepartureCities(s2.departureCity.split(',').map((c: string) => c.trim()).filter(Boolean))
          if (s2.dates) setDates(s2.dates)
          if (s2.fixedDates) setFixedDates(s2.fixedDates)
          if (s2.flexLength) setFlexLength(s2.flexLength)
          if (s2.domestic) setDomestic(s2.domestic)
          if (s2.regions) setRegions(s2.regions)
          if (s2.stops) {
            if (STOP_OPTIONS.includes(s2.stops)) setStops(s2.stops)
            else { setStops('Other'); setStopsOther(s2.stops) }
          }
          if (s2.activities) setActivities(s2.activities)
          if (s2.vibe) setVibe(s2.vibe)
          if (s2.accommodation) setAccommodation(s2.accommodation)
          if (s2.budget) setBudget(s2.budget)
          if (s2.popularity) setPopularity(s2.popularity)
          if (s2.q3) setQ3(s2.q3)
          if (s2.stage) setStage(s2.stage)
          if (Array.isArray(s2.chatMessages)) setChatMessages(s2.chatMessages)
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

  const isQ2Complete = () => {
    if (departureCities.length === 0) return false
    if (!dates) return false
    if (dates === 'Fixed dates' && (!fixedDates.start || !fixedDates.end)) return false
    if (dates === 'Flexible — I have a range' && (!fixedDates.start || !fixedDates.end || !flexLength)) return false
    if (!domestic) return false
    if (domestic === 'International' && regions.length === 0) return false
    if (!stops) return false
    if (stops === 'Other' && !stopsOther.trim()) return false
    if (activities.length === 0) return false
    if (vibe.length === 0) return false
    if (vibe.includes('Other') && !vibeOther.trim()) return false
    if (!accommodation) return false
    if (!budget) return false
    if (budget === 'Other' && !budgetOther.trim()) return false
    if (!popularity) return false
    return true
  }

  const q2Valid = isQ2Complete()

  const showQ2 = (typeof stage === 'number' && stage >= 2) || stage === 'generate' || stage === 'done' || editMode
  const showQ3 = editMode || stage === 'generate' || stage === 'done' || (typeof stage === 'number' && stage >= 3 && q2Valid)

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

  const saveProgress = async (stageToSave: any, messagesOverride?: { role: 'user' | 'assistant'; content: string }[]) => {
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
        chatMessages: messagesOverride ?? chatMessages,
      }
    }).eq('trip_id', tripId).eq('email', profile?.email || '')
  }

  const persistChatMessages = async (messages: { role: 'user' | 'assistant'; content: string }[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('user_profiles').select('email').eq('user_id', user.id).single()
    const { data: traveler } = await supabase
      .from('travelers')
      .select('step2')
      .eq('trip_id', tripId)
      .eq('email', profile?.email || '')
      .single()
    const existingStep2 = traveler?.step2 || {}
    await supabase.from('travelers').update({
      step2: { ...existingStep2, chatMessages: messages },
    }).eq('trip_id', tripId).eq('email', profile?.email || '')
  }

  const refreshChat = async () => {
    setRefreshingChat(true)
    const { data: { user } } = await supabase.auth.getUser()
    setChatMessages([])
    setChatInput('')
    if (user) {
      const { data: profile } = await supabase.from('user_profiles').select('email').eq('user_id', user.id).single()
      const { data: traveler } = await supabase
        .from('travelers')
        .select('step2')
        .eq('trip_id', tripId)
        .eq('email', profile?.email || '')
        .single()
      const existingStep2 = traveler?.step2 || {}
      await supabase.from('travelers').update({
        step2: { ...existingStep2, chatMessages: [] },
      }).eq('trip_id', tripId).eq('email', profile?.email || '')
      await supabase.from('trip_conversations').delete().eq('trip_id', tripId).eq('user_id', user.id)
    }
    setRefreshingChat(false)
    setShowRefreshChatConfirm(false)
  }

  const toggleMulti = (arr: string[], val: string, setter: (a: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
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
    setGenerateError(null)
    setGenerateStatus('Finding your first destinations…')
    setCards([])
    await saveProgress('done')

    const answerPayload = {
      q1,
      departureCities,
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
    }

    try {
      const parsed = await fetchFullDestinationCards(answerPayload, {
        tripId,
        onStatus: setGenerateStatus,
        onPartialCards: partial => {
          setCards(partial)
          if (partial.length > 0) setStage('done')
        },
        messages: chatMessages,
      })

      setCards(parsed)
      setStage('done')
      await supabase.from('trip_destinations').upsert({
        trip_id: tripId,
        cards: parsed,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id' })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong generating trip ideas'
      console.error('generate error:', e)
      setGenerateError(message)
    } finally {
      setGenerating(false)
      setGenerateStatus(null)
    }
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
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: data.message }]
      setChatMessages(finalMessages)
      await persistChatMessages(finalMessages)
    } catch (e) {
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: 'Something went wrong. Try again.' }]
      setChatMessages(finalMessages)
      await persistChatMessages(finalMessages)
    }
    setChatLoading(false)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const avatarStyle = { width: '40px', height: '40px', borderRadius: '50%', background: 'var(--forest-deep)', flexShrink: 0 } as const
  const questionTextStyle = { fontSize: '16px', color: 'var(--foreground)', lineHeight: 1.7, margin: 0, ...s }
  const underlineInputStyle = { width: '100%', border: 'none', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', resize: 'none' as const, lineHeight: 1.6, ...s }

  const AvantiQuestion = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '20px' }}>
      <div style={avatarStyle} />
      <p style={questionTextStyle}>{children}</p>
    </div>
  )

  const UserBubble = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
      <div style={{ maxWidth: '80%', background: 'var(--forest-deep)', color: '#fff', borderRadius: '0', padding: '12px 16px', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap', ...s }}>
        {children}
      </div>
    </div>
  )

  if (loading) return <SuitcaseLoader message="Loading" />

  return (
    <main style={{ minHeight: '100vh', background: 'transparent', paddingBottom: '140px', ...s }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
        <BackLink href={`/trips/${tripId}`} wrapperClassName="mb-8 flex justify-end" />
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--foreground)', margin: 0, ...s }}>
            {trip?.name}
          </p>
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
                  color: 'var(--foreground)',
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
                      padding: '12px 28px', border: '1px solid var(--forest-deep)',
                      background: q1.trim() ? 'var(--forest-deep)' : 'transparent',
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
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--forest-deep)', flexShrink: 0 }} />
              <p style={{ fontSize: '16px', color: 'var(--foreground)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                Tell us about this trip. Who is going? What kind of trip are you looking for? Any idea where? What&apos;s the reason for the trip?
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ maxWidth: '80%', background: 'var(--forest-deep)', color: '#fff', padding: '12px 16px', borderRadius: '0', fontSize: '14px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                {q1}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={() => setStage(1)}
                style={{ fontSize: '11px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
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
                <span style={sectionLabel}>Where are you flying from?</span>

                {departureCities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {departureCities.map((city, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f', borderRadius: '20px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--forest-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{city}</span>
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
                      color: 'var(--foreground)',
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
                <span style={sectionLabel}>What are your dates?</span>
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
                      onClick={() => generateDestinations()}
                      style={{
                        padding: '14px 32px',
                        border: '1px solid var(--forest-deep)',
                        background: 'var(--forest-deep)',
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
              border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)',
              color: '#fafaf8', fontSize: '11px', letterSpacing: '0.25em',
              textTransform: 'uppercase', cursor: 'pointer',
              fontFamily: 'var(--font-cormorant), Georgia, serif',
              marginTop: '24px',
            }}
          >
            Regenerate trip ideas →
          </button>
        )}

        {generating && cards.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round">
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: 'center' }} />
            </svg>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d6a4f', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Avanti is thinking...</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {generateStatus || 'Based on what you\'ve shared — weighing destinations against your vibe, budget, and deal breakers'}
            </p>
          </div>
        )}

        {!generating && generateError && cards.length === 0 && (
          <div style={{ marginTop: '32px', padding: '20px 24px', border: '1px solid #c0392b', background: '#fdf2f2', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#c0392b', margin: '0 0 16px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {generateError}
            </p>
            <button
              type="button"
              onClick={() => generateDestinations()}
              style={{
                padding: '12px 28px',
                border: '1px solid var(--forest-deep)',
                background: 'var(--forest-deep)',
                color: '#fafaf8',
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'var(--font-cormorant), Georgia, serif',
              }}
            >
              Try again →
            </button>
          </div>
        )}

        {!editMode && cards.length > 0 && (
          <>
            {generating && (
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'center', marginTop: '24px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                {generateStatus || 'Adding more destinations…'}
              </p>
            )}
            {generateError && cards.length > 0 && cards.length < 4 && (
              <div style={{ marginTop: '16px', padding: '14px 18px', border: '1px solid #d4a017', background: '#fef9ec', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#8a6a10', margin: '0 0 10px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {generateError} — showing {cards.length} of 4 picks so far.
                </p>
                <button type="button" onClick={() => generateDestinations()} style={{ padding: '10px 20px', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fafaf8', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  Finish generating →
                </button>
              </div>
            )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '32px', marginBottom: '32px' }}>
            {cards.map((card, i) => (
              <DestinationCard
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
          </>
        )}

        {!generating && cards.length > 0 && cards.length < 4 && !generateError && (
          <div style={{ marginTop: '8px', marginBottom: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 12px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {cards.length} of 4 destinations ready — tap to generate the rest.
            </p>
            <button type="button" onClick={() => generateDestinations()} style={{ padding: '10px 20px', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fafaf8', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Finish generating →
            </button>
          </div>
        )}

        {!generating && cards.length >= 4 && isOrganizer && (
          <div style={{ marginTop: '24px', marginBottom: '32px' }}>
            <p style={{ ...labelStyle, marginBottom: '10px' }}>Suggestion window</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {[
                { h: 24, label: '24 hours' },
                { h: 48, label: '48 hours' },
                { h: 72, label: '72 hours' },
                { h: 168, label: '1 week' },
              ].map(opt => (
                <button
                  key={opt.h}
                  type="button"
                  onClick={() => setSubmissionHours(opt.h)}
                  style={chipStyle(submissionHours === opt.h)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                setStartingDecision(true)
                try {
                  await startDecision(tripId, submissionHours)
                  router.push(`/trips/${tripId}/choose`)
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Failed to start')
                } finally {
                  setStartingDecision(false)
                }
              }}
              disabled={startingDecision}
              style={{
                width: '100%', padding: '16px',
                border: 'none', background: 'var(--forest-deep)', color: '#fafaf8',
                fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
                cursor: startingDecision ? 'wait' : 'pointer',
                opacity: startingDecision ? 0.7 : 1,
                fontFamily: 'var(--font-cormorant), Georgia, serif',
              }}
            >
              {startingDecision ? 'Starting…' : 'Start group decision →'}
            </button>
          </div>
        )}

        {!generating && cards.length >= 4 && !isOrganizer && (
          <div style={{ marginTop: '24px', marginBottom: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Waiting for the organizer to start the group destination decision.
            </p>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--card)', borderTop: '0.5px solid #e4e4d8',
        padding: '12px 24px 20px', zIndex: 50,
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {(chatMessages.length > 0 || chatLoading) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => setShowRefreshChatConfirm(true)}
                disabled={chatLoading || refreshingChat}
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  background: 'none',
                  border: 'none',
                  cursor: chatLoading || refreshingChat ? 'default' : 'pointer',
                  opacity: chatLoading || refreshingChat ? 0.4 : 1,
                  ...s,
                }}
              >
                Refresh chat
              </button>
            </div>
          )}
          {chatMessages.length > 0 && (
            <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '8px 14px', borderRadius: '0', fontSize: '13px', lineHeight: 1.5,
                    background: msg.role === 'user' ? 'var(--forest-deep)' : '#f5f5f0',
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
                color: 'var(--foreground)', outline: 'none', ...s,
              }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading}
              style={{
                padding: '8px 18px', background: 'var(--forest-deep)', border: 'none',
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

      {showRefreshChatConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '24px' }}>
          <div style={{ background: 'var(--cream)', borderRadius: '0', padding: '28px', width: '100%', maxWidth: '360px', textAlign: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif', boxShadow: 'var(--shadow-box)' }}>
            <p style={{ fontSize: '18px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 12px' }}>Refresh chat?</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 24px', lineHeight: 1.7 }}>
              Are you sure? This will delete your chat history and any stored conversation data. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowRefreshChatConfirm(false)}
                disabled={refreshingChat}
                style={{ flex: 1, border: '1px solid var(--border)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', borderRadius: '0', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={refreshChat}
                disabled={refreshingChat}
                style={{ flex: 1, border: '1px solid var(--foreground)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', background: 'var(--foreground)', cursor: 'pointer', borderRadius: '0', fontFamily: 'var(--font-cormorant), Georgia, serif', opacity: refreshingChat ? 0.5 : 1 }}
              >
                {refreshingChat ? 'Clearing...' : 'Refresh chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
