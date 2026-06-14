'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import SuitcaseLoader from '../../../components/SuitcaseLoader'

const PRIORITY_ITEMS = [
  { id: 'cost', label: 'Cost', description: 'How much we spend matters' },
  { id: 'adventure', label: 'Adventure', description: 'Physical activity and thrills' },
  { id: 'travel_time', label: 'Travel time', description: 'Getting there quickly' },
  { id: 'nightlife', label: 'Nightlife', description: 'Evenings out and social energy' },
  { id: 'culture', label: 'Culture & history', description: 'Art, architecture, heritage' },
  { id: 'relaxation', label: 'Relaxation', description: 'Rest, slowness, unwinding' },
  { id: 'food', label: 'Food & drink', description: 'Eating and drinking well' },
  { id: 'nature', label: 'Natural beauty', description: 'Landscapes, scenery, outdoors' },
]

const ACTIVITY_CATEGORIES = [
  {
    label: 'On your feet',
    items: [
      { id: 'hiking', label: 'Hiking & trekking' },
      { id: 'cycling', label: 'Cycling' },
      { id: 'watersports', label: 'Watersports' },
      { id: 'adrenaline', label: 'Adrenaline sports' },
    ]
  },
  {
    label: 'Culturally driven',
    items: [
      { id: 'history', label: 'History & ruins' },
      { id: 'art', label: 'Art & architecture' },
      { id: 'markets', label: 'Food & markets' },
      { id: 'festivals', label: 'Local festivals & nightlife' },
    ]
  },
  {
    label: 'Slow & sensory',
    items: [
      { id: 'wine', label: 'Wine & spirits' },
      { id: 'wellness', label: 'Spas & wellness' },
      { id: 'cooking', label: 'Cooking classes' },
      { id: 'wandering', label: 'Wandering & exploring' },
    ]
  },
  {
    label: 'Nature without exertion',
    items: [
      { id: 'wildlife', label: 'Wildlife & safari' },
      { id: 'scenic', label: 'Scenic drives & boat trips' },
      { id: 'beaches', label: 'Beaches & swimming' },
      { id: 'photography', label: 'Photography & sightseeing' },
    ]
  },
]

type ActivityState = 'neutral' | 'yes' | 'skip'
type DragItem = { id: string; label: string; description: string }

export default function TripPreferences() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trip, setTrip] = useState<any>(null)
  const [section, setSection] = useState(0)

  const [priorities, setPriorities] = useState<DragItem[]>(PRIORITY_ITEMS)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const [dayStructure, setDayStructure] = useState<string>('')
  const [groupTime, setGroupTime] = useState<number>(2)
  const [activities, setActivities] = useState<Record<string, ActivityState>>(() => {
    const init: Record<string, ActivityState> = {}
    ACTIVITY_CATEGORIES.forEach(cat => cat.items.forEach(item => { init[item.id] = 'neutral' }))
    return init
  })

  const [nightlifeClarifier, setNightlifeClarifier] = useState('')
  const [adventureClarifier, setAdventureClarifier] = useState('')
  const [anchorRequest, setAnchorRequest] = useState('')
  const [flags, setFlags] = useState({
    accessibility: '',
    dietary: '',
    safety: '',
    medical: '',
    other: '',
  })

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }

  const nightlifeSelected = activities['festivals'] === 'yes'
  const adventureSelected = activities['hiking'] === 'yes' || activities['adrenaline'] === 'yes' || activities['watersports'] === 'yes'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) setTrip(tripData)

      const { data: profile } = await supabase.from('user_profiles').select('email').eq('user_id', user.id).single()
      const { data: traveler } = await supabase.from('travelers').select('*').eq('trip_id', tripId).eq('email', profile?.email || '').single()
      if (traveler?.preferences) {
        const p = traveler.preferences
        if (p.priorities) setPriorities(p.priorities)
        if (p.day_structure) setDayStructure(p.day_structure)
        if (p.group_time !== undefined) setGroupTime(p.group_time)
        if (p.activities) setActivities(p.activities)
        if (p.nightlife_clarifier) setNightlifeClarifier(p.nightlife_clarifier)
        if (p.adventure_clarifier) setAdventureClarifier(p.adventure_clarifier)
        if (p.anchor_request) setAnchorRequest(p.anchor_request)
        if (p.flags) setFlags(p.flags)
      }
      setLoading(false)
    }
    load()
  }, [tripId, router])

  const handleDragStart = (index: number) => {
    dragItem.current = index
    setDragging(priorities[index].id)
  }
  const handleDragEnter = (index: number) => {
    dragOverItem.current = index
    setDragOver(priorities[index].id)
  }
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return
    const newList = [...priorities]
    const dragged = newList.splice(dragItem.current, 1)[0]
    newList.splice(dragOverItem.current, 0, dragged)
    setPriorities(newList)
    dragItem.current = null
    dragOverItem.current = null
    setDragging(null)
    setDragOver(null)
  }

  const cycleActivity = (id: string) => {
    setActivities(prev => {
      const current = prev[id]
      const next: ActivityState = current === 'neutral' ? 'yes' : current === 'yes' ? 'skip' : 'neutral'
      return { ...prev, [id]: next }
    })
  }

  const getActivityStyle = (state: ActivityState) => {
    if (state === 'yes') return { background: 'var(--accent-light)', border: '1px solid var(--forest)', color: 'var(--forest-deep)' }
    if (state === 'skip') return { background: '#fef0f0', border: '1px solid #ffb4b4', color: '#9a3a3a' }
    return { background: '#fff', border: '0.5px solid var(--border)', color: 'var(--muted-foreground)' }
  }

  const getActivityIcon = (state: ActivityState) => {
    if (state === 'yes') return '✓'
    if (state === 'skip') return '✕'
    return ''
  }

  const groupTimeLabels = [
    'Together for everything',
    'Shared anchors, free time between',
    'Base camp — share mornings & evenings',
    'Total independence',
  ]

  const save = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('user_profiles').select('email').eq('user_id', user.id).single()
      const preferences = {
        priorities,
        day_structure: dayStructure,
        group_time: groupTime,
        activities,
        nightlife_clarifier: nightlifeSelected ? nightlifeClarifier : '',
        adventure_clarifier: adventureSelected ? adventureClarifier : '',
        anchor_request: anchorRequest,
        flags,
        completed_at: new Date().toISOString(),
      }
      await supabase.from('travelers')
        .update({ preferences, profile_complete: true })
        .eq('trip_id', tripId)
        .eq('email', profile?.email || '')
      setSaved(true)
      setTimeout(() => router.push(`/trips/${tripId}`), 1200)
    } catch (e: unknown) {
      alert('Failed to save: ' + (e instanceof Error ? e.message : 'Unknown error'))
    }
    setSaving(false)
  }

  if (loading) return <SuitcaseLoader message="Loading your preferences" />

  const sections = [
    'Priorities',
    'Your days',
    'Group time',
    'Activities',
    'Final touches',
  ]

  return (
    <main style={{ minHeight: '100vh', background: 'var(--cream)', ...s }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.push(`/trips/${tripId}`)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← Back</button>
        </div>

        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Step 2</p>
        <h1 style={{ fontSize: '36px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 6px' }}>{trip?.name}</h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', margin: '0 0 32px', lineHeight: 1.6 }}>Tell us what matters to you. This shapes the whole trip.</p>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '40px' }}>
          {sections.map((sec, i) => (
            <button key={i} onClick={() => setSection(i)} style={{ flex: 1, height: '3px', background: i <= section ? 'var(--forest-deep)' : 'var(--border)', border: 'none', cursor: 'pointer', borderRadius: '2px', transition: 'background 0.2s' }} />
          ))}
        </div>

        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>{section + 1} of {sections.length}</p>
        <h2 style={{ fontSize: '28px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 28px' }}>{sections[section]}</h2>

        {section === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 8px', lineHeight: 1.6 }}>Drag to rank what matters most for this trip. #1 is your top priority.</p>
            {priorities.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px 18px',
                  background: dragging === item.id ? '#f0f5f0' : dragOver === item.id ? 'var(--accent-light)' : '#fff',
                  border: `0.5px solid ${dragOver === item.id ? 'var(--forest)' : 'var(--border)'}`,
                  borderRadius: '12px', cursor: 'grab',
                  opacity: dragging === item.id ? 0.5 : 1,
                  transition: 'all 0.1s',
                  userSelect: 'none',
                }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: index < 3 ? 'var(--forest-deep)' : '#f5f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: index < 3 ? '#fff' : 'var(--muted-foreground)', fontSize: '13px', fontWeight: 500, flexShrink: 0 }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', color: 'var(--foreground)', margin: '0 0 2px', fontWeight: 400, ...s }}>{item.label}</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>{item.description}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </div>
            ))}
          </div>
        )}

        {section === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 8px', lineHeight: 1.6 }}>How do you want your days to feel on this trip?</p>
            {[
              { value: 'packed', label: 'Packed', desc: 'Something planned every day — I want to make the most of every hour' },
              { value: 'balanced', label: 'Balanced', desc: 'Mix of activity and downtime, roughly half and half' },
              { value: 'relaxed', label: 'Relaxed', desc: 'Happy doing one thing and then nothing — I\'m here to recharge' },
              { value: 'flexible', label: 'Flexible', desc: 'I\'ll decide when I\'m there — don\'t over-plan for me' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setDayStructure(opt.value)} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '18px 20px', background: dayStructure === opt.value ? 'var(--accent-light)' : '#fff', border: `1px solid ${dayStructure === opt.value ? 'var(--forest)' : 'var(--border)'}`, borderRadius: '12px', cursor: 'pointer', textAlign: 'left', ...s }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${dayStructure === opt.value ? 'var(--forest)' : 'var(--border)'}`, background: dayStructure === opt.value ? 'var(--forest)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  {dayStructure === opt.value && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div>
                  <p style={{ fontSize: '15px', color: 'var(--foreground)', margin: '0 0 4px', fontWeight: 400, ...s }}>{opt.label}</p>
                  <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {section === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 8px', lineHeight: 1.6 }}>How do you picture the group dynamic on this trip?</p>
            <div style={{ padding: '8px 0' }}>
              <input
                type="range" min={0} max={3} step={1} value={groupTime}
                onChange={e => setGroupTime(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--forest-deep)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>Together</span>
                <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>Independent</span>
              </div>
            </div>
            <div style={{ background: 'var(--accent-light)', border: '0.5px solid #a8d4b8', borderRadius: '12px', padding: '20px' }}>
              <p style={{ fontSize: '16px', color: 'var(--forest-deep)', margin: '0 0 6px', ...s }}>{groupTimeLabels[groupTime]}</p>
              <p style={{ fontSize: '12px', color: 'var(--forest)', margin: 0, lineHeight: 1.6 }}>
                {groupTime === 0 && 'We move as one — same activities, same meals, always together.'}
                {groupTime === 1 && 'We share the anchors — meals, key experiences — and split off in between.'}
                {groupTime === 2 && 'We share a home base and meet for mornings and evenings. Days are your own.'}
                {groupTime === 3 && 'We\'re traveling together in name — I\'ll find my own rhythm and check in when it feels right.'}
              </p>
            </div>
          </div>
        )}

        {section === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 4px', lineHeight: 1.6 }}>
              Tap once to mark something you want. Tap again to say you&apos;d rather skip it. Leave it blank if you&apos;re indifferent.
            </p>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--muted-foreground)', margin: '0 0 8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--accent-light)', border: '1px solid var(--forest)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'var(--forest-deep)' }}>✓</span> Want it</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#fef0f0', border: '1px solid #ffb4b4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#9a3a3a' }}>✕</span> Skip it</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#fff', border: '0.5px solid var(--border)', display: 'inline-flex' }}></span> Either way</span>
            </div>
            {ACTIVITY_CATEGORIES.map(cat => (
              <div key={cat.label}>
                <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 10px' }}>{cat.label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {cat.items.map(item => {
                    const state = activities[item.id]
                    const style = getActivityStyle(state)
                    return (
                      <button
                        key={item.id}
                        onClick={() => cycleActivity(item.id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', ...style, ...s }}
                      >
                        <span style={{ fontSize: '13px' }}>{item.label}</span>
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, background: state === 'yes' ? 'var(--forest)' : state === 'skip' ? '#ffb4b4' : '#f5f5f0', color: state === 'yes' ? '#fff' : state === 'skip' ? '#9a3a3a' : 'var(--border)', flexShrink: 0 }}>
                          {getActivityIcon(state)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {nightlifeSelected && (
              <div style={{ background: '#f5f5f0', borderRadius: '12px', padding: '20px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>What does a great night out look like?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { value: 'going_hard', label: 'Going hard', desc: 'Clubs, bar crawls, late nights — the night is the point' },
                    { value: 'drinks_vibes', label: 'Drinks and good vibes', desc: 'Sunset cocktails, rooftop bars, dinner with wine' },
                    { value: 'cultural', label: 'Cultural nights', desc: 'Night markets, live music, evening experiences' },
                    { value: 'mix', label: 'Mix of all three', desc: 'Some nights one way, some nights another' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setNightlifeClarifier(opt.value)} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', background: nightlifeClarifier === opt.value ? 'var(--accent-light)' : '#fff', border: `1px solid ${nightlifeClarifier === opt.value ? 'var(--forest)' : 'var(--border)'}`, borderRadius: '10px', cursor: 'pointer', textAlign: 'left', ...s }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${nightlifeClarifier === opt.value ? 'var(--forest)' : 'var(--border)'}`, background: nightlifeClarifier === opt.value ? 'var(--forest)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        {nightlifeClarifier === opt.value && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff' }} />}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--foreground)', margin: '0 0 2px', ...s }}>{opt.label}</p>
                        <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {adventureSelected && (
              <div style={{ background: '#f5f5f0', borderRadius: '12px', padding: '20px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>What kind of adventure?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { value: 'water', label: 'Water-based', desc: 'Surfing, diving, kayaking, sailing' },
                    { value: 'hiking', label: 'Hiking & trekking', desc: 'Trails, mountains, long walks in beautiful places' },
                    { value: 'adrenaline', label: 'Adrenaline', desc: 'Zip-lining, cliff jumping, skydiving, motorsports' },
                    { value: 'whatever', label: 'Whatever\'s available', desc: 'I\'m up for anything — surprise me' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setAdventureClarifier(opt.value)} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', background: adventureClarifier === opt.value ? 'var(--accent-light)' : '#fff', border: `1px solid ${adventureClarifier === opt.value ? 'var(--forest)' : 'var(--border)'}`, borderRadius: '10px', cursor: 'pointer', textAlign: 'left', ...s }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${adventureClarifier === opt.value ? 'var(--forest)' : 'var(--border)'}`, background: adventureClarifier === opt.value ? 'var(--forest)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        {adventureClarifier === opt.value && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff' }} />}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--foreground)', margin: '0 0 2px', ...s }}>{opt.label}</p>
                        <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {section === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div>
              <label style={labelStyle}>One thing you&apos;d love this trip to include</label>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>Optional. Something specific — an experience, a type of place, something you&apos;ve always wanted to do.</p>
              <textarea
                value={anchorRequest}
                onChange={e => setAnchorRequest(e.target.value)}
                placeholder="e.g. A meal I'll be talking about for years. Somewhere I can learn to surf. A night under the stars."
                maxLength={200}
                rows={3}
                style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', resize: 'none', lineHeight: 1.6, ...s }}
              />
              <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', margin: '4px 0 0', textAlign: 'right' }}>{anchorRequest.length}/200</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>Anything the group should know about you?</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 16px', lineHeight: 1.5, fontStyle: 'italic' }}>All optional. Only shared with the AI to improve your recommendations — never shown to other travelers individually.</p>
              {[
                { key: 'accessibility', label: 'Accessibility or mobility needs', placeholder: 'e.g. Bad knee, can\'t do long stairs, wheelchair accessible required' },
                { key: 'dietary', label: 'Dietary requirements', placeholder: 'e.g. Vegan, severe nut allergy, kosher, halal' },
                { key: 'safety', label: 'Identity-based safety considerations', placeholder: 'e.g. LGBTQ+ traveler, want to avoid certain regions, safety conscious' },
                { key: 'medical', label: 'Medical needs', placeholder: 'e.g. Need access to good hospitals, traveling with medication' },
                { key: 'other', label: 'Anything else', placeholder: 'Anything the AI should factor in when planning for you' },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>{field.label}</label>
                  <input
                    style={inputStyle}
                    value={flags[field.key as keyof typeof flags]}
                    onChange={e => setFlags(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '40px' }}>
          {section > 0 && (
            <button onClick={() => setSection(s => s - 1)} style={{ flex: 1, border: '0.5px solid var(--border)', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', ...s }}>
              ← Back
            </button>
          )}
          {section < sections.length - 1 ? (
            <button onClick={() => setSection(s => s + 1)} style={{ flex: 1, border: '1px solid var(--foreground)', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--foreground)', background: 'transparent', cursor: 'pointer', ...s }}>
              Next →
            </button>
          ) : (
            <button onClick={save} disabled={saving} style={{ flex: 1, border: '1px solid var(--forest-deep)', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--cream)', background: saved ? 'var(--forest)' : 'var(--forest-deep)', cursor: 'pointer', opacity: saving ? 0.6 : 1, transition: 'background 0.3s', ...s }}>
              {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save my preferences →'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
