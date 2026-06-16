'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../components/AvantiLogo'
import SuitcaseLoader from '../components/SuitcaseLoader'
import Footer from '../components/Footer'

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
    'var(--forest-deep)',
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
    cover_image: '',
  }
  const [form, setForm] = useState(defaultForm)
  const [tripType, setTripType] = useState('')
  const [isEventCentered, setIsEventCentered] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventLocation, setEventLocation] = useState('')

  const resetModalState = () => {
    setShowErrors(false)
    setTripType('')
    setIsEventCentered(false)
    setEventName('')
    setEventDate('')
    setEventLocation('')
  }

  const closeModal = () => {
    setShowModal(false)
    setForm(defaultForm)
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
    return form.name.trim().length > 0 && tripType.length > 0
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
      trip_type: tripType,
      is_event_centered: isEventCentered,
      event_name: isEventCentered ? eventName : null,
      event_date: isEventCentered ? eventDate : null,
      event_location: isEventCentered ? eventLocation : null,
      cover_image: form.cover_image || null,
      organizer_id: user.id,
      status: 'planning',
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
  const inputStyle = { width: '100%', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }

  if (loading) return <SuitcaseLoader message="Welcome back" />

  const orderedTrips = tripOrder.map((id: string) => trips.find((t: any) => t.id === id)).filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', ...s }}>
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ flex: 1, padding: '48px 40px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
            <AvantiLogo size="sm" />
            <button onClick={() => router.push('/features')} style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Features
            </button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--forest-deep)', ...s }}>
              {sidebarOpen ? 'Close ×' : `${firstName} ☰`}
            </button>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <p style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>{greeting}</p>
            <h1 style={{ fontSize: '48px', fontWeight: 300, color: 'var(--forest-deep)', letterSpacing: '-0.01em', lineHeight: 1.1, margin: 0 }}>{firstName}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: 0 }}>My trips</p>
            <button onClick={() => setShowModal(true)}
              style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--forest)', background: 'none', border: '1px solid var(--forest)', padding: '8px 16px', cursor: 'pointer', ...s }}>
              + New trip
            </button>
          </div>

          {trips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontSize: '40px', margin: '0 0 16px' }}>✈️</p>
              <p style={{ fontSize: '20px', fontWeight: 300, color: 'var(--foreground)', marginBottom: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>No trips yet</p>
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '24px', lineHeight: 1.7 }}>Create your first trip and Avanti handles the rest.<br/>Or ask a friend to send you an invite link.</p>
              <button onClick={() => setShowModal(true)}
                style={{ border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '14px 28px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
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
          <div style={{ width: '320px', background: '#f0f0e8', borderLeft: '1px solid var(--border)', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ marginBottom: '32px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Signed in as</p>
              <p style={{ fontSize: '15px', color: 'var(--foreground)', margin: '0 0 2px' }}>{profile?.full_name}</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0 }}>{profile?.email}</p>
            </div>
            {[
              { label: 'My profile', path: '/profile' },
              { label: 'My travelers', path: '/profile' },
              { label: 'Wallet', path: '/wallet' },
              { label: 'Settings', path: '/settings' },
            ].map(item => (
              <button key={item.label} onClick={() => item.label === 'My travelers' ? router.push('/profile?tab=travelers') : router.push(item.path)}
                style={{ textAlign: 'left', padding: '14px 0', fontSize: '13px', letterSpacing: '0.1em', color: 'var(--foreground)', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', ...s }}>
                {item.label}
              </button>
            ))}
            <button onClick={handleSignOut}
              style={{ textAlign: 'left', padding: '14px 0', fontSize: '13px', letterSpacing: '0.1em', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '16px', ...s }}>
              Sign out
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '40px', position: 'relative', ...s }}>
            <button onClick={closeModal}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--muted-foreground)' }}>×</button>

            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>New trip</p>
            <h2 style={{ fontSize: '28px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 32px' }}>Create a trip</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              <div>
                <label style={labelStyle}>Trip name</label>
                <input style={inputStyle} value={form.name} onChange={e => setFormAndDraft({...form, name: e.target.value})} placeholder="Mama Mia Summer" autoFocus />
                {showErrors && !form.name.trim() && <p style={{ fontSize: '11px', color: '#c0392b', margin: '4px 0 0' }}>Please enter a trip name</p>}
                <button onClick={() => setShowNameHelper(!showNameHelper)} style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  ✦ Need help naming it?
                </button>
                {showNameHelper && (
                  <div style={{ background: '#f5f5f0', padding: '16px', marginTop: '4px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: '0 0 8px' }}>Describe your trip in a few words</p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input value={nameHelperInput} onChange={e => setNameHelperInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && getNameSuggestions()} placeholder="e.g. girls trip to greece in july" style={{ flex: 1, borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '13px', color: 'var(--foreground)', outline: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif' }} />
                      <button onClick={getNameSuggestions} disabled={loadingNames} style={{ padding: '6px 12px', border: '1px solid var(--foreground)', background: 'var(--foreground)', color: 'var(--cream)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                        {loadingNames ? '...' : 'Go'}
                      </button>
                    </div>
                    {nameSuggestions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {nameSuggestions.map((name, i) => (
                          <button key={i} onClick={() => { setFormAndDraft(f => ({...f, name})); setShowNameHelper(false); setNameSuggestions([]) }}
                            style={{ textAlign: 'left', padding: '8px 12px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: '13px', color: 'var(--foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p style={labelStyle}>Type of trip</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Bachelorette', 'Bachelor', 'Wedding', 'Birthday', 'Friend group', 'Family reunion', 'Corporate', 'Honeymoon', 'Other'].map(type => (
                    <button
                      key={type}
                      onClick={() => setTripType(type)}
                      style={{
                        padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
                        border: `1px solid ${tripType === type ? '#1a3a2a' : '#d4d4c8'}`,
                        background: tripType === type ? '#e8f5ee' : 'transparent',
                        color: tripType === type ? '#1a3a2a' : '#6a6a6a',
                        borderRadius: '24px', fontFamily: 'var(--font-cormorant), Georgia, serif',
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {showErrors && !tripType && <p style={{ fontSize: '11px', color: '#c0392b', margin: '8px 0 0' }}>Please choose a trip type</p>}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '0.5px solid #e4e4d8' }}>
                  <div>
                    <p style={{ fontSize: '14px', color: '#1a1a1a', margin: '0 0 2px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Centered around an event?</p>
                    <p style={{ fontSize: '12px', color: '#9a9a8a', margin: 0 }}>e.g. a wedding, concert, conference</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEventCentered(!isEventCentered)}
                    style={{
                      width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      background: isEventCentered ? '#1a3a2a' : '#d4d4c8', position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: '3px',
                      left: isEventCentered ? '23px' : '3px', transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
                {isEventCentered && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px' }}>
                    <div>
                      <label style={labelStyle}>Event name</label>
                      <input style={inputStyle} value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Sarah's Wedding" />
                    </div>
                    <div>
                      <label style={labelStyle}>Event date</label>
                      <input type="date" style={inputStyle} value={eventDate} onChange={e => setEventDate(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Event location</label>
                      <input style={inputStyle} value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder="City, venue, or address" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Trip cover image <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>(optional)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <label style={{ flex: 1, border: '1px solid var(--border)', padding: '10px 14px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      Upload from device
                      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (ev) => setFormAndDraft(f => ({...f, cover_image: ev.target?.result as string}))
                        reader.readAsDataURL(file)
                      }} />
                    </label>
                    <label style={{ flex: 1, border: '1px solid var(--border)', padding: '10px 14px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
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
                style={{ width: '100%', border: '1px solid var(--foreground)', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--foreground)', background: 'transparent', cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.4 : 1, ...s }}>
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
