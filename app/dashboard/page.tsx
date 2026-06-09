'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../components/AvantiLogo'
import SuitcaseLoader from '../components/SuitcaseLoader'
import PlacesAutocomplete from '../components/PlacesAutocomplete'
import Footer from '../components/Footer'

const COLORS = [
  { name: 'Midnight', value: '#1a1a1a' },
  { name: 'Forest', value: '#2d4a3e' },
  { name: 'Navy', value: '#1e3a5f' },
  { name: 'Burgundy', value: '#4a1a2c' },
  { name: 'Sand', value: '#8b7355' },
  { name: 'Slate', value: '#4a5568' },
  { name: 'Terracotta', value: '#8b4513' },
  { name: 'Sage', value: '#4a5e4a' },
]

const DESTINATION_IMAGES: Record<string, string> = {
  default: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
  greece: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=80',
  mykonos: 'https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?w=800&q=80',
  paris: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80',
  italy: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&q=80',
  rome: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80',
  sicily: 'https://images.unsplash.com/photo-1523365154888-8a758819b722?w=800&q=80',
  tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
  barcelona: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&q=80',
  london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80',
  croatia: 'https://images.unsplash.com/photo-1555990538-c88f6e05c059?w=800&q=80',
  florence: 'https://images.unsplash.com/photo-1538935732373-f7a495fea3f6?w=800&q=80',
  amalfi: 'https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=800&q=80',
}

function getTripImage(destination: string, coverImage?: string) {
  if (coverImage) return coverImage
  const d = destination.toLowerCase()
  for (const key of Object.keys(DESTINATION_IMAGES)) {
    if (d.includes(key)) return DESTINATION_IMAGES[key]
  }
  return DESTINATION_IMAGES.default
}

function getTripColor(index: number): string {
  const greens = [
    '#182D09',
    '#2d4a3e',
    '#1e4a2a',
    '#3a4a1e',
    '#2a4a1a',
    '#1a4a38',
    '#384a1a',
    '#1a3a34',
  ]
  return greens[index % greens.length]
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [trips, setTrips] = useState<any[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [tripOrder, setTripOrder] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [showNameHelper, setShowNameHelper] = useState(false)
  const [nameHelperInput, setNameHelperInput] = useState('')
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])
  const [loadingNames, setLoadingNames] = useState(false)
  const defaultForm = {
    name: '',
    date_type: 'exact',
    start_date: '',
    end_date: '',
    date_range_start: '',
    date_range_end: '',
    date_flexibility_nights: 5,
    destination_type: 'single',
    destination: '',
    destinations: [] as string[],
    destination_input: '',
    destination_place: null as any,
    destinations_places: [] as any[],
    cover_color: '#1a1a1a',
    cover_image: '',
  }
  const [form, setForm] = useState(defaultForm)
  const [destinationMode, setDestinationMode] = useState<'know' | 'deciding' | null>(null)

  const resetModalState = () => {
    setDestinationMode(null)
    setShowErrors(false)
  }

  const closeModal = () => {
    setShowModal(false)
    resetModalState()
  }

  const setFormAndDraft = (updater: typeof defaultForm | ((f: typeof defaultForm) => typeof defaultForm)) => {
    setForm(f => {
      const updated = typeof updater === 'function' ? updater(f) : updater
      localStorage.setItem('avanti_new_trip_draft', JSON.stringify(updated))
      return updated
    })
  }

  useEffect(() => {
    if (showModal) {
      const draft = localStorage.getItem('avanti_new_trip_draft')
      if (draft) {
        try {
          setForm({ ...defaultForm, ...JSON.parse(draft) })
        } catch {}
      }
    }
  }, [showModal])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: prof } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
      if (!prof?.profile_complete) { router.push('/profile'); return }
      setProfile(prof)

      const { data: organizerTrips } = await supabase
        .from('trips')
        .select('*')
        .eq('organizer_id', user.id)

      const { data: memberTravelers } = await supabase
        .from('travelers')
        .select('trip_id')
        .eq('user_id', user.id)
        .eq('status', 'approved')

      const memberTripIds = memberTravelers?.map(t => t.trip_id) || []

      let memberTrips: any[] = []
      if (memberTripIds.length > 0) {
        const { data } = await supabase
          .from('trips')
          .select('*')
          .in('id', memberTripIds)
        memberTrips = data || []
      }

      const allTrips = [...(organizerTrips || []), ...memberTrips]
      allTrips.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const uniqueTrips = allTrips.filter((trip, index, self) =>
        index === self.findIndex(t => t.id === trip.id)
      )
      setTrips(uniqueTrips)
      setTripOrder(uniqueTrips.map((t: any) => t.id))
      setLoading(false)
    }
    load()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const canCreate = () => {
    if (!form.name.trim()) return false
    if (form.date_type === 'exact' && (!form.start_date || !form.end_date)) return false
    if (form.date_type === 'range' && (!form.date_range_start || !form.date_range_end)) return false
    if (!destinationMode) return false
    if (destinationMode === 'know' && !form.destination.trim()) return false
    return true
  }

  const getNameSuggestions = async () => {
    if (!nameHelperInput.trim()) return
    setLoadingNames(true)
    try {
      const res = await fetch('/api/suggest-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: nameHelperInput })
      })
      const { names } = await res.json()
      setNameSuggestions(names)
    } catch (e) {}
    setLoadingNames(false)
  }

  const handleCreate = async () => {
    if (!canCreate()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const tripData: any = {
      name: form.name,
      destination: destinationMode === 'know' ? form.destination : 'TBD',
      destination_type: destinationMode === 'know' ? 'decided' : 'flexible',
      destinations: [],
      date_type: form.date_type,
      cover_color: form.cover_color,
      cover_image: form.cover_image || null,
      organizer_id: user.id,
      status: 'planning',
    }

    if (form.date_type === 'exact') {
      tripData.start_date = form.start_date
      tripData.end_date = form.end_date
      tripData.dates_locked = true
    } else {
      tripData.date_range_start = form.date_range_start
      tripData.date_range_end = form.date_range_end
      tripData.date_flexibility_nights = form.date_flexibility_nights
      tripData.dates_locked = false
    }

    const { data: trip, error } = await supabase.from('trips').insert(tripData).select().single()
    if (error || !trip) { setCreating(false); alert('Error: ' + error?.message); return }

    await supabase.from('travelers').insert({
      trip_id: trip.id,
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      nickname: profile?.full_name?.split(' ')[0] || '',
      role: 'organizer',
      profile_complete: true,
    })

    localStorage.removeItem('avanti_new_trip_draft')
    closeModal()
    router.push(`/trips/${trip.id}`)
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '14px', color: '#1a1a1a', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#9a9a8a', display: 'block', marginBottom: '6px' }

  if (loading) return <SuitcaseLoader message="Welcome back" />

  const orderedTrips = tripOrder.map((id: string) => trips.find((t: any) => t.id === id)).filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: '#fafaf8', ...s }}>
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ flex: 1, padding: '48px 40px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
            <AvantiLogo size="sm" />
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#083807', ...s }}>
              {sidebarOpen ? 'Close ×' : `${firstName} ☰`}
            </button>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <p style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a8a', marginBottom: '8px' }}>{greeting}</p>
            <h1 style={{ fontSize: '48px', fontWeight: 300, color: '#083807', letterSpacing: '-0.01em', lineHeight: 1.1, margin: 0 }}>{firstName}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: 0 }}>My trips</p>
            <button onClick={() => setShowModal(true)}
              style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d5a18', background: 'none', border: '1px solid #2d5a18', padding: '8px 16px', cursor: 'pointer', ...s }}>
              + New trip
            </button>
          </div>

          {trips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontSize: '40px', margin: '0 0 16px' }}>✈️</p>
              <p style={{ fontSize: '20px', fontWeight: 300, color: '#1a1a1a', marginBottom: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>No trips yet</p>
              <p style={{ fontSize: '13px', color: '#9a9a8a', marginBottom: '24px', lineHeight: 1.7 }}>Create your first trip and Avanti handles the rest.<br/>Or ask a friend to send you an invite link.</p>
              <button onClick={() => setShowModal(true)}
                style={{ border: '1px solid #182D09', background: '#182D09', color: '#fff', padding: '14px 28px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                Create your first trip →
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {orderedTrips.map((trip: any, i: number) => (
                <div key={trip.id} onClick={() => router.push(`/trips/${trip.id}`)}
                  draggable={true}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === i) return
                    const newOrder = [...tripOrder]
                    const [moved] = newOrder.splice(dragIndex, 1)
                    newOrder.splice(i, 0, moved)
                    setTripOrder(newOrder)
                    setDragIndex(null)
                  }}
                  style={{ position: 'relative', height: '200px', cursor: 'grab', overflow: 'hidden', borderRadius: '8px', opacity: dragIndex === i ? 0.5 : 1 }}>
                  <>
                    {trip.cover_image ? (
                      <>
                        <img src={trip.cover_image} alt={trip.destination} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />
                      </>
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: getTripColor(i) }} />
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px' }}>
                      <p style={{ fontSize: '18px', fontWeight: 400, color: '#ffffff', margin: '0 0 4px', letterSpacing: '0.02em' }}>{trip.name}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{trip.destination}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>
                        {trip.start_date ? `${trip.start_date} → ${trip.end_date}` : 'Dates flexible'}
                      </p>
                    </div>
                  </>
                </div>
              ))}
            </div>
          )}
        </div>

        {sidebarOpen && (
          <div style={{ width: '320px', background: '#f0f0e8', borderLeft: '1px solid #e4e4d8', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ marginBottom: '32px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', marginBottom: '4px' }}>Signed in as</p>
              <p style={{ fontSize: '15px', color: '#1a1a1a', margin: '0 0 2px' }}>{profile?.full_name}</p>
              <p style={{ fontSize: '12px', color: '#9a9a8a', margin: 0 }}>{profile?.email}</p>
            </div>
            {[
              { label: 'My profile', path: '/profile' },
              { label: 'My travelers', path: '/profile' },
              { label: 'Wallet', path: '/wallet' },
              { label: 'Settings', path: '/settings' },
            ].map(item => (
              <button key={item.label} onClick={() => item.label === 'My travelers' ? router.push('/profile?tab=travelers') : router.push(item.path)}
                style={{ textAlign: 'left', padding: '14px 0', fontSize: '13px', letterSpacing: '0.1em', color: '#1a1a1a', background: 'none', border: 'none', borderBottom: '1px solid #e4e4d8', cursor: 'pointer', ...s }}>
                {item.label}
              </button>
            ))}
            <button onClick={handleSignOut}
              style={{ textAlign: 'left', padding: '14px 0', fontSize: '13px', letterSpacing: '0.1em', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', marginTop: '16px', ...s }}>
              Sign out
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: '#fafaf8', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '40px', position: 'relative', ...s }}>
            <button onClick={closeModal}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9a9a8a' }}>×</button>

            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', marginBottom: '8px' }}>New trip</p>
            <h2 style={{ fontSize: '28px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 32px' }}>Where are we going?</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              <div>
                <label style={labelStyle}>Trip name</label>
                <input style={inputStyle} value={form.name} onChange={e => setFormAndDraft({...form, name: e.target.value})} placeholder="Mama Mia Summer" autoFocus />
                {showErrors && !form.name.trim() && <p style={{ fontSize: '11px', color: '#c0392b', margin: '4px 0 0' }}>Please enter a trip name</p>}
                <button onClick={() => setShowNameHelper(!showNameHelper)} style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  ✦ Need help naming it?
                </button>
                {showNameHelper && (
                  <div style={{ background: '#f5f5f0', padding: '16px', marginTop: '4px' }}>
                    <p style={{ fontSize: '11px', color: '#9a9a8a', margin: '0 0 8px' }}>Describe your trip in a few words</p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input value={nameHelperInput} onChange={e => setNameHelperInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && getNameSuggestions()} placeholder="e.g. girls trip to greece in july" style={{ flex: 1, borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '13px', color: '#1a1a1a', outline: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif' }} />
                      <button onClick={getNameSuggestions} disabled={loadingNames} style={{ padding: '6px 12px', border: '1px solid #1a1a1a', background: '#1a1a1a', color: '#fafaf8', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                        {loadingNames ? '...' : 'Go'}
                      </button>
                    </div>
                    {nameSuggestions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {nameSuggestions.map((name, i) => (
                          <button key={i} onClick={() => { setFormAndDraft(f => ({...f, name})); setShowNameHelper(false); setNameSuggestions([]) }}
                            style={{ textAlign: 'left', padding: '8px 12px', border: '1px solid #d4d4c8', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#1a1a1a', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Dates</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {[{ value: 'exact', label: 'Exact dates' }, { value: 'range', label: 'Flexible range' }].map(opt => (
                    <button key={opt.value} onClick={() => setFormAndDraft({...form, date_type: opt.value})}
                      style={{ flex: 1, padding: '8px', fontSize: '11px', letterSpacing: '0.08em', border: `1px solid ${form.date_type === opt.value ? '#1a1a1a' : '#d4d4c8'}`, background: form.date_type === opt.value ? '#1a1a1a' : 'transparent', color: form.date_type === opt.value ? '#fafaf8' : '#6a6a6a', cursor: 'pointer', ...s }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.date_type === 'exact' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '9px' }}>Start date</label>
                      <input type="date" style={inputStyle} value={form.start_date} onChange={e => setFormAndDraft({...form, start_date: e.target.value})} />
                      {showErrors && form.date_type === 'exact' && !form.start_date && <p style={{ fontSize: '11px', color: '#c0392b', margin: '4px 0 0' }}>Please select a start date</p>}
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '9px' }}>End date</label>
                      <input type="date" style={inputStyle} value={form.end_date} onChange={e => setFormAndDraft({...form, end_date: e.target.value})} />
                      {showErrors && form.date_type === 'exact' && !form.end_date && <p style={{ fontSize: '11px', color: '#c0392b', margin: '4px 0 0' }}>Please select an end date</p>}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '9px' }}>Earliest start</label>
                        <input type="date" style={inputStyle} value={form.date_range_start} onChange={e => setFormAndDraft({...form, date_range_start: e.target.value})} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '9px' }}>Latest end</label>
                        <input type="date" style={inputStyle} value={form.date_range_end} onChange={e => setFormAndDraft({...form, date_range_end: e.target.value})} />
                      </div>
                    </div>
                    {form.date_type === 'range' && (
                      <div style={{ marginTop: '12px' }}>
                        <label style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Roughly how many nights?</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={form.date_flexibility_nights || ''}
                            onChange={e => {
                              const val = parseInt(e.target.value, 10)
                              setFormAndDraft({ ...form, date_flexibility_nights: Number.isNaN(val) ? 5 : val })
                            }}
                            placeholder="7"
                            style={{ width: '70px', border: 'none', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '6px 0', fontSize: '16px', color: '#1a1a1a', outline: 'none', textAlign: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
                          />
                          <span style={{ fontSize: '12px', color: '#9a9a8a', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>nights — roughly, not set in stone</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', display: 'block', marginBottom: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Destination</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { key: 'know', label: 'I know where I\'m going' },
                    { key: 'deciding', label: 'Still deciding' }
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setDestinationMode(opt.key as 'know' | 'deciding')}
                      style={{ flex: 1, padding: '10px', border: `1.5px solid ${destinationMode === opt.key ? '#1a3a2a' : '#d4d4c8'}`, background: destinationMode === opt.key ? '#e8f5ee' : 'transparent', color: destinationMode === opt.key ? '#1a3a2a' : '#9a9a8a', fontSize: '12px', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif', transition: 'all 0.2s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {destinationMode === 'know' && (
                  <div style={{ marginTop: '10px' }}>
                    <PlacesAutocomplete
                      value={form.destination || ''}
                      onChange={val => setFormAndDraft({ ...form, destination: val })}
                      onSelect={place => setFormAndDraft({ ...form, destination: place.fullName, destination_place: place })}
                      placeholder="Where are you going?"
                    />
                  </div>
                )}
                {showErrors && !destinationMode && <p style={{ fontSize: '11px', color: '#c0392b', margin: '8px 0 0' }}>Please choose a destination option</p>}
                {showErrors && destinationMode === 'know' && !form.destination.trim() && <p style={{ fontSize: '11px', color: '#c0392b', margin: '8px 0 0' }}>Please enter a destination</p>}
              </div>

              <div>
                <label style={labelStyle}>Trip card color</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setFormAndDraft({...form, cover_color: c.value})} title={c.name}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', background: c.value, border: form.cover_color === c.value ? '3px solid #1a1a1a' : '3px solid transparent', cursor: 'pointer', outline: form.cover_color === c.value ? '2px solid #fafaf8' : 'none', outlineOffset: '-4px' }} />
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Trip cover image <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>(optional)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <label style={{ flex: 1, border: '1px solid #d4d4c8', padding: '10px 14px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6a6a6a', cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      Upload from device
                      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (ev) => setFormAndDraft(f => ({...f, cover_image: ev.target?.result as string}))
                        reader.readAsDataURL(file)
                      }} />
                    </label>
                    <label style={{ flex: 1, border: '1px solid #d4d4c8', padding: '10px 14px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6a6a6a', cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      Take photo
                      <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (ev) => setFormAndDraft(f => ({...f, cover_image: ev.target?.result as string}))
                        reader.readAsDataURL(file)
                      }} />
                    </label>
                  </div>
                  <input type="url" style={inputStyle} value={form.cover_image.startsWith('data:') ? '' : form.cover_image} onChange={e => setFormAndDraft({...form, cover_image: e.target.value})} placeholder="Or paste an image URL" />
                  {form.cover_image && (
                    <div style={{ position: 'relative', height: '80px', borderRadius: '6px', overflow: 'hidden' }}>
                      <img src={form.cover_image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setFormAndDraft({...form, cover_image: ''})} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', fontSize: '12px' }}>×</button>
                    </div>
                  )}
                </div>
              </div>

              <button onClick={() => { if (!canCreate()) { setShowErrors(true); return } handleCreate() }} disabled={creating}
                style={{ width: '100%', border: '1px solid #1a1a1a', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#1a1a1a', background: 'transparent', cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.4 : 1, ...s }}>
                {creating ? 'Creating...' : 'Create trip →'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
