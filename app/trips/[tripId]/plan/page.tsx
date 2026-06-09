'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import PlacesAutocomplete from '../../../components/PlacesAutocomplete'
import Footer from '../../../components/Footer'

interface CardBullet {
  text: string
  type: 'positive' | 'warning'
}

interface CardThingToDo {
  activity: string
  cost: string
}

interface CardDetails {
  avanti_take?: string
  pros?: string[]
  cons?: string[]
  things_to_do?: CardThingToDo[]
  food?: string
  weather?: string
  getting_there?: string
  tiktok_searches?: string[]
}

interface DestinationCard {
  title: string
  price: number
  priceRange: string
  priceNote?: string
  tagline: string
  bullets: CardBullet[]
  details?: CardDetails
  bottomLine: string
}

interface Message {
  id: string
  role: 'avanti' | 'user'
  text: string
  cards?: DestinationCard[]
}

const OPENING = "Tell me about this trip. Where, when, who, and what are you thinking?"

export default function PlanConversation() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [addedCards, setAddedCards] = useState<DestinationCard[]>([])
  const [sendingToGroup, setSendingToGroup] = useState(false)
  const [showVoteConfirm, setShowVoteConfirm] = useState(false)
  const [createdVoteId, setCreatedVoteId] = useState<string | null>(null)
  const [followUpSubmitted, setFollowUpSubmitted] = useState(false)
  const [departureCities, setDepartureCities] = useState<string[]>([])
  const [departureCityInput, setDepartureCityInput] = useState('')
  const [dateMode, setDateMode] = useState<'exact' | 'range' | null>(null)
  const [departureDate, setDepartureDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [earliestDeparture, setEarliestDeparture] = useState('')
  const [latestReturn, setLatestReturn] = useState('')
  const [travelers, setTravelers] = useState<any[]>([])
  const [showConvosPanel, setShowConvosPanel] = useState(false)
  const [viewingTraveler, setViewingTraveler] = useState<any>(null)
  const [viewingMessages, setViewingMessages] = useState<any[]>([])
  const [loadingConvo, setLoadingConvo] = useState(false)
  const [showMemberConvos, setShowMemberConvos] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#9a9a8a', display: 'block', marginBottom: '6px' }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '14px', color: '#1a1a1a', outline: 'none', ...s }
  const userMessageCount = messages.filter(m => m.role === 'user').length
  const hasCards = messages.some(m => m.cards && m.cards.length > 0)
  const showFollowUpCard =
    !followUpSubmitted &&
    userMessageCount === 1 &&
    !sending &&
    !hasCards

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      let loadedExisting = false
      if (user) {
        setCurrentUserId(user.id)
        const { data: existingMessages } = await supabase
          .from('trip_conversations')
          .select('*')
          .eq('trip_id', tripId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (existingMessages && existingMessages.length > 0) {
          setMessages(existingMessages.map(m => ({
            id: m.id,
            role: m.role === 'assistant' ? 'avanti' : 'user',
            text: m.content || '',
            cards: m.cards || undefined,
          })))
          if (existingMessages.filter(m => m.role === 'user').length > 1) {
            setFollowUpSubmitted(true)
          }
          loadedExisting = true
        }
      }
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        if (tripData?.show_member_conversations === false) setShowMemberConvos(false)
      }
      const { data: travelerData } = await supabase.from('travelers').select('*').eq('trip_id', tripId).eq('status', 'approved')
      if (travelerData) setTravelers(travelerData)
      if (!loadedExisting) {
        setMessages([{ id: 'opening', role: 'avanti', text: OPENING }])
      }
    }
    load()
  }, [tripId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const cardKey = (card: DestinationCard) => card.title

  const isAdded = (card: DestinationCard) => addedCards.some(c => c.title === card.title)

  const toggleAddCard = (card: DestinationCard) => {
    if (isAdded(card)) {
      setAddedCards(prev => prev.filter(c => c.title !== card.title))
    } else {
      setAddedCards(prev => [...prev, card])
    }
  }

  const loadTravelerConvo = async (traveler: any) => {
    setViewingTraveler(traveler)
    setLoadingConvo(true)
    setShowConvosPanel(true)
    const { data } = await supabase
      .from('trip_conversations')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', traveler.user_id)
      .order('created_at', { ascending: true })
    setViewingMessages(data || [])
    setLoadingConvo(false)
  }

  const addDepartureCity = (city: string) => {
    const trimmed = city.trim()
    if (!trimmed || departureCities.includes(trimmed)) return
    setDepartureCities(prev => [...prev, trimmed])
    setDepartureCityInput('')
  }

  const removeDepartureCity = (city: string) => {
    setDepartureCities(prev => prev.filter(c => c !== city))
  }

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const isFirstUserMessage = messages.filter(m => m.role === 'user').length === 0
    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    if (currentUserId) {
      await supabase.from('trip_conversations').insert({
        trip_id: tripId,
        user_id: currentUserId,
        role: 'user',
        content: trimmed,
      })
    }

    if (isFirstUserMessage) {
      setSending(false)
      inputRef.current?.focus()
      return
    }

    try {
      const res = await fetch('/api/plan-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          messages: messages.map(m => ({
            role: m.role === 'avanti' ? 'assistant' : 'user',
            content: m.text,
          })),
          userMessage: trimmed,
        }),
      })
      const data = await res.json()
      const assistantMessage = data.text || 'Something went wrong — try again.'
      const cards = data.cards || null
      const avantiMsg: Message = {
        id: `avanti-${Date.now()}`,
        role: 'avanti',
        text: assistantMessage,
        cards: cards || undefined,
      }
      setMessages(prev => [...prev, avantiMsg])
      if (currentUserId) {
        await supabase.from('trip_conversations').insert({
          trip_id: tripId,
          user_id: currentUserId,
          role: 'assistant',
          content: assistantMessage,
          cards: cards || null,
        })
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'avanti', text: 'Connection issue — please try again.' },
      ])
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const sendToGroupVote = async (selectedOptions: any[]) => {
    setSendingToGroup(true)
    try {
      const { data: existingVote } = await supabase
        .from('group_votes')
        .select('*')
        .eq('trip_id', tripId)
        .eq('status', 'open')
        .maybeSingle()

      if (existingVote) {
        const combined = [...(existingVote.options || []), ...selectedOptions]
        await supabase.from('group_votes').update({ options: combined }).eq('id', existingVote.id)
        setCreatedVoteId(existingVote.id)
      } else {
        const res = await fetch('/api/send-to-vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId, options: selectedOptions, voteType: 'Destination', deadlineDays: 2 })
        })
        const data = await res.json()
        if (data.vote) setCreatedVoteId(data.vote.id)
      }
      setShowVoteConfirm(true)
    } catch (e) {
      console.error('Send to vote error:', e)
    }
    setSendingToGroup(false)
  }

  const canSubmitFollowUp = () => {
    if (departureCities.length === 0) return false
    if (dateMode === 'exact') return Boolean(departureDate && returnDate)
    if (dateMode === 'range') return Boolean(earliestDeparture && latestReturn)
    return false
  }

  const handleFollowUpSubmit = () => {
    if (!canSubmitFollowUp() || sending) return
    let datesPart = ''
    if (dateMode === 'exact') {
      datesPart = `Exact dates — departure ${departureDate}, return ${returnDate}`
    } else if (dateMode === 'range') {
      datesPart = `Date range — earliest departure ${earliestDeparture}, latest return ${latestReturn} (find cheapest days within window)`
    }
    const text = `Departure cities: ${departureCities.join(', ')}. Travel dates: ${datesPart}`
    setFollowUpSubmitted(true)
    sendMessage(text)
  }

  const noteStyle = { fontSize: '11px', color: '#9a9a8a', margin: '8px 0 0', lineHeight: 1.55, fontStyle: 'italic' as const }

  if (!trip) return null

  return (
    <div style={{ flex: 1, minHeight: '100%', background: '#fafaf8', display: 'flex', flexDirection: 'column', ...s }}>
      {/* Top bar */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '0.5px solid #e4e4d8',
        background: '#fafaf8',
      }}>
        <AvantiLogo size="sm" />
        <div style={{ flex: 1, textAlign: 'center', padding: '0 16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 400, color: '#1a1a1a', margin: 0, letterSpacing: '0.02em' }}>{trip.name}</p>
        </div>
        <button
          onClick={() => router.push(`/trips/${tripId}`)}
          style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', ...s }}>
          ← Trip
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, position: 'relative', minHeight: 0 }}>
        {showMemberConvos && (
          <div style={{ width: '260px', borderRight: '0.5px solid #e4e4d8', background: '#fafaf8', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            {!showConvosPanel ? (
              <div style={{ padding: '20px 16px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 14px' }}>Group conversations</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {travelers.filter(t => t.user_id !== currentUserId).map(traveler => (
                    <button
                      key={traveler.id}
                      onClick={() => loadTravelerConvo(traveler)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '0.5px solid #e4e4d8', background: '#fff', cursor: 'pointer', borderRadius: '10px', textAlign: 'left', fontFamily: 'var(--font-cormorant), Georgia, serif', transition: 'border-color 0.2s' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#182D09', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#fff', flexShrink: 0 }}>
                        {traveler.nickname?.charAt(0).toUpperCase() || traveler.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', color: '#1a1a1a', margin: '0 0 2px' }}>{traveler.nickname || traveler.full_name?.split(' ')[0]}</p>
                        <p style={{ fontSize: '10px', color: '#9a9a8a', margin: 0 }}>View conversation →</p>
                      </div>
                    </button>
                  ))}
                  {travelers.filter(t => t.user_id !== currentUserId).length === 0 && (
                    <p style={{ fontSize: '12px', color: '#b4b4a8', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>No other members yet</p>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #e4e4d8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => { setShowConvosPanel(false); setViewingTraveler(null); setViewingMessages([]) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a9a8a', fontSize: '16px', padding: 0, lineHeight: 1 }}>
                    ←
                  </button>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#182D09', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff', flexShrink: 0 }}>
                    {viewingTraveler?.nickname?.charAt(0).toUpperCase() || viewingTraveler?.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <p style={{ fontSize: '13px', color: '#1a1a1a', margin: 0, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                    {viewingTraveler?.nickname || viewingTraveler?.full_name?.split(' ')[0]}
                  </p>
                  <p style={{ fontSize: '10px', color: '#9a9a8a', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Read only</p>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {loadingConvo && (
                    <p style={{ fontSize: '12px', color: '#9a9a8a', textAlign: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Loading...</p>
                  )}
                  {!loadingConvo && viewingMessages.length === 0 && (
                    <p style={{ fontSize: '12px', color: '#b4b4a8', textAlign: 'center', fontStyle: 'italic', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>No messages yet</p>
                  )}
                  {viewingMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '6px', alignItems: 'flex-start' }}>
                      {msg.role === 'assistant' && (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#182D09', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                          <span style={{ fontSize: '8px', color: '#fff' }}>A</span>
                        </div>
                      )}
                      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '12px 0 12px 12px' : '0 12px 12px 12px', background: msg.role === 'user' ? '#182D09' : '#fff', border: msg.role === 'assistant' ? '0.5px solid #e4e4d8' : 'none' }}>
                        <p style={{ fontSize: '11px', color: msg.role === 'user' ? '#fff' : '#1a1a1a', margin: 0, lineHeight: 1.5, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      {/* Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: addedCards.length ? '160px' : '24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {messages.map(msg => (
            <div key={msg.id}>
              {msg.role === 'avanti' ? (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: '#182D09',
                    flexShrink: 0, marginTop: '2px',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {msg.text && (
                      <p style={{ fontSize: '15px', color: '#1a1a1a', margin: '0 0 12px', lineHeight: 1.65, fontWeight: 400 }}>
                        {msg.text}
                      </p>
                    )}
                    {msg.cards && msg.cards.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {msg.cards.map(card => {
                          const option = card
                          const key = cardKey(card)
                          const added = isAdded(card)
                          const isExpanded = expandedCard === key
                          return (
                            <div key={key} style={{
                              background: '#ffffff',
                              border: '0.5px solid #d4d4c8',
                              borderRadius: '12px',
                              overflow: 'hidden',
                            }}>
                              <div style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '12px' }}>
                                  <h3 style={{ fontSize: '20px', fontWeight: 400, color: '#182D09', margin: 0, letterSpacing: '-0.3px' }}>{card.title}</h3>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontSize: '18px', fontWeight: 400, color: '#182D09', margin: 0 }}>${card.price?.toLocaleString()}</p>
                                    <p style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a8a', margin: '2px 0 0' }}>${card.priceRange} est.</p>
                                  </div>
                                </div>
                                <p style={{ fontSize: '13px', color: '#6a6a6a', margin: '0 0 14px', lineHeight: 1.5, fontStyle: 'italic' }}>{card.tagline}</p>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
                                  {(card.bullets || []).map((b, i) => (
                                    <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
                                      <span style={{
                                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginTop: '7px',
                                        background: b.type === 'warning' ? '#ba7517' : '#2d5a18',
                                      }} />
                                      <span style={{ fontSize: '13px', color: '#3a3a3a', lineHeight: 1.5 }}>{b.text}</span>
                                    </li>
                                  ))}
                                </ul>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => setExpandedCard(isExpanded ? null : key)}
                                    style={{
                                      flex: 1, padding: '10px', fontSize: '10px', letterSpacing: '0.15em',
                                      textTransform: 'uppercase', color: '#182D09', background: 'transparent',
                                      border: '0.5px solid #d4d4c8', borderRadius: '6px', cursor: 'pointer', ...s,
                                    }}>
                                    {isExpanded ? 'Hide details' : 'Details'}
                                  </button>
                                  <button
                                    onClick={() => toggleAddCard(card)}
                                    style={{
                                      flex: 1.4, padding: '10px', fontSize: '10px', letterSpacing: '0.15em',
                                      textTransform: 'uppercase', borderRadius: '6px', cursor: 'pointer',
                                      border: '3px solid #182D09',
                                      background: added ? '#182D09' : '#ffffff',
                                      color: added ? '#ffffff' : '#182D09',
                                      ...s,
                                    }}>
                                    {added ? '✓ Added to vote' : 'Add to group vote'}
                                  </button>
                                </div>
                              </div>
                              {isExpanded && option.details && (
                                <div style={{ borderTop: '0.5px solid #f0f0e8', padding: '16px', background: '#fafaf8', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                  {option.details?.avanti_take && (
                                    <div style={{ padding: '12px 14px', background: '#e8f5ee', borderRadius: '8px' }}>
                                      <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2d6a4f', margin: '0 0 6px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Why Avanti picks this for your group</p>
                                      <p style={{ fontSize: '12px', color: '#0a3a1e', margin: 0, lineHeight: 1.7, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{option.details.avanti_take}</p>
                                    </div>
                                  )}

                                  {((option.details?.pros?.length ?? 0) > 0 || (option.details?.cons?.length ?? 0) > 0) && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                      {(option.details?.pros?.length ?? 0) > 0 && (
                                        <div>
                                          <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2d6a4f', margin: '0 0 8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Pros</p>
                                          {(option.details?.pros ?? []).map((pro, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px' }}>
                                              <span style={{ color: '#2d6a4f', fontSize: '10px', marginTop: '3px', flexShrink: 0 }}>✓</span>
                                              <p style={{ fontSize: '12px', color: '#3a3a3a', margin: 0, lineHeight: 1.5, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{pro}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {(option.details?.cons?.length ?? 0) > 0 && (
                                        <div>
                                          <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#854f0b', margin: '0 0 8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Watch out</p>
                                          {(option.details?.cons ?? []).map((con, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px' }}>
                                              <span style={{ color: '#854f0b', fontSize: '10px', marginTop: '3px', flexShrink: 0 }}>⚠</span>
                                              <p style={{ fontSize: '12px', color: '#854f0b', margin: 0, lineHeight: 1.5, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{con}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {(option.details?.things_to_do?.length ?? 0) > 0 && (
                                    <div>
                                      <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Top things to do</p>
                                      {(option.details?.things_to_do ?? []).map((item, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f0f0e8' }}>
                                          <p style={{ fontSize: '12px', color: '#1a1a1a', margin: 0, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{item.activity}</p>
                                          <p style={{ fontSize: '11px', color: '#9a9a8a', margin: 0, flexShrink: 0, marginLeft: '12px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{item.cost}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {option.details?.food && (
                                    <div>
                                      <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Food & drink</p>
                                      <p style={{ fontSize: '12px', color: '#3a3a3a', margin: 0, lineHeight: 1.7, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{option.details.food}</p>
                                    </div>
                                  )}

                                  {option.details?.weather && (
                                    <div>
                                      <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Weather</p>
                                      <p style={{ fontSize: '12px', color: '#3a3a3a', margin: 0, lineHeight: 1.7, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{option.details.weather}</p>
                                    </div>
                                  )}

                                  {option.details?.getting_there && (
                                    <div>
                                      <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Getting there</p>
                                      <p style={{ fontSize: '12px', color: '#3a3a3a', margin: 0, lineHeight: 1.7, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{option.details.getting_there}</p>
                                    </div>
                                  )}

                                  {(option.details?.tiktok_searches?.length ?? 0) > 0 && (
                                    <div>
                                      <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>See it for yourself</p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {(option.details?.tiktok_searches ?? []).map((term, i) => (
                                          <a key={i} href={`https://www.tiktok.com/search?q=${encodeURIComponent(term)}`} target="_blank" rel="noopener noreferrer"
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '8px', textDecoration: 'none' }}>
                                            <span style={{ fontSize: '14px' }}>🎵</span>
                                            <p style={{ fontSize: '12px', color: '#1a1a1a', margin: 0, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{term}</p>
                                            <span style={{ fontSize: '10px', color: '#9a9a8a', marginLeft: 'auto' }}>Search TikTok →</span>
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {option.bottomLine && (
                                    <div style={{ padding: '12px 14px', background: '#1a3a2a', borderRadius: '8px' }}>
                                      <p style={{ fontSize: '12px', color: '#ffffff', margin: 0, lineHeight: 1.7, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{option.bottomLine}</p>
                                    </div>
                                  )}

                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    maxWidth: '85%', background: '#182D09', color: '#ffffff',
                    padding: '12px 16px', borderRadius: '16px 16px 4px 16px',
                    fontSize: '15px', lineHeight: 1.55,
                  }}>
                    {msg.text}
                  </div>
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#182D09', flexShrink: 0 }} />
              <p style={{ fontSize: '14px', color: '#9a9a8a', margin: '6px 0 0', fontStyle: 'italic' }}>Avanti is thinking...</p>
            </div>
          )}

          {showFollowUpCard && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#182D09', flexShrink: 0, marginTop: '2px' }} />
              <div style={{
                flex: 1, background: '#ffffff', border: '0.5px solid #d4d4c8',
                borderRadius: '12px', padding: '20px',
              }}>
                <p style={{ fontSize: '15px', color: '#1a1a1a', margin: '0 0 18px', lineHeight: 1.5 }}>
                  Two quick things before I start looking:
                </p>

                <div style={{ marginBottom: '18px' }}>
                  <label style={labelStyle}>Departure cities</label>
                  <PlacesAutocomplete
                    value={departureCityInput}
                    onChange={setDepartureCityInput}
                    onSelect={place => addDepartureCity(place.name || place.fullName)}
                    placeholder="Add a departure city..."
                  />
                  {departureCities.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                      {departureCities.map(city => (
                        <span
                          key={city}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            background: '#e8f0e4',
                            border: '0.5px solid #8aad7a',
                            borderRadius: '20px',
                            fontSize: '12px',
                            color: '#182D09',
                          }}
                        >
                          {city}
                          <button
                            type="button"
                            onClick={() => removeDepartureCity(city)}
                            style={{ background: 'none', border: 'none', color: '#6a6a6a', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Travel dates</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                    {[
                      { key: 'exact' as const, label: 'Exact dates' },
                      { key: 'range' as const, label: 'Date range' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setDateMode(opt.key)}
                        style={{
                          flex: '1 1 auto', padding: '8px 12px', fontSize: '12px',
                          border: `1px solid ${dateMode === opt.key ? '#182D09' : '#d4d4c8'}`,
                          background: dateMode === opt.key ? '#182D09' : 'transparent',
                          color: dateMode === opt.key ? '#ffffff' : '#6a6a6a',
                          borderRadius: '20px', cursor: 'pointer', ...s,
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {dateMode === 'exact' && (
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={labelStyle}>Departure</label>
                        <input type="date" style={inputStyle} value={departureDate} onChange={e => setDepartureDate(e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Return</label>
                        <input type="date" style={inputStyle} value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {dateMode === 'range' && (
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={labelStyle}>Earliest departure</label>
                        <input type="date" style={inputStyle} value={earliestDeparture} onChange={e => setEarliestDeparture(e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Latest return</label>
                        <input type="date" style={inputStyle} value={latestReturn} onChange={e => setLatestReturn(e.target.value)} />
                      </div>
                    </div>
                    <p style={noteStyle}>Avanti will find the cheapest days to fly within your window</p>
                  </div>
                )}

                <button
                  onClick={handleFollowUpSubmit}
                  disabled={!canSubmitFollowUp() || sending}
                  style={{
                    width: '100%', padding: '14px', background: '#182D09', color: '#ffffff',
                    border: 'none', borderRadius: '8px', fontSize: '11px', letterSpacing: '0.15em',
                    textTransform: 'uppercase', cursor: canSubmitFollowUp() && !sending ? 'pointer' : 'default',
                    opacity: canSubmitFollowUp() && !sending ? 1 : 0.4, ...s,
                  }}>
                  Let&apos;s go →
                </button>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Vote tray */}
      {addedCards.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '88px', left: 0, right: 0,
          background: '#ffffff', borderTop: '0.5px solid #e4e4d8',
          padding: '12px 24px', zIndex: 20,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        }}>
          <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: '8px' }}>
              {addedCards.map(card => (
                <span key={card.title} style={{
                  flexShrink: 0, padding: '6px 12px', background: '#e8f0e4', border: '0.5px solid #8aad7a',
                  borderRadius: '20px', fontSize: '12px', color: '#182D09',
                }}>
                  {card.title}
                </span>
              ))}
            </div>
            <button
              onClick={() => sendToGroupVote(addedCards)}
              disabled={sendingToGroup}
              style={{
                flexShrink: 0, padding: '10px 18px', background: '#182D09', color: '#ffffff',
                border: 'none', borderRadius: '6px', fontSize: '10px', letterSpacing: '0.15em',
                textTransform: 'uppercase', cursor: 'pointer', opacity: sendingToGroup ? 0.6 : 1, ...s,
              }}>
              {sendingToGroup ? 'Sending...' : 'Send to group →'}
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{
        flexShrink: 0, padding: '12px 24px 24px', borderTop: '0.5px solid #e4e4d8',
        background: '#fafaf8',
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="Type"
            rows={1}
            style={{
              flex: 1, resize: 'none', border: '0.5px solid #d4d4c8', borderRadius: '10px',
              padding: '12px 14px', fontSize: '15px', color: '#1a1a1a', background: '#ffffff',
              outline: 'none', lineHeight: 1.5, maxHeight: '120px', ...s,
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            style={{
              padding: '12px 20px', background: '#182D09', color: '#ffffff', border: 'none',
              borderRadius: '10px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
              cursor: input.trim() && !sending ? 'pointer' : 'default',
              opacity: input.trim() && !sending ? 1 : 0.4, flexShrink: 0, ...s,
            }}>
            Send
          </button>
        </div>
      </div>
        </div>
      </div>
      {showVoteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: '#fafaf8', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>✓</div>
            <h3 style={{ fontSize: '22px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Sent to the group</h3>
            <p style={{ fontSize: '13px', color: '#9a9a8a', margin: '0 0 24px', lineHeight: 1.7 }}>Your options are ready for the group to vote on. You can set the voting timeline from the trip dashboard.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => { setShowVoteConfirm(false); router.push(`/trips/${tripId}/decisions`) }}
                style={{ width: '100%', border: '1px solid #1a3a2a', background: '#1a3a2a', color: '#fff', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                Go to Decisions →
              </button>
              <button
                onClick={() => setShowVoteConfirm(false)}
                style={{ width: '100%', border: '0.5px solid #d4d4c8', background: 'transparent', color: '#9a9a8a', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                Stay here
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
