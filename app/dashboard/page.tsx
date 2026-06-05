'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../components/AvantiLogo'
import SuitcaseLoader from '../components/SuitcaseLoader'

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
}

function getTripImage(destination: string) {
  const d = destination.toLowerCase()
  for (const key of Object.keys(DESTINATION_IMAGES)) {
    if (d.includes(key)) return DESTINATION_IMAGES[key]
  }
  return DESTINATION_IMAGES.default
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [trips, setTrips] = useState<any[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNewTrip, setShowNewTrip] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTrip, setNewTrip] = useState({ name: '', destination: '', start_date: '', end_date: '', trip_type: 'vacation' })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: prof } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
      if (!prof?.profile_complete) { router.push('/profile'); return }
      setProfile(prof)
      const { data: tripData } = await supabase.from('trips').select('*').order('created_at', { ascending: false })
      setTrips(tripData || [])
      setLoading(false)
    }
    load()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: trip, error } = await supabase.from('trips').insert({ ...newTrip, organizer_id: user?.id }).select().single()
    if (error || !trip) { setCreating(false); return }
    await supabase.from('travelers').insert({ trip_id: trip.id, full_name: profile.full_name, email: profile.email, profile_complete: true })
    router.push(`/trip/${trip.id}/dashboard`)
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) return <SuitcaseLoader message="Welcome back" />

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>

        <div style={{ flex: 1, padding: '48px 40px', maxWidth: sidebarOpen ? 'calc(100% - 320px)' : '100%', transition: 'max-width 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
            <AvantiLogo size="sm" />
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a' }}>
              {sidebarOpen ? 'Close ×' : `${firstName} ☰`}
            </button>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <p style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a8a', marginBottom: '8px' }}>{greeting}</p>
            <h1 style={{ fontSize: '48px', fontWeight: 300, color: '#1a1a1a', letterSpacing: '-0.01em', lineHeight: 1.1 }}>{firstName}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a' }}>My trips</p>
            <button onClick={() => router.push('/create')}
              style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1a1a1a', background: 'none', border: '1px solid #1a1a1a', padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              + New trip
            </button>
          </div>

          {trips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontSize: '14px', color: '#9a9a8a', marginBottom: '8px' }}>No trips yet.</p>
              <p style={{ fontSize: '12px', color: '#b4b4a8' }}>Create your first trip and Avanti handles the rest.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {trips.map(trip => (
                <div key={trip.id} onClick={() => router.push(`/trip/${trip.id}/dashboard`)}
                  style={{ position: 'relative', height: '200px', cursor: 'pointer', overflow: 'hidden', borderRadius: '2px' }}>
                  <img src={getTripImage(trip.destination)} alt={trip.destination}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
                    onMouseEnter={e => (e.target as HTMLImageElement).style.transform = 'scale(1.05)'}
                    onMouseLeave={e => (e.target as HTMLImageElement).style.transform = 'scale(1)'} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px' }}>
                    <p style={{ fontSize: '18px', fontWeight: 400, color: '#ffffff', margin: '0 0 4px', letterSpacing: '0.02em' }}>{trip.name}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{trip.destination}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0', letterSpacing: '0.05em' }}>{trip.start_date} → {trip.end_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {sidebarOpen && (
          <div style={{ width: '320px', background: '#f0f0e8', borderLeft: '1px solid #e4e4d8', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ marginBottom: '32px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', marginBottom: '4px' }}>Signed in as</p>
              <p style={{ fontSize: '15px', color: '#1a1a1a' }}>{profile?.full_name}</p>
              <p style={{ fontSize: '12px', color: '#9a9a8a' }}>{profile?.email}</p>
            </div>
            {[
              { label: 'My profile', path: '/profile' },
              { label: 'Travel documents', path: '/profile' },
              { label: 'Wallet', path: '/wallet' },
              { label: 'Settings', path: '/settings' },
            ].map(item => (
              <button key={item.label} onClick={() => router.push(item.path)}
                style={{ textAlign: 'left', padding: '14px 0', fontSize: '13px', letterSpacing: '0.1em', color: '#1a1a1a', background: 'none', border: 'none', borderBottom: '1px solid #e4e4d8', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                {item.label}
              </button>
            ))}
            <button onClick={handleSignOut}
              style={{ textAlign: 'left', padding: '14px 0', fontSize: '13px', letterSpacing: '0.1em', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', marginTop: '16px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Sign out
            </button>
          </div>
        )}
      </div>

      {showNewTrip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fafaf8', padding: '48px', width: '100%', maxWidth: '480px', margin: '24px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', marginBottom: '32px' }}>New trip</p>
            <form onSubmit={handleCreateTrip} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { label: 'Trip name', key: 'name', placeholder: 'Mama Mia Summer' },
                { label: 'Destination', key: 'destination', placeholder: 'Mykonos + Paros, Greece' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', display: 'block', marginBottom: '6px' }}>{f.label}</label>
                  <input required value={(newTrip as any)[f.key]} onChange={e => setNewTrip({...newTrip, [f.key]: e.target.value})} placeholder={f.placeholder}
                    style={{ width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '15px', color: '#1a1a1a', outline: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif' }} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[{ label: 'Start date', key: 'start_date' }, { label: 'End date', key: 'end_date' }].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', display: 'block', marginBottom: '6px' }}>{f.label}</label>
                    <input type="date" required value={(newTrip as any)[f.key]} onChange={e => setNewTrip({...newTrip, [f.key]: e.target.value})}
                      style={{ width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '14px', color: '#1a1a1a', outline: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowNewTrip(false)}
                  style={{ flex: 1, border: '1px solid #d4d4c8', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  style={{ flex: 1, border: '1px solid #1a1a1a', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1a1a1a', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif', opacity: creating ? 0.5 : 1 }}>
                  {creating ? 'Creating...' : 'Create trip →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
